/**
 * Phase 2 Tests: useFreeholds Hook - Sprint 8
 * Tests for freehold management and building additions
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useFreeholds } from '../useFreeholds';

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

const mockFreeholds = [
  {
    id: 'fh-1',
    group_id: 'group-1',
    owner_id: 'user-1',
    name: 'Crimson Hold',
    node_name: 'Varcrest',
    size: 'large',
    is_public: false,
    freehold_buildings: [
      {
        id: 'bldg-1',
        freehold_id: 'fh-1',
        building_type: 'tavern',
        building_name: 'The Crossed Blades',
        tier: 2,
      },
    ],
    users: { display_name: 'PlayerOne' },
    members: { name: 'Lord Crimson' },
  },
  {
    id: 'fh-2',
    group_id: 'group-1',
    owner_id: 'user-2',
    name: 'Trade Post',
    node_name: 'Dunir',
    size: 'small',
    is_public: true,
    freehold_buildings: [],
    users: { display_name: 'PlayerTwo' },
    members: { name: 'Merchant Two' },
  },
];

describe('useFreeholds Hook - Phase 2 Sprint 8', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFreeholds('group-1'));

      expect(result.current.freeholds).toEqual([]);
      expect(result.current.myFreehold).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null groupId early without fetching', () => {
      const { result } = renderHook(() => useFreeholds(null));

      expect(result.current.freeholds).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('exposes all required API methods', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createFreehold).toBe('function');
      expect(typeof result.current.updateFreehold).toBe('function');
      expect(typeof result.current.deleteFreehold).toBe('function');
      expect(typeof result.current.addBuilding).toBe('function');
      expect(typeof result.current.updateBuilding).toBe('function');
      expect(typeof result.current.removeBuilding).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Freehold Fetching & Transformation', () => {
    it('fetches freeholds and transforms buildings and owners', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.freeholds).toHaveLength(2);
      expect(result.current.freeholds[0].name).toBe('Crimson Hold');
      expect(result.current.freeholds[0].buildings).toHaveLength(1);
      expect(result.current.freeholds[0]?.owner?.display_name).toBe('PlayerOne');
      expect(result.current.freeholds[0]?.owner_character?.name).toBe('Lord Crimson');
    });

    it('handles fetch error gracefully', async () => {
      const errorMsg = 'Database error';
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) }),
      });

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.freeholds).toEqual([]);
    });
  });

  describe('Freehold Creation', () => {
    it('creates freehold with auth and groupId', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const insertQuery = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      supabase.from
        .mockReturnValueOnce(freeholdsQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.createFreehold({
          name: 'New Hold',
          size: 'medium',
          node_name: 'Varcrest',
        });
      });

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'group-1',
          owner_id: 'user-1',
          name: 'New Hold',
          size: 'medium',
        })
      );
    });

    it('throws error if no groupId for creation', async () => {
      const { result } = renderHook(() => useFreeholds(null));

      await act(async () => {
        try {
          await result.current.createFreehold({
            name: 'Test',
            size: 'small',
          });
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('No clan selected');
        }
      });
    });

    it('throws error if not authenticated', async () => {
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.createFreehold({
            name: 'Test',
            size: 'small',
          });
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('Not authenticated');
        }
      });
    });
  });

  describe('Freehold Updates & Deletion', () => {
    it('updateFreehold method is available', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateFreehold).toBe('function');
    });

    it('deleteFreehold method is available', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.deleteFreehold).toBe('function');
    });
  });

  describe('Building Management', () => {
    it('addBuilding method is available', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.addBuilding).toBe('function');
    });

    it('updateBuilding method is available', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateBuilding).toBe('function');
    });

    it('removeBuilding method is available', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.removeBuilding).toBe('function');
    });
  });

  describe('myFreehold Computed Property', () => {
    it('initially returns null for myFreehold', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from.mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.myFreehold).toBeNull();
    });
  });

  describe('Refresh & State', () => {
    it('refresh re-fetches all freeholds', async () => {
      const freeholdsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFreeholds, error: null }),
      };

      supabase.from
        .mockReturnValueOnce(freeholdsQuery)
        .mockReturnValueOnce(freeholdsQuery);

      const { result } = renderHook(() => useFreeholds('group-1'));

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
