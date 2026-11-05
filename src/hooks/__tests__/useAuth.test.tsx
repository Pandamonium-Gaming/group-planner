import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';
import { useAuth } from '../useAuth';
import { AuthProvider, useAuthContext } from '@/components/auth/AuthProvider';

(globalThis as { React?: typeof React }).React = React;

jest.mock('next-auth/react', () => ({ signIn: jest.fn(), signOut: jest.fn() }));
jest.mock('@/lib/authStack', () => ({ getClientAuthStack: () => 'v2' }));
jest.mock('@/lib/auth', () => ({
  getUserProfile: jest.fn(),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signInWithDiscord: jest.fn(),
  signOut: jest.fn(),
  updateDisplayName: jest.fn(),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const fetchMock = jest.fn();
const session = {
  stack: 'v2',
  authenticated: true,
  user: { id: 'player', discordId: 'discord-player', displayName: 'Player' },
};
const anonymous = { stack: 'v2', authenticated: false, user: null };
const profile = {
  id: 'player', discord_id: 'discord-player', discord_username: 'player',
  discord_avatar: null, display_name: 'Player', timezone: 'UTC',
};
const response = (payload: unknown) => ({ ok: true, json: async () => payload });

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

function EventPage() {
  const { user, loading } = useAuthContext();
  if (loading) return <p>Loading</p>;
  return user ? <p>Event for {user.id}</p> : <button>Sign in</button>;
}

it.each(['network', 'server', 'invalid-json', 'wrong-stack', 'malformed-user'] as const)(
  'shows a retry screen, not a login prompt, after a %s failure and recovers the event without OAuth',
  async failure => {
    window.history.replaceState({}, '', '/guild/wowforever/events#event-123');
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'));
    if (failure === 'server') fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    if (failure === 'invalid-json') {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
    }
    if (failure === 'wrong-stack') {
      fetchMock.mockResolvedValueOnce(response({ ...anonymous, stack: 'v1' }));
    }
    if (failure === 'malformed-user') {
      fetchMock.mockResolvedValueOnce(response({ ...session, user: null }));
    }
    render(<AuthProvider><EventPage /></AuthProvider>);
    expect(await screen.findByRole('heading', { name: 'auth.sessionUnavailable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'common.returnHome' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({ profile }));
    fireEvent.click(screen.getByRole('button', { name: 'common.retryConnection' }));
    expect(await screen.findByText('Event for player')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.hash).toBe('/guild/wowforever/events#event-123');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      credentials: 'include', cache: 'no-store',
    });
  }
);

it('allows the normal login prompt only after a valid anonymous session response', async () => {
  fetchMock.mockResolvedValueOnce(response(anonymous));
  render(<AuthProvider><EventPage /></AuthProvider>);
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'auth.sessionUnavailable' })).not.toBeInTheDocument();
});

it('preserves the known user and profile on a failed refresh, but clears them on confirmed logout', async () => {
  fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({ profile }));
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.user?.id).toBe('player');

  fetchMock.mockRejectedValueOnce(new TypeError('Connection lost'));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.user?.id).toBe('player');
  expect(result.current.profile).toEqual(profile);
  expect(result.current.error).toBeInstanceOf(Error);

  fetchMock.mockResolvedValueOnce(response(anonymous));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.user).toBeNull();
  expect(result.current.profile).toBeNull();
  expect(result.current.error).toBeNull();
});

it('does not require another login when only the optional profile request fails', async () => {
  fetchMock.mockResolvedValueOnce(response(session)).mockRejectedValueOnce(new TypeError('Profile unavailable'));
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.user?.id).toBe('player');
  expect(result.current.profile?.display_name).toBe('Player');
  expect(result.current.error).toBeNull();
});
