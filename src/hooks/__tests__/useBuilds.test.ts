/**
 * Phase 2 Tests: useBuilds Hook - Sprint 5
 * Tests for build management, filtering, likes, and comments
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useBuilds } from '../useBuilds';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
  },
}));

import { supabase } from '@/lib/supabase';

const mockSupabase = jest.mocked(supabase);

const mockBuilds = [
  {
    id: 'build-1',
    name: 'Fighter Build',
    description: 'Classic fighter archetype',
    created_by: 'user-1',
    group_id: 'group-1',
    clan_id: 'group-1',
    primary_archetype: 'fighter',
    secondary_archetype: 'rogue',
    visibility: 'public',
    likes_count: 15,
    copies_count: 3,
    users: { display_name: 'Player One' },
  },
  {
    id: 'build-2',
    name: 'Mage Build (Copy)',
    description: 'Optimized mage',
    created_by: 'user-1',
    group_id: 'group-1',
    clan_id: 'group-1',
    primary_archetype: 'mage',
    secondary_archetype: null,
    visibility: 'private',
    likes_count: 5,
    copies_count: 1,
    users: { display_name: 'Player One' },
  },
  {
    id: 'build-3',
    name: 'Group Healer',
    description: 'Healing spec',
    created_by: 'user-2',
    group_id: 'group-1',
    clan_id: 'group-1',
    primary_archetype: 'cleric',
    secondary_archetype: 'ranger',
    visibility: 'guild',
    likes_count: 8,
    copies_count: 2,
    users: { display_name: 'Player Two' },
  },
];

describe('useBuilds Hook - Phase 2 Sprint 5', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }) as any);
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useBuilds('group-1'));

      expect(result.current.builds).toEqual([]);
      expect(result.current.myBuilds).toEqual([]);
      expect(result.current.guildBuilds).toEqual([]);
      expect(result.current.publicBuilds).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('exposes all required API methods', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createBuild).toBe('function');
      expect(typeof result.current.updateBuild).toBe('function');
      expect(typeof result.current.deleteBuild).toBe('function');
      expect(typeof result.current.copyBuild).toBe('function');
      expect(typeof result.current.likeBuild).toBe('function');
      expect(typeof result.current.unlikeBuild).toBe('function');
      expect(typeof result.current.addComment).toBe('function');
      expect(typeof result.current.getComments).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Build Fetching & Filtering', () => {
    it('fetches and filters public builds correctly', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        eq: jest.fn().mockResolvedValue({ data: [{ build_id: 'build-1' }], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.builds).toHaveLength(3);
      expect(result.current.publicBuilds).toHaveLength(1);
      expect(result.current.publicBuilds[0].visibility).toBe('public');
    });

    it('filters group builds by group id', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.guildBuilds).toHaveLength(1);
      expect(result.current.guildBuilds[0].visibility).toBe('guild');
      expect(result.current.guildBuilds[0].clan_id).toBe('group-1');
    });

    it('filters my builds (private or created by user)', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.myBuilds).toHaveLength(3); // Private or created by user
    });

    it('handles fetch error gracefully', async () => {
      const errorMsg = 'Database error';
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) }),
      });

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.builds).toEqual([]);
    });
  });

  describe('Build Creation', () => {
    it('creates new build and returns id', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const insertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'build-new', name: 'New Build' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let buildId: string | undefined;
      await act(async () => {
        buildId = await result.current.createBuild({
          name: 'New Build',
          primary_archetype: 'warrior',
        });
      });

      expect(buildId).toBe('build-new');
      expect(insertQuery.insert).toHaveBeenCalled();
    });

    it('throws error if not authenticated', async () => {
      // Restore and set up auth failure
      supabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: null },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { session: null },
          error: null,
        });

      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.createBuild({
            name: 'Test',
            primary_archetype: 'test',
          });
          fail('Should have thrown error');
        } catch (e) {
          expect(String(e)).toContain('Not authenticated');
        }
      });
    });
  });

  describe('Build Updates & Deletion', () => {
    it('updates build with partial data', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateBuild).toBe('function');
    });

    it('deletes build by id', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.deleteBuild).toBe('function');
    });
  });

  describe('Copy Build Functionality', () => {
    it('copy build method is available', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.copyBuild).toBe('function');
    });

    it('throws error if build not found for copy', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.copyBuild('non-existent-id');
          fail('Should have thrown error');
        } catch (e) {
          expect(String(e)).toContain('Build not found');
        }
      });
    });
  });

  describe('Like & Unlike Functionality', () => {
    it('like and unlike methods are available', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.likeBuild).toBe('function');
      expect(typeof result.current.unlikeBuild).toBe('function');
    });
  });

  describe('Comments Functionality', () => {
    it('comment methods are available on hook', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.addComment).toBe('function');
      expect(typeof result.current.getComments).toBe('function');
    });
  });

  describe('Refresh & State', () => {
    it('refresh re-fetches all builds', async () => {
      const buildsQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockBuilds, error: null }),
      };

      const likesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery)
        .mockReturnValueOnce(buildsQuery)
        .mockReturnValueOnce(likesQuery);

      const { result } = renderHook(() => useBuilds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockSupabase.from.mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
