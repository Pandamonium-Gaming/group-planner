'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  SiegeEvent, 
  SiegeRoster, 
  SiegeRosterWithCharacter, 
  SiegeEventWithRoster,
  SiegeType, 
  SiegeRole, 
  RosterStatus 
} from '@/lib/types';

// Data for creating/updating siege events
export interface SiegeEventData {
  title: string;
  description?: string;
  siege_type: SiegeType;
  target_name: string;
  starts_at: string;
  declaration_ends_at?: string;
  max_participants?: number;
  frontline_needed?: number;
  ranged_needed?: number;
  healer_needed?: number;
  siege_operator_needed?: number;
  scout_needed?: number;
  reserve_needed?: number;
}

// Data for roster signup
export interface RosterSignupData {
  character_id: string;
  role: SiegeRole;
  note?: string;
}

interface UseSiegeEventsReturn {
  sieges: SiegeEventWithRoster[];
  upcomingSieges: SiegeEventWithRoster[];
  loading: boolean;
  error: string | null;
  // Event actions
  createSiege: (data: SiegeEventData) => Promise<SiegeEvent>;
  updateSiege: (id: string, data: Partial<SiegeEventData>) => Promise<void>;
  cancelSiege: (id: string) => Promise<void>;
  setSiegeResult: (id: string, result: 'victory' | 'defeat' | 'draw') => Promise<void>;
  // Roster actions
  signUp: (siegeId: string, data: RosterSignupData) => Promise<void>;
  withdraw: (siegeId: string, characterId: string) => Promise<void>;
  updateRosterStatus: (rosterId: string, status: RosterStatus) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSiegeEvents(groupId: string | null): UseSiegeEventsReturn {
  const [sieges, setSieges] = useState<SiegeEventWithRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all siege events with rosters
  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch siege events
      const { data: siegeData, error: siegeError } = await supabase
        .from('siege_events')
        .select(`
          *,
          siege_roster (
            *,
            members (
              id, name, race, primary_archetype, secondary_archetype, level, is_main
            )
          )
        `)
        .eq('group_id', groupId)
        .order('starts_at', { ascending: true });

      if (siegeError) throw siegeError;

      // Transform data
      const transformedSieges: SiegeEventWithRoster[] = (siegeData || []).map((siege) => ({
        id: siege.id,
        group_id: siege.clan_id,
        title: siege.title,
        description: siege.description,
        siege_type: siege.siege_type as SiegeType,
        target_name: siege.target_name,
        starts_at: siege.starts_at,
        declaration_ends_at: siege.declaration_ends_at,
        max_participants: siege.max_participants,
        frontline_needed: siege.frontline_needed,
        ranged_needed: siege.ranged_needed,
        healer_needed: siege.healer_needed,
        siege_operator_needed: siege.siege_operator_needed,
        scout_needed: siege.scout_needed,
        reserve_needed: siege.reserve_needed,
        is_cancelled: siege.is_cancelled,
        result: siege.result,
        created_by: siege.created_by,
        created_at: siege.created_at,
        updated_at: siege.updated_at,
        roster: (siege.siege_roster || []).map((r: SiegeRoster & { members?: Record<string, unknown> }) => ({
          id: r.id,
          siege_id: r.siege_id,
          character_id: r.character_id,
          user_id: r.user_id,
          role: r.role as SiegeRole,
          is_leader: r.is_leader,
          priority: r.priority,
          status: r.status as RosterStatus,
          signed_up_at: r.signed_up_at,
          confirmed_at: r.confirmed_at,
          checked_in_at: r.checked_in_at,
          note: r.note,
          character: r.members ? {
            id: r.members.id as string,
            name: r.members.name as string,
            race: r.members.race,
            primary_archetype: r.members.primary_archetype,
            secondary_archetype: r.members.secondary_archetype,
            level: r.members.level,
            is_main: r.members.is_main,
            professions: [],
          } : undefined,
        })),
      }));

      setSieges(transformedSieges);
    } catch (err) {
      console.error('Error fetching siege events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sieges');
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

  // Create siege event
  const createSiege = async (data: SiegeEventData): Promise<SiegeEvent> => {
    if (!groupId) throw new Error('No clan selected');

    const { data: newSiege, error: createError } = await supabase
      .from('siege_events')
      .insert({
        group_id: groupId,
        ...data,
      })
      .select()
      .single();

    if (createError) throw createError;

    await fetchData();
    return newSiege as SiegeEvent;
  };

  // Update siege event
  const updateSiege = async (id: string, data: Partial<SiegeEventData>) => {
    const { error: updateError } = await supabase
      .from('siege_events')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Cancel siege
  const cancelSiege = async (id: string) => {
    const { error: updateError } = await supabase
      .from('siege_events')
      .update({ is_cancelled: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Set siege result
  const setSiegeResult = async (id: string, result: 'victory' | 'defeat' | 'draw') => {
    const { error: updateError } = await supabase
      .from('siege_events')
      .update({ result, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Sign up for siege
  const signUp = async (siegeId: string, data: RosterSignupData) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: signupError } = await supabase
      .from('siege_roster')
      .upsert({
        siege_id: siegeId,
        character_id: data.character_id,
        user_id: user?.id,
        role: data.role,
        note: data.note,
      }, { onConflict: 'siege_id,character_id' });

    if (signupError) throw signupError;

    await fetchData();
  };

  // Withdraw from siege
  const withdraw = async (siegeId: string, characterId: string) => {
    const { error: deleteError } = await supabase
      .from('siege_roster')
      .delete()
      .eq('siege_id', siegeId)
      .eq('character_id', characterId);

    if (deleteError) throw deleteError;

    await fetchData();
  };

  // Update roster status
  const updateRosterStatus = async (rosterId: string, status: RosterStatus) => {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
    } else if (status === 'checked_in') {
      updates.checked_in_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('siege_roster')
      .update(updates)
      .eq('id', rosterId);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Filter upcoming sieges
  const upcomingSieges = sieges.filter((s) => {
    const startsAt = new Date(s.starts_at);
    return startsAt > new Date() && !s.is_cancelled;
  });

  return {
    sieges,
    upcomingSieges,
    loading,
    error,
    createSiege,
    updateSiege,
    cancelSiege,
    setSiegeResult,
    signUp,
    withdraw,
    updateRosterStatus,
    refresh: fetchData,
  };
}

