/**
 * Character lookup utilities for Discord ID-based queries
 * Phase 3: Discord ID Migration - provides fallback lookups
 */

import { supabase } from './supabase';
import { CharacterWithProfessions, MemberProfession } from './types';

/**
 * Find a user's character by Discord ID and group ID
 * Fallback to user_id if discord_id not available (backward compatibility)
 */
export async function getCharacterByDiscordId(
  discordId: string,
  groupId: string,
  gameSlug: string = 'aoc'
): Promise<CharacterWithProfessions | null> {
  try {
    // Primary lookup: by Discord ID (Phase 3 - new resilient method)
    const { data: byDiscord, error: discordError } = await supabase
      .from('members')
      .select(`
        *,
        member_professions (*)
      `)
      .eq('discord_id', discordId)
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug)
      .eq('is_main', true)
      .maybeSingle();

    if (!discordError && byDiscord) {
      return transformCharacter(byDiscord);
    }

    // If no main character, return first non-main
    if (!discordError) {
      const { data: allByDiscord } = await supabase
        .from('members')
        .select(`
          *,
          member_professions (*)
        `)
        .eq('discord_id', discordId)
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug)
        .limit(1)
        .maybeSingle();

      if (allByDiscord) {
        return transformCharacter(allByDiscord);
      }
    }

    return null;
  } catch (err) {
    console.error('Error in getCharacterByDiscordId:', err);
    return null;
  }
}

/**
 * Find all characters for a Discord user in a group
 * Used for multi-character support
 */
export async function getCharactersByDiscordId(
  discordId: string,
  groupId: string,
  gameSlug?: string
): Promise<CharacterWithProfessions[]> {
  try {
    const query = supabase
      .from('members')
      .select(`
        *,
        member_professions (*)
      `)
      .eq('discord_id', discordId)
      .eq('group_id', groupId);

    if (gameSlug) {
      query.eq('game_slug', gameSlug);
    }

    const { data, error } = await query
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformCharacter);
  } catch (err) {
    console.error('Error in getCharactersByDiscordId:', err);
    return [];
  }
}

/**
 * Check if character ownership is resilient (has both user_id and discord_id)
 * Used for migration validation
 */
export async function checkCharacterResilience(characterId: string): Promise<{
  hasUserId: boolean;
  hasDiscordId: boolean;
  isResilient: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('user_id, discord_id')
      .eq('id', characterId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { hasUserId: false, hasDiscordId: false, isResilient: false };
    }

    return {
      hasUserId: !!data.user_id,
      hasDiscordId: data.discord_id !== null,
      isResilient: !!data.user_id && data.discord_id !== null,
    };
  } catch (err) {
    console.error('Error in checkCharacterResilience:', err);
    return { hasUserId: false, hasDiscordId: false, isResilient: false };
  }
}

/**
 * Get current user's main character in a group
 * Phase 4: Uses Discord ID with fallback to user_id (DR-resilient)
 * Returns first result ordered by is_main then created_at
 */
export async function getCurrentUserMainCharacter(
  groupId: string,
  gameSlug: string = 'aoc'
): Promise<CharacterWithProfessions | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return null;
    }

    const discordId = authUser.user_metadata?.provider_id || null;

    // Primary lookup: by Discord ID (DR-resilient)
    if (discordId) {
      const { data: byDiscordId } = await supabase
        .from('members')
        .select(`
          *,
          member_professions (*)
        `)
        .eq('discord_id', discordId)
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug)
        .eq('is_main', true)
        .maybeSingle();

      if (byDiscordId) {
        return transformCharacter(byDiscordId);
      }
    }

    // Fallback: by user_id (old method, for backward compat)
    const { data: byUserId } = await supabase
      .from('members')
      .select(`
        *,
        member_professions (*)
      `)
      .eq('user_id', authUser.id)
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug)
      .eq('is_main', true)
      .maybeSingle();

    if (byUserId) {
      return transformCharacter(byUserId);
    }

    // If no main character found, return first non-main by any lookup
    if (discordId) {
      const { data: firstByDiscord } = await supabase
        .from('members')
        .select(`
          *,
          member_professions (*)
        `)
        .eq('discord_id', discordId)
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (firstByDiscord) {
        return transformCharacter(firstByDiscord);
      }
    }

    // Final fallback
    const { data: firstByUserId } = await supabase
      .from('members')
      .select(`
        *,
        member_professions (*)
      `)
      .eq('user_id', authUser.id)
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return firstByUserId ? transformCharacter(firstByUserId) : null;
  } catch (err) {
    console.error('Error in getCurrentUserMainCharacter:', err);
    return null;
  }
}

/**
 * Transform character data to include professions
 */
type CharacterLookupRow = CharacterWithProfessions & {
  member_professions?: unknown[];
};

function toRankLevel(value: unknown): MemberProfession['rank'] {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }

  if (typeof value === 'number') {
    if (value >= 4) return 4;
    if (value >= 3) return 3;
    if (value >= 2) return 2;
  }

  return 1;
}

function toMemberProfession(value: unknown, fallbackMemberId: string): MemberProfession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const profession = value as Partial<Record<keyof MemberProfession, unknown>>;

  if (typeof profession.profession !== 'string') {
    return null;
  }

  return (
    {
      id: typeof profession.id === 'string' ? profession.id : `${fallbackMemberId}-${profession.profession}`,
      member_id: typeof profession.member_id === 'string' ? profession.member_id : fallbackMemberId,
      profession: profession.profession,
      rank: toRankLevel(profession.rank),
      artisan_level: typeof profession.artisan_level === 'number' ? profession.artisan_level : 0,
      quality_score: typeof profession.quality_score === 'number' ? profession.quality_score : 0,
    }
  );
}

function transformCharacter(char: CharacterLookupRow): CharacterWithProfessions {
  const professions = (char.member_professions || [])
    .map((profession) => toMemberProfession(profession, char.id))
    .filter((profession): profession is MemberProfession => profession !== null);

  return {
    ...char,
    race: char.race || null,
    primary_archetype: char.primary_archetype || null,
    secondary_archetype: char.secondary_archetype || null,
    level: char.level || 1,
    is_main: char.is_main || false,
    professions,
  };
}
