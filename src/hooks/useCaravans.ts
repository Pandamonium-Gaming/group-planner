'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CaravanEventWithDetails,
  CaravanType,
  CaravanStatus,
} from '@/lib/types';

export interface CaravanData {
  title: string;
  description?: string;
  caravan_type: CaravanType;
  origin_node: string;
  destination_node: string;
  departure_at: string;
  estimated_arrival_at?: string;
  cargo_description?: string;
  cargo_value?: number;
  min_escorts?: number;
  max_escorts?: number;
  escort_reward_gold?: number;
  escort_reward_dkp?: number;
}

export interface WaypointData {
  order_index: number;
  location_name: string;
  notes?: string;
  is_danger_zone?: boolean;
  estimated_time_minutes?: number;
}

interface UseCaravansReturn {
  caravans: CaravanEventWithDetails[];
  upcomingCaravans: CaravanEventWithDetails[];
  loading: boolean;
  error: string | null;
  createCaravan: (data: CaravanData) => Promise<string>;
  updateCaravan: (id: string, data: Partial<CaravanData>) => Promise<void>;
  updateStatus: (id: string, status: CaravanStatus) => Promise<void>;
  cancelCaravan: (id: string) => Promise<void>;
  signUpAsEscort: (caravanId: string, characterId: string, role?: string) => Promise<void>;
  withdrawEscort: (caravanId: string, characterId: string) => Promise<void>;
  confirmEscort: (escortId: string) => Promise<void>;
  addWaypoint: (caravanId: string, data: WaypointData) => Promise<void>;
  removeWaypoint: (waypointId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCaravans(groupId: string | null): UseCaravansReturn {
  const [caravans, setCaravans] = useState<CaravanEventWithDetails[]>([]);
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
        .from('caravan_events')
        .select(`
          *,
          caravan_escorts (
            *,
            members:character_id (name)
          ),
          caravan_waypoints (*)
        `)
        .eq('group_id', groupId)
        .order('departure_at', { ascending: true });

      if (fetchError) throw fetchError;

      const transformed = (data || []).map((c) => ({
        ...c,
        escorts: (c.caravan_escorts || []).map((e: Record<string, unknown>) => ({
          ...e,
          character: e.members,
        })),
        waypoints: (c.caravan_waypoints || []).sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index),
      })) as CaravanEventWithDetails[];

      setCaravans(transformed);
    } catch (err) {
      console.error('Error fetching caravans:', err);
      setError(err instanceof Error ? err.message : 'Failed to load caravans');
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

  const now = new Date();
  const upcomingCaravans = caravans.filter((c) => 
    new Date(c.departure_at) > now && 
    !['completed', 'failed', 'cancelled'].includes(c.status)
  );

  const createCaravan = async (data: CaravanData): Promise<string> => {
    if (!groupId) throw new Error('No clan selected');

    const { data: { user } } = await supabase.auth.getUser();
    
    // Destructure escortRequirements (not a DB column) from data to prevent insert error
    const { escortRequirements, ...caravanData } = data as CaravanData & { escortRequirements?: unknown };

    const { data: newCaravan, error: insertError } = await supabase
      .from('caravan_events')
      .insert({
        group_id: groupId,
        created_by: user?.id,
        ...caravanData,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return newCaravan.id;
  };

  const updateCaravan = async (id: string, data: Partial<CaravanData>) => {
    const { error: updateError } = await supabase
      .from('caravan_events')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchData();
  };

  const updateStatus = async (id: string, status: CaravanStatus) => {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('caravan_events')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchData();
  };

  const cancelCaravan = async (id: string) => {
    await updateStatus(id, 'cancelled');
  };

  const signUpAsEscort = async (caravanId: string, characterId: string, role = 'escort') => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from('caravan_escorts')
      .insert({
        caravan_id: caravanId,
        character_id: characterId,
        user_id: user?.id,
        role,
      });

    if (insertError) throw insertError;
    await fetchData();
  };

  const withdrawEscort = async (caravanId: string, characterId: string) => {
    const { error: deleteError } = await supabase
      .from('caravan_escorts')
      .delete()
      .eq('caravan_id', caravanId)
      .eq('character_id', characterId);

    if (deleteError) throw deleteError;
    await fetchData();
  };

  const confirmEscort = async (escortId: string) => {
    const { error: updateError } = await supabase
      .from('caravan_escorts')
      .update({ confirmed: true })
      .eq('id', escortId);

    if (updateError) throw updateError;
    await fetchData();
  };

  const addWaypoint = async (caravanId: string, data: WaypointData) => {
    const { error: insertError } = await supabase
      .from('caravan_waypoints')
      .insert({
        caravan_id: caravanId,
        ...data,
      });

    if (insertError) throw insertError;
    await fetchData();
  };

  const removeWaypoint = async (waypointId: string) => {
    const { error: deleteError } = await supabase
      .from('caravan_waypoints')
      .delete()
      .eq('id', waypointId);

    if (deleteError) throw deleteError;
    await fetchData();
  };

  return {
    caravans,
    upcomingCaravans,
    loading,
    error,
    createCaravan,
    updateCaravan,
    updateStatus,
    cancelCaravan,
    signUpAsEscort,
    withdrawEscort,
    confirmEscort,
    addWaypoint,
    removeWaypoint,
    refresh: fetchData,
  };
}

