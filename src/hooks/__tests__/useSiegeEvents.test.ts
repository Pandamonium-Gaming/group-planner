import { act, renderHook, waitFor } from '@testing-library/react';
import { useSiegeEvents } from '../useSiegeEvents';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('useSiegeEvents', () => {
  const mockGroupId = 'group-123';
  const mockUserId = 'user-123';

  // Generate dynamic dates relative to today
  const now = new Date();
  const futureDateStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
  const pastDateStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

  const mockSiegeData = [
    {
      id: 'siege-1',
      clan_id: mockGroupId,
      title: 'Castle Siege Alpha',
      description: 'Attack on Red Castle',
      siege_type: 'castle_attack',
      target_name: 'Red Castle',
      starts_at: futureDateStr, // Future date
      declaration_ends_at: '2026-02-28T18:00:00Z',
      max_participants: 250,
      frontline_needed: 80,
      ranged_needed: 60,
      healer_needed: 40,
      siege_operator_needed: 20,
      scout_needed: 10,
      reserve_needed: 40,
      is_cancelled: false,
      result: null,
      created_by: mockUserId,
      created_at: '2026-02-10T10:00:00Z',
      updated_at: '2026-02-10T10:00:00Z',
      siege_roster: [
        {
          id: 'roster-1',
          siege_id: 'siege-1',
          character_id: 'char-1',
          user_id: mockUserId,
          role: 'frontline',
          is_leader: true,
          priority: 10,
          status: 'confirmed',
          signed_up_at: '2026-02-10T11:00:00Z',
          confirmed_at: '2026-02-10T12:00:00Z',
          checked_in_at: null,
          note: 'Ready for battle',
          members: {
            id: 'char-1',
            name: 'Tank Warrior',
            race: 'tulnar',
            primary_archetype: 'tank',
            secondary_archetype: 'fighter',
            level: 50,
            is_main: true,
          },
        },
      ],
    },
    {
      id: 'siege-2',
      clan_id: mockGroupId,
      title: 'Node Defense',
      description: 'Defend our node',
      siege_type: 'node_defense',
      target_name: 'Winstead',
      starts_at: pastDateStr, // Past date
      declaration_ends_at: null,
      max_participants: 200,
      frontline_needed: 60,
      ranged_needed: 50,
      healer_needed: 30,
      siege_operator_needed: 15,
      scout_needed: 5,
      reserve_needed: 40,
      is_cancelled: false,
      result: 'victory',
      created_by: mockUserId,
      created_at: '2025-12-20T10:00:00Z',
      updated_at: '2026-01-02T10:00:00Z',
      siege_roster: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock auth.getUser
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty state and loading true', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      expect(result.current.sieges).toEqual([]);
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should return early when groupId is null', async () => {
      const { result } = renderHook(() => useSiegeEvents(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sieges).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should expose all required methods and properties', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Data properties
      expect(result.current).toHaveProperty('sieges');
      expect(result.current).toHaveProperty('upcomingSieges');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');

      // Event management methods
      expect(result.current).toHaveProperty('createSiege');
      expect(result.current).toHaveProperty('updateSiege');
      expect(result.current).toHaveProperty('cancelSiege');
      expect(result.current).toHaveProperty('setSiegeResult');

      // Roster management methods
      expect(result.current).toHaveProperty('signUp');
      expect(result.current).toHaveProperty('withdraw');
      expect(result.current).toHaveProperty('updateRosterStatus');

      // Utility method
      expect(result.current).toHaveProperty('refresh');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch sieges with nested roster and character data', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.sieges).toHaveLength(2);
      expect(result.current.sieges[0].title).toBe('Castle Siege Alpha');
      expect(result.current.sieges[0].roster).toHaveLength(1);
    });

    it('should transform roster data with character enrichment', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const rosterEntry = result.current.sieges[0].roster[0];
      expect(rosterEntry.character).toBeDefined();
      expect(rosterEntry.character?.name).toBe('Tank Warrior');
      expect(rosterEntry.character?.primary_archetype).toBe('tank');
      expect(rosterEntry.role).toBe('frontline');
      expect(rosterEntry.status).toBe('confirmed');
    });

    it('should handle fetch errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Database connection failed');
      expect(result.current.sieges).toEqual([]);
    });
  });

  describe('Siege Event Management', () => {
    it('should create a new siege event', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      const mockInsertQuery = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'siege-new',
                group_id: mockGroupId,
                title: 'New Siege',
                siege_type: 'castle_attack',
                target_name: 'Blue Castle',
                starts_at: '2026-04-01T18:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockInsertQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let newSiege: { id: string } | null = null;
      await act(async () => {
        newSiege = await result.current.createSiege({
          title: 'New Siege',
          siege_type: 'castle_attack',
          target_name: 'Blue Castle',
          starts_at: '2026-04-01T18:00:00Z',
        });
      });

      expect(newSiege.id).toBe('siege-new');
      expect(mockInsertQuery.insert).toHaveBeenCalled();
    });

    it('should update an existing siege event', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSiege('siege-1', {
          title: 'Updated Siege Title',
        });
      });

      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Siege Title',
        })
      );
    });

    it('should cancel a siege event', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.cancelSiege('siege-1');
      });

      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_cancelled: true,
        })
      );
    });

    it('should set siege result after completion', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.setSiegeResult('siege-1', 'victory');
      });

      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'victory',
        })
      );
    });
  });

  describe('Roster Management', () => {
    it('should sign up a character for a siege', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockUpsertQuery = {
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockUpsertQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('siege-1', {
          character_id: 'char-2',
          role: 'healer',
          note: 'Ready to heal',
        });
      });

      expect(mockUpsertQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          siege_id: 'siege-1',
          character_id: 'char-2',
          role: 'healer',
          note: 'Ready to heal',
        }),
        { onConflict: 'siege_id,character_id' }
      );
    });

    it('should withdraw a character from a siege', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockDeleteQuery = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockDeleteQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.withdraw('siege-1', 'char-1');
      });

      expect(mockDeleteQuery.delete).toHaveBeenCalled();
    });

    it('should update roster status with conditional timestamps', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      const mockUpdateQuery = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        })
        .mockReturnValueOnce(mockUpdateQuery)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue(mockSelectQuery),
        });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRosterStatus('roster-1', 'checked_in');
      });

      expect(mockUpdateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'checked_in',
          checked_in_at: expect.any(String),
        })
      );
    });
  });

  describe('Upcoming Sieges Filter', () => {
    it('should filter upcoming sieges (future dates, not cancelled)', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Only siege-1 has a future date (7 days from now)
      // siege-2 has a past date (30 days ago)
      expect(result.current.upcomingSieges).toHaveLength(1);
      expect(result.current.upcomingSieges[0].id).toBe('siege-1');
      expect(result.current.upcomingSieges[0].title).toBe('Castle Siege Alpha');
    });
  });

  describe('Refresh Functionality', () => {
    it('should re-fetch all siege data when refresh is called', async () => {
      const mockSelectQuery = {
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockSiegeData, error: null }),
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue(mockSelectQuery),
      });

      const { result } = renderHook(() => useSiegeEvents(mockGroupId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = (supabase.from as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((supabase.from as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
