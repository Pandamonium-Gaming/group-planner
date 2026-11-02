import type { NextRequest } from 'next/server';
import { GET, POST } from '../route';

jest.mock('next/server', () => {
  class Response {
    status: number;
    constructor(private body: string, init?: { status?: number }) { this.status = init?.status || 200; }
    async json() { return JSON.parse(this.body); }
    static json(body: unknown, init?: { status?: number }) { return new Response(JSON.stringify(body), init); }
  }
  return { NextResponse: Response };
});
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const { auth } = jest.requireMock('@/auth') as { auth: jest.Mock };
const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
const group = '00000000-0000-4000-8000-000000000001';
const character = '00000000-0000-4000-8000-000000000002';
let role: string;
let archived: boolean;
let count: number;
const rpc = jest.fn();
const row = { id: character, name: 'Pilot', level: 1, is_main: false, member_professions: [], character_ships: [] };

function request(payload?: unknown): NextRequest {
  return { url: `https://planner.test/api/group/character-transfer?group_id=${group}&game_slug=starcitizen`,
    headers: { get: () => null }, text: async () => JSON.stringify(payload) } as NextRequest;
}

const document = { format: 'group-planner-characters', version: 1, game_slug: 'starcitizen', exported_at: '2026-11-02',
  characters: [{ id: character, owner: { discord_id: null, label: null },
    data: { name: 'Pilot', level: 1, is_main: false }, professions: [], ships: [] }] };

beforeEach(() => {
  role = 'admin'; archived = false; count = 1; jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  auth.mockResolvedValue({ user: { id: 'admin-user' } });
  rpc.mockResolvedValue({ data: { token: 'preview', create_count: 1, update_count: 0, warnings: [] }, error: null });
  createClient.mockReturnValue({
    rpc,
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: async () => ({ data: table === 'group_members' ? { role } : { archived }, error: null }),
        limit: async () => ({ data: [row], error: null, count }),
      };
      return query;
    },
  });
});

it('requires authentication and group admin for export and import', async () => {
  auth.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  auth.mockResolvedValue({ user: { id: 'user' } });
  for (const deniedRole of ['officer', 'member', 'trial', 'pending']) {
    role = deniedRole;
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request({ document }))).status).toBe(403);
  }
  expect(rpc).not.toHaveBeenCalled();
});

it('exports only complete data and rejects truncated result sets', async () => {
  const exported = await GET(request());
  expect(exported.status).toBe(200);
  expect((await exported.json()).characters[0].id).toBe(character);
  count = 1001;
  expect((await GET(request())).status).toBe(413);
});

it('previews without applying and requires explicit confirmation to import', async () => {
  expect((await POST(request({ document }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('transfer_group_characters', expect.objectContaining({ p_apply: false }));
  rpc.mockClear();
  expect((await POST(request({ document, apply: true, token: 'preview' }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  expect((await POST(request({ document, apply: true, token: 'preview', confirmation: 'IMPORT' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('transfer_group_characters', expect.objectContaining({
    p_group_id: group, p_apply: true, p_expected_token: 'preview',
  }));
});

it('rejects archived games and invalid files before any import calls', async () => {
  archived = true;
  expect((await POST(request({ document }))).status).toBe(409);
  archived = false;
  expect((await POST(request({ document: { ...document, game_slug: 'wowforever' } }))).status).toBe(400);
  expect((await POST(request({ document, apply: 'true' }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
