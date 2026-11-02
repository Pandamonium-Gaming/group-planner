import { supabase } from '@/lib/supabase';
import { GameId } from '@/lib/games';

interface UserGameRow {
  game: GameId;
}

interface UserGroupForGame {
  id: string;
  slug: string;
  name: string;
  game: GameId;
  role: string;
  isCreator: boolean;
  group_icon_url: string | null;
}

interface GroupMemberWithGroupRelation {
  role: string;
  is_creator: boolean;
  clans:
    | {
        id: string;
        slug: string;
        name: string;
        game: GameId;
        group_icon_url: string | null;
      }
    | {
        id: string;
        slug: string;
        name: string;
        game: GameId;
        group_icon_url: string | null;
      }[]
    | null;
}

/**
 * Track which games a user participates in
 */
export async function addUserGame(userId: string, gameId: GameId) {
  const { error } = await supabase
    .from('user_games')
    .upsert(
      {
        user_id: userId,
        game: gameId,
      },
      { onConflict: 'user_id,game' }
    );

  if (error) {
    console.error('Error adding user game:', error);
    throw error;
  }
}

/**
 * Get all games a user is in
 */
export async function getUserGames(userId: string): Promise<GameId[]> {
  const { data, error } = await supabase
    .from('user_games')
    .select('game')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user games:', error);
    return [];
  }

  return (data?.map((row: UserGameRow) => row.game) || []) as GameId[];
}

/**
 * Get a user's clans for a specific game
 */
export async function getUserGroupsForGame(
  userId: string,
  gameId: GameId
): Promise<UserGroupForGame[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(
      `
      clan_id,
      role,
      is_creator,
      clans (
        id,
        slug,
        name,
        game,
        group_icon_url
      )
    `
    )
    .eq('user_id', userId)
    .eq('clans.game', gameId);

  if (error) {
    console.error('Error fetching clans:', error);
    return [];
  }

  const rows = (data || []) as GroupMemberWithGroupRelation[];

  return rows
    .map((row) => {
      const clan = Array.isArray(row.clans) ? row.clans[0] : row.clans;
      if (!clan) return null;

      return {
        id: clan.id,
        slug: clan.slug,
        name: clan.name,
        game: clan.game,
        role: row.role,
        isCreator: row.is_creator,
        group_icon_url: clan.group_icon_url,
      };
    })
    .filter((group): group is UserGroupForGame => group !== null);
}

