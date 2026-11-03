import { getGameConfig } from '@/config';
import { Clan } from '@/lib/types';

export type GameRank = {
  id: string;
  name: string;
  hierarchy: number;
};

function isOpaqueRankToken(value: string): boolean {
  return /^[a-z0-9_-]{1,24}$/i.test(value);
}

export function normalizeGameId(gameSlug: string): 'aoc' | 'sc' | 'ror' | 'wowforever' {
  if (gameSlug === 'sc' || gameSlug === 'starcitizen' || gameSlug === 'star-citizen') return 'sc';
  if (gameSlug === 'ror' || gameSlug === 'returnofreckoning' || gameSlug === 'return-of-reckoning') return 'ror';
  if (gameSlug === 'wowforever') return 'wowforever';
  return 'aoc';
}

export function getRankColumnNames(gameSlug: string): {
  enabledColumn: keyof Clan;
  customRanksColumn: keyof Clan;
} {
  const gameId = normalizeGameId(gameSlug);

  if (gameId === 'sc') {
    return {
      enabledColumn: 'sc_ranks_enabled',
      customRanksColumn: 'sc_custom_ranks',
    };
  }

  if (gameId === 'ror') {
    return {
      enabledColumn: 'ror_ranks_enabled',
      customRanksColumn: 'ror_custom_ranks',
    };
  }

  if (gameId === 'wowforever') {
    return {
      enabledColumn: 'wowforever_ranks_enabled',
      customRanksColumn: 'wowforever_custom_ranks',
    };
  }

  return {
    enabledColumn: 'aoc_ranks_enabled',
    customRanksColumn: 'aoc_custom_ranks',
  };
}

function toValidRank(input: unknown, index: number): GameRank | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const obj = input as Record<string, unknown>;
  const id = typeof obj.id === 'string' && obj.id.trim().length > 0
    ? obj.id.trim()
    : `rank-${index + 1}`;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';

  if (!name) {
    return null;
  }

  const hierarchy = typeof obj.hierarchy === 'number' && Number.isFinite(obj.hierarchy)
    ? obj.hierarchy
    : index + 1;

  return { id, name, hierarchy };
}

function normalizeRanks(ranks: unknown[]): GameRank[] {
  const parsed = ranks
    .map((entry, index) => toValidRank(entry, index))
    .filter((entry): entry is GameRank => !!entry)
    .sort((a, b) => a.hierarchy - b.hierarchy)
    .map((rank, index) => ({
      ...rank,
      hierarchy: index + 1,
    }));

  return parsed;
}

export function getDefaultGameRanks(gameSlug: string): GameRank[] {
  // RoR does not currently define static rank defaults in config.
  // Use custom ranks only when configured at group level.
  if (normalizeGameId(gameSlug) === 'ror' || normalizeGameId(gameSlug) === 'wowforever') {
    return [];
  }

  const config = getGameConfig(normalizeGameId(gameSlug) === 'sc' ? 'starcitizen' : gameSlug) as Record<string, unknown>;
  const rawRanks = Array.isArray(config?.ranks) ? config.ranks : [];
  return normalizeRanks(rawRanks);
}

export function getConfiguredGameRanks(group: Clan | null, gameSlug: string): GameRank[] {
  if (!group) {
    return getDefaultGameRanks(gameSlug);
  }

  const { customRanksColumn } = getRankColumnNames(gameSlug);
  const customValue = group[customRanksColumn];

  if (Array.isArray(customValue) && customValue.length > 0) {
    const normalized = normalizeRanks(customValue);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return getDefaultGameRanks(gameSlug);
}

export function isGameRankEnabled(group: Clan | null, gameSlug: string): boolean {
  if (!group) {
    return getDefaultGameRanks(gameSlug).length > 0;
  }

  const { enabledColumn } = getRankColumnNames(gameSlug);
  const enabled = group[enabledColumn];
  if (typeof enabled === 'boolean') {
    return enabled;
  }

  return getDefaultGameRanks(gameSlug).length > 0;
}

export function resolveConfiguredRank(
  ranks: GameRank[],
  rankValue: string | null | undefined
): GameRank | null {
  if (!rankValue) {
    return null;
  }

  const normalizedValue = rankValue.trim();
  if (!normalizedValue) {
    return null;
  }

  const byId = ranks.find((rank) => rank.id === normalizedValue);
  if (byId) {
    return byId;
  }

  const lowerValue = normalizedValue.toLowerCase();

  const byIdCaseInsensitive = ranks.find((rank) => rank.id.toLowerCase() === lowerValue);
  if (byIdCaseInsensitive) {
    return byIdCaseInsensitive;
  }

  return ranks.find((rank) => rank.name.toLowerCase() === lowerValue) || null;
}

export function resolveConfiguredRankLabel(
  ranks: GameRank[],
  rankValue: string | null | undefined
): string | null {
  const rank = resolveConfiguredRank(ranks, rankValue);
  if (rank) return rank.name;

  const normalizedValue = rankValue?.trim();
  if (!normalizedValue || isOpaqueRankToken(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}
