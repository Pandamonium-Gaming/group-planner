import type { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('next/server', () => ({ NextResponse: {
  json: (body: unknown, init?: { status?: number }) => ({ status: init?.status || 200, json: async () => body }),
} }));
jest.mock('@/auth', () => ({ auth: jest.fn().mockResolvedValue({ user: { id: 'admin' } }) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
const insert = jest.fn();
const update = jest.fn();
const previous = { id: 'event', group_id: 'group', created_by: 'admin', game_slug: 'wowforever', event_type: 'farming_gear' };

function request(payload: unknown) {
  return { json: async () => payload } as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  createClient.mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, neq: () => query,
        maybeSingle: async () => ({ data: table === 'group_members' ? { role: 'admin' } : previous, error: null }),
        single: async () => ({ data: previous, error: null }),
        insert: (data: unknown) => { insert(data); return query; },
        update: (data: unknown) => { update(data); return query; },
        then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
      };
      return query;
    },
  });
});

it.each(['dungeon', 'leveling', 'world_pvp', 'battleground_pvp', 'arena_pvp'])('accepts new WoW %s events', async eventType => {
  const response = await POST(request({ action: 'create_event', group_id: 'group',
    event: { event_type: eventType, game_slug: 'wowforever' } }));
  expect(response.status).toBe(200);
  expect(insert).toHaveBeenCalled();
});

it('rejects removed choices on creation and WoW-only choices in other games', async () => {
  for (const eventType of ['siege', 'farming_glint', 'farming_materials', 'farming_gear', 'farming_other']) {
    expect((await POST(request({ action: 'create_event', group_id: 'group',
      event: { event_type: eventType, game_slug: 'wowforever' } }))).status).toBe(400);
  }
  expect((await POST(request({ action: 'create_event', group_id: 'group',
    event: { event_type: 'arena_pvp', game_slug: 'aoc' } }))).status).toBe(400);
  expect(insert).not.toHaveBeenCalled();
});

it('allows retaining a legacy type or choosing a new one, without changing games', async () => {
  expect((await POST(request({ action: 'update_event', group_id: 'group', id: 'event',
    updates: { title: 'Updated', event_type: 'farming_gear' } }))).status).toBe(200);
  expect((await POST(request({ action: 'update_event', group_id: 'group', id: 'event',
    updates: { event_type: 'dungeon' } }))).status).toBe(200);
  update.mockClear();
  expect((await POST(request({ action: 'update_event', group_id: 'group', id: 'event',
    updates: { event_type: 'farming_other' } }))).status).toBe(400);
  expect((await POST(request({ action: 'update_event', group_id: 'group', id: 'event',
    updates: { game_slug: 'aoc' } }))).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
