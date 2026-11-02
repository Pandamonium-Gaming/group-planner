'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Clan, CharacterWithProfessions, MemberProfession, RankLevel, Race, Archetype } from '@/lib/types';
import { canEditCharacter, canDeleteCharacter, canOfficerManageUser } from '@/lib/character-permissions';
import { GroupRole } from '@/lib/permissions';
import { syncSubscriberShips, updateSubscriberTier } from '@/lib/subscriberShips';
import { handleAsyncError } from '@/lib/errorHandling';
import { getClientAuthStack } from '@/lib/authStack';
import { getSession as getAuthSession } from '@/lib/auth';

// Character data for creating/updating
export interface CharacterData {
  name: string;
  race?: Race | null;
  primary_archetype?: Archetype | null;
  secondary_archetype?: Archetype | null;
  level?: number;
  is_main?: boolean;
  user_id?: string | null; // Allow setting user_id for ownership
  preferred_role?: string[] | null;
  rank?: string | null;
  ror_faction?: string | null;
  ror_class?: string | null;
  wow_race?: string | null;
  wow_faction?: 'Alliance' | 'Horde' | null;
  wow_class?: string | null;
  wow_main_spec?: string | null;
  wow_secondary_spec?: string | null;
  wow_profession_1?: string | null;
  wow_profession_2?: string | null;
  subscriber_tier?: 'centurion' | 'imperator' | null;
  subscriber_since?: string | null;
  subscriber_ships_month?: string | null;
}

interface UseGroupDataReturn {
  group: Clan | null;
  characters: CharacterWithProfessions[];
  loading: boolean;
  error: string | null;
  // Actions
  addCharacter: (data: CharacterData) => Promise<void>;
  updateCharacter: (id: string, data: Partial<CharacterData>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  setProfessionRank: (characterId: string, professionId: string, rank: RankLevel | null, level?: number, quality?: number) => Promise<void>;
  refresh: () => Promise<void>;
  // Legacy aliases
  members: CharacterWithProfessions[];
  addMember: (name: string) => Promise<void>;
  updateMember: (id: string, name: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

export function useGroupData(groupSlug: string, gameSlug?: string): UseGroupDataReturn {
  const [group, setGroup] = useState<Clan | null>(null);
  const [characters, setCharacters] = useState<CharacterWithProfessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  const callMembersApi = useCallback(
    async <T>(body: Record<string, unknown>, defaultError: string): Promise<T> => {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `${defaultError} (${response.status})`);
      }

      return (await response.json()) as T;
    },
    []
  );

  const resolveCurrentUserId = useCallback(async (): Promise<string | null> => {
    if (getClientAuthStack() === 'v2' && typeof fetch === 'function') {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          user?: { id?: string | null };
        };

        if (payload.authenticated && payload.user?.id) {
          return payload.user.id;
        }
      } catch (err) {
        console.error('[useGroupData] Failed to resolve user from v2 session:', err);
      }

      return null;
    }

    try {
      const session = await getAuthSession();
      return session?.user?.id ?? null;
    } catch (err) {
      console.error('[useGroupData] Failed to resolve user from v1 session:', err);
    }

    return null;
  }, []);

  const resolveCurrentGroupRole = useCallback(async (groupId: string, currentUserId: string): Promise<GroupRole> => {
    if (getClientAuthStack() === 'v2' && typeof fetch === 'function') {
      try {
        const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/permissions`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (response.ok) {
          const payload = (await response.json()) as { role?: GroupRole };
          return (payload.role || 'member') as GroupRole;
        }
      } catch (err) {
        console.error('[useGroupData] Failed to resolve v2 group role via API:', err);
      }

      return 'member';
    }

    const { data: membershipData } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .maybeSingle();

    return (membershipData?.role || 'member') as GroupRole;
  }, []);

  // Reset state when groupSlug or gameSlug changes (prevent stale data on route transition)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setGroup(null);
      setCharacters([]);
      setLoading(true);
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupSlug, gameSlug]);

  // Fetch clan (no longer auto-creates - that's handled by UI)
  const fetchClan = useCallback(async (): Promise<Clan | null> => {
    try {
      if (getClientAuthStack() === 'v2' && typeof fetch === 'function') {
        const response = await fetch(`/api/groups/by-slug?slug=${encodeURIComponent(groupSlug)}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (response.ok) {
          const payload = (await response.json()) as { group?: Clan | null };
          return payload.group || null;
        }

        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to load group (${response.status})`);
      }

      const { data: existingClan, error: fetchError } = await supabase
        .from('groups')
        .select('*')
        .eq('slug', groupSlug)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      return existingClan as Clan | null;
    } catch (err) {
      setError(handleAsyncError(err, 'Failed to load clan', { context: 'fetchClan', groupSlug }));
      return null;
    }
  }, [groupSlug]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const groupData = await fetchClan();
      if (!groupData) {
        setLoading(false);
        return;
      }

      setGroup(groupData);

      let charactersData: CharacterWithProfessions[] = [];

      if (canUseV2Api) {
        try {
          const response = await fetch(
            `/api/group/members?group_id=${encodeURIComponent(groupData.id)}&game_slug=${encodeURIComponent(gameSlug || 'aoc')}`,
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
          );

          if (response.ok) {
            const payload = (await response.json()) as { members?: CharacterWithProfessions[] };
            charactersData = payload.members || [];
          } else {
            throw new Error(`Failed to load members (${response.status})`);
          }
        } catch (apiError) {
          console.error('[useGroupData] Falling back to direct Supabase member query:', apiError);
          const { data, error: charactersError } = await supabase
            .from('members')
            .select(`
              *,
              member_professions (*)
            `)
            .eq('group_id', groupData.id)
            .eq('game_slug', gameSlug || 'aoc')
            .order('is_main', { ascending: false })
            .order('name');

          if (charactersError) throw charactersError;
          charactersData = (data || []) as CharacterWithProfessions[];
        }
      } else {
        // Fetch characters with their professions
        const { data, error: charactersError } = await supabase
          .from('members')
          .select(`
            *,
            member_professions (*)
          `)
          .eq('group_id', groupData.id)
          .eq('game_slug', gameSlug || 'aoc')
          .order('is_main', { ascending: false })
          .order('name');

        if (charactersError) throw charactersError;
        charactersData = (data || []) as CharacterWithProfessions[];
      }

      const charactersWithProfessions: CharacterWithProfessions[] = (charactersData || []).map((char) => ({
        ...char,
        professions:
          ('professions' in char
            ? char.professions
            : (char as { member_professions?: MemberProfession[] }).member_professions) || [],
        // Ensure defaults for new fields
        race: char.race || null,
        primary_archetype: char.primary_archetype || null,
        secondary_archetype: char.secondary_archetype || null,
        level: char.level || 1,
        is_main: char.is_main || false,
      }));

      setCharacters(charactersWithProfessions);
    } catch (err) {
      setError(handleAsyncError(err, 'Failed to load data', { context: 'fetchData', groupSlug }));
    } finally {
      setLoading(false);
    }
  }, [canUseV2Api, fetchClan]);

  // Initial fetch
  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchData]);

  // Add character with full data
  const addCharacter = async (data: CharacterData) => {
    if (!group) return;

    const currentUserId = await resolveCurrentUserId();
    const targetGameSlug = gameSlug || 'aoc';
    const targetUserId = data.user_id !== undefined ? data.user_id : (currentUserId || null);
    let insertedData: Array<{ id: string }> | null = null;

    if (canUseV2Api) {
      try {
        const payload = await callMembersApi<{ character?: { id?: string } }>(
          {
            action: 'create_character',
            group_id: group.id,
            game_slug: targetGameSlug,
            character: {
              ...buildMemberUpdate(data as Partial<CharacterData> & Record<string, unknown>, targetGameSlug),
              user_id: targetUserId,
              name: data.name,
              level: data.level || 1,
              is_main: data.is_main || false,
            },
          },
          'Failed to create character'
        );

        if (payload.character?.id) {
          insertedData = [{ id: payload.character.id }];
        }
      } catch (apiError) {
        console.error('[useGroupData] Falling back to direct Supabase create character:', apiError);
      }
    }

    if (!insertedData) {
      if (data.is_main && targetUserId) {
        await supabase
          .from('members')
          .update({ is_main: false })
          .eq('group_id', group.id)
          .eq('user_id', targetUserId)
          .eq('game_slug', targetGameSlug)
          .eq('is_main', true);
      }

      const insertPayload = {
        ...buildMemberUpdate(data as Partial<CharacterData> & Record<string, unknown>, targetGameSlug),
        group_id: group.id,
        user_id: targetUserId,
        name: data.name,
        level: data.level || 1,
        is_main: data.is_main || false,
        game_slug: targetGameSlug,
      };

      const { data: insertedRows, error: insertError } = await supabase
        .from('members')
        .insert(insertPayload)
        .select();

      if (insertError) {
        setError(handleAsyncError(insertError, 'Failed to add character', { context: 'addCharacter', gameSlug: targetGameSlug }));
        throw insertError;
      }

      insertedData = (insertedRows || []) as Array<{ id: string }>;
    }

    // Handle subscriber tier for Star Citizen new character creation
    if (targetGameSlug === 'starcitizen' && data.subscriber_tier && insertedData && insertedData.length > 0) {
      try {
        const characterId = insertedData[0].id;

        let syncedViaApi = false;
        if (canUseV2Api) {
          try {
            await callMembersApi<{ success: boolean }>(
              {
                action: 'sync_subscriber_tier',
                group_id: group.id,
                character_id: characterId,
                old_tier: null,
                new_tier: data.subscriber_tier,
              },
              'Failed to sync subscriber ships'
            );
            syncedViaApi = true;
          } catch (apiError) {
            console.error('[useGroupData] Falling back to direct Supabase subscriber sync on create:', apiError);
          }
        }

        if (!syncedViaApi) {
          const { getCurrentMonthKey } = await import('@/games/starcitizen/config/subscriber-ships');
          const currentMonth = getCurrentMonthKey();

          await syncSubscriberShips(supabase, characterId, data.subscriber_tier);

          await supabase
            .from('members')
            .update({ subscriber_ships_month: currentMonth })
            .eq('id', characterId);
        }
      } catch (err) {
        console.error('Error syncing subscriber ships for new character:', err);
        // Don't throw - character was created successfully
      }
    }

    await fetchData();
  };

  const buildMemberUpdate = (
    data: Partial<CharacterData> & Record<string, unknown>,
    effectiveGame: string
  ) => {
    const payload: Record<string, unknown> = {};

    if ('name' in data) payload.name = data.name;
    if ('level' in data) payload.level = data.level;
    if ('is_main' in data) payload.is_main = data.is_main;
    if ('user_id' in data) payload.user_id = data.user_id;
    if ('preferred_role' in data) payload.preferred_role = data.preferred_role;
    if ('rank' in data) payload.rank = data.rank;

    if (effectiveGame === 'aoc') {
      if ('race' in data) payload.race = data.race ?? null;
      if ('primary_archetype' in data) payload.primary_archetype = data.primary_archetype ?? null;
      if ('secondary_archetype' in data) payload.secondary_archetype = data.secondary_archetype ?? null;
    }

    if (effectiveGame === 'ror') {
      if ('ror_faction' in data) payload.ror_faction = data.ror_faction ?? null;
      if ('ror_class' in data) payload.ror_class = data.ror_class ?? null;
    }

    if (effectiveGame === 'wowforever') {
      [
        'wow_race',
        'wow_faction',
        'wow_class',
        'wow_main_spec',
        'wow_secondary_spec',
        'wow_profession_1',
        'wow_profession_2',
      ].forEach((field) => {
        if (field in data) payload[field] = data[field] ?? null;
      });
    }

    if (effectiveGame === 'starcitizen') {
      if ('subscriber_tier' in data) payload.subscriber_tier = data.subscriber_tier ?? null;
      if ('subscriber_since' in data) payload.subscriber_since = data.subscriber_since ?? null;
      if ('subscriber_ships_month' in data) payload.subscriber_ships_month = data.subscriber_ships_month ?? null;
    }

    return payload;
  };

  // Update character
  const updateCharacter = async (id: string, data: Partial<CharacterData>) => {
    const currentUserId = await resolveCurrentUserId();

    if (!currentUserId) {
      throw new Error('You must be logged in to update a character');
    }

    // Get the character being updated
    const character = characters.find(c => c.id === id);
    if (!character) {
      throw new Error('Character not found');
    }

    // Get current user's role in the group
    if (!group) {
      throw new Error('Group not found');
    }

    const userRole = await resolveCurrentGroupRole(group.id, currentUserId);

    // Check if user can edit this character
    if (!canEditCharacter(userRole, character.user_id, currentUserId)) {
      // If officer trying to edit another user's character, check that target user is a member
      if (getClientAuthStack() !== 'v2' && userRole === 'officer' && character.user_id !== currentUserId) {
        const { data: targetMembership } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', group.id)
          .eq('user_id', character.user_id)
          .maybeSingle();

        const targetRole = (targetMembership?.role || 'member') as GroupRole;
        
        if (!canOfficerManageUser(userRole, targetRole)) {
          throw new Error('Officers can only manage characters owned by members, not other officers or admins');
        }
      } else {
        throw new Error('You do not have permission to edit this character');
      }
    }

    // If setting as main, first unmark any other main characters for the target user
    if (data.is_main === true && !canUseV2Api) {
      const targetUserId = (data as any).user_id ?? character.user_id;
      const targetGameSlug = (character as any)?.game_slug || gameSlug || (data as any).game_slug || 'aoc';
      if (targetUserId) {
        await supabase
          .from('members')
          .update({ is_main: false })
          .eq('group_id', group?.id || '')
          .eq('user_id', targetUserId)
          .eq('game_slug', targetGameSlug)
          .eq('is_main', true)
          .neq('id', id); // Don't update the character we're about to update
      }
    }

    // Claim ownership if character doesn't have a user_id
    // This allows users to take ownership of existing characters by editing them
    const updateData = { ...data } as Partial<CharacterData> & Record<string, unknown>;
    if (currentUserId) {
      const character = characters.find(c => c.id === id);
      if (character && !character.user_id) {
        updateData.user_id = currentUserId;
      }
    }

    const characterGame = (character as any)?.game_slug as string | undefined;
    const dataGame = updateData.game_slug as string | undefined;
    const effectiveGame = characterGame || gameSlug || dataGame || 'aoc';
    const memberData = buildMemberUpdate(updateData, effectiveGame);

    if (Object.prototype.hasOwnProperty.call(updateData, 'rank') && group?.id && getClientAuthStack() === 'v2') {
      const normalizedRank = typeof updateData.rank === 'string' && updateData.rank.trim().length > 0
        ? updateData.rank.trim()
        : null;

      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_character_rank',
          group_id: group.id,
          character_id: id,
          rank: normalizedRank,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to update character rank (${response.status})`);
      }

      delete (memberData as Record<string, unknown>).rank;
    }

    if (Object.keys(memberData).length === 0) {
      await fetchData();
      return;
    }

    if (Object.keys(memberData).length > 0) {
      let updatedViaApi = false;

      if (canUseV2Api) {
        try {
          await callMembersApi<{ success: boolean }>(
            {
              action: 'update_character',
              group_id: group.id,
              character_id: id,
              changes: memberData,
            },
            'Failed to update character'
          );
          updatedViaApi = true;
        } catch (apiError) {
          console.error('[useGroupData] Falling back to direct Supabase character update:', apiError);
        }
      }

      if (!updatedViaApi) {
        const { error: updateError } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', id)
          .select();

        if (updateError) {
          console.error('Error updating character:', updateError);
          setError(updateError.message);
          throw updateError;
        }
      }
    }

    // Keep character modal rank changes aligned with member rank management data.
    if (
      Object.prototype.hasOwnProperty.call(updateData, 'rank') &&
      (userRole === 'admin' || userRole === 'officer') &&
      getClientAuthStack() !== 'v2'
    ) {
      const normalizedRank = typeof updateData.rank === 'string' && updateData.rank.trim().length > 0
        ? updateData.rank.trim()
        : null;
      const targetUserId = (updateData.user_id as string | null | undefined) ?? character.user_id;

      if (group?.id && targetUserId) {
        if (getClientAuthStack() === 'v2') {
          const response = await fetch('/api/group/members', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'update_user_rank',
              group_id: group.id,
              target_user_id: targetUserId,
              rank: normalizedRank,
            }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
            throw new Error(payload.details || payload.error || `Failed to sync member rank (${response.status})`);
          }
        } else {
          const { error: rankSyncError } = await supabase
            .from('group_members')
            .update({ guild_rank: normalizedRank })
            .eq('group_id', group.id)
            .eq('user_id', targetUserId);

          if (rankSyncError) {
            throw rankSyncError;
          }
        }
      }
    }

    // Handle subscriber tier changes for Star Citizen
    if (effectiveGame === 'starcitizen') {
      const oldTier = (character as any)?.subscriber_tier as 'centurion' | 'imperator' | null | undefined;
      const newTier = data.subscriber_tier as 'centurion' | 'imperator' | null | undefined;

      if (newTier && newTier !== oldTier) {
        // User selected a subscriber tier
        try {
          let syncedViaApi = false;
          if (canUseV2Api && group?.id) {
            try {
              await callMembersApi<{ success: boolean }>(
                {
                  action: 'sync_subscriber_tier',
                  group_id: group.id,
                  character_id: id,
                  old_tier: oldTier ?? null,
                  new_tier: newTier,
                },
                'Failed to sync subscriber ships'
              );
              syncedViaApi = true;
            } catch (apiError) {
              console.error('[useGroupData] Falling back to direct Supabase subscriber tier sync:', apiError);
            }
          }

          if (!syncedViaApi) {
            const { getCurrentMonthKey } = await import('@/games/starcitizen/config/subscriber-ships');
            const currentMonth = getCurrentMonthKey();

            if (oldTier) {
              await updateSubscriberTier(supabase, id, oldTier as any, newTier);
            } else {
              await syncSubscriberShips(supabase, id, newTier);
            }

            await supabase
              .from('members')
              .update({ subscriber_ships_month: currentMonth })
              .eq('id', id);
          }
        } catch (err) {
          console.error('Error syncing subscriber ships:', err);
          // Don't throw - let the update succeed even if ship sync fails
        }
      } else if (!newTier && oldTier) {
        // Tier was removed - remove subscriber ships
        try {
          let syncedViaApi = false;
          if (canUseV2Api && group?.id) {
            try {
              await callMembersApi<{ success: boolean }>(
                {
                  action: 'sync_subscriber_tier',
                  group_id: group.id,
                  character_id: id,
                  old_tier: oldTier,
                  new_tier: null,
                },
                'Failed to clear subscriber ships'
              );
              syncedViaApi = true;
            } catch (apiError) {
              console.error('[useGroupData] Falling back to direct Supabase subscriber tier removal:', apiError);
            }
          }

          if (!syncedViaApi) {
            const { getSubscriberShips } = await import('@/games/starcitizen/config/subscriber-ships');
            const { removeSubscriberShips } = await import('@/lib/subscriberShips');
            const shipsToRemove = getSubscriberShips(oldTier);
            if (shipsToRemove && shipsToRemove.length > 0) {
              await removeSubscriberShips(supabase, id, shipsToRemove);
            }

            await supabase
              .from('members')
              .update({ subscriber_ships_month: null })
              .eq('id', id);
          }
        } catch (err) {
          console.error('Error removing subscriber ships:', err);
          // Don't throw - let the update succeed
        }
      }
    }

    await fetchData();
  };

  // Delete character
  const deleteCharacter = async (id: string) => {
    const currentUserId = await resolveCurrentUserId();

    if (!currentUserId) {
      throw new Error('You must be logged in to delete a character');
    }

    // Get the character being deleted
    const character = characters.find(c => c.id === id);
    if (!character) {
      throw new Error('Character not found');
    }

    // Get current user's role in the group
    if (!group) {
      throw new Error('Group not found');
    }

    const userRole = await resolveCurrentGroupRole(group.id, currentUserId);

    // Check if user can delete this character
    if (!canDeleteCharacter(userRole, character.user_id, currentUserId)) {
      // If officer trying to delete another user's character, check that target user is a member
      if (getClientAuthStack() !== 'v2' && userRole === 'officer' && character.user_id !== currentUserId) {
        const { data: targetMembership } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', group.id)
          .eq('user_id', character.user_id)
          .maybeSingle();

        const targetRole = (targetMembership?.role || 'member') as GroupRole;
        
        if (!canOfficerManageUser(userRole, targetRole)) {
          throw new Error('Officers can only manage characters owned by members, not other officers or admins');
        }
      } else {
        throw new Error('You do not have permission to delete this character');
      }
    }

    let deletedViaApi = false;
    if (canUseV2Api) {
      try {
        await callMembersApi<{ success: boolean }>(
          {
            action: 'delete_character',
            group_id: group.id,
            character_id: id,
          },
          'Failed to delete character'
        );
        deletedViaApi = true;
      } catch (apiError) {
        console.error('[useGroupData] Falling back to direct Supabase character delete:', apiError);
      }
    }

    if (!deletedViaApi) {
      const { error: deleteError } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
        .select();

      if (deleteError) {
        setError(handleAsyncError(deleteError, 'Failed to delete character', { context: 'deleteCharacter', characterId: id }));
        throw deleteError;
      }
    }

    await fetchData();
  };

  // Set profession rank (null to remove) - uses optimistic updates
  const setProfessionRank = async (
    characterId: string,
    professionId: string,
    rank: RankLevel | null,
    level: number = 1,
    quality: number = 0
  ) => {
    // Optimistic update - update local state immediately
    setCharacters((prevCharacters) =>
      prevCharacters.map((character) => {
        if (character.id !== characterId) return character;

        let updatedProfessions = [...character.professions];

        if (rank === null) {
          // Remove profession
          updatedProfessions = updatedProfessions.filter(
            (p) => p.profession !== professionId
          );
        } else {
          // Add or update profession
          const existingIndex = updatedProfessions.findIndex(
            (p) => p.profession === professionId
          );
          if (existingIndex >= 0) {
            updatedProfessions[existingIndex] = {
              ...updatedProfessions[existingIndex],
              rank,
              artisan_level: level,
              quality_score: quality,
            };
          } else {
            updatedProfessions.push({
              id: `temp-${Date.now()}`, // Temporary ID
              member_id: characterId,
              profession: professionId,
              rank,
              artisan_level: level,
              quality_score: quality,
            });
          }
        }

        return { ...character, professions: updatedProfessions };
      })
    );

    // Persist to database in background
    try {
      let persistedViaApi = false;

      if (canUseV2Api && group?.id) {
        try {
          await callMembersApi<{ success: boolean }>(
            {
              action: 'set_profession_rank',
              group_id: group.id,
              character_id: characterId,
              profession_id: professionId,
              rank,
              level,
              quality,
            },
            'Failed to update profession rank'
          );
          persistedViaApi = true;
        } catch (apiError) {
          console.error('[useGroupData] Falling back to direct Supabase profession update:', apiError);
        }
      }

      if (!persistedViaApi) {
        if (rank === null) {
          const { error: deleteError } = await supabase
            .from('member_professions')
            .delete()
            .eq('member_id', characterId)
            .eq('profession', professionId)
            .select();

          if (deleteError) throw deleteError;
        } else {
          const { error: upsertError } = await supabase
            .from('member_professions')
            .upsert(
              {
                member_id: characterId,
                profession: professionId,
                rank,
                artisan_level: level,
                quality_score: quality
              },
              { onConflict: 'member_id,profession' }
            )
            .select();

          if (upsertError) throw upsertError;
        }
      }
    } catch (err) {
      console.error('Error setting profession rank:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profession');
      // Revert on error by refetching
      await fetchData();
    }
  };

  // Legacy aliases for backward compatibility
  const addMember = async (name: string) => addCharacter({ name });
  const updateMember = async (id: string, name: string) => updateCharacter(id, { name });
  const deleteMember = deleteCharacter;

  return {
    group,
    characters,
    loading,
    error,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    setProfessionRank,
    refresh: fetchData,
    // Legacy aliases
    members: characters,
    addMember,
    updateMember,
    deleteMember,
  };
}
