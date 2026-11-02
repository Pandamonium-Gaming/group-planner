import { getGroupPermissionsSnapshot } from '../group-permissions-service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const { createClient } = jest.requireMock('@supabase/supabase-js') as {
  createClient: jest.Mock;
};

type MembershipRow = { role: 'admin' | 'officer' | 'member' | 'trial' | 'pending'; user_id: string };

type MockState = {
  memberships: MembershipRow[];
  overridesByRole: Record<string, Record<string, unknown> | null>;
};

const mockState: MockState = {
  memberships: [],
  overridesByRole: {},
};

function createMockSupabaseAdmin() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'group_members') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn().mockResolvedValue({ data: mockState.memberships, error: null }),
            })),
          })),
        };
      }

      if (table === 'group_permission_overrides') {
        const query: any = {};
        query.select = jest.fn(() => query);
        query.eq = jest.fn((column: string, value: string) => {
          if (column === 'role') {
            query.__role = value;
          }
          return query;
        });
        query.maybeSingle = jest.fn().mockImplementation(async () => ({
          data: mockState.overridesByRole[query.__role] ?? null,
          error: null,
        }));
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('getGroupPermissionsSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    mockState.memberships = [];
    mockState.overridesByRole = {};

    createClient.mockImplementation(() => createMockSupabaseAdmin());
  });

  it('returns null for non-member users', async () => {
    const snapshot = await getGroupPermissionsSnapshot('group-1', ['user-1']);
    expect(snapshot).toBeNull();
  });

  it.each([
    ['admin'],
    ['officer'],
    ['member'],
    ['trial'],
    ['pending'],
  ] as const)('resolves default permissions for role %s', async (role) => {
    mockState.memberships = [{ role, user_id: 'user-1' }];

    const snapshot = await getGroupPermissionsSnapshot('group-1', ['user-1']);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.role).toBe(role);
    expect(Array.isArray(snapshot?.permissions)).toBe(true);
  });

  it('applies override booleans on top of defaults', async () => {
    mockState.memberships = [{ role: 'member', user_id: 'user-1' }];
    mockState.overridesByRole.member = {
      events_create: false,
      settings_view_permissions: true,
    };

    const snapshot = await getGroupPermissionsSnapshot('group-1', ['user-1']);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.permissions.includes('events_create')).toBe(false);
    expect(snapshot?.permissions.includes('settings_view_permissions')).toBe(true);
  });
});
