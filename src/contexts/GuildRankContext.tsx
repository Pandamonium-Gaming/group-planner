'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getConfiguredGameRanks, isGameRankEnabled, resolveConfiguredRank, resolveConfiguredRankLabel } from '@/lib/gameRankSettings';
import type { Character, Clan } from '@/lib/types';

interface GuildRankDisplay {
  name: string;
  color: string;
}

const RANK_COLORS = ['text-slate-300', 'text-green-300', 'text-blue-300', 'text-purple-300', 'text-amber-300'];
const GuildRankContext = createContext<ReadonlyMap<string, GuildRankDisplay>>(new Map());

export function GuildRankProvider({ group, gameSlug, characters, members, children }: {
  group: Clan | null;
  gameSlug: string;
  characters: ReadonlyArray<Pick<Character, 'id' | 'user_id'>>;
  members: ReadonlyArray<{ user_id: string; guild_rank: string | null }>;
  children: ReactNode;
}) {
  const characterRanks = useMemo(() => {
    const result = new Map<string, GuildRankDisplay>();
    if (!isGameRankEnabled(group, gameSlug)) return result;

    const ranks = getConfiguredGameRanks(group, gameSlug);
    const memberRanks = new Map(members.map(member => [member.user_id, member.guild_rank]));
    for (const character of characters) {
      if (!character.user_id) continue;
      const value = memberRanks.get(character.user_id);
      const rank = resolveConfiguredRank(ranks, value);
      const name = rank?.name || resolveConfiguredRankLabel(ranks, value);
      if (!name) continue;

      const colorIndex = rank && ranks.length > 1
        ? Math.round((rank.hierarchy - 1) / (ranks.length - 1) * (RANK_COLORS.length - 1))
        : 0;
      result.set(character.id, { name, color: RANK_COLORS[colorIndex] });
    }
    return result;
  }, [group, gameSlug, characters, members]);

  return <GuildRankContext.Provider value={characterRanks}>{children}</GuildRankContext.Provider>;
}

export function useCharacterGuildRank(characterId: string | null | undefined) {
  const ranks = useContext(GuildRankContext);
  return characterId ? ranks.get(characterId) : undefined;
}
