import { supabase } from '@/lib/supabase';

export interface GroupGameInfo {
  game_slug: string;
  archived: boolean;
}

async function fetchGroupGamesViaApi(groupId: string): Promise<GroupGameInfo[]> {
  const response = await fetch(`/api/group/games?group_id=${encodeURIComponent(groupId)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch group games via API (${response.status})`);
  }

  const payload = (await response.json()) as { games?: GroupGameInfo[] };
  return payload.games || [];
}

/**
 * Get all enabled games for a group (excludes archived games by default)
 * Returns all available games if none have been explicitly configured
 */
export async function getGroupGames(groupId: string, includeArchived = false): Promise<string[]> {
  try {
    let query = supabase
      .from('group_games')
      .select('game_slug')
      .eq('group_id', groupId);
    
    // Exclude archived games unless explicitly requested
    if (!includeArchived) {
      query = query.eq('archived', false);
    }
    
    const { data, error } = await query.order('created_at');

    if (error) throw error;
    
    // If games are configured, return them; otherwise return empty array
    // (The calling code will handle showing all games if array is empty)
    return data?.map(row => row.game_slug) || [];
  } catch (err) {
    console.error('Error fetching group games:', err);
    return []; // Return empty array, let caller decide default behavior
  }
}

/**
 * Get all games with their archived status for a group
 */
export async function getGroupGamesWithStatus(groupId: string): Promise<GroupGameInfo[]> {
  try {
    const { data, error } = await supabase
      .from('group_games')
      .select('game_slug, archived')
      .eq('group_id', groupId)
      .order('created_at');

    if (error) throw error;
    
    return data || [];
  } catch (err) {
    console.error('Error fetching group games with status:', err);
    return [];
  }
}

/**
 * Add a game to a group (admin only)
 */
export async function addGameToGroup(groupId: string, gameSlug: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_games')
      .insert([{ group_id: groupId, game_slug: gameSlug }]);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding game to group:', err);
    return false;
  }
}

/**
 * Remove a game from a group (admin only)
 */
export async function removeGameFromGroup(groupId: string, gameSlug: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_games')
      .delete()
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error removing game from group:', err);
    return false;
  }
}

/**
 * Archive a game for a group (admin only)
 * Archived games are hidden from the UI but all data is preserved
 */
export async function archiveGameForGroup(groupId: string, gameSlug: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_games')
      .update({ archived: true })
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error archiving game for group:', err);
    return false;
  }
}

/**
 * Unarchive a game for a group (admin only)
 */
export async function unarchiveGameForGroup(groupId: string, gameSlug: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_games')
      .update({ archived: false })
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error unarchiving game for group:', err);
    return false;
  }
}

/**
 * Check if a game is archived for a group
 */
export async function isGameArchived(groupId: string, gameSlug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('group_games')
      .select('archived')
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug)
      .maybeSingle();

    if (error) throw error;
    return data?.archived || false;
  } catch (err) {
    console.error('Error checking if game is archived:', err);
    return false;
  }
}

