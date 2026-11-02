'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ClanAchievementWithDefinition,
  AchievementDefinition,
  AchievementCategory,
} from '@/lib/types';

interface UseAchievementsReturn {
  achievements: ClanAchievementWithDefinition[];
  definitions: AchievementDefinition[];
  unlockedCount: number;
  totalPoints: number;
  loading: boolean;
  error: string | null;
  getByCategory: (category: AchievementCategory) => ClanAchievementWithDefinition[];
  updateProgress: (achievementId: string, value: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAchievements(groupId: string | null): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<ClanAchievementWithDefinition[]>([]);
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [loading, setLoading] = useState(() => groupId !== null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all definitions
      const { data: defs, error: defsError } = await supabase
        .from('achievement_definitions')
        .select('*')
        .order('sort_order');

      if (defsError) throw defsError;
      setDefinitions((defs || []) as AchievementDefinition[]);

      // Fetch clan achievements
      const { data: clanAchievements, error: achieveError } = await supabase
        .from('group_achievements')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at');

      if (achieveError) {
        console.error('Error fetching clan achievements:', achieveError);
        throw achieveError;
      }

      // Merge with definitions for complete list
      const achievementMap = new Map(
        (clanAchievements || []).map((a) => [a.achievement_id, a])
      );

      const merged = (defs || []).map((def) => {
        const existing = achievementMap.get(def.id);
        if (existing) {
          return {
            ...existing,
            definition: def,
          } as ClanAchievementWithDefinition;
        }
        return {
          id: `pending-${def.id}`,
          group_id: groupId,
          achievement_id: def.id,
          current_value: 0,
          is_unlocked: false,
          created_at: '',
          updated_at: '',
          definition: def,
        } as ClanAchievementWithDefinition;
      });

      setAchievements(merged);
    } catch (err) {
      console.error('Error fetching achievements:', err);
      setError(err instanceof Error ? err.message : 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchData]);

  const unlockedCount = achievements.filter((a) => a.is_unlocked).length;
  const totalPoints = achievements
    .filter((a) => a.is_unlocked)
    .reduce((sum, a) => sum + a.definition.points, 0);

  const getByCategory = (category: AchievementCategory) => {
    return achievements.filter((a) => a.definition.category === category);
  };

  const updateProgress = async (achievementId: string, value: number) => {
    if (!groupId) throw new Error('No clan selected');

    const def = definitions.find((d) => d.id === achievementId);
    if (!def) throw new Error('Achievement not found');

    const isUnlocked = value >= def.requirement_value;
    const { data: { user } } = await supabase.auth.getUser();

    const { error: upsertError } = await supabase
      .from('group_achievements')
      .upsert({
        group_id: groupId,
        achievement_id: achievementId,
        current_value: value,
        is_unlocked: isUnlocked,
        unlocked_at: isUnlocked ? new Date().toISOString() : null,
        first_contributor_id: isUnlocked ? user?.id : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'group_id,achievement_id',
      });

    if (upsertError) throw upsertError;
    await fetchData();
  };

  return {
    achievements,
    definitions,
    unlockedCount,
    totalPoints,
    loading,
    error,
    getByCategory,
    updateProgress,
    refresh: fetchData,
  };
}

