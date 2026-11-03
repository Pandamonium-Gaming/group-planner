/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { createClient as databaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminNotificationPayload, processAdminNotifications, type AdminNotification } from '../admin-discord';
import { GET as deliver } from '@/app/api/admin/notifications/deliver/route';
import { GET as settings, POST as save } from '@/app/api/group/admin-notifications/route';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';
import { GET as siteSettings, POST as saveSite } from '@/app/api/admin/notifications/settings/route';
import type { AdminCategorySettings, AdminRoleMentions } from '@/lib/adminNotifications';

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
const destination = 'https://discord.com/api/webhooks/123/private-test-token';
const notification: AdminNotification = {
  id: 'notice-1', kind: 'role_changed', group_id: groupId, group_name: 'Guild',
  actor_id: 'admin-1', subject_id: 'member-1', subject_name: 'Member',
  destination: 'group', destination_id: 'destination-1', changes: { role: { before: 'member', after: 'officer' } },
  attempts: 1, created_at: '2026-11-03T08:00:00Z',
};
let events: AdminNotification[];
let role: string | null;
let dbError: boolean;
let resultError: boolean;
let destinationError: boolean;
let updatedRow: boolean;
let resolvedUser: { display_name: string | null; discord_username: string | null } | null;
let groupCategories: AdminCategorySettings;
let siteConfig: { categories: AdminCategorySettings; webhook_override: boolean; destination_id: string | null; role_mentions: AdminRoleMentions | null } | null;
const updates = jest.fn();
const selects = jest.fn();
const ranges = jest.fn();
const getUser = jest.fn();
const discordFetch = jest.fn();
const rpc = jest.fn();
let client: SupabaseClient;
const mockClient = {
  auth: { getUser },
  rpc,
  from: jest.fn((table: string) => {
    const query = {
      select: (fields: string): object => { selects(table, fields); return query; },
      eq: jest.fn((): object => query),
      order: (): object => query,
      update: (value: unknown): object => { updates(table, value); return query; },
      single: async () => ({
        data: table === 'admin_discord_destinations' ? { webhook_url: destination } : updatedRow ? { id: 'notice-1' } : null,
        error: (table === 'admin_discord_destinations' ? destinationError : resultError) ? { code: 'offline' } : null,
      }),
      maybeSingle: async () => ({
        data: table === 'group_members' ? role && { role }
          : table === 'users' ? resolvedUser
            : table === 'groups' ? { slug: 'friendly-guild' }
              : table === 'site_admin_discord' ? siteConfig : { destination_id: 'destination-1', role_mentions: {}, categories: groupCategories },
        error: dbError ? { code: 'offline' } : null,
      }),
      range: async (start: number, end: number) => {
        ranges(start, end);
        return { data: [], error: dbError ? { code: 'offline' } : null };
      },
    };
    return query;
  }),
};

function request(body?: unknown, secret?: string, page = '0'): NextRequest {
  return {
    nextUrl: new URL(`https://planner.test/api/group/admin-notifications?group_id=${groupId}&page=${page}`),
    headers: new Headers(secret ? { Authorization: `Bearer ${secret}` } : {}),
    json: async () => body,
  } as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  events = [notification]; role = 'admin'; dbError = false; resultError = false;
  destinationError = false; updatedRow = true;
  groupCategories = {}; siteConfig = null;
  resolvedUser = { display_name: 'Friendly player', discord_username: 'discord-player' };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.AUTH_STACK = 'v2';
  process.env.CRON_SECRET = 'test-cron-secret';
  delete process.env.ADMIN_DISCORD_WEBHOOK_URL;
  delete process.env.ADMIN_DISCORD_ROLE_MENTIONS;
  delete process.env.SITE_ADMIN_DISCORD_IDS;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://planner.test';
  createClient.mockReturnValue(mockClient);
  client = databaseClient('https://test.supabase.co', 'test-key');
  auth.mockResolvedValue({ user: { id: 'admin-1' } });
  getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
  rpc.mockImplementation(async (name: string) => ({ data: name === 'claim_admin_discord_notifications' ? events : null, error: null }));
  discordFetch.mockResolvedValue({ ok: true, status: 204 });
  global.fetch = discordFetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('formats before/after changes and native timestamps without Discord pings', () => {
  const payload = adminNotificationPayload({
    ...notification, subject_name: '@everyone <@123> **name**', actor_id: null,
    changes: { events_create: { before: false, after: true } },
  });
  expect(payload.allowed_mentions).toEqual({ parse: [] });
  expect(payload.embeds[0].description).toMatch(/^Occurred <t:\d+:F>$/);
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changed by', value: expect.stringContaining('Not available') }));
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changes', value: 'Create Event: Disabled -> Enabled' }));
  expect(payload.embeds[0].fields.find(field => field.name === 'Affected account')?.value).toContain('\\<@123\\>');
});

it('keeps large permission changes inside Discord limits and handles defaults', () => {
  const payload = adminNotificationPayload({ ...notification, changes: Object.fromEntries(
    Array.from({ length: 100 }, (_, index) => [`permission_${index}`, { before: null, after: true }]),
  ) });
  expect(payload.embeds[0].fields.find(field => field.name === 'Changes')?.value.length).toBeLessThanOrEqual(1024);
  expect(JSON.stringify(payload)).toContain('not set / default');
});

it('uses names rather than IDs, distinct colours and readable role changes', async () => {
  await processAdminNotifications(client);
  const payload = JSON.parse(discordFetch.mock.calls[0][1].body);
  expect(JSON.stringify(payload.embeds[0].fields)).not.toContain('admin-1');
  expect(JSON.stringify(payload.embeds[0].fields)).not.toContain('member-1');
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changed by', value: 'Friendly player' }));
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changes', value: 'Role: Member -> Officer' }));
  expect(payload.embeds[0].url).toBe('https://planner.test/friendly-guild/settings#members');
  const kinds = ['account_registered', 'group_created', 'group_deleted', 'member_joined', 'member_left_or_removed',
    'member_requested', 'member_request_closed', 'role_changed', 'permissions_changed', 'webhook_changed'] as const;
  expect(new Set(kinds.map(kind => adminNotificationPayload({ ...notification, kind }).embeds[0].color)).size).toBe(kinds.length);
});

it('falls back to Discord usernames and captured subject names without exposing IDs', async () => {
  resolvedUser = { display_name: ' ', discord_username: 'discord-player' };
  await processAdminNotifications(client);
  let payload = JSON.parse(discordFetch.mock.calls[0][1].body);
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changed by', value: 'discord-player' }));
  resolvedUser = null;
  await processAdminNotifications(client);
  payload = JSON.parse(discordFetch.mock.calls[1][1].body);
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Affected account', value: 'Member' }));
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Changed by', value: expect.stringContaining('Name unavailable') }));
  expect(JSON.stringify(payload.embeds[0].fields)).not.toContain('admin-1');
});

it('rejects invalid group role snapshots and unsafe settings origins without sending', async () => {
  events = [{ ...notification, mention_role_id: '@everyone' }];
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
  events = [notification];
  process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
  expect(discordFetch).not.toHaveBeenCalled();
});

it.each([
  ['permissions_changed', {}, 'permissions'],
  ['webhook_changed', { admin_webhook: { before: false, after: true } }, 'admin'],
  ['webhook_changed', { group_webhook_url: 'changed' }, 'discord'],
] as const)('links %s to the correct settings tab', (kind, changes, tab) => {
  const payload = adminNotificationPayload({ ...notification, kind, changes }, { groupSlug: 'guild' });
  expect(payload.embeds[0].url).toBe(`https://planner.test/guild/settings#${tab}`);
});

it('keeps deleted subjects readable and omits broken links and raw IDs', () => {
  const payload = adminNotificationPayload({ ...notification, kind: 'group_deleted' }, { groupSlug: 'deleted-guild' });
  expect(payload.embeds[0].url).toBeUndefined();
  expect(JSON.stringify(payload.embeds[0].fields)).not.toContain('admin-1');
  expect(payload.embeds[0].fields).toContainEqual(expect.objectContaining({ name: 'Affected account', value: 'Member' }));
  delete process.env.NEXT_PUBLIC_SITE_URL;
  expect(adminNotificationPayload(notification, { groupSlug: 'guild' }).embeds[0].url).toBeUndefined();
});

it('allows exactly the configured role and suppresses all other mentions', async () => {
  const roleId = '123456789012345678';
  events = [{ ...notification, mention_role_id: roleId }];
  await processAdminNotifications(client);
  const payload = JSON.parse(discordFetch.mock.calls[0][1].body);
  expect(payload.content).toBe(`<@&${roleId}>`);
  expect(payload.allowed_mentions).toEqual({ parse: [], roles: [roleId] });
  process.env.ADMIN_DISCORD_WEBHOOK_URL = destination;
  process.env.ADMIN_DISCORD_ROLE_MENTIONS = JSON.stringify({ account_registered: roleId });
  events = [{ ...notification, kind: 'account_registered', destination: 'site' }];
  await processAdminNotifications(client);
  expect(JSON.parse(discordFetch.mock.calls[1][1].body).allowed_mentions).toEqual({ parse: [], roles: [roleId] });
});

it('fails invalid site role configuration before sending any ping', async () => {
  process.env.ADMIN_DISCORD_WEBHOOK_URL = destination;
  events = [{ ...notification, destination: 'site' }];
  for (const config of ['invalid json', '{"role_changed":"@everyone"}', '{"unknown":"123456789012345678"}']) {
    process.env.ADMIN_DISCORD_ROLE_MENTIONS = config;
    await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
  }
  expect(discordFetch).not.toHaveBeenCalled();
});

it('validates per-type role saves and never accepts client-supplied actors', async () => {
  const roleId = '123456789012345678';
  expect((await save(request({ group_id: groupId, role_mentions: { role_changed: roleId }, actor_id: 'forged' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_group_admin_discord_roles', {
    p_group_id: groupId, p_roles: { role_changed: roleId }, p_actor_id: 'admin-1',
  });
  for (const role_mentions of [{ role_changed: '@everyone' }, { unknown: roleId }, [], null, { role_changed: '' }]) {
    expect((await save(request({ group_id: groupId, role_mentions }))).status).toBe(400);
  }
});
it('posts to the captured private destination and records delivery metadata only', async () => {
  expect(await processAdminNotifications(client)).toEqual({ processed: 1, sent: 1 });
  expect(discordFetch).toHaveBeenCalledWith(destination, expect.objectContaining({ redirect: 'error', method: 'POST' }));
  expect(JSON.stringify(updates.mock.calls)).not.toContain('private-test-token');
  expect(updates).toHaveBeenCalledWith('admin_discord_notifications', { status: 'sent', http_status: 204, error: null });
});

it('uses the server-only destination for site accounts and never falls back to it for group alerts', async () => {
  process.env.ADMIN_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/456/site-test-token';
  events = [{ ...notification, kind: 'account_registered', destination: 'site', destination_id: null }];
  await processAdminNotifications(client);
  expect(discordFetch).toHaveBeenCalledWith(process.env.ADMIN_DISCORD_WEBHOOK_URL, expect.anything());
  discordFetch.mockClear();
  events = [{ ...notification, destination_id: null }];
  await processAdminNotifications(client);
  expect(discordFetch).not.toHaveBeenCalled();
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ status: 'skipped' }));
});

it('records missing or invalid site configuration explicitly without sending', async () => {
  events = [{ ...notification, destination: 'site' }];
  await processAdminNotifications(client);
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ status: 'skipped' }));
  process.env.ADMIN_DISCORD_WEBHOOK_URL = 'https://example.com/api/webhooks/123/token';
  await processAdminNotifications(client);
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ status: 'failed' }));
  expect(discordFetch).not.toHaveBeenCalled();
});

it('retries only explicit rate limits, with a bounded delay and five-attempt ceiling', async () => {
  discordFetch.mockResolvedValue({ ok: false, status: 429, headers: new Headers({ 'retry-after': '120' }) });
  await processAdminNotifications(client);
  const result = updates.mock.calls[0][1] as { status: string; available_at: string };
  expect(result.status).toBe('pending');
  expect(new Date(result.available_at).getTime() - Date.now()).toBeGreaterThan(119000);
  events = [{ ...notification, attempts: 5 }];
  await processAdminNotifications(client);
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ status: 'failed', http_status: 429 }));
});

it.each([400, 401, 403, 404, 500, 502])('records HTTP %s without blindly retrying', async status => {
  discordFetch.mockResolvedValue({ ok: false, status });
  await processAdminNotifications(client);
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({
    status: status >= 500 ? 'uncertain' : 'failed', http_status: status,
  }));
});

it('treats a network error as uncertain without logging secrets', async () => {
  discordFetch.mockRejectedValue(new Error(destination));
  await processAdminNotifications(client);
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ status: 'uncertain' }));
  expect(JSON.stringify(updates.mock.calls)).not.toContain('private-test-token');
  expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('private-test-token');
});

it('fails explicitly on claim, destination and final audit errors', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'offline' } });
  await expect(processAdminNotifications(client)).rejects.toThrow('claim');
  expect(discordFetch).not.toHaveBeenCalled();
  destinationError = true;
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
  expect(discordFetch).not.toHaveBeenCalled();
  destinationError = false; resultError = true;
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
  resultError = false; updatedRow = false;
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
});

it('requires the cron secret and refuses unauthenticated or differently sized tokens', async () => {
  expect((await deliver(request())).status).toBe(401);
  expect((await deliver(request(undefined, 'bad'))).status).toBe(401);
  expect((await deliver(request(undefined, 'wrong-cron-key!!'))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
  expect((await deliver(request(undefined, 'test-cron-secret'))).status).toBe(200);
  delete process.env.CRON_SECRET;
  expect((await deliver(request())).status).toBe(503);
});

it('fails worker requests explicitly when database credentials or claims are unavailable', async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect((await deliver(request(undefined, 'test-cron-secret'))).status).toBe(503);
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  rpc.mockResolvedValue({ error: { code: 'offline' } });
  expect((await deliver(request(undefined, 'test-cron-secret'))).status).toBe(500);
});

it.each(['officer', 'member', 'trial', 'pending', null])('denies group admin settings to %s', async value => {
  role = value;
  expect((await settings(request())).status).toBe(403);
  expect((await save(request({ group_id: groupId, webhook_url: destination }))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

it('supports legacy bearer authentication without invoking Auth.js', async () => {
  process.env.AUTH_STACK = 'v1';
  expect((await settings(request(undefined, 'legacy-session'))).status).toBe(200);
  expect(auth).not.toHaveBeenCalled();
  expect(getUser).toHaveBeenCalledWith('legacy-session');
});

it('never returns stored credentials or payloads and paginates history', async () => {
  const response = await settings(request(undefined, undefined, '1'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ configured: true, role_mentions: {}, categories: {}, logs: [], hasMore: false });
  expect(ranges).toHaveBeenCalledWith(20, 40);
  expect(selects).not.toHaveBeenCalledWith('admin_discord_destinations', expect.anything());
  expect(selects).toHaveBeenCalledWith('admin_discord_notifications', 'id,kind,status,http_status,error,created_at');
  expect((await settings(request(undefined, undefined, '-1'))).status).toBe(400);
});

it('validates webhook URLs, handles disabling and passes only the authenticated actor', async () => {
  for (const webhook_url of [null, 42, 'https://evil.test/api/webhooks/123/token', `${destination}#fragment`]) {
    expect((await save(request({ group_id: groupId, webhook_url }))).status).toBe(400);
  }
  expect((await save(request({ group_id: groupId, webhook_url: ` ${destination} `, actor_id: 'forged' }))).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('save_group_admin_discord', { p_group_id: groupId, p_webhook_url: destination, p_actor_id: 'admin-1' });
  expect((await save(request({ group_id: groupId, webhook_url: '' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_group_admin_discord', { p_group_id: groupId, p_webhook_url: null, p_actor_id: 'admin-1' });
});

it('rejects invalid input and surfaces configuration database failures', async () => {
  expect((await save(request(null))).status).toBe(400);
  expect((await save(request({ group_id: 'invalid', webhook_url: destination }))).status).toBe(400);
  auth.mockResolvedValue(null);
  expect((await settings(request())).status).toBe(401);
  auth.mockResolvedValue({ user: { id: 'admin-1' } });
  dbError = true;
  expect((await settings(request())).status).toBe(500);
  dbError = false;
  rpc.mockResolvedValue({ error: { code: 'offline' } });
  expect((await save(request({ group_id: groupId, webhook_url: destination }))).status).toBe(500);
});

it.each([
  ['https://discord.com/api/webhooks/123/token?thread_id=1', true],
  ['https://discordapp.com/api/webhooks/123/token/', true],
  ['http://discord.com/api/webhooks/123/token', false],
  ['https://discord.com.evil.test/api/webhooks/123/token', false],
  ['https://discord.com/api/webhooks/123/token#fragment', false],
])('validates the Discord destination %s', (url, expected) => {
  expect(isDiscordWebhookUrl(url)).toBe(expected);
});

it('skips claimed disabled alerts before resolving names or sending, and requires a recorded result', async () => {
  groupCategories = { role_changed: false };
  expect(await processAdminNotifications(client)).toEqual({ processed: 1, sent: 0 });
  expect(discordFetch).not.toHaveBeenCalled();
  expect(selects).not.toHaveBeenCalledWith('users', expect.anything());
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', { status: 'skipped', error: 'Notification category disabled' });
  updatedRow = false;
  await expect(processAdminNotifications(client)).rejects.toThrow('Unable to complete');
});

it('uses current site categories and explicit webhook/role overrides without environment fallback', async () => {
  events = [{ ...notification, destination: 'site', kind: 'account_registered', destination_id: null }];
  process.env.ADMIN_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/456/environment-token';
  process.env.ADMIN_DISCORD_ROLE_MENTIONS = 'malformed environment override';
  siteConfig = { categories: {}, webhook_override: true, destination_id: 'site-destination', role_mentions: { account_registered: '123456789012345678' } };
  await processAdminNotifications(client);
  expect(discordFetch).toHaveBeenCalledWith(destination, expect.anything());
  expect(JSON.parse(discordFetch.mock.calls[0][1].body).allowed_mentions.roles).toEqual(['123456789012345678']);
  discordFetch.mockClear();
  siteConfig.destination_id = null;
  await processAdminNotifications(client);
  expect(discordFetch).not.toHaveBeenCalled();
  siteConfig.categories = { account_registered: false };
  siteConfig.destination_id = 'site-destination';
  await processAdminNotifications(client);
  expect(discordFetch).not.toHaveBeenCalled();
  expect(updates).toHaveBeenLastCalledWith('admin_discord_notifications', expect.objectContaining({ error: 'Notification category disabled' }));
});

it('saves group categories and roles together, validates values and rejects mixed webhook writes', async () => {
  expect((await save(request({ group_id: groupId, categories: { role_changed: false }, role_mentions: {}, actor_id: 'forged' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_admin_discord_preferences', {
    p_group_id: groupId, p_categories: { role_changed: false }, p_roles: {}, p_actor_id: 'admin-1',
  });
  for (const categories of [null, [], { role_changed: 'false' }, { unknown: false }]) {
    expect((await save(request({ group_id: groupId, categories, role_mentions: {} }))).status).toBe(400);
  }
  expect((await save(request({ group_id: groupId, categories: {}, role_mentions: {}, webhook_url: '' }))).status).toBe(400);
});

it('links preference audits to their correct protected configuration pages', () => {
  const group = adminNotificationPayload({ ...notification, kind: 'webhook_changed', changes: { notification_preferences: 'changed' } },
    { groupSlug: 'friendly-guild' });
  expect(group.embeds[0].url).toBe('https://planner.test/friendly-guild/settings#admin');
  const site = adminNotificationPayload({ ...notification, kind: 'webhook_changed', destination: 'site', group_id: null });
  expect(site.embeds[0].url).toBe('https://planner.test/admin/notifications');
});

it('denies site settings by default, including group admins and forged identities', async () => {
  expect((await siteSettings(request())).status).toBe(403);
  expect((await saveSite(request({ actor_id: 'admin-1', discord_id: '123456789012345678' }))).status).toBe(403);
  process.env.SITE_ADMIN_DISCORD_IDS = '123456789012345678';
  expect((await siteSettings(request())).status).toBe(403);
  auth.mockResolvedValue(null);
  expect((await siteSettings(request())).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

it('authorizes site admins using signed v2 provider identity and never reads public profile identity', async () => {
  process.env.SITE_ADMIN_DISCORD_IDS = ' 123456789012345678,987654321098765432 ';
  auth.mockResolvedValue({ user: { id: 'admin-1', discordId: '123456789012345678' } });
  process.env.ADMIN_DISCORD_WEBHOOK_URL = destination;
  expect((await siteSettings(request(undefined, undefined, '1'))).status).toBe(200);
  expect(ranges).toHaveBeenCalledWith(20, 40);
  expect(selects).not.toHaveBeenCalledWith('users', expect.anything());
  expect(selects).not.toHaveBeenCalledWith('admin_discord_destinations', expect.anything());
  expect((await saveSite(request({ categories: { account_registered: false }, role_mentions: {}, actor_id: 'forged' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_admin_discord_preferences', {
    p_group_id: null, p_categories: { account_registered: false }, p_roles: {}, p_actor_id: 'admin-1',
  });
  expect((await saveSite(request({ webhook_url: ` ${destination} ` }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_site_admin_discord_webhook', { p_url: destination, p_actor_id: 'admin-1' });
  expect((await saveSite(request({ webhook_url: '' }))).status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('save_site_admin_discord_webhook', { p_url: null, p_actor_id: 'admin-1' });
});

it('authorizes legacy site admins only through verified Discord identities, not user metadata', async () => {
  process.env.AUTH_STACK = 'v1';
  process.env.SITE_ADMIN_DISCORD_IDS = '123456789012345678';
  getUser.mockResolvedValue({ data: { user: { id: 'admin-1', user_metadata: { provider_id: '123456789012345678' } } }, error: null });
  expect((await siteSettings(request(undefined, 'legacy-session'))).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: { id: 'admin-1', identities: [{ provider: 'discord', id: '123456789012345678' }] } }, error: null });
  expect((await siteSettings(request(undefined, 'legacy-session'))).status).toBe(200);
  expect(auth).not.toHaveBeenCalled();
  expect(selects).not.toHaveBeenCalledWith('users', expect.anything());
});

it('validates site input, explicit overrides and configuration errors without exposing credentials', async () => {
  process.env.SITE_ADMIN_DISCORD_IDS = '123456789012345678';
  auth.mockResolvedValue({ user: { id: 'admin-1', discordId: '123456789012345678' } });
  process.env.ADMIN_DISCORD_ROLE_MENTIONS = 'invalid JSON';
  siteConfig = { categories: { account_registered: false }, webhook_override: true, destination_id: null, role_mentions: {} };
  const response = await siteSettings(request());
  expect(await response.json()).toEqual({ configured: false, categories: { account_registered: false }, role_mentions: {}, logs: [], hasMore: false });
  expect((await siteSettings(request(undefined, undefined, '-1'))).status).toBe(400);
  for (const body of [null, [], {}, { categories: { unknown: false }, role_mentions: {} }, { categories: {}, role_mentions: { role_changed: '@everyone' } },
    { webhook_url: 'https://evil.test' }, { webhook_url: '', categories: {} }]) {
    expect((await saveSite(request(body))).status).toBe(400);
  }
  process.env.SITE_ADMIN_DISCORD_IDS = 'bad-id';
  expect((await siteSettings(request())).status).toBe(500);
  process.env.SITE_ADMIN_DISCORD_IDS = '123456789012345678';
  dbError = true;
  expect((await siteSettings(request())).status).toBe(500);
  dbError = false;
  rpc.mockResolvedValue({ error: { code: 'offline' } });
  expect((await saveSite(request({ categories: {}, role_mentions: {} }))).status).toBe(500);
});
