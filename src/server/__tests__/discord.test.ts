/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { POST as notify } from '@/app/api/group/events/notify/route';
import { POST as proxy } from '@/app/api/discord/route';
import { GET as logs } from '@/app/api/group/webhook-logs/route';
import { deliverWebhook } from '../discord';

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
const groupId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const destination = 'https://discord.com/api/webhooks/123/private-token';
let role: string | null;
let creator: string;
let game: string;
let cancelled: boolean;
let group: Record<string, unknown>;
let logInsertError: boolean;
let logUpdateError: boolean;
const insert = jest.fn();
const update = jest.fn();
const select = jest.fn();
const range = jest.fn();
const getUser = jest.fn();
const discordFetch = jest.fn();
const client = {
  auth: { getUser },
  from: jest.fn((table: string) => {
    const query = {
      select: (columns: string): object => { select(table, columns); return query; },
      eq: jest.fn((): object => query),
      order: (): object => query,
      insert: (data: unknown): object => { insert(data); return query; },
      update: (data: unknown) => { update(data); return { eq: async () => ({ error: logUpdateError ? { code: 'offline' } : null }) }; },
      maybeSingle: async () => ({
        data: table === 'group_members' ? role && { role } : {
          id: eventId, group_id: groupId, created_by: creator, game_slug: game,
          title: 'Guild raid', starts_at: '2026-11-03T20:00:00Z', event_type: 'raid',
          description: 'Bring potions', content: 'Group announcement', is_cancelled: cancelled,
          tanks_min: 0, clerics_min: 0, bards_min: 0, ranged_dps_min: 0, melee_dps_min: 0,
          tanks_max: null, clerics_max: null, bards_max: null, ranged_dps_max: null, melee_dps_max: null,
        }, error: null,
      }),
      single: async () => ({
        data: table === 'groups' ? group : { id: 'log-1' },
        error: table === 'discord_webhook_logs' && logInsertError ? { code: 'missing_table' } : null,
      }),
      range,
    };
    return query;
  }),
};

function request(body?: unknown, token = false, page = '0'): NextRequest {
  return {
    nextUrl: new URL(`https://planner.test/api/group/webhook-logs?group_id=${groupId}&page=${page}`),
    headers: new Headers(token ? { Authorization: 'Bearer legacy-token' } : {}),
    json: async () => body,
  } as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  role = 'member'; creator = 'user-1'; game = 'wowforever'; cancelled = false;
  logInsertError = false; logUpdateError = false;
  group = { id: groupId, name: 'Guild', slug: 'guild', wowforever_events_webhook_url: destination,
    wowforever_events_role_id: 'role-123', notify_on_events: true, notify_on_announcements: true };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.AUTH_STACK = 'v2';
  auth.mockResolvedValue({ user: { id: 'user-1' } });
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  createClient.mockReturnValue(client);
  discordFetch.mockResolvedValue({ ok: true, status: 204 });
  global.fetch = discordFetch;
  range.mockResolvedValue({ data: [], error: null });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('uses bearer authentication in v1 without invoking Auth.js', async () => {
  process.env.AUTH_STACK = 'v1';
  auth.mockRejectedValue(new Error('Missing secret'));
  expect((await notify(request({ event_id: eventId }, true))).status).toBe(200);
  expect(auth).not.toHaveBeenCalled();
  expect(getUser).toHaveBeenCalledWith('legacy-token');
  expect((await notify(request({ event_id: eventId }))).status).toBe(401);
  getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Expired' } });
  expect((await notify(request({ event_id: eventId }, true))).status).toBe(401);
});

it('requires authentication, membership and creator/edit-any permission for reposts', async () => {
  auth.mockResolvedValue(null);
  expect((await notify(request({ event_id: eventId }))).status).toBe(401);
  auth.mockResolvedValue({ user: { id: 'user-1' } });
  for (const denied of [null, 'trial', 'pending']) {
    role = denied;
    expect((await notify(request({ event_id: eventId }))).status).toBe(403);
  }
  role = 'member'; creator = 'another-user';
  expect((await notify(request({ event_id: eventId, repost: true }))).status).toBe(403);
  expect(discordFetch).not.toHaveBeenCalled();
  role = 'officer';
  expect((await notify(request({ event_id: eventId, repost: true }))).status).toBe(200);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'repost', actor_id: 'user-1', subject_id: eventId }));
});

it.each(['events', 'general', 'group'] as const)('uses WoW %s webhook fallback and event/general/group role fallback', async (level) => {
  if (level !== 'events') {
    delete group.wowforever_events_webhook_url; delete group.wowforever_events_role_id;
    group.wowforever_webhook_url = destination; group.wowforever_announcement_role_id = 'role-general';
  }
  if (level === 'group') {
    delete group.wowforever_webhook_url; delete group.wowforever_announcement_role_id;
    group.group_webhook_url = destination; group.discord_announcement_role_id = 'role-group';
  }
  expect((await notify(request({ event_id: eventId }))).status).toBe(200);
  expect(discordFetch).toHaveBeenCalledTimes(1);
  const [url, options] = discordFetch.mock.calls[0];
  expect(url).toBe(destination);
  const payload = JSON.parse(options.body);
  expect(payload.content).toContain(level === 'events' ? 'role-123' : level === 'general' ? 'role-general' : 'role-group');
  expect(payload.embeds[0].url).toContain('/guild/wowforever/events#event-');
  expect(insert).toHaveBeenCalledWith({
    group_id: groupId, game_slug: 'wowforever', kind: 'event', subject_id: eventId, actor_id: 'user-1',
  });
  expect(JSON.stringify(insert.mock.calls)).not.toContain('private-token');
  expect(update).toHaveBeenCalledWith({ status: 'sent', http_status: 204, error: null });
});

it('normalizes the Star Citizen configuration prefix without changing the route slug', async () => {
  game = 'starcitizen'; group.sc_events_webhook_url = destination;
  expect((await notify(request({ event_id: eventId }))).status).toBe(200);
  expect(JSON.parse(discordFetch.mock.calls[0][1].body).embeds[0].url).toContain('/starcitizen/events');
});

it.each(['disabled', 'cancelled', 'missing', 'invalid', 'rejected', 'network', 'log-insert', 'log-update'])('records %s outcomes without exposing credentials or retrying', async outcome => {
  if (outcome === 'disabled') group.notify_on_events = false;
  if (outcome === 'cancelled') cancelled = true;
  if (outcome === 'missing') delete group.wowforever_events_webhook_url;
  if (outcome === 'invalid') group.wowforever_events_webhook_url = `${destination}/../bad`;
  if (outcome === 'rejected') discordFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'private-token' });
  if (outcome === 'network') discordFetch.mockRejectedValue(new Error(`Network: ${destination}`));
  logInsertError = outcome === 'log-insert'; logUpdateError = outcome === 'log-update';
  const response = await notify(request({ event_id: eventId }));
  expect(JSON.stringify(await response.json())).not.toContain('private-token');
  expect(JSON.stringify(update.mock.calls)).not.toContain('private-token');
  const sent = ['rejected', 'network', 'log-update'].includes(outcome);
  expect(discordFetch).toHaveBeenCalledTimes(sent ? 1 : 0);
  if (['disabled', 'cancelled'].includes(outcome)) {
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'skipped', error: outcome === 'cancelled' ? 'Event cancelled' : 'Notifications disabled in group settings',
    }));
  } else expect(response.status).toBeGreaterThanOrEqual(400);
});

it('sends and logs group-wide announcements independently of event flags', async () => {
  group.group_webhook_url = destination; group.notify_on_events = false;
  expect((await notify(request({ announcement_id: eventId }))).status).toBe(200);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'announcement' }));
});

it('validates notification input and malformed JSON without sending', async () => {
  expect((await notify(request({ event_id: 'bad' }))).status).toBe(400);
  const invalid = request();
  invalid.json = async () => { throw new Error('Bad JSON'); };
  expect((await notify(invalid)).status).toBe(400);
  expect(discordFetch).not.toHaveBeenCalled();
});

it('requires admin access for logs and returns bounded metadata-only pages', async () => {
  expect((await logs(request())).status).toBe(403);
  expect(range).not.toHaveBeenCalled();
  role = 'admin';
  range.mockResolvedValue({ data: Array.from({ length: 51 }, (_, n) => ({ id: n })), error: null });
  const response = await logs(request(undefined, false, '2'));
  expect(await response.json()).toEqual({ logs: Array.from({ length: 50 }, (_, n) => ({ id: n })), hasMore: true });
  expect(range).toHaveBeenCalledWith(100, 150);
  expect(select).toHaveBeenCalledWith('discord_webhook_logs', 'id,game_slug,kind,subject_id,actor_id,status,http_status,error,created_at');
  expect((await logs(request(undefined, false, '-1'))).status).toBe(400);
});

it.each(['test', 'reminder', 'announcement', 'welcome'] as const)('authenticates and logs proxy %s activity', async kind => {
  role = 'admin';
  expect((await proxy(request({ webhookUrl: destination, payload: { content: 'Test' }, context: { groupId, gameSlug: game, kind } }))).status).toBe(200);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind, group_id: groupId }));
});

it('rejects proxy requests without context or permission and unconfigured destinations', async () => {
  expect((await proxy(request({ webhookUrl: destination, payload: {} }))).status).toBe(400);
  expect((await proxy(request({ webhookUrl: destination, payload: {}, context: { groupId, kind: 'test' } }))).status).toBe(403);
  role = 'admin';
  expect((await proxy(request({ webhookUrl: `${destination}-other`, payload: {}, context: { groupId, kind: 'reminder' } }))).status).toBe(400);
  expect(discordFetch).not.toHaveBeenCalled();
});

it('requires successful audit insertion before attempting delivery', async () => {
  logInsertError = true;
  await expect(deliverWebhook(createClient(), 'user-1', { groupId, kind: 'test' }, destination, {})).rejects.toThrow('not sent');
  expect(discordFetch).not.toHaveBeenCalled();
});

it('preserves legitimate Discord webhook query parameters', async () => {
  const url = `${destination}?thread_id=456&wait=true`;
  await expect(deliverWebhook(createClient(), 'user-1', { groupId, kind: 'test' }, url, {}))
    .resolves.toEqual({ success: true, skipped: false, error: undefined });
  expect(discordFetch).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error' }));
});
