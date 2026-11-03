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

type GroupMemberRow = {
  id?: string;
  role: 'admin' | 'officer' | 'member' | 'trial' | 'pending';
  user_id: string;
};

type CharacterRow = {
  id: string;
  user_id: string | null;
  group_id: string;
};

type UpdateRecord = {
  table: 'group_members' | 'members';
  payload: Record<string, unknown>;
  eqCalls: Array<[string, string]>;
};

type MockState = {
  selectMembershipQueue: GroupMemberRow[];
  selectCharacterQueue: CharacterRow[];
  updates: UpdateRecord[];
  insertResult: { data: unknown; error: { message: string } | null };
};

const mockState: MockState = {
  selectMembershipQueue: [],
  selectCharacterQueue: [],
  updates: [],
  insertResult: { data: null, error: null },
};

function createGroupMembersSelectQuery() {
  const query: any = {};
  query.eq = jest.fn(() => query);
  query.in = jest.fn(() => query);
  query.neq = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.maybeSingle = jest.fn().mockImplementation(async () => {
    const next = mockState.selectMembershipQueue.shift();
    return {
      data: next ?? null,
      error: null,
    };
  });
  return query;
}

function createMembersSelectQuery() {
  const query: any = {};
  query.eq = jest.fn(() => query);
  query.maybeSingle = jest.fn().mockImplementation(async () => {
    const next = mockState.selectCharacterQueue.shift();
    return {
      data: next ?? null,
      error: null,
    };
  });
  return query;
}

function createUpdateChain(record: UpdateRecord) {
  const chain: any = {};
  chain.eq = jest.fn((column: string, value: string) => {
    record.eqCalls.push([column, value]);
    return chain;
  });
  chain.then = (resolve: (value: { error: null }) => unknown) => resolve({ error: null });
  return chain;
}

function createMockAdminClient() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'group_members') {
        return {
          select: jest.fn(() => createGroupMembersSelectQuery()),
          update: jest.fn((payload: Record<string, unknown>) => {
            const record: UpdateRecord = {
              table: 'group_members',
              payload,
              eqCalls: [],
            };
            mockState.updates.push(record);
            return createUpdateChain(record);
          }),
        };
      }

      if (table === 'members') {
        return {
          insert: jest.fn(() => ({
            select: () => ({ single: async () => mockState.insertResult }),
          })),
          select: jest.fn(() => createMembersSelectQuery()),
          update: jest.fn((payload: Record<string, unknown>) => {
            const record: UpdateRecord = {
              table: 'members',
              payload,
              eqCalls: [],
            };
            mockState.updates.push(record);
            return createUpdateChain(record);
          }),
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

describe('POST /api/group/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    mockState.selectMembershipQueue = [];
    mockState.selectCharacterQueue = [];
    mockState.updates = [];
    mockState.insertResult = { data: null, error: null };

    auth.mockResolvedValue({
      user: {
        id: 'actor-user-id',
      },
    });

    createClient.mockImplementation(() => createMockAdminClient());
  });

  it('returns 409 game_not_enabled when the game was removed from the group', async () => {
    mockState.selectMembershipQueue = [{ id: 'actor-membership-id', role: 'member', user_id: 'actor-user-id' }];
    mockState.insertResult = { data: null, error: { message: 'GAME_NOT_ENABLED' } };

    const response = await POST(makeRequest({
      action: 'create_character', group_id: 'group-1', game_slug: 'aoc', character: { name: 'Stale' },
    }) as any);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'This game is no longer enabled for the group', code: 'game_not_enabled' });
  });

  it('keeps other character insert failures as 500', async () => {
    mockState.selectMembershipQueue = [{ id: 'actor-membership-id', role: 'member', user_id: 'actor-user-id' }];
    mockState.insertResult = { data: null, error: { message: 'duplicate key' } };

    const response = await POST(makeRequest({
      action: 'create_character', group_id: 'group-1', game_slug: 'aoc', character: { name: 'Dup' },
    }) as any);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to create character', details: 'duplicate key' });
  });

  it('updates by resolved target membership id for update_user_rank action', async () => {
    mockState.selectMembershipQueue = [
      { id: 'actor-membership-id', role: 'admin', user_id: 'actor-user-id' },
      { id: 'target-membership-id', role: 'member', user_id: 'target-user-id' },
    ];

    const request = makeRequest({
      action: 'update_user_rank',
      group_id: 'group-1',
      target_user_id: 'target-user-id',
      rank: 'lead',
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockState.updates).toEqual([
      {
        table: 'group_members',
        payload: { guild_rank: 'lead' },
        eqCalls: [
          ['id', 'target-membership-id'],
          ['group_id', 'group-1'],
        ],
      },
    ]);
  });

  it('syncs character rank to members and group_members for update_character_rank action', async () => {
    mockState.selectMembershipQueue = [
      { id: 'actor-membership-id', role: 'admin', user_id: 'actor-user-id' },
    ];
    mockState.selectCharacterQueue = [
      { id: 'character-1', user_id: 'target-user-id', group_id: 'group-1' },
    ];

    const request = makeRequest({
      action: 'update_character_rank',
      group_id: 'group-1',
      character_id: 'character-1',
      rank: 'captain',
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockState.updates).toEqual([
      {
        table: 'members',
        payload: { rank: 'captain' },
        eqCalls: [
          ['id', 'character-1'],
          ['group_id', 'group-1'],
        ],
      },
      {
        table: 'group_members',
        payload: { guild_rank: 'captain' },
        eqCalls: [
          ['group_id', 'group-1'],
          ['user_id', 'target-user-id'],
        ],
      },
    ]);
  });

  it('forbids officers from changing character rank for admin targets', async () => {
    mockState.selectMembershipQueue = [
      { id: 'actor-membership-id', role: 'officer', user_id: 'actor-user-id' },
      { id: 'target-membership-id', role: 'admin', user_id: 'target-user-id' },
    ];
    mockState.selectCharacterQueue = [
      { id: 'character-1', user_id: 'target-user-id', group_id: 'group-1' },
    ];

    const request = makeRequest({
      action: 'update_character_rank',
      group_id: 'group-1',
      character_id: 'character-1',
      rank: 'captain',
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(mockState.updates).toEqual([]);
  });
});
