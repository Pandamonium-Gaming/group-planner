/**
 * Phase 2 Tests: useGuildBank Hook - Sprint 7
 * Tests for bank management, inventory transactions, and resource requests
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useGuildBank } from '../useGuildBank';

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

const mockBank = {
  id: 'bank-1',
  group_id: 'group-1',
  name: 'Clan Treasury',
  gold_balance: 50000,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const mockCatalog = [
  { id: 'res-1', name: 'Iron Ore', category: 'material' },
  { id: 'res-2', name: 'Leather', category: 'material' },
  { id: 'res-3', name: 'Health Potion', category: 'consumable' },
];

const mockInventory = [
  {
    id: 'inv-1',
    bank_id: 'bank-1',
    resource_id: 'res-1',
    quantity: 500,
    resource_catalog: mockCatalog[0],
  },
  {
    id: 'inv-2',
    bank_id: 'bank-1',
    resource_id: 'res-3',
    quantity: 100,
    resource_catalog: mockCatalog[2],
  },
];

const mockTransactions = [
  {
    id: 'tx-1',
    bank_id: 'bank-1',
    resource_id: 'res-1',
    transaction_type: 'deposit',
    quantity: 100,
    gold_amount: null,
    user_id: 'user-1',
    created_at: '2026-01-15',
    resource_catalog: mockCatalog[0],
    users: { display_name: 'PlayerOne' },
    members: null,
  },
];

const mockRequests = [
  {
    id: 'req-1',
    bank_id: 'bank-1',
    resource_id: 'res-1',
    requested_by: 'user-1',
    character_id: 'char-1',
    quantity: 50,
    status: 'pending',
    reason: 'Quest materials',
    created_at: '2026-01-16',
    resource_catalog: mockCatalog[0],
    users: { display_name: 'PlayerOne' },
    members: { name: 'Warrior' },
  },
];

describe('useGuildBank Hook - Phase 2 Sprint 7', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'guild_banks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }

      if (table === 'resource_catalog') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest
            .fn()
            .mockReturnValueOnce({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })
            .mockResolvedValue({ data: [], error: null }),
        } as any;
      }

      if (table === 'bank_inventory') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }

      if (table === 'bank_transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }

      if (table === 'resource_requests') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }

      return {
        select: jest.fn().mockReturnThis(),
      } as any;
    });
  });

  describe('Hook Initialization & Loading State', () => {
    it('initializes with empty state and loading=true', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useGuildBank('group-1'));

      expect(result.current.bank).toBeNull();
      expect(result.current.inventory).toEqual([]);
      expect(result.current.transactions).toEqual([]);
      expect(result.current.requests).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns early with null groupId', () => {
      const { result } = renderHook(() => useGuildBank(null));

      expect(result.current.bank).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('exposes all required API methods', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.initializeBank).toBe('function');
      expect(typeof result.current.updateBankSettings).toBe('function');
      expect(typeof result.current.deposit).toBe('function');
      expect(typeof result.current.withdraw).toBe('function');
      expect(typeof result.current.adjustGold).toBe('function');
      expect(typeof result.current.createRequest).toBe('function');
      expect(typeof result.current.approveRequest).toBe('function');
      expect(typeof result.current.denyRequest).toBe('function');
      expect(typeof result.current.fulfillRequest).toBe('function');
      expect(typeof result.current.searchResources).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('Bank Data Fetching', () => {
    it('fetches bank data and transforms nested joins', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      const catalogQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest
          .fn()
          .mockReturnValueOnce({
            order: jest.fn().mockResolvedValue({ data: mockCatalog, error: null }),
          })
          .mockResolvedValue({ data: mockCatalog, error: null }),
      };

      const inventoryQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockInventory, error: null }),
      };

      const txQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
      };

      const reqQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockRequests, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(catalogQuery)
        .mockReturnValueOnce(inventoryQuery)
        .mockReturnValueOnce(txQuery)
        .mockReturnValueOnce(reqQuery);

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.bank).toEqual(mockBank);
      expect(result.current.inventory).toHaveLength(2);
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.requests).toHaveLength(1);
      expect(result.current.resourceCatalog).toHaveLength(3);
    });

    it('handles fetch error gracefully', async () => {
      const errorMsg = 'Database error';
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error(errorMsg) }),
      });

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.bank).toBeNull();
    });
  });

  describe('Bank Initialization', () => {
    it('initializeBank method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.initializeBank).toBe('function');
    });

    it('throws error if no groupId for initialization', async () => {
      const { result } = renderHook(() => useGuildBank(null));

      await act(async () => {
        try {
          await result.current.initializeBank();
          fail('Should throw error');
        } catch (e) {
          expect(String(e)).toContain('No clan selected');
        }
      });
    });
  });

  describe('Bank Settings Management', () => {
    it('updateBankSettings method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateBankSettings).toBe('function');
    });
  });

  describe('Transactions', () => {
    it('deposit method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.deposit).toBe('function');
    });

    it('withdraw method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.withdraw).toBe('function');
    });

    it('adjustGold method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.adjustGold).toBe('function');
    });
  });

  describe('Request Management', () => {
    it('createRequest method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.createRequest).toBe('function');
    });

    it('approveRequest method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.approveRequest).toBe('function');
    });

    it('denyRequest method is available', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'));

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.denyRequest).toBe('function');
    });
  });

  describe('Resource Search', () => {
    it('search method is available on hook', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(bankQuery);

      const { result } = renderHook(() => useGuildBank('group-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.searchResources).toBe('function');
    });
  });

  describe('Refresh & State', () => {
    it('refresh re-fetches all bank data', async () => {
      const bankQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockBank, error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'))
        .mockReturnValueOnce(mockSupabase.from('bank_inventory'))
        .mockReturnValueOnce(mockSupabase.from('bank_transactions'))
        .mockReturnValueOnce(mockSupabase.from('resource_requests'))
        .mockReturnValueOnce(bankQuery)
        .mockReturnValueOnce(mockSupabase.from('resource_catalog'));

      const { result } = renderHook(() => useGuildBank('group-1'));

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
