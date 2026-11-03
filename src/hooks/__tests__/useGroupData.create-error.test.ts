import { act, renderHook, waitFor } from '@testing-library/react';
import { useGroupData } from '../useGroupData';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));
jest.mock('@/lib/auth', () => ({
  getSession: jest.fn().mockResolvedValue({ user: { id: 'trial-user' } }),
}));
jest.mock('@/lib/authStack', () => ({ getClientAuthStack: () => 'v1' }));
jest.mock('@/lib/subscriberShips', () => ({
  syncSubscriberShips: jest.fn(),
  updateSubscriberTier: jest.fn(),
}));

it('keeps a failed character save in the form without changing group-loading state', async () => {
  const group = { id: 'group-1', slug: 'test-group', name: 'Test Group' };
  const databaseError = {
    code: '42501',
    message: 'new row violates row-level security policy for table "members"',
  };
  const insert = jest.fn(() => ({
    select: jest.fn().mockResolvedValue({ data: null, error: databaseError }),
  }));
  mockFrom.mockImplementation((table: string) => {
    if (table === 'groups') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: group, error: null }) }) }),
      };
    }
    if (table === 'members') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
        }),
        insert,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { result } = renderHook(() => useGroupData('test-group', 'wowforever'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.group).toEqual(group);
    await act(async () => {
      await expect(result.current.addCharacter({ name: 'Trial character' })).rejects.toThrow(databaseError.message);
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      group_id: group.id, user_id: 'trial-user', game_slug: 'wowforever', name: 'Trial character',
    }));
    expect(result.current.error).toBeNull();
    expect(result.current.group).toEqual(group);
    expect(result.current.loading).toBe(false);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
