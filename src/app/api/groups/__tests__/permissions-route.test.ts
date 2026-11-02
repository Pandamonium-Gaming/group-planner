import { GET } from '../[groupId]/permissions/route';

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

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/server/permissions/group-permissions-service', () => ({
  getGroupPermissionsSnapshot: jest.fn(),
}));

const { auth } = jest.requireMock('@/auth') as { auth: jest.Mock };
const { createClient } = jest.requireMock('@supabase/supabase-js') as { createClient: jest.Mock };
const { getGroupPermissionsSnapshot } = jest.requireMock('@/server/permissions/group-permissions-service') as {
  getGroupPermissionsSnapshot: jest.Mock;
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

describe('GET /api/groups/[groupId]/permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    createClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('unauthorized'),
        }),
      },
    });
  });

  it('returns 401 when user context cannot be resolved', async () => {
    auth.mockResolvedValue(null);

    const response = await GET(makeRequest() as any, {
      params: Promise.resolve({ groupId: 'group-1' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when user is not a group member', async () => {
    auth.mockResolvedValue({ user: { id: 'user-1', discordId: null } });
    getGroupPermissionsSnapshot.mockResolvedValue(null);

    const response = await GET(makeRequest() as any, {
      params: Promise.resolve({ groupId: 'group-1' }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns role and effective permissions for group member', async () => {
    auth.mockResolvedValue({ user: { id: 'user-1', discordId: null } });
    getGroupPermissionsSnapshot.mockResolvedValue({
      groupId: 'group-1',
      userId: 'user-1',
      role: 'officer',
      permissions: ['events_create', 'settings_edit_roles'],
    });

    const response = await GET(makeRequest() as any, {
      params: Promise.resolve({ groupId: 'group-1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      groupId: 'group-1',
      userId: 'user-1',
      role: 'officer',
      permissions: ['events_create', 'settings_edit_roles'],
    });
  });
});
