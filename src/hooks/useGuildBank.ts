'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  GuildBank,
  ResourceCatalog,
  BankInventoryWithResource,
  BankTransactionWithDetails,
  ResourceRequestWithDetails,
  BankTransactionType,
  ResourceCategory,
} from '@/lib/types';

// Data for depositing/withdrawing resources
export interface ResourceTransactionData {
  resource_id: string;
  quantity: number;
  notes?: string;
}

// Data for creating resource request
export interface ResourceRequestData {
  resource_id: string;
  character_id?: string;
  quantity: number;
  reason?: string;
}

interface UseGuildBankReturn {
  bank: GuildBank | null;
  inventory: BankInventoryWithResource[];
  transactions: BankTransactionWithDetails[];
  requests: ResourceRequestWithDetails[];
  resourceCatalog: ResourceCatalog[];
  loading: boolean;
  error: string | null;
  // Bank management
  initializeBank: () => Promise<GuildBank>;
  updateBankSettings: (settings: Partial<Pick<GuildBank, 'name' | 'description' | 'deposit_min_role' | 'withdraw_min_role'>>) => Promise<void>;
  // Inventory management
  deposit: (data: ResourceTransactionData) => Promise<void>;
  withdraw: (data: ResourceTransactionData) => Promise<void>;
  adjustGold: (amount: number, notes?: string) => Promise<void>;
  // Request management
  createRequest: (data: ResourceRequestData) => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  denyRequest: (requestId: string) => Promise<void>;
  fulfillRequest: (requestId: string) => Promise<void>;
  // Catalog
  searchResources: (query: string, category?: ResourceCategory) => ResourceCatalog[];
  refresh: () => Promise<void>;
}

export function useGuildBank(groupId: string | null, gameSlug = 'aoc'): UseGuildBankReturn {
  const [bank, setBank] = useState<GuildBank | null>(null);
  const [inventory, setInventory] = useState<BankInventoryWithResource[]>([]);
  const [transactions, setTransactions] = useState<BankTransactionWithDetails[]>([]);
  const [requests, setRequests] = useState<ResourceRequestWithDetails[]>([]);
  const [resourceCatalog, setResourceCatalog] = useState<ResourceCatalog[]>([]);
  const [loading, setLoading] = useState(() => groupId !== null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all bank data
  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch or create bank
      const { data: bankData, error: bankError } = await supabase
        .from('guild_banks')
        .select('*')
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug)
        .maybeSingle();

      if (bankError) throw bankError;

      setBank(bankData as GuildBank | null);

      // Fetch resource catalog
      const { data: catalogData, error: catalogError } = await supabase
        .from('resource_catalog')
        .select('*')
        .eq('game_slug', gameSlug)
        .order('category')
        .order('name');

      if (catalogError) throw catalogError;
      setResourceCatalog((catalogData || []) as ResourceCatalog[]);

      if (!bankData) {
        setInventory([]);
        setTransactions([]);
        setRequests([]);
        setLoading(false);
        return;
      }

      // Fetch inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('bank_inventory')
        .select(`
          *,
          resource_catalog (*)
        `)
        .eq('bank_id', bankData.id)
        .gt('quantity', 0)
        .order('last_updated_at', { ascending: false });

      if (inventoryError) throw inventoryError;

      setInventory((inventoryData || []).map((item) => ({
        ...item,
        resource: item.resource_catalog,
      })) as BankInventoryWithResource[]);

      // Fetch recent transactions
      const { data: txData, error: txError } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          resource_catalog (*),
          users:user_id (display_name),
          members:character_id (name)
        `)
        .eq('bank_id', bankData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txError) throw txError;

      setTransactions((txData || []).map((tx) => ({
        ...tx,
        resource: tx.resource_catalog,
        user: tx.users,
        character: tx.members,
      })) as BankTransactionWithDetails[]);

      // Fetch pending requests
      const { data: requestData, error: requestError } = await supabase
        .from('resource_requests')
        .select(`
          *,
          resource_catalog (*),
          users:requested_by (display_name),
          members:character_id (name)
        `)
        .eq('bank_id', bankData.id)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

      if (requestError) throw requestError;

      setRequests((requestData || []).map((req) => ({
        ...req,
        resource: req.resource_catalog,
        requested_by_user: req.users,
        character: req.members,
      })) as ResourceRequestWithDetails[]);

    } catch (err) {
      console.error('Error fetching guild bank:', err);
      setError(err instanceof Error ? err.message : 'Failed to load guild bank');
    } finally {
      setLoading(false);
    }
  }, [groupId, gameSlug]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchData]);

  // Initialize bank for clan
  const initializeBank = async (): Promise<GuildBank> => {
    if (!groupId) throw new Error('No clan selected');

    const { data, error: createError } = await supabase
      .from('guild_banks')
      .insert({ group_id: groupId, game_slug: gameSlug })
      .select()
      .single();

    if (createError) throw createError;

    await fetchData();
    return data as GuildBank;
  };

  // Update bank settings
  const updateBankSettings = async (settings: Partial<Pick<GuildBank, 'name' | 'description' | 'deposit_min_role' | 'withdraw_min_role'>>) => {
    if (!bank) throw new Error('Bank not initialized');

    const { error: updateError } = await supabase
      .from('guild_banks')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', bank.id);

    if (updateError) throw updateError;

    await fetchData();
  };

  // Deposit resources
  const deposit = async (data: ResourceTransactionData) => {
    if (!bank) throw new Error('Bank not initialized');

    const { error: transactionError } = await supabase.rpc('apply_bank_resource_transaction', {
      p_bank_id: bank.id,
      p_resource_id: data.resource_id,
      p_quantity: data.quantity,
      p_transaction_type: 'deposit',
      p_notes: data.notes ?? null,
    });
    if (transactionError) throw transactionError;

    await fetchData();
  };

  // Withdraw resources
  const withdraw = async (data: ResourceTransactionData) => {
    if (!bank) throw new Error('Bank not initialized');

    const { error: transactionError } = await supabase.rpc('apply_bank_resource_transaction', {
      p_bank_id: bank.id,
      p_resource_id: data.resource_id,
      p_quantity: data.quantity,
      p_transaction_type: 'withdrawal',
      p_notes: data.notes ?? null,
    });
    if (transactionError) throw transactionError;

    await fetchData();
  };

  // Adjust gold balance
  const adjustGold = async (amount: number, notes?: string) => {
    if (!bank) throw new Error('Bank not initialized');

    const { data: { user } } = await supabase.auth.getUser();

    const newBalance = bank.gold_balance + amount;
    if (newBalance < 0) throw new Error('Insufficient gold');

    const { error: updateError } = await supabase
      .from('guild_banks')
      .update({
        gold_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bank.id);
    if (updateError) throw updateError;

    const { error: transactionError } = await supabase.from('bank_transactions').insert({
      bank_id: bank.id,
      transaction_type: amount > 0 ? 'deposit' : 'withdrawal' as BankTransactionType,
      quantity: 0,
      gold_amount: amount,
      user_id: user?.id,
      notes,
    });
    if (transactionError) throw transactionError;

    await fetchData();
  };

  // Create resource request
  const createRequest = async (data: ResourceRequestData) => {
    if (!bank) throw new Error('Bank not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: requestError } = await supabase.from('resource_requests').insert({
      bank_id: bank.id,
      resource_id: data.resource_id,
      requested_by: user.id,
      character_id: data.character_id,
      quantity: data.quantity,
      reason: data.reason,
    });
    if (requestError) throw requestError;

    await fetchData();
  };

  // Approve request
  const approveRequest = async (requestId: string) => {
    if (!bank) throw new Error('Bank not initialized');
    const { data: { user } } = await supabase.auth.getUser();

    const { error: requestError } = await supabase
      .from('resource_requests')
      .update({
        status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('bank_id', bank.id);
    if (requestError) throw requestError;

    await fetchData();
  };

  // Deny request
  const denyRequest = async (requestId: string) => {
    if (!bank) throw new Error('Bank not initialized');
    const { data: { user } } = await supabase.auth.getUser();

    const { error: requestError } = await supabase
      .from('resource_requests')
      .update({
        status: 'denied',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('bank_id', bank.id);
    if (requestError) throw requestError;

    await fetchData();
  };

  // Fulfill request (withdraw and complete)
  const fulfillRequest = async (requestId: string) => {
    if (!bank) throw new Error('Bank not initialized');
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error('Request not found');

    await withdraw({
      resource_id: request.resource_id,
      quantity: request.quantity,
      notes: `Fulfilled request: ${request.reason || request.id}`,
    });

    const { error: requestError } = await supabase
      .from('resource_requests')
      .update({
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('bank_id', bank.id);
    if (requestError) throw requestError;

    await fetchData();
  };

  // Search resources
  const searchResources = (query: string, category?: ResourceCategory): ResourceCatalog[] => {
    return resourceCatalog.filter((r) => {
      const matchesQuery = r.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = !category || r.category === category;
      return matchesQuery && matchesCategory;
    });
  };

  return {
    bank,
    inventory,
    transactions,
    requests,
    resourceCatalog,
    loading,
    error,
    initializeBank,
    updateBankSettings,
    deposit,
    withdraw,
    adjustGold,
    createRequest,
    approveRequest,
    denyRequest,
    fulfillRequest,
    searchResources,
    refresh: fetchData,
  };
}
