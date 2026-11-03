/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { GAMES } from '@/lib/games';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200, json: async () => body,
    }),
  },
}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const { auth } = jest.requireMock('@/auth') as { auth: jest.Mock };
const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };

const groupId = '00000000-0000-4000-8000-000000000001';
const rpc = jest.fn();
let role: string | null;

const client = {
  rpc,
  from: () => {
    const query = {
      select: (): object => query,
      eq: (): object => query,
      maybeSingle: async () => ({ data: role && { role }, error: null }),
    };
    return query;
  },
};

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

const valid = { groupId, gameSlug: 'starcitizen', confirmName: 'Star Citizen' };

beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  createClient.mockReturnValue(client);
  auth.mockResolvedValue({ user: { id: 'admin-1' } });
  rpc.mockResolvedValue({ error: null });
  role = 'admin';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('DELETE /api/group/games', () => {
  it('deletes through the RPC with the registry name and session user', async () => {
    const response = await DELETE(request({ ...valid, confirmName: 'Star Citizen' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith('delete_group_game', {
      p_group_id: groupId,
      p_game_slug: 'starcitizen',
      p_confirm_name: 'Star Citizen',
      p_expected_name: GAMES.starcitizen.name,
      p_actor_id: 'admin-1',
    });
  });

  it('ignores any expected name the client sends', async () => {
    await DELETE(request({ ...valid, confirmName: 'Wrong', expectedName: 'Wrong' }));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_confirm_name: 'Wrong', p_expected_name: 'Star Citizen' });
  });

  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue(null);
    const response = await DELETE(request(valid));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('unauthorized');
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['member', 'officer', 'trial'])('rejects the %s role before the RPC', async (memberRole) => {
    role = memberRole;
    const response = await DELETE(request(valid));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('game_forbidden');
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ gameSlug: 'starcitizen', confirmName: 'x' }],
    [{ groupId, confirmName: 'x' }],
    [{ groupId, gameSlug: 'starcitizen' }],
    [{ groupId, gameSlug: 'starcitizen', confirmName: 42 }],
  ])('returns 400 for missing fields %#', async (body) => {
    const response = await DELETE(request(body));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 404 game_not_found for a slug missing from the registry', async () => {
    const response = await DELETE(request({ ...valid, gameSlug: 'nonexistent' }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('game_not_found');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('deletes an archived ror game using the registry name', async () => {
    const response = await DELETE(request({ groupId, gameSlug: 'ror', confirmName: 'x' }));
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_game_slug: 'ror', p_expected_name: GAMES.ror.name });
  });

  it.each(['toString', '__proto__', 'constructor'])('rejects prototype slug %s without the RPC', async (slug) => {
    const response = await DELETE(request({ ...valid, gameSlug: slug }));
    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_ADMIN', 403, 'game_forbidden'],
    ['GAME_NOT_FOUND', 404, 'game_not_found'],
    ['GAME_NOT_ARCHIVED', 409, 'game_not_archived'],
    ['CONFIRMATION_MISMATCH', 400, 'game_confirmation'],
    ['LAST_GAME', 409, 'game_last'],
  ])('maps %s to %i', async (message, status, code) => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message } });
    const response = await DELETE(request(valid));
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(typeof body.error).toBe('string');
    expect(body.code).toBe(code);
  });

  it('returns 500 game_delete without leaking the raw error', async () => {
    rpc.mockResolvedValue({ error: { code: 'XX000', message: 'relation secret_table exploded' } });
    const response = await DELETE(request(valid));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('game_delete');
    expect(JSON.stringify(body)).not.toContain('secret_table');
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('secret_table'));
  });
});
