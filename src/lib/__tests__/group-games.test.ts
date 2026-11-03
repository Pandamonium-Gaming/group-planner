jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/webhookClient', () => ({ webhookHeaders: jest.fn() }));
import * as groupGames from '@/lib/group-games';

const { webhookHeaders } = jest.requireMock('@/lib/webhookClient') as { webhookHeaders: jest.Mock };
const fetchMock = jest.fn();
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  webhookHeaders.mockReset();
  webhookHeaders.mockResolvedValue({ 'Content-Type': 'application/json', Authorization: 'Bearer v1-token' });
});

it('deleteGameForGroup sends the v1 bearer headers from webhookHeaders alongside the cookies', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  await groupGames.deleteGameForGroup('g1', 'aoc', 'Ashes of Creation');
  expect(webhookHeaders).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith('/api/group/games', expect.objectContaining({
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer v1-token' },
  }));
});

it('deleteGameForGroup reports a null code without fetching when no session can be read', async () => {
  webhookHeaders.mockRejectedValue(new Error('Sign in before sending a Discord notification'));
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(groupGames.deleteGameForGroup('g1', 'aoc', 'n')).resolves.toEqual({ ok: false, code: null });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('no longer exports removeGameFromGroup (home-page remove button is gone)', () => {
  expect('removeGameFromGroup' in groupGames).toBe(false);
});

it('deleteGameForGroup sends the DELETE request and reports success', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  await expect(groupGames.deleteGameForGroup('g1', 'aoc', 'Ashes of Creation')).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith('/api/group/games', expect.objectContaining({
    method: 'DELETE', credentials: 'include',
    body: JSON.stringify({ groupId: 'g1', gameSlug: 'aoc', confirmName: 'Ashes of Creation' }),
  }));
});

it('deleteGameForGroup returns the error code, or null when unavailable', async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'x', code: 'game_not_archived' }) });
  await expect(groupGames.deleteGameForGroup('g1', 'aoc', 'n')).resolves.toEqual({ ok: false, code: 'game_not_archived' });
  fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error('bad json'); } });
  await expect(groupGames.deleteGameForGroup('g1', 'aoc', 'n')).resolves.toEqual({ ok: false, code: null });
  fetchMock.mockRejectedValue(new Error('network'));
  await expect(groupGames.deleteGameForGroup('g1', 'aoc', 'n')).resolves.toEqual({ ok: false, code: null });
});
