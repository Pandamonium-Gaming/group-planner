import { POST } from '../route';

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

const { auth } = jest.requireMock('@/auth') as {
  auth: jest.Mock;
};

const { createClient } = jest.requireMock('@supabase/supabase-js') as {
  createClient: jest.Mock;
};

type MockState = {
  membershipRole: 'admin' | 'officer' | 'member' | 'trial' | 'pending';
  groupUpdateError: { message: string } | null;
  updatedGroupsPayload: Record<string, unknown> | null;
};

const mockState: MockState = {
  membershipRole: 'admin',
  groupUpdateError: null,
  updatedGroupsPayload: null,
};

function createMockAdminClient() {
  const groupMembersSelect = jest.fn(() => {
    const query: any = {};
    query.eq = jest.fn(() => query);
    query.in = jest.fn(() => query);
    query.neq = jest.fn(() => query);
    query.limit = jest.fn(() => query);
    query.maybeSingle = jest.fn().mockResolvedValue({
      data: { role: mockState.membershipRole },
      error: null,
    });
    return query;
  });

  const groupsUpdate = jest.fn((payload: Record<string, unknown>) => {
    mockState.updatedGroupsPayload = payload;
    return {
      eq: jest.fn().mockResolvedValue({ error: mockState.groupUpdateError }),
    };
  });

  return {
    from: jest.fn((table: string) => {
      if (table === 'group_members') {
        return {
          select: groupMembersSelect,
        };
      }

      if (table === 'groups') {
        return {
          update: groupsUpdate,
        };
      }

      if (table === 'users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
}

function makeRequest(payload: unknown) {
  return {
    headers: {
      get: (_name: string) => null,
    },
    json: async () => payload,
  };
}

describe('POST /api/group/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    mockState.membershipRole = 'admin';
    mockState.groupUpdateError = null;
    mockState.updatedGroupsPayload = null;

    auth.mockResolvedValue({
      user: {
        id: 'actor-user-id',
        discordId: 'discord-123',
      },
    });

    createClient.mockImplementation(() => createMockAdminClient());
  });

  it('accepts rank settings fields and filters out unknown fields', async () => {
    const request = makeRequest({
      action: 'update_group_fields',
      group_id: 'group-1',
      changes: {
        sc_ranks_enabled: true,
        sc_custom_ranks: [{ id: 'lead', name: 'Lead', hierarchy: 1 }],
        ignored_field: 'should-not-be-updated',
      },
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockState.updatedGroupsPayload).toEqual({
      sc_ranks_enabled: true,
      sc_custom_ranks: [{ id: 'lead', name: 'Lead', hierarchy: 1 }],
    });
  });

  it('returns 400 when no allowed fields are provided', async () => {
    const request = makeRequest({
      action: 'update_group_fields',
      group_id: 'group-1',
      changes: {
        completely_invalid: true,
      },
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'No allowed fields to update' });
  });

  it('returns 403 when role lacks permission to update settings fields', async () => {
    mockState.membershipRole = 'member';

    const request = makeRequest({
      action: 'update_group_fields',
      group_id: 'group-1',
      changes: {
        sc_ranks_enabled: true,
      },
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
  });
});
