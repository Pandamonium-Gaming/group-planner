'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FreeholdWithBuildings,
  FreeholdBuilding,
  FreeholdSize,
  FreeholdBuildingType,
} from '@/lib/types';

export interface FreeholdData {
  name: string;
  node_name?: string;
  region?: string;
  coordinates?: string;
  size: FreeholdSize;
  is_public?: boolean;
  description?: string;
}

export interface BuildingData {
  building_type: FreeholdBuildingType;
  building_name?: string;
  tier?: number;
  profession_id?: string;
  is_guild_accessible?: boolean;
  usage_fee?: number;
}

interface UseFreeholdsReturn {
  freeholds: FreeholdWithBuildings[];
  myFreehold: FreeholdWithBuildings | null;
  loading: boolean;
  error: string | null;
  createFreehold: (data: FreeholdData) => Promise<void>;
  updateFreehold: (id: string, data: Partial<FreeholdData>) => Promise<void>;
  deleteFreehold: (id: string) => Promise<void>;
  addBuilding: (freeholdId: string, data: BuildingData) => Promise<void>;
  updateBuilding: (buildingId: string, data: Partial<BuildingData>) => Promise<void>;
  removeBuilding: (buildingId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFreeholds(groupId: string | null): UseFreeholdsReturn {
  const [freeholds, setFreeholds] = useState<FreeholdWithBuildings[]>([]);
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
      const { data, error: fetchError } = await supabase
        .from('freeholds')
        .select(`
          *,
          freehold_buildings (*),
          users:owner_id (display_name),
          members:owner_character_id (name)
        `)
        .eq('group_id', groupId)
        .order('name');

      if (fetchError) throw fetchError;

      const transformed = (data || []).map((f) => ({
        ...f,
        buildings: f.freehold_buildings || [],
        owner: f.users,
        owner_character: f.members,
      })) as FreeholdWithBuildings[];

      setFreeholds(transformed);
    } catch (err) {
      console.error('Error fetching freeholds:', err);
      setError(err instanceof Error ? err.message : 'Failed to load freeholds');
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

  const myFreehold = freeholds.find((f) => {
    // Check if current user owns this freehold - would need auth context
    return false; // Placeholder - implement with auth
  }) || null;

  const createFreehold = async (data: FreeholdData) => {
    if (!groupId) throw new Error('No clan selected');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: insertError } = await supabase
      .from('freeholds')
      .insert({
        group_id: groupId,
        owner_id: user.id,
        ...data,
      });

    if (insertError) throw insertError;
    await fetchData();
  };

  const updateFreehold = async (id: string, data: Partial<FreeholdData>) => {
    const { error: updateError } = await supabase
      .from('freeholds')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchData();
  };

  const deleteFreehold = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('freeholds')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchData();
  };

  const addBuilding = async (freeholdId: string, data: BuildingData) => {
    const { error: insertError } = await supabase
      .from('freehold_buildings')
      .insert({
        freehold_id: freeholdId,
        ...data,
      });

    if (insertError) throw insertError;
    await fetchData();
  };

  const updateBuilding = async (buildingId: string, data: Partial<BuildingData>) => {
    const { error: updateError } = await supabase
      .from('freehold_buildings')
      .update(data)
      .eq('id', buildingId);

    if (updateError) throw updateError;
    await fetchData();
  };

  const removeBuilding = async (buildingId: string) => {
    const { error: deleteError } = await supabase
      .from('freehold_buildings')
      .delete()
      .eq('id', buildingId);

    if (deleteError) throw deleteError;
    await fetchData();
  };

  return {
    freeholds,
    myFreehold,
    loading,
    error,
    createFreehold,
    updateFreehold,
    deleteFreehold,
    addBuilding,
    updateBuilding,
    removeBuilding,
    refresh: fetchData,
  };
}

