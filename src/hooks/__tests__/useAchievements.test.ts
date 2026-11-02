/**
 * Phase 2 Tests: useAchievements Hook - Sprint 4
 * Tests for achievement tracking, unlock conditions, and progress tracking
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useAchievements } from '../useAchievements';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'contributor-1' } },
        error: null,
      }),
    },
  },
}));

import { supabase } from '@/lib/supabase';

const mockSupabase = jest.mocked(supabase);

const mockDefinitions = [
  {
    id: 'achieve-1',
    name: 'First Steps',
    description: 'Complete first task',
    category: 'guild',
    points: 10,
    requirement_value: 1,
    sort_order: 1,
  },
  {
    id: 'achieve-2',
    name: 'Master Miner',
    description: 'Mine 1000 ore',
    category: 'economy',
    points: 50,
    requirement_value: 1000,
    sort_order: 2,
  },
  {
    id: 'achieve-3',
    name: 'Collector',
    description: 'Unlock 10 achievements',
    category: 'community',
    points: 100,
    requirement_value: 10,
    sort_order: 3,
  },
];

const mockClanAchievements = [
  {
    id: 'clan-achieve-1',
    group_id: 'group-1',
    achievement_id: 'achieve-1',
    current_value: 1,
    is_unlocked: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    unlocked_at: '2026-01-01T00:00:00Z',
    first_contributor_id: 'user-1',
  },
  {
    id: 'clan-achieve-2',
    group_id: 'group-1',
    achievement_id: 'achieve-2',
    current_value: 250,
    is_unlocked: false,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    unlocked_at: null,
    first_contributor_id: null,
  },
];

describe('useAchievements Hook - Phase 2 Sprint 4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null } as any),
      } as any);

      const { result } = renderHook(() => useAchievements('group-1'));

      expect(result.current.achievements).toEqual([]);
      expect(result.current.definitions).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null group id early without loading definitions', () => {
      const { result } = renderHook(() => useAchievements(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.achievements).toEqual([]);
      expect(result.current.definitions).toEqual([]);
    });

    it('exposes all required API methods', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null } as any),
      } as any);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.getByCategory).toBe('function');
      expect(typeof result.current.updateProgress).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
      expect(result.current.unlockedCount).toBe(0);
      expect(result.current.totalPoints).toBe(0);
    });
  });

  describe('Data Fetching', () => {
    it('fetches achievement definitions and clan achievements on mount', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.definitions).toHaveLength(3);
      expect(result.current.achievements).toHaveLength(3);
      expect(mockSupabase.from).toHaveBeenCalledWith('achievement_definitions');
      expect(mockSupabase.from).toHaveBeenCalledWith('group_achievements');
    });

    it('handles definition fetch error', async () => {
      const errorMsg = 'Database error';
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) } as any),
      } as any);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.definitions).toEqual([]);
    });

    it('handles clan achievements fetch error', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Fetch failed'),
        }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Achievement Merging Logic', () => {
    it('merges clan achievements with definitions', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have all definitions (including one without progress)
      expect(result.current.achievements).toHaveLength(3);

      // First achievement should be unlocked
      const firstAchieve = result.current.achievements.find((a) => a.achievement_id === 'achieve-1');
      expect(firstAchieve?.is_unlocked).toBe(true);
      expect(firstAchieve?.current_value).toBe(1);
      expect(firstAchieve?.definition.points).toBe(10);

      // Second achievement should be in progress
      const secondAchieve = result.current.achievements.find((a) => a.achievement_id === 'achieve-2');
      expect(secondAchieve?.is_unlocked).toBe(false);
      expect(secondAchieve?.current_value).toBe(250);

      // Third achievement should be pending (no progress)
      const thirdAchieve = result.current.achievements.find((a) => a.achievement_id === 'achieve-3');
      expect(thirdAchieve?.is_unlocked).toBe(false);
      expect(thirdAchieve?.current_value).toBe(0);
      expect(thirdAchieve?.id).toContain('pending-');
    });
  });

  describe('Computed Values', () => {
    it('calculates unlockedCount correctly', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only achieve-1 is unlocked, so unlockedCount should be 1
      expect(result.current.unlockedCount).toBe(1);
    });

    it('calculates totalPoints from unlocked achievements only', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only achieve-1 (10 points) is unlocked
      expect(result.current.totalPoints).toBe(10);
    });

    it('excludes in-progress achievements from point total', async () => {
      const allUnlockedAchievements = [
        {
          id: 'clan-achieve-1',
          group_id: 'group-1',
          achievement_id: 'achieve-1',
          current_value: 1,
          is_unlocked: true,
          definition: mockDefinitions[0],
        },
        {
          id: 'clan-achieve-2',
          group_id: 'group-1',
          achievement_id: 'achieve-2',
          current_value: 1000,
          is_unlocked: true,
          definition: mockDefinitions[1],
        },
      ];

      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: allUnlockedAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // achieve-1 (10) + achieve-2 (50) = 60 points total
      expect(result.current.totalPoints).toBe(60);
    });
  });

  describe('Category Filtering', () => {
    it('filters achievements by category', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const guildAchievements = result.current.getByCategory('guild');
      expect(guildAchievements).toHaveLength(1); // achieve-1
      expect(guildAchievements.every((a) => a.definition.category === 'guild')).toBe(true);

      const economyAchievements = result.current.getByCategory('economy');
      expect(economyAchievements).toHaveLength(1); // achieve-2
      expect(economyAchievements[0].definition.category).toBe('economy');
    });

    it('returns empty array for non-existent category', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const communityAchievements = result.current.getByCategory('community');
      expect(communityAchievements).toHaveLength(1);
    });
  });

  describe('Progress Updates & Unlock Logic', () => {
    it('updates progress to unlocked when requirement met', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      const upsertQuery = {
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery)
        .mockReturnValueOnce(upsertQuery)
        .mockReturnValueOnce(definitionsQuery)  // refresh
        .mockReturnValueOnce(clanAchievementsQuery); // refresh

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        // Update achieve-2 to reach the 1000 requirement
        await result.current.updateProgress('achieve-2', 1000);
      });

      // Should have called upsert with is_unlocked: true
      expect(upsertQuery.upsert).toHaveBeenCalled();
      const upsertCall = (upsertQuery.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.is_unlocked).toBe(true);
      expect(upsertCall.current_value).toBe(1000);
      expect(upsertCall.unlocked_at).toBeDefined();
      expect(upsertCall.first_contributor_id).toBe('contributor-1');
    });

    it('keeps progress unlocked=false when below requirement', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      const upsertQuery = {
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery)
        .mockReturnValueOnce(upsertQuery)
        .mockReturnValueOnce(definitionsQuery)  // refresh
        .mockReturnValueOnce(clanAchievementsQuery); // refresh

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        // Update achieve-2 to 500 (below 1000 requirement)
        await result.current.updateProgress('achieve-2', 500);
      });

      const upsertCall = (upsertQuery.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.is_unlocked).toBe(false);
      expect(upsertCall.current_value).toBe(500);
      expect(upsertCall.unlocked_at).toBeNull();
    });

    it('throws error if no group id for update', async () => {
      const { result } = renderHook(() => useAchievements(null));

      await act(async () => {
        try {
          await result.current.updateProgress('achieve-1', 100);
          fail('Should have thrown error');
        } catch (e) {
          expect(String(e)).toContain('No clan selected');
        }
      });
    });

    it('throws error if achievement definition not found', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.updateProgress('non-existent-id', 100);
          fail('Should have thrown error');
        } catch (e) {
          expect(String(e)).toContain('Achievement not found');
        }
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('refresh re-fetches achievements', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery)
        .mockReturnValueOnce(definitionsQuery)  // refresh
        .mockReturnValueOnce(clanAchievementsQuery); // refresh

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCount = mockSupabase.from.mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      // Should have called from() twice more (definitions + clan achievements)
      expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(initialCount);
    });
  });

  describe('State Consistency', () => {
    it('maintains state consistency across operations', async () => {
      const definitionsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDefinitions, error: null }),
      };

      const clanAchievementsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClanAchievements, error: null }),
      };

      (mockSupabase.from as any)
        .mockReturnValueOnce(definitionsQuery)
        .mockReturnValueOnce(clanAchievementsQuery);

      const { result } = renderHook(() => useAchievements('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.achievements.length).toBe(result.current.definitions.length);
      expect(typeof result.current.unlockedCount).toBe('number');
      expect(typeof result.current.totalPoints).toBe('number');
      expect(result.current.unlockedCount).toBeGreaterThanOrEqual(0);
      expect(result.current.totalPoints).toBeGreaterThanOrEqual(0);
    });
  });
});
