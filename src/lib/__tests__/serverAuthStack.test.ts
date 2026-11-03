import { getServerSession } from 'next-auth';
import { auth } from '@/auth';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('next-auth/providers/discord', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@auth/pg-adapter', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/server/users/discord-identity', () => ({ resolveStandaloneDiscordUser: jest.fn() }));

const getSession = jest.mocked(getServerSession);
const originalStack = process.env.AUTH_STACK;
const originalPublicStack = process.env.NEXT_PUBLIC_AUTH_STACK;

afterEach(() => {
  jest.resetAllMocks();
  if (originalStack === undefined) delete process.env.AUTH_STACK;
  else process.env.AUTH_STACK = originalStack;
  if (originalPublicStack === undefined) delete process.env.NEXT_PUBLIC_AUTH_STACK;
  else process.env.NEXT_PUBLIC_AUTH_STACK = originalPublicStack;
});

it.each(['v1', undefined])('does not invoke Auth.js for legacy stack %s', async stack => {
  if (stack) process.env.AUTH_STACK = stack;
  else delete process.env.AUTH_STACK;
  delete process.env.NEXT_PUBLIC_AUTH_STACK;
  getSession.mockRejectedValue(new Error('NO_SECRET'));
  await expect(auth()).resolves.toBeNull();
  expect(getSession).not.toHaveBeenCalled();
});

it('retains Auth.js sessions and configuration errors for v2', async () => {
  process.env.AUTH_STACK = 'v2';
  getSession.mockResolvedValue({ user: { id: 'admin' } });
  await expect(auth()).resolves.toEqual({ user: { id: 'admin' } });
  getSession.mockRejectedValue(new Error('NO_SECRET'));
  await expect(auth()).rejects.toThrow('NO_SECRET');
});
