import { act, renderHook, waitFor } from '@testing-library/react';
import { useGroupData } from '../useGroupData';
import type { WowSkill } from '@/games/wowforever/config/skills';

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

it('persists and validates skills in direct Supabase creates and updates without changing unrelated fields', async () => {
  const group = { id: 'group-1', slug: 'test-group', name: 'Test Group' };
  const character = { id: 'character-1', group_id: group.id, user_id: 'trial-user',
    game_slug: 'wowforever', name: 'Aster', professions: [], wow_profession_1: 'Alchemy', wow_profession_2: 'Mining' };
  const skills: WowSkill[] = [
    { name: 'Fishing', category: 'secondary', rank: null, current: 0, max: 75 },
    { name: 'Swords', category: 'weapon', rank: null, current: 12, max: 50 },
  ];
  const insert = jest.fn(() => ({ select: async () => ({ data: [{ id: 'new-character' }], error: null }) }));
  const update = jest.fn(() => {
    const chain = {
      eq: (_field: string, _value: string) => chain,
      select: async () => ({ data: [], error: null }),
    };
    return chain;
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'groups') return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: group, error: null }) }) }),
    };
    if (table === 'group_members') return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'member' }, error: null }) }) }) }),
    };
    if (table === 'members') return {
      select: () => ({
        eq: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [character], error: null }) }) }) }),
      }),
      insert, update,
    };
    throw new Error(`Unexpected table: ${table}`);
  });
  const { result } = renderHook(() => useGroupData('test-group', 'wowforever'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.addCharacter({ name: 'New character', wow_profession_1: 'Alchemy',
      wow_profession_2: 'Mining', wow_skills: skills });
    await result.current.updateCharacter('character-1', { wow_skills: skills });
    await result.current.updateCharacter('character-1', { name: 'Renamed' });
  });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ wow_skills: skills, wow_profession_1: 'Alchemy', wow_profession_2: 'Mining' }));
  expect(update).toHaveBeenNthCalledWith(1, { wow_skills: skills });
  expect(update).toHaveBeenNthCalledWith(2, { name: 'Renamed' });
  await act(async () => {
    await expect(result.current.updateCharacter('character-1', {
      is_main: true, wow_skills: [{ ...skills[0], current: 76 }],
    })).rejects.toThrow('Invalid WoW skill data');
  });
  expect(update).toHaveBeenCalledTimes(2);
});
