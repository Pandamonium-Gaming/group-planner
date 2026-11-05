/** @jest-environment node */
import { GET } from '../route';
import { getSessionSnapshot } from '@/server/auth/session-service';

jest.mock('@/server/auth/session-service', () => ({ getSessionSnapshot: jest.fn() }));

it.each([null, 'player'])('does not allow caching the session response for user %s', async userId => {
  jest.mocked(getSessionSnapshot).mockResolvedValue({
    stack: 'v2', userId, discordId: null, displayName: null,
  });
  const response = await GET();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    stack: 'v2', authenticated: !!userId,
    user: userId ? { id: userId, discordId: null, displayName: null } : null,
  });
});
