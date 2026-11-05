/** @jest-environment node */
import { getURL } from '../url';

const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
  for (const key of ['NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_VERCEL_URL', 'VERCEL_URL']) {
    delete process.env[key];
  }
});
afterEach(() => { process.env = originalEnv; });

it('prefers the configured site over authentication and deployment hostnames', () => {
  process.env.NEXT_PUBLIC_SITE_URL = ' https://planner.test/ ';
  process.env.NEXTAUTH_URL = 'https://auth.test/api/auth';
  process.env.VERCEL_URL = 'preview.vercel.app';
  expect(getURL()).toBe('https://planner.test/');
});

it('uses the authentication origin rather than a preview hostname when no site is configured', () => {
  process.env.NEXT_PUBLIC_SITE_URL = ' ';
  process.env.NEXTAUTH_URL = 'https://planner.test/api/auth';
  process.env.VERCEL_URL = 'preview.vercel.app';
  expect(getURL()).toBe('https://planner.test/');
});

it.each(['NEXT_PUBLIC_VERCEL_URL', 'VERCEL_URL'])('normalises a scheme-less %s fallback', key => {
  process.env[key] = 'planner.vercel.app';
  expect(getURL()).toBe('https://planner.vercel.app/');
});

it('preserves HTTP for local development', () => {
  expect(getURL()).toBe('http://localhost:3000/');
});

it('rejects invalid URL protocols instead of sending broken notification links', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'ftp://planner.test';
  expect(getURL).toThrow('Site URL must use HTTP or HTTPS');
});
