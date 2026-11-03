/** @jest-environment node */
import type { NextAuthOptions, Session } from 'next-auth';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('next-auth/providers/discord', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@auth/pg-adapter', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn() })) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/server/users/discord-identity', () => ({ resolveStandaloneDiscordUser: jest.fn() }));

const originalEnvironment = { ...process.env };
const discordId = '123456789012345678';
beforeEach(() => {
  jest.resetModules();
  process.env.APP_DATA_BACKEND = 'postgres';
  process.env.AUTH_STACK = 'v2';
  process.env.AUTH_SESSION_STRATEGY = 'database';
  process.env.AUTH_DATABASE_URL = 'postgresql://test:test@localhost/group_planner_rehearsal_validation';
  process.env.AUTH_SECRET = 'test-secret';
  process.env.AUTH_DISCORD_ID = 'test-client';
  process.env.AUTH_DISCORD_SECRET = 'test-client-secret';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...originalEnvironment };
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function callbacks() {
  const { authOptions } = await import('@/auth');
  if (!authOptions.callbacks?.signIn || !authOptions.callbacks.session) throw new Error('Missing auth callbacks');
  return { signIn: authOptions.callbacks.signIn, session: authOptions.callbacks.session, options: authOptions };
}

function sessionInput(): Parameters<NonNullable<NonNullable<NextAuthOptions['callbacks']>['session']>>[0] {
  return {
    session: { user: { id: null, discordId: null, name: 'Discord name' }, expires: new Date(Date.now() + 60000).toISOString() },
    user: { id: 'auth-user-id', name: 'Discord name', email: 'test@example.test', emailVerified: null },
    token: { sub: 'auth-user-id', discordId },
    newSession: null, trigger: 'update',
  };
}

it('isolates database sessions from application users and preserves the mapped application ID', async () => {
  const { session, options } = await callbacks();
  const resolver = jest.requireMock('@/server/users/discord-identity').resolveStandaloneDiscordUser as jest.Mock;
  const pool = jest.requireMock('pg').Pool as jest.Mock;
  resolver.mockResolvedValue('existing-application-id');
  const result = await session(sessionInput()) as Session;
  expect(result.user?.id).toBe('existing-application-id');
  expect(result.user?.id).not.toBe('auth-user-id');
  expect(result.user?.discordId).toBe(discordId);
  expect(options.session?.strategy).toBe('database');
  expect(pool).toHaveBeenCalledWith(expect.objectContaining({ options: '-c search_path=authjs,pg_catalog' }));
});

it('rejects sign-in and session resolution when application mapping is unavailable', async () => {
  const { signIn, session } = await callbacks();
  const resolver = jest.requireMock('@/server/users/discord-identity').resolveStandaloneDiscordUser as jest.Mock;
  resolver.mockResolvedValue(null);
  const profile = { id: discordId, name: 'Discord name' };
  expect(await signIn({
    user: { id: 'auth-user-id' }, account: { provider: 'discord', providerAccountId: discordId, type: 'oauth' },
    profile,
  })).toBe(false);
  await expect(session(sessionInput())).rejects.toThrow('Unable to resolve application account');
  expect(await signIn({ user: { id: 'auth-user-id' }, account: null })).toBe(false);
});

it('resolves a database-session callback when NextAuth omits the JWT token', async () => {
  const { session } = await callbacks();
  const resolver = jest.requireMock('@/server/users/discord-identity').resolveStandaloneDiscordUser as jest.Mock;
  const pool = jest.requireMock('pg').Pool as jest.Mock;
  const query = pool.mock.results[0].value.query as jest.Mock;
  query.mockResolvedValue({ rows: [{ providerAccountId: discordId }] });
  resolver.mockResolvedValue('existing-application-id');
  const input = sessionInput();
  // Database sessions omit token at runtime despite NextAuth's callback typing.
  const result: Session = await Reflect.apply(session, undefined, [{ session: input.session, user: input.user }]);
  expect(result.user?.id).toBe('existing-application-id');
  expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM accounts'), ['auth-user-id', 'discord']);
});

it('surfaces database errors instead of granting an Auth.js identity as application access', async () => {
  const { session } = await callbacks();
  const resolver = jest.requireMock('@/server/users/discord-identity').resolveStandaloneDiscordUser as jest.Mock;
  resolver.mockRejectedValue(new Error('Database unavailable'));
  await expect(session(sessionInput())).rejects.toThrow('Database unavailable');
});

it.each(['AUTH_DATABASE_URL', 'AUTH_SECRET'])('refuses standalone startup without %s', async key => {
  delete process.env[key];
  await expect(import('@/auth')).rejects.toThrow('Standalone authentication requires database sessions');
});

it('refuses JWT fallback for standalone authentication', async () => {
  process.env.AUTH_SESSION_STRATEGY = 'jwt';
  await expect(import('@/auth')).rejects.toThrow('Standalone authentication requires database sessions');
});
