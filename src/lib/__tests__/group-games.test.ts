jest.mock('@/lib/supabase', () => ({ supabase: {} }));
import * as groupGames from '@/lib/group-games';

const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });

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
