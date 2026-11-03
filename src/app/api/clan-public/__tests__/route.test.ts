import { GET } from '../route';

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: ResponseInit) => ({ status: init?.status ?? 200, json: async () => body }) },
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'gte']) c[m] = () => c;
  c.single = async () => result;
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return c;
}

it('returns the group games (with archived flag) for the recruitment form', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const games = [{ game_slug: 'aoc', archived: false }, { game_slug: 'ror', archived: true }];
  createClient.mockReturnValue({
    from: (t: string) => chain(
      t === 'groups' ? { data: { id: 'g1', is_public: true }, error: null }
      : t === 'group_games' ? { data: games, error: null }
      : { count: 1, data: null, error: null }),
  });
  const res = await GET({ url: 'http://l/api/clan-public?slug=s' } as never);
  const body = await res.json();
  expect(body.groupGames).toEqual(games);
  expect(body.clan).toEqual(expect.objectContaining({ id: 'g1' }));
});

it('returns 500 rather than an empty games list when the group_games query fails', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  createClient.mockReturnValue({
    from: (t: string) => chain(
      t === 'groups' ? { data: { id: 'g1', is_public: true }, error: null }
      : t === 'group_games' ? { data: null, error: { message: 'boom' } }
      : { count: 1, data: null, error: null }),
  });
  const res = await GET({ url: 'http://l/api/clan-public?slug=s' } as never);
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body.groupGames).toBeUndefined();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
