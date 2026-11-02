import { GET } from '../route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/authStack', () => ({
  getServerAuthStack: jest.fn(),
}));

jest.mock('@/server/users/user-profile-repository', () => ({
  findOrCreateUserProfileById: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const { auth } = jest.requireMock('@/auth') as { auth: jest.Mock };
const { getServerAuthStack } = jest.requireMock('@/lib/authStack') as {
  getServerAuthStack: jest.Mock;
};
const { findOrCreateUserProfileById } = jest.requireMock('@/server/users/user-profile-repository') as {
  findOrCreateUserProfileById: jest.Mock;
};
const { createClient } = jest.requireMock('@supabase/supabase-js') as {
  createClient: jest.Mock;
};

function makeRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'authorization') {
          return authHeader ?? null;
        }
        return null;
      },
    },
  };
}

describe('GET /api/me/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('returns 401 in v2 when no session user exists', async () => {
    getServerAuthStack.mockReturnValue('v2');
    auth.mockResolvedValue(null);

    const response = await GET(makeRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns profile in v2 when session user exists', async () => {
    getServerAuthStack.mockReturnValue('v2');
    auth.mockResolvedValue({
      user: {
        id: 'user-1',
        discordId: 'discord-1',
        name: 'Display Name',
      },
    });

    findOrCreateUserProfileById.mockResolvedValue({
      id: 'user-1',
      discord_id: 'discord-1',
      discord_username: 'Display Name',
      discord_avatar: null,
      display_name: 'Display Name',
      timezone: 'UTC',
    });

    const response = await GET(makeRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toMatchObject({
      id: 'user-1',
      display_name: 'Display Name',
    });
    expect(findOrCreateUserProfileById).toHaveBeenCalledWith('user-1', {
      discordId: 'discord-1',
      discordUsername: null,
      discordAvatar: null,
      displayName: 'Display Name',
      timezone: 'UTC',
    });
  });

  it('returns 401 in v1 when bearer token is missing', async () => {
    getServerAuthStack.mockReturnValue('v1');

    const response = await GET(makeRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns profile in v1 when bearer token resolves user', async () => {
    getServerAuthStack.mockReturnValue('v1');

    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'legacy-user-1',
              user_metadata: {
                provider_id: 'discord-legacy-1',
                full_name: 'Legacy Name',
                avatar_url: 'https://cdn.example/avatar.png',
              },
            },
          },
          error: null,
        }),
      },
    });

    findOrCreateUserProfileById.mockResolvedValue({
      id: 'legacy-user-1',
      discord_id: 'discord-legacy-1',
      discord_username: 'Legacy Name',
      discord_avatar: 'https://cdn.example/avatar.png',
      display_name: 'Legacy Name',
      timezone: 'UTC',
    });

    const response = await GET(makeRequest('Bearer token-123') as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toMatchObject({
      id: 'legacy-user-1',
      discord_id: 'discord-legacy-1',
    });
    expect(findOrCreateUserProfileById).toHaveBeenCalledWith('legacy-user-1', {
      discordId: 'discord-legacy-1',
      discordUsername: 'Legacy Name',
      discordAvatar: 'https://cdn.example/avatar.png',
      displayName: 'Legacy Name',
      timezone: 'UTC',
    });
  });
});
