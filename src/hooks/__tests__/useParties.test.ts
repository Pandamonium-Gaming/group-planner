/**
 * Phase 2 Tests: useParties Hook - Sprint 10
 * Tests for party management, roster assignment, and role tracking
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useParties } from '../useParties';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@/lib/supabase';

const mockCharacters = [
  {
    id: 'char-1',
    name: 'Warrior',
    group_id: 'group-1',
    user_id: 'user-1',
    race: 'kaelar' as const,
    primary_archetype: 'tank' as const,
    secondary_archetype: null,
    level: 50,
    is_main: true,
    created_at: '2026-01-01',
    professions: [],
  },
  {
    id: 'char-2',
    name: 'Mage',
    group_id: 'group-1',
    user_id: 'user-2',
    race: 'pyrai' as const,
    primary_archetype: 'mage' as const,
    secondary_archetype: null,
    level: 48,
    is_main: true,
    created_at: '2026-01-02',
    professions: [],
  },
  {
    id: 'char-3',
    name: 'Rogue',
    group_id: 'group-1',
    user_id: 'user-3',
    race: 'vek' as const,
    primary_archetype: 'rogue' as const,
    secondary_archetype: null,
    level: 45,
    is_main: false,
    created_at: '2026-01-03',
    professions: [],
  },
  {
    id: 'char-4',
    name: 'Cleric',
    group_id: 'group-1',
    user_id: 'user-4',
    race: 'dunir' as const,
    primary_archetype: 'cleric' as const,
    secondary_archetype: null,
    level: 47,
    is_main: true,
    created_at: '2026-01-04',
    professions: [],
  },
];

const mockParty = {
  id: 'party-1',
  group_id: 'group-1',
  name: 'Raid Team A',
  description: 'Primary raid group',
  tanks_needed: 2,
  clerics_needed: 2,
  bards_needed: 1,
  ranged_dps_needed: 2,
  melee_dps_needed: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const mockRoster = [
  {
    id: 'roster-1',
    party_id: 'party-1',
    character_id: 'char-1',
    role: 'tank',
    assigned_at: '2026-01-05',
    is_confirmed: true,
  },
  {
    id: 'roster-2',
    party_id: 'party-1',
    character_id: 'char-2',
    role: 'dps',
    assigned_at: '2026-01-06',
    is_confirmed: false,
  },
];

const mockPartiesData = {
  ...mockParty,
  party_roster: mockRoster,
};

describe('useParties Hook - Phase 2 Sprint 10', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      expect(result.current.parties).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns early with null groupId', () => {
      const { result } = renderHook(() => useParties(null, mockCharacters));

      expect(result.current.parties).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('exposes all required API methods', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createParty).toBe('function');
      expect(typeof result.current.updateParty).toBe('function');
      expect(typeof result.current.deleteParty).toBe('function');
      expect(typeof result.current.assignCharacter).toBe('function');
      expect(typeof result.current.removeFromRoster).toBe('function');
      expect(typeof result.current.updateRosterRole).toBe('function');
      expect(typeof result.current.toggleConfirmed).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Party Data Fetching', () => {
    it('fetches parties with roster and enriches character data', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockPartiesData],
          error: null,
        }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.parties).toHaveLength(1);
      expect(result.current.parties[0]?.name).toBe('Raid Team A');
      expect(result.current.parties[0]?.roster).toHaveLength(2);
      expect(result.current.parties[0]?.roster[0]?.character?.name).toBe('Warrior');
    });

    it('handles empty parties list gracefully', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.parties).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch error gracefully', async () => {
      const errorMsg = 'Database error';
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.parties).toEqual([]);
    });
  });

  describe('Party Creation', () => {
    it('creates party and refetches data', async () => {
      const newParty = {
        group_id: 'group-1',
        name: 'Raid Team B',
        description: 'Secondary raid group',
        tanks_needed: 2,
        clerics_needed: 2,
        bards_needed: 1,
        ranged_dps_needed: 2,
        melee_dps_needed: 1,
      };

      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const createQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'party-2', ...newParty },
          error: null,
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(createQuery)
        .mockReturnValueOnce(fetchQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const partyId = await act(async () => {
        const party = await result.current.createParty(newParty);
        return party?.id;
      });

      expect(partyId).toBe('party-2');
    });

    it('throws error on create failure', async () => {
      const newParty = {
        group_id: 'group-1',
        name: 'Raid Team',
        description: 'Test',
        tanks_needed: 1,
        clerics_needed: 1,
        bards_needed: 1,
        ranged_dps_needed: 1,
        melee_dps_needed: 1,
      };

      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const createQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Create failed'),
        }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(createQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.createParty(newParty);
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('Create failed');
        }
      });
    });
  });

  describe('Party Updates', () => {
    it('updates party name', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(fetchQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateParty('party-1', { name: 'Updated Team' });
      });

      expect(updateQuery.update).toHaveBeenCalled();
    });

    it('handles update error', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      (supabase.from as any).mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
      });

      await act(async () => {
        try {
          await result.current.updateParty('party-1', { name: 'New Name' });
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('Update failed');
        }
      });
    });
  });

  describe('Party Deletion', () => {
    it('deletes party and removes from state', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const deleteQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(deleteQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.parties).toHaveLength(1);

      await act(async () => {
        await result.current.deleteParty('party-1');
      });

      expect(result.current.parties).toHaveLength(0);
    });
  });

  describe('Roster Management', () => {
    it('assigns character to party with role', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const assignQuery = {
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(assignQuery)
        .mockReturnValueOnce(fetchQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.assignCharacter('party-1', 'char-3', 'melee_dps');
      });

      expect(assignQuery.upsert).toHaveBeenCalled();
    });

    it('removes character from roster', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const removeQuery = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(removeQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.parties[0]?.roster).toHaveLength(2);

      await act(async () => {
        await result.current.removeFromRoster('party-1', 'char-1');
      });

      expect(result.current.parties[0]?.roster).toHaveLength(1);
    });

    it('updates roster role', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const updateQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(updateQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateRosterRole('party-1', 'char-1', 'melee_dps');
      });

      expect(updateQuery.update).toHaveBeenCalled();
    });

    it('toggles character confirmation status', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      const toggleQuery = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(toggleQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleConfirmed('party-1', 'char-1', false);
      });

      expect(result.current.parties[0]?.roster[0]?.is_confirmed).toBe(false);
    });
  });

  describe('Refresh Functionality', () => {
    it('refresh re-fetches all party data', async () => {
      const fetchQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockPartiesData], error: null }),
      };

      (supabase.from as any)
        .mockReturnValueOnce(fetchQuery)
        .mockReturnValueOnce(fetchQuery);

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = (supabase.from as any).mock.calls.length;

      await act(async () => {
        await result.current.refresh();
      });

      expect((supabase.from as any).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Error Handling', () => {
    it('maintains error state on failed operations', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Fetch failed'),
        }),
      });

      const { result } = renderHook(() => useParties('group-1', mockCharacters));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});
