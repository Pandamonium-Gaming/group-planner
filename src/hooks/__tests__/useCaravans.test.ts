/**
 * Phase 2 Tests: useCaravans Hook - Sprint 6
 * Tests for caravan management, escort coordination, and waypoint tracking
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useCaravans } from '../useCaravans';

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

const mockSupabase = jest.mocked(supabase);

const mockCaravans = [
  {
    id: 'caravan-1',
    group_id: 'group-1',
    title: 'Desert Supply Run',
    description: 'Transporting goods to outposts',
    caravan_type: 'supply',
    origin_node: 'Tulnar Keep',
    destination_node: 'Karran Hold',
    departure_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    estimated_arrival_at: new Date(Date.now() + 172800000).toISOString(), // +2 days
    status: 'active',
    caravan_escorts: [
      {
        id: 'escort-1',
        character_id: 'char-1',
        user_id: 'user-1',
        role: 'lead_escort',
        confirmed: true,
        members: { name: 'Warrior One' },
      },
    ],
    caravan_waypoints: [
      { id: 'wp-1', order_index: 1, location_name: 'Rest Stop 1', notes: 'Safe zone' },
    ],
  },
  {
    id: 'caravan-2',
    group_id: 'group-1',
    title: 'Past Event',
    description: 'Already completed',
    caravan_type: 'exploration',
    origin_node: 'Node A',
    destination_node: 'Node B',
    departure_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: 'completed',
    caravan_escorts: [],
    caravan_waypoints: [],
  },
];

describe('useCaravans Hook - Phase 2 Sprint 6', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useCaravans('group-1'));

      expect(result.current.caravans).toEqual([]);
      expect(result.current.upcomingCaravans).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null groupId early without fetching', () => {
      const { result } = renderHook(() => useCaravans(null));

      expect(result.current.caravans).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('exposes all required API methods', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createCaravan).toBe('function');
      expect(typeof result.current.updateCaravan).toBe('function');
      expect(typeof result.current.updateStatus).toBe('function');
      expect(typeof result.current.cancelCaravan).toBe('function');
      expect(typeof result.current.signUpAsEscort).toBe('function');
      expect(typeof result.current.withdrawEscort).toBe('function');
      expect(typeof result.current.confirmEscort).toBe('function');
      expect(typeof result.current.addWaypoint).toBe('function');
      expect(typeof result.current.removeWaypoint).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Caravan Fetching & Transformation', () => {
    it('fetches caravans and transforms escorts and waypoints', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCaravans, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.caravans).toHaveLength(2);
      expect(result.current.caravans[0].title).toBe('Desert Supply Run');
      expect(result.current.caravans[0].escorts).toHaveLength(1);
      expect(result.current.caravans[0]?.escorts[0]?.character?.name).toBe('Warrior One');
      expect(result.current.caravans[0].waypoints).toHaveLength(1);
    });

    it('handles fetch error gracefully', async () => {
      const errorMsg = 'Database error';
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) }),
      });

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.caravans).toEqual([]);
    });
  });

  describe('Upcoming Caravans Filter', () => {
    it('filters only future, active caravans', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCaravans, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.upcomingCaravans).toHaveLength(1);
      expect(result.current.upcomingCaravans[0].id).toBe('caravan-1');
      expect(result.current.upcomingCaravans[0].status).toBe('active');
    });

    it('excludes completed, failed, and cancelled caravans', async () => {
      const caravansWithStates = [
        { ...mockCaravans[0] },
        { ...mockCaravans[1], status: 'failed' },
        { ...mockCaravans[1], id: 'caravan-3', status: 'cancelled' },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: caravansWithStates, error: null }),
      });

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.upcomingCaravans).toHaveLength(1);
      expect(result.current.upcomingCaravans[0].id).toBe('caravan-1');
    });
  });

  describe('Caravan Creation', () => {
    it('creates caravan with auth and groupId', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const insertQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'caravan-new' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let caravanId: string | undefined;
      await act(async () => {
        caravanId = await result.current.createCaravan({
          title: 'New Caravan',
          caravan_type: 'escort',
          origin_node: 'Start',
          destination_node: 'End',
          departure_at: new Date().toISOString(),
        });
      });

      expect(caravanId).toBe('caravan-new');
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'group-1',
          created_by: 'user-1',
          title: 'New Caravan',
        })
      );
    });

    it('throws error if no groupId for creation', async () => {
      const { result } = renderHook(() => useCaravans(null));

      await act(async () => {
        try {
          await result.current.createCaravan({
            title: 'Test',
            caravan_type: 'guild',
            origin_node: 'A',
            destination_node: 'B',
            departure_at: new Date().toISOString(),
          });
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('No clan selected');
        }
      });
    });
  });

  describe('Caravan Status Management', () => {
    it('updates caravan status with timestamp on completion', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCaravans, error: null }),
      };

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateStatus('caravan-1', 'completed');
      });

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String),
        })
      );
    });

    it('cancels caravan by status update', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCaravans, error: null }),
      };

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.cancelCaravan('caravan-1');
      });

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
        })
      );
    });
  });

  describe('Escort Management', () => {
    it('signs up character as escort', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data:[], error: null }),
      };

      const escortQuery = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(escortQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpAsEscort('caravan-1', 'char-1', 'lead_escort');
      });

      expect(escortQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          caravan_id: 'caravan-1',
          character_id: 'char-1',
          user_id: 'user-1',
          role: 'lead_escort',
        })
      );
    });

    it('withdraws character from escort list', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const deleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest
          .fn()
          .mockReturnValueOnce({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          })
          .mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(deleteQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.withdrawEscort('caravan-1', 'char-1');
      });

      expect(deleteQuery.delete).toHaveBeenCalled();
    });

    it('confirms escort participation', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.confirmEscort('escort-1');
      });

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ confirmed: true })
      );
    });
  });

  describe('Waypoint Management', () => {
    it('adds waypoint to caravan', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const waypointQuery = {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(waypointQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addWaypoint('caravan-1', {
          order_index: 2,
          location_name: 'Waypoint 2',
          is_danger_zone: true,
        });
      });

      expect(waypointQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          caravan_id: 'caravan-1',
          order_index: 2,
          location_name: 'Waypoint 2',
          is_danger_zone: true,
        })
      );
    });

    it('removes waypoint from caravan', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const deleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(deleteQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.removeWaypoint('wp-1');
      });

      expect(deleteQuery.delete).toHaveBeenCalled();
    });
  });

  describe('Refresh & State', () => {
    it('refresh re-fetches all caravans', async () => {
      const caravansQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockCaravans, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(caravansQuery)
        .mockReturnValueOnce(caravansQuery);

      const { result } = renderHook(() => useCaravans('group-1'));

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
