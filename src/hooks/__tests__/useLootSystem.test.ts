/**
 * Phase 2 Tests: useLootSystem Hook - Sprint 9
 * Tests for DKP loot system management
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useLootSystem } from '../useLootSystem';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  },
}));

import { supabase } from '@/lib/supabase';

const mockSystem = {
  id: 'sys-1',
  group_id: 'group-1',
  name: 'Main Raid DKP',
  system_type: 'dkp',
  is_active: true,
  starting_points: 100,
  decay_enabled: true,
  decay_rate: 5,
};

const mockLeaderboard = [
  {
    id: 'dkp-1',
    loot_system_id: 'sys-1',
    character_id: 'char-1',
    current_points: 250,
    earned_total: 500,
    spent_total: 250,
    priority_ratio: 1.0,
    rank: 1,
    members: {
      id: 'char-1',
      name: 'Warrior One',
      race: 'Human',
      primary_archetype: 'Fighter',
      level: 50,
      is_main: true,
    },
  },
  {
    id: 'dkp-2',
    loot_system_id: 'sys-1',
    character_id: 'char-2',
    current_points: 150,
    earned_total: 300,
    spent_total: 150,
    priority_ratio: 0.8,
    rank: 2,
    members: {
      id: 'char-2',
      name: 'Mage Two',
      race: 'Elf',
      primary_archetype: 'Mage',
      level: 48,
      is_main: false,
    },
  },
];

const mockLootHistory = [
  {
    id: 'loot-1',
    loot_system_id: 'sys-1',
    item_name: 'Legendary Sword',
    item_rarity: 'legendary',
    source_type: 'boss_drop',
    awarded_to: 'char-1',
    dkp_cost: 200,
    dropped_at: '2026-02-10T10:00:00Z',
    members: { id: 'char-1', name: 'Warrior One' },
    users: { display_name: 'Admin' },
  },
];

describe('useLootSystem Hook - Phase 2 Sprint 9', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      expect(result.current.lootSystem).toBeNull();
      expect(result.current.leaderboard).toEqual([]);
      expect(result.current.lootHistory).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null groupId early without fetching', () => {
      const { result } = renderHook(() => useLootSystem(null));

      expect(result.current.lootSystem).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('exposes all required API methods', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createSystem).toBe('function');
      expect(typeof result.current.updateSystem).toBe('function');
      expect(typeof result.current.awardPoints).toBe('function');
      expect(typeof result.current.deductPoints).toBe('function');
      expect(typeof result.current.awardBulkPoints).toBe('function');
      expect(typeof result.current.recordLoot).toBe('function');
      expect(typeof result.current.distributeLoot).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Loot System & Leaderboard Fetching', () => {
    it('fetches active loot system and transforms leaderboard with ranks', async () => {
      const mockFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSystem, error: null }),
      };

      const mockLeaderboardFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockLeaderboard, error: null }),
      };

      const mockHistoryFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockLootHistory, error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockFetch)
        .mockReturnValueOnce(mockLeaderboardFetch)
        .mockReturnValueOnce(mockHistoryFetch);

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lootSystem).toEqual(mockSystem);
      expect(result.current.leaderboard).toHaveLength(2);
      expect(result.current.leaderboard[0].rank).toBe(1);
      expect(result.current.leaderboard[0]?.character?.name).toBe('Warrior One');
    });

    it('handles fetch error gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: null, error: new Error('DB error') }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.lootSystem).toBeNull();
    });
  });

  describe('Loot System Management', () => {
    it('createSystem method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createSystem).toBe('function');
    });

    it('updateSystem method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateSystem).toBe('function');
    });

    it('throws error if creating system without groupId', async () => {
      const { result } = renderHook(() => useLootSystem(null));

      await act(async () => {
        try {
          await result.current.createSystem({
            name: 'Test',
            system_type: 'dkp',
          });
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('No clan selected');
        }
      });
    });
  });

  describe('DKP Points Management', () => {
    it('awardPoints method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.awardPoints).toBe('function');
    });

    it('deductPoints method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.deductPoints).toBe('function');
    });

    it('awardBulkPoints method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.awardBulkPoints).toBe('function');
    });
  });

  describe('Loot Recording & Distribution', () => {
    it('recordLoot method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.recordLoot).toBe('function');
    });

    it('distributeLoot method is available', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.distributeLoot).toBe('function');
    });
  });

  describe('Loot History Transformation', () => {
    it('transforms loot history with character and user details', async () => {
      const mockFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSystem, error: null }),
      };

      const mockLeaderboardFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockHistoryFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockLootHistory, error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockFetch)
        .mockReturnValueOnce(mockLeaderboardFetch)
        .mockReturnValueOnce(mockHistoryFetch);

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lootHistory).toHaveLength(1);
      expect(result.current.lootHistory[0].item_name).toBe('Legendary Sword');
      expect(result.current.lootHistory[0].awarded_to_character?.name).toBe('Warrior One');
    });
  });

  describe('Refresh & State Management', () => {
    it('refresh re-fetches all loot data', async () => {
      const mockFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockSystem, error: null }),
      };

      const mockLeaderboardFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockHistoryFetch = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      supabase.from
        .mockReturnValueOnce(mockFetch)
        .mockReturnValueOnce(mockLeaderboardFetch)
        .mockReturnValueOnce(mockHistoryFetch)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: mockSystem, error: null }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

      const { result } = renderHook(() => useLootSystem('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = supabase.from.mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      expect(supabase.from.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
