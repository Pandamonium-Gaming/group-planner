'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LootSystem,
  LootSystemType,
  DKPPoints,
  DKPPointsWithCharacter,
  LootHistory,
  LootHistoryWithDetails,
  DKPTransaction,
  ItemRarity,
} from '@/lib/types';

// Data for creating/updating loot system
export interface LootSystemData {
  name: string;
  system_type: LootSystemType;
  description?: string;
  starting_points?: number;
  decay_enabled?: boolean;
  decay_rate?: number;
  decay_minimum?: number;
  raid_attendance_points?: number;
  siege_attendance_points?: number;
  boss_kill_points?: number;
}

// Data for recording loot
export interface LootRecordData {
  item_name: string;
  item_rarity: ItemRarity;
  item_slot?: string;
  item_description?: string;
  source_type?: string;
  source_name?: string;
  siege_id?: string;
  awarded_to?: string;
  dkp_cost?: number;
  notes?: string;
}

// Data for adding/removing DKP
export interface DKPAdjustmentData {
  character_id: string;
  amount: number;
  reason: string;
}

interface UseLootSystemReturn {
  lootSystem: LootSystem | null;
  leaderboard: DKPPointsWithCharacter[];
  lootHistory: LootHistoryWithDetails[];
  loading: boolean;
  error: string | null;
  // System management
  createSystem: (data: LootSystemData) => Promise<LootSystem>;
  updateSystem: (data: Partial<LootSystemData>) => Promise<void>;
  // DKP management
  awardPoints: (data: DKPAdjustmentData) => Promise<void>;
  deductPoints: (data: DKPAdjustmentData) => Promise<void>;
  awardBulkPoints: (characterIds: string[], amount: number, reason: string) => Promise<void>;
  // Loot recording
  recordLoot: (data: LootRecordData) => Promise<void>;
  distributeLoot: (lootId: string, characterId: string, dkpCost: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLootSystem(groupId: string | null): UseLootSystemReturn {
  const [lootSystem, setLootSystem] = useState<LootSystem | null>(null);
  const [leaderboard, setLeaderboard] = useState<DKPPointsWithCharacter[]>([]);
  const [lootHistory, setLootHistory] = useState<LootHistoryWithDetails[]>([]);
  const [loading, setLoading] = useState(() => groupId !== null);
  const [error, setError] = useState<string | null>(null);

  // Fetch loot system and data
  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch active loot system for clan
      const { data: systemData, error: systemError } = await supabase
        .from('loot_systems')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .maybeSingle();

      if (systemError) throw systemError;

      if (!systemData) {
        setLootSystem(null);
        setLeaderboard([]);
        setLootHistory([]);
        setLoading(false);
        return;
      }

      setLootSystem(systemData as LootSystem);

      // Fetch DKP leaderboard
      const { data: pointsData, error: pointsError } = await supabase
        .from('dkp_points')
        .select(`
          *,
          members (
            id, name, race, primary_archetype, level, is_main
          )
        `)
        .eq('loot_system_id', systemData.id)
        .order('current_points', { ascending: false });

      if (pointsError) throw pointsError;

      const transformedLeaderboard: DKPPointsWithCharacter[] = (pointsData || []).map((p, idx) => ({
        id: p.id,
        loot_system_id: p.loot_system_id,
        character_id: p.character_id,
        current_points: p.current_points,
        earned_total: p.earned_total,
        spent_total: p.spent_total,
        priority_ratio: p.priority_ratio,
        last_earned_at: p.last_earned_at,
        last_spent_at: p.last_spent_at,
        last_decay_at: p.last_decay_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
        character: p.members ? {
          id: p.members.id,
          name: p.members.name,
          race: p.members.race,
          primary_archetype: p.members.primary_archetype,
          level: p.members.level,
          is_main: p.members.is_main,
          professions: [],
          group_id: groupId,
          user_id: null,
          secondary_archetype: null,
          created_at: '',
        } : undefined,
        rank: idx + 1,
      }));

      setLeaderboard(transformedLeaderboard);

      // Fetch recent loot history
      const { data: historyData, error: historyError } = await supabase
        .from('loot_history')
        .select(`
          *,
          members:awarded_to (
            id, name
          ),
          users:awarded_by (
            display_name
          )
        `)
        .eq('loot_system_id', systemData.id)
        .order('dropped_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;

      const transformedHistory: LootHistoryWithDetails[] = (historyData || []).map((h) => ({
        id: h.id,
        loot_system_id: h.loot_system_id,
        item_name: h.item_name,
        item_rarity: h.item_rarity as ItemRarity,
        item_slot: h.item_slot,
        item_description: h.item_description,
        source_type: h.source_type,
        source_name: h.source_name,
        event_id: h.event_id,
        siege_id: h.siege_id,
        awarded_to: h.awarded_to,
        awarded_by: h.awarded_by,
        dkp_cost: h.dkp_cost,
        votes_for: h.votes_for,
        votes_against: h.votes_against,
        dropped_at: h.dropped_at,
        distributed_at: h.distributed_at,
        notes: h.notes,
        awarded_to_character: h.members ? {
          ...h.members,
          professions: [],
        } : undefined,
        awarded_by_user: h.users,
      }));

      setLootHistory(transformedHistory);
    } catch (err) {
      console.error('Error fetching loot system:', err);
      setError(err instanceof Error ? err.message : 'Failed to load loot system');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Initial fetch
  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchData]);

  // Create loot system
  const createSystem = async (data: LootSystemData): Promise<LootSystem> => {
    if (!groupId) throw new Error('No clan selected');

    const { data: newSystem, error: createError } = await supabase
      .from('loot_systems')
      .insert({
        group_id: groupId,
        ...data,
        is_active: true,
      })
      .select()
      .single();

    if (createError) throw createError;

    await fetchData();
    return newSystem as LootSystem;
  };

  // Update loot system
  const updateSystem = async (data: Partial<LootSystemData>) => {
    if (!lootSystem) throw new Error('No loot system configured');

    const { error: updateError } = await supabase
      .from('loot_systems')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', lootSystem.id);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Award points to a character
  const awardPoints = async (data: DKPAdjustmentData) => {
    if (!lootSystem) throw new Error('No loot system configured');

    // Upsert DKP points
    const { data: existing } = await supabase
      .from('dkp_points')
      .select('id, current_points, earned_total')
      .eq('loot_system_id', lootSystem.id)
      .eq('character_id', data.character_id)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('dkp_points')
        .update({
          current_points: existing.current_points + data.amount,
          earned_total: existing.earned_total + data.amount,
          last_earned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;

      // Record transaction
      await supabase.from('dkp_transactions').insert({
        dkp_points_id: existing.id,
        amount: data.amount,
        reason: data.reason,
      });
    } else {
      // Create new
      const { data: newPoints, error: insertError } = await supabase
        .from('dkp_points')
        .insert({
          loot_system_id: lootSystem.id,
          character_id: data.character_id,
          current_points: lootSystem.starting_points + data.amount,
          earned_total: data.amount,
          last_earned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Record transaction
      await supabase.from('dkp_transactions').insert({
        dkp_points_id: newPoints.id,
        amount: data.amount,
        reason: data.reason,
      });
    }

    await fetchData();
  };

  // Deduct points from a character
  const deductPoints = async (data: DKPAdjustmentData) => {
    if (!lootSystem) throw new Error('No loot system configured');

    const { data: existing } = await supabase
      .from('dkp_points')
      .select('id, current_points, spent_total')
      .eq('loot_system_id', lootSystem.id)
      .eq('character_id', data.character_id)
      .single();

    if (!existing) throw new Error('Character has no DKP record');

    const { error: updateError } = await supabase
      .from('dkp_points')
      .update({
        current_points: Math.max(0, existing.current_points - data.amount),
        spent_total: existing.spent_total + data.amount,
        last_spent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // Record transaction (negative amount)
    await supabase.from('dkp_transactions').insert({
      dkp_points_id: existing.id,
      amount: -data.amount,
      reason: data.reason,
    });

    await fetchData();
  };

  // Award points to multiple characters
  const awardBulkPoints = async (characterIds: string[], amount: number, reason: string) => {
    for (const characterId of characterIds) {
      await awardPoints({ character_id: characterId, amount, reason });
    }
  };

  // Record a loot drop
  const recordLoot = async (data: LootRecordData) => {
    if (!lootSystem) throw new Error('No loot system configured');

    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from('loot_history')
      .insert({
        loot_system_id: lootSystem.id,
        ...data,
        awarded_by: user?.id,
        distributed_at: data.awarded_to ? new Date().toISOString() : null,
      });

    if (insertError) throw insertError;

    // If awarded and has DKP cost, deduct points
    if (data.awarded_to && data.dkp_cost && data.dkp_cost > 0) {
      await deductPoints({
        character_id: data.awarded_to,
        amount: data.dkp_cost,
        reason: `Loot: ${data.item_name}`,
      });
    }

    await fetchData();
  };

  // Distribute existing loot to a character
  const distributeLoot = async (lootId: string, characterId: string, dkpCost: number) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: loot, error: fetchError } = await supabase
      .from('loot_history')
      .select('item_name')
      .eq('id', lootId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('loot_history')
      .update({
        awarded_to: characterId,
        awarded_by: user?.id,
        dkp_cost: dkpCost,
        distributed_at: new Date().toISOString(),
      })
      .eq('id', lootId);

    if (updateError) throw updateError;

    // Deduct DKP if cost > 0
    if (dkpCost > 0) {
      await deductPoints({
        character_id: characterId,
        amount: dkpCost,
        reason: `Loot: ${loot.item_name}`,
      });
    }

    await fetchData();
  };

  return {
    lootSystem,
    leaderboard,
    lootHistory,
    loading,
    error,
    createSystem,
    updateSystem,
    awardPoints,
    deductPoints,
    awardBulkPoints,
    recordLoot,
    distributeLoot,
    refresh: fetchData,
  };
}

