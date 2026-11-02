import {
  getConfiguredGameRanks,
  getDefaultGameRanks,
  getRankColumnNames,
  isGameRankEnabled,
  normalizeGameId,
  resolveConfiguredRankLabel,
} from '../gameRankSettings';
import type { Clan } from '../types';

describe('gameRankSettings', () => {
  describe('normalizeGameId', () => {
    it('normalizes Star Citizen aliases to sc', () => {
      expect(normalizeGameId('starcitizen')).toBe('sc');
      expect(normalizeGameId('star-citizen')).toBe('sc');
      expect(normalizeGameId('sc')).toBe('aoc');
    });

    it('normalizes RoR aliases to ror', () => {
      expect(normalizeGameId('ror')).toBe('ror');
      expect(normalizeGameId('returnofreckoning')).toBe('ror');
      expect(normalizeGameId('return-of-reckoning')).toBe('ror');
    });

    it('falls back unknown game ids to aoc', () => {
      expect(normalizeGameId('unknown')).toBe('aoc');
    });
  });

  describe('getRankColumnNames', () => {
    it('returns SC columns for starcitizen slug', () => {
      expect(getRankColumnNames('starcitizen')).toEqual({
        enabledColumn: 'sc_ranks_enabled',
        customRanksColumn: 'sc_custom_ranks',
      });
    });

    it('returns RoR columns for ror slug', () => {
      expect(getRankColumnNames('ror')).toEqual({
        enabledColumn: 'ror_ranks_enabled',
        customRanksColumn: 'ror_custom_ranks',
      });
    });

    it('returns AoC columns for unknown game slug', () => {
      expect(getRankColumnNames('unknown')).toEqual({
        enabledColumn: 'aoc_ranks_enabled',
        customRanksColumn: 'aoc_custom_ranks',
      });
    });
  });

  describe('getDefaultGameRanks', () => {
    it('returns configured default ranks for Star Citizen', () => {
      const ranks = getDefaultGameRanks('starcitizen');
      expect(ranks.length).toBeGreaterThan(0);
      expect(ranks[0]).toHaveProperty('id');
      expect(ranks[0]).toHaveProperty('name');
      expect(ranks[0]).toHaveProperty('hierarchy');
    });

    it('returns empty defaults for RoR', () => {
      expect(getDefaultGameRanks('ror')).toEqual([]);
    });
  });

  describe('getConfiguredGameRanks', () => {
    it('uses normalized custom SC ranks when present', () => {
      const group = {
        sc_custom_ranks: [
          { id: 'lead', name: 'Lead', hierarchy: 10 },
          { id: 'recruit', name: 'Recruit', hierarchy: 1 },
        ],
      } as Clan;

      expect(getConfiguredGameRanks(group, 'starcitizen')).toEqual([
        { id: 'recruit', name: 'Recruit', hierarchy: 1 },
        { id: 'lead', name: 'Lead', hierarchy: 2 },
      ]);
    });

    it('falls back to SC defaults when no custom ranks exist', () => {
      const group = { sc_custom_ranks: [] } as Clan;
      const ranks = getConfiguredGameRanks(group, 'starcitizen');
      expect(ranks.length).toBeGreaterThan(0);
    });

    it('returns custom RoR ranks when configured', () => {
      const group = {
        ror_custom_ranks: [{ id: 'warband', name: 'Warband', hierarchy: 1 }],
      } as Clan;

      expect(getConfiguredGameRanks(group, 'ror')).toEqual([
        { id: 'warband', name: 'Warband', hierarchy: 1 },
      ]);
    });

    it('returns empty for RoR when no custom ranks configured', () => {
      const group = { ror_custom_ranks: [] } as Clan;
      expect(getConfiguredGameRanks(group, 'ror')).toEqual([]);
    });
  });

  describe('isGameRankEnabled', () => {
    it('respects explicit enabled flag when present', () => {
      const group = { sc_ranks_enabled: false } as Clan;
      expect(isGameRankEnabled(group, 'starcitizen')).toBe(false);
    });

    it('falls back to defaults for null group', () => {
      expect(isGameRankEnabled(null, 'starcitizen')).toBe(true);
      expect(isGameRankEnabled(null, 'ror')).toBe(false);
    });

    it('falls back to defaults when enabled flag is undefined', () => {
      const group = {} as Clan;
      expect(isGameRankEnabled(group, 'starcitizen')).toBe(true);
      expect(isGameRankEnabled(group, 'ror')).toBe(false);
    });
  });

  describe('resolveConfiguredRankLabel', () => {
    const ranks = [
      { id: 'captain', name: 'Captain', hierarchy: 1 },
      { id: 'admiral', name: 'Admiral', hierarchy: 2 },
    ];

    it('returns mapped name for exact id', () => {
      expect(resolveConfiguredRankLabel(ranks, 'captain')).toBe('Captain');
    });

    it('returns mapped name for case-insensitive id', () => {
      expect(resolveConfiguredRankLabel(ranks, 'CAPTAIN')).toBe('Captain');
    });

    it('returns mapped name when value already equals configured name', () => {
      expect(resolveConfiguredRankLabel(ranks, 'Admiral')).toBe('Admiral');
    });

    it('returns null for unknown token-like rank values', () => {
      expect(resolveConfiguredRankLabel(ranks, 't')).toBeNull();
      expect(resolveConfiguredRankLabel(ranks, 'rank_legacy_1')).toBeNull();
    });

    it('preserves human-readable legacy labels', () => {
      expect(resolveConfiguredRankLabel(ranks, 'Legacy Officer')).toBe('Legacy Officer');
    });
  });
});
