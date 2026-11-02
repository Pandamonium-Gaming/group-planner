'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { NodeCitizenship, NodeDistribution, NodeType, NodeStage } from '@/lib/types';

// Data for creating/updating citizenship
export interface CitizenshipData {
  node_name: string;
  node_type: NodeType;
  node_stage: NodeStage;
  region?: string;
  is_mayor?: boolean;
  is_council_member?: boolean;
}

interface UseNodeCitizenshipsReturn {
  citizenships: NodeCitizenship[];
  distribution: NodeDistribution[];
  loading: boolean;
  error: string | null;
  // Actions
  setCitizenship: (characterId: string, data: CitizenshipData) => Promise<void>;
  removeCitizenship: (characterId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNodeCitizenships(groupId: string | null): UseNodeCitizenshipsReturn {
  const [citizenships, setCitizenships] = useState<NodeCitizenship[]>([]);
  const [distribution, setDistribution] = useState<NodeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all citizenships for clan members
  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch citizenships for all characters in this clan
      const { data: citizenshipData, error: citizenshipError } = await supabase
        .from('node_citizenships')
        .select(`
          *,
          members!inner (
            clan_id
          )
        `)
        .eq('members.clan_id', groupId);

      if (citizenshipError) throw citizenshipError;

      // Map to clean format
      const cleanCitizenships: NodeCitizenship[] = (citizenshipData || []).map((c) => ({
        id: c.id,
        character_id: c.character_id,
        node_name: c.node_name,
        node_type: c.node_type as NodeType,
        node_stage: c.node_stage as NodeStage,
        region: c.region || undefined,
        is_mayor: c.is_mayor || false,
        is_council_member: c.is_council_member || false,
        became_citizen_at: c.became_citizen_at,
        updated_at: c.updated_at,
      }));

      setCitizenships(cleanCitizenships);

      // Calculate distribution from citizenships
      const distMap = new Map<string, NodeDistribution>();
      for (const c of cleanCitizenships) {
        const key = c.node_name;
        if (!distMap.has(key)) {
          distMap.set(key, {
            group_id: groupId,
            node_name: c.node_name,
            node_type: c.node_type,
            node_stage: c.node_stage,
            citizen_count: 0,
            has_mayor: false,
            citizen_names: [],
          });
        }
        const dist = distMap.get(key)!;
        dist.citizen_count++;
        if (c.is_mayor) dist.has_mayor = true;
      }

      setDistribution(Array.from(distMap.values()));
    } catch (err) {
      console.error('Error fetching node citizenships:', err);
      setError(err instanceof Error ? err.message : 'Failed to load citizenships');
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

  // Set or update citizenship for a character
  const setCitizenship = async (characterId: string, data: CitizenshipData) => {
    try {
      const { error: upsertError } = await supabase
        .from('node_citizenships')
        .upsert(
          {
            character_id: characterId,
            node_name: data.node_name,
            node_type: data.node_type,
            node_stage: data.node_stage,
            region: data.region || null,
            is_mayor: data.is_mayor || false,
            is_council_member: data.is_council_member || false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'character_id' }
        );

      if (upsertError) throw upsertError;

      await fetchData();
    } catch (err) {
      console.error('Error setting citizenship:', err);
      setError(err instanceof Error ? err.message : 'Failed to update citizenship');
      throw err;
    }
  };

  // Remove citizenship from a character
  const removeCitizenship = async (characterId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('node_citizenships')
        .delete()
        .eq('character_id', characterId);

      if (deleteError) throw deleteError;

      await fetchData();
    } catch (err) {
      console.error('Error removing citizenship:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove citizenship');
      throw err;
    }
  };

  return {
    citizenships,
    distribution,
    loading,
    error,
    setCitizenship,
    removeCitizenship,
    refresh: fetchData,
  };
}

