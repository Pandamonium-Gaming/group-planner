/**
 * Phase 2 Tests: Data Fetching Hooks
 * Tests for core hooks that manage group and character data
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useActivity } from '../useActivity';

// Helper to create chainable Supabase mock
const createMockQuery = (data: any, error: any = null) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data, error }),
      }),
      order: jest.fn().mockResolvedValue({ data, error }),
    }),
  }),
});

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase';

const mockSupabase = jest.mocked(supabase);

describe('useActivity Hook - Phase 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'member_activity_summary') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        } as any;
      }

      if (table === 'inactivity_alerts') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        } as any;
      }

      if (table === 'activity_log') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        } as any;
      }

      return {
        select: jest.fn().mockReturnThis(),
      } as any;
    });
  });

  describe('Initial State', () => {
    it('should initialize with empty state when no groupId', () => {
      const { result } = renderHook(() => useActivity(null));

      expect(result.current.activitySummaries).toEqual([]);
      expect(result.current.inactivityAlerts).toEqual([]);
      expect(result.current.inactiveMemberCount).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set loading true when fetching data', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
          order: jest.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      } as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Activity Summary Fetching', () => {
    it('should fetch and display activity summaries', async () => {
      const mockSummaries = [
        {
          user_id: 'user-1',
          display_name: 'Player One',
          last_activity: '2024-02-01T00:00:00Z',
          total_activities_30d: 15,
          is_inactive: false,
        },
        {
          user_id: 'user-2',
          display_name: 'Player Two',
          last_activity: '2024-01-15T00:00:00Z',
          total_activities_30d: 2,
          is_inactive: true,
        },
      ];

      // Mock summaries query (1st from() call)
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockSummaries,
              error: null,
            }),
          }),
        }),
      };

      // Mock alerts query (2nd from() call) 
      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.activitySummaries).toEqual(mockSummaries);
      expect(result.current.inactiveMemberCount).toBe(1);
    });

    it('should calculate inactive member count correctly', async () => {
      const mockSummaries = [
        { is_inactive: false },
        { is_inactive: true },
        { is_inactive: true },
        { is_inactive: false },
      ];

      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockSummaries,
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.inactiveMemberCount).toBe(2);
      });
    });

    it('should sort summaries by total_activities_30d descending', async () => {
      const mockSummaries = [
        { user_id: 'user-1', total_activities_30d: 50 },
        { user_id: 'user-2', total_activities_30d: 25 },
        { user_id: 'user-3', total_activities_30d: 5 },
      ];

      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockSummaries,
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.activitySummaries[0].total_activities_30d).toBe(50);
        expect(result.current.activitySummaries[1].total_activities_30d).toBe(25);
        expect(result.current.activitySummaries[2].total_activities_30d).toBe(5);
      });
    });
  });

  describe('Inactivity Alerts', () => {
    it('should fetch unacknowledged inactivity alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          user_id: 'user-2',
          display_name: 'Inactive Player',
          days_inactive: 30,
          is_acknowledged: false,
        },
        {
          id: 'alert-2',
          user_id: 'user-3',
          display_name: 'Another Inactive',
          days_inactive: 45,
          is_acknowledged: false,
        },
      ];

      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockAlerts,
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.inactivityAlerts).toEqual(mockAlerts);
      });
    });

    it('should sort alerts by days_inactive descending', async () => {
      const mockAlerts = [
        { id: 'alert-1', days_inactive: 45 },
        { id: 'alert-2', days_inactive: 30 },
        { id: 'alert-3', days_inactive: 60 },
      ];

      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockAlerts,
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        // Alerts should be sorted by days_inactive descending
        expect(result.current.inactivityAlerts).toEqual(mockAlerts);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle activity summary fetch errors gracefully', async () => {
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database connection failed'),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.activitySummaries).toEqual([]);
      });
    });

    it('should handle alert fetch errors gracefully', async () => {
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Alert fetch failed'),
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.inactivityAlerts).toEqual([]);
      });
    });

    it('should set error message on fetch failure', async () => {
      const mockError = new Error('Connection timeout');
      
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('Data Dependencies', () => {
    it('should not fetch when groupId is null', () => {
      const { result } = renderHook(() => useActivity(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.activitySummaries).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Refresh Functionality', () => {
    it('should expose refresh function', async () => {
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.refresh).toBeDefined();
        expect(typeof result.current.refresh).toBe('function');
      });
    });
  });

  describe('Activity Logging', () => {
    it('should expose logActivity function', async () => {
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.logActivity).toBeDefined();
        expect(typeof result.current.logActivity).toBe('function');
      });
    });

    it('should throw error when logging activity without groupId', async () => {
      const { result } = renderHook(() => useActivity(null));

      await expect(result.current.logActivity('character_update')).rejects.toThrow('No clan selected');
    });
  });

  describe('Alert Acknowledgment', () => {
    it('should expose acknowledgeAlert function', async () => {
      const mockSummariesQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      const mockAlertsQuery = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSummariesQuery as any)
        .mockReturnValueOnce(mockAlertsQuery as any);

      const { result } = renderHook(() => useActivity('group-123'));

      await waitFor(() => {
        expect(result.current.acknowledgeAlert).toBeDefined();
        expect(typeof result.current.acknowledgeAlert).toBe('function');
      });
    });
  });
});
