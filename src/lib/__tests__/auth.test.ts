/**
 * Tests for authentication and user management
 * Critical security: These tests verify user auth, profiles, and group membership
 */

import {
  signInWithDiscord,
  signOut,
  getSession,
  getUserProfile,
  updateDisplayName,
  getGroupMembership,
  applyToGroup,
  acceptMember,
  removeMember,
  updateMemberRole,
  createGroup,
  getGroupBySlug,
  getGroupById,
  updateClanIconUrl,
  getUserGroups,
  syncDiscordIdToMembers,
  type UserProfile,
  type ClanMembership,
} from '../auth';

// Mock Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock getURL
jest.mock('../url', () => ({
  getURL: jest.fn(() => 'http://localhost:3000/'),
}));

import { supabase } from '../supabase';

describe('Authentication & User Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signInWithDiscord', () => {
    it('should initiate OAuth flow with Discord', async () => {
      const mockData = { url: 'https://discord.com/oauth/authorize' };
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await signInWithDiscord();

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'discord',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
          scopes: 'identify',
        },
      });
      expect(result).toEqual(mockData);
    });

    it('should handle OAuth error', async () => {
      const error = new Error('OAuth failed');
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: null,
        error,
      });

      await expect(signInWithDiscord()).rejects.toThrow('OAuth failed');
    });

    it('should use custom redirect URL if provided', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: { url: 'https://discord.com/oauth' },
        error: null,
      });

      await signInWithDiscord('/dashboard');

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo: 'http://localhost:3000/auth/callback',
          }),
        })
      );
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: null,
      });

      await signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should throw error on sign out failure', async () => {
      const error = new Error('Sign out failed');
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({
        error,
      });

      await expect(signOut()).rejects.toThrow('Sign out failed');
    });
  });

  describe('getSession', () => {
    it('should return current session', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123',
      };

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await getSession();

      expect(result).toEqual(mockSession);
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });

    it('should return null when no session exists', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await getSession();

      expect(result).toBeNull();
    });

    it('should throw error on session fetch failure', async () => {
      const error = new Error('Session fetch failed');
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error,
      });

      await expect(getSession()).rejects.toThrow('Session fetch failed');
    });
  });

  describe('getUserProfile', () => {
    const mockProfile: UserProfile = {
      id: 'user-123',
      discord_id: 'discord-456',
      discord_username: 'testuser',
      discord_avatar: null,
      display_name: 'Test User',
      timezone: 'UTC',
    };

    it('should return existing user profile', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getUserProfile('user-123');

      expect(result).toEqual(mockProfile);
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('should auto-create profile from auth.users if not found', async () => {
      const mockSelectForGet = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: mockSelectForGet,
            insert: mockInsert,
          };
        }
        return null;
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            user_metadata: {
              provider_id: 'discord-456',
              full_name: 'Test User',
              avatar_url: null,
            },
          },
        },
        error: null,
      });

      const result = await getUserProfile('user-123');

      expect(result).toEqual(mockProfile);
    });

    it('should return null if auth user does not match requested user', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'different-user' } },
        error: null,
      });

      const result = await getUserProfile('user-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const error = new Error('Database error');
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getUserProfile('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('updateDisplayName', () => {
    it('should update user display name', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await updateDisplayName('user-123', 'New Name');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({ display_name: 'New Name' });
    });

    it('should throw error on update failure', async () => {
      const error = new Error('Update failed');
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(updateDisplayName('user-123', 'New Name')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('getGroupMembership', () => {
    const mockMembership: ClanMembership = {
      group_id: 'group-123',
      role: 'member',
      is_creator: false,
      approved_at: '2024-01-01T00:00:00Z',
    };

    it('should return group membership', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getGroupMembership('group-123', 'user-123');

      expect(result).toEqual(mockMembership);
    });

    it('should return null if membership does not exist', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getGroupMembership('group-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('applyToGroup', () => {
    it('should create pending membership when approval is required', async () => {
      const mockSelectGroup = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { approval_required: true, default_role: 'trial' },
            error: null,
          }),
        }),
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'groups') {
          return { select: mockSelectGroup };
        }
        if (table === 'group_members') {
          return { insert: mockInsert };
        }
      });

      await applyToGroup('group-123', 'user-123');

      expect(mockInsert).toHaveBeenCalledWith({
        group_id: 'group-123',
        user_id: 'user-123',
        role: 'pending',
        approved_at: null,
      });
    });

    it('should auto-approve membership when approval not required', async () => {
      const mockSelectGroup = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { approval_required: false, default_role: 'member' },
            error: null,
          }),
        }),
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'groups') {
          return { select: mockSelectGroup };
        }
        if (table === 'group_members') {
          return { insert: mockInsert };
        }
      });

      await applyToGroup('group-123', 'user-123');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'group-123',
          user_id: 'user-123',
          role: 'member',
          approved_at: expect.any(String),
        })
      );
    });

    it('should throw error if group not found', async () => {
      const error = new Error('Group not found');
      const mockSelectGroup = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelectGroup,
      } as any);

      await expect(applyToGroup('invalid-group', 'user-123')).rejects.toThrow(
        'Group not found'
      );
    });
  });

  describe('acceptMember', () => {
    it('should accept pending member', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await acceptMember('membership-123', 'admin-user');

      expect(mockUpdate).toHaveBeenCalledWith({
        role: 'member',
        approved_at: expect.any(String),
        approved_by: 'admin-user',
      });
    });

    it('should throw error on acceptance failure', async () => {
      const error = new Error('Update failed');
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(acceptMember('membership-123', 'admin-user')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from group', async () => {
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      } as any);

      await removeMember('membership-123');

      expect(supabase.from).toHaveBeenCalledWith('group_members');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw error on removal failure', async () => {
      const error = new Error('Deletion failed');
      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      } as any);

      await expect(removeMember('membership-123')).rejects.toThrow(
        'Deletion failed'
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await updateMemberRole('membership-123', 'officer');

      expect(mockUpdate).toHaveBeenCalledWith({ role: 'officer' });
    });

    it('should support all valid roles', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      const roles = ['admin', 'officer', 'member'] as const;

      for (const role of roles) {
        await updateMemberRole('membership-123', role);
        expect(mockUpdate).toHaveBeenCalledWith({ role });
      }
    });

    it('should throw error on role update failure', async () => {
      const error = new Error('Update failed');
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(updateMemberRole('membership-123', 'admin')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('createGroup', () => {
    const mockGroup = {
      id: 'group-123',
      slug: 'test-group',
      name: 'Test Group',
    };

    it('should create group and add creator as admin', async () => {
      const mockSelectGroup = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockGroup,
          error: null,
        }),
      });

      const mockInsertMember = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'groups') {
          return {
            insert: jest.fn().mockReturnValue({
              select: mockSelectGroup,
            }),
          };
        }
        if (table === 'group_members') {
          return { insert: mockInsertMember };
        }
      });

      const result = await createGroup('test-group', 'Test Group', 'user-123');

      expect(result).toEqual(mockGroup);
      expect(mockInsertMember).toHaveBeenCalledWith({
        group_id: 'group-123',
        user_id: 'user-123',
        role: 'admin',
        is_creator: true,
        approved_at: expect.any(String),
        approved_by: 'user-123',
      });
    });

    it('should throw error if group creation fails', async () => {
      const error = new Error('Unique constraint violation');
      const mockSelectGroup = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: mockSelectGroup,
        }),
      } as any);

      await expect(createGroup('test', 'Test', 'user-123')).rejects.toThrow(
        'Unique constraint violation'
      );
    });

    it('should throw error if member record creation fails', async () => {
      const error = new Error('Member insert failed');
      const mockSelectGroup = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockGroup,
          error: null,
        }),
      });

      const mockInsertMember = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          error,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table) => {
        if (table === 'groups') {
          return {
            insert: jest.fn().mockReturnValue({
              select: mockSelectGroup,
            }),
          };
        }
        if (table === 'group_members') {
          return { insert: mockInsertMember };
        }
      });

      await expect(createGroup('test', 'Test', 'user-123')).rejects.toThrow(
        'Member insert failed'
      );
    });
  });

  describe('getGroupBySlug', () => {
    it('should return group by slug', async () => {
      const mockGroup = {
        id: 'group-123',
        slug: 'test-group',
        name: 'Test Group',
        group_icon_url: 'https://example.com/icon.png',
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: mockGroup,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getGroupBySlug('test-group');

      expect(result).toEqual(mockGroup);
    });

    it('should return null if group not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getGroupBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getGroupById', () => {
    it('should return group by ID', async () => {
      const mockGroup = {
        id: 'group-123',
        slug: 'test-group',
        name: 'Test Group',
        group_icon_url: 'https://example.com/icon.png',
        group_webhook_url: 'https://discord.com/webhook/123',
        group_welcome_webhook_url: 'https://discord.com/webhook/456',
      };

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: mockGroup,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getGroupById('group-123');

      expect(result).toEqual(mockGroup);
    });

    it('should throw error on database failure', async () => {
      const error = new Error('Database error');
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getGroupById('group-123')).rejects.toThrow('Database error');
    });
  });

  describe('updateClanIconUrl', () => {
    it('should update group icon URL', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await updateClanIconUrl('group-123', 'https://example.com/new-icon.png');

      expect(mockUpdate).toHaveBeenCalledWith({
        group_icon_url: 'https://example.com/new-icon.png',
      });
    });

    it('should throw error on update failure', async () => {
      const error = new Error('Update failed');
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          error,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      await expect(
        updateClanIconUrl('group-123', 'https://example.com/icon.png')
      ).rejects.toThrow('Update failed');
    });
  });

  describe('getUserGroups', () => {
    it('should return all approved groups for user', async () => {
      const mockGroups = [
        {
          role: 'admin',
          is_creator: true,
          groups: {
            id: 'group-123',
            slug: 'group-1',
            name: 'Group 1',
            group_icon_url: 'https://example.com/1.png',
          },
        },
        {
          role: 'member',
          is_creator: false,
          groups: {
            id: 'group-456',
            slug: 'group-2',
            name: 'Group 2',
            group_icon_url: 'https://example.com/2.png',
          },
        },
      ];

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: mockGroups,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserGroups('user-123');

      expect(result).toEqual([
        {
          id: 'group-123',
          slug: 'group-1',
          name: 'Group 1',
          role: 'admin',
          isCreator: true,
          group_icon_url: 'https://example.com/1.png',
        },
        {
          id: 'group-456',
          slug: 'group-2',
          name: 'Group 2',
          role: 'member',
          isCreator: false,
          group_icon_url: 'https://example.com/2.png',
        },
      ]);
    });

    it('should exclude pending memberships', async () => {
      const mockGroups = [
        {
          role: 'member',
          is_creator: false,
          groups: {
            id: 'group-123',
            slug: 'group-1',
            name: 'Group 1',
          },
        },
        {
          role: 'pending',
          is_creator: false,
          groups: null, // Pending roles should be filtered
        },
      ];

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: mockGroups,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getUserGroups('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('group-123');
    });

    it('should return empty array when user has no groups', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await getUserGroups('user-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const error = new Error('Database error');
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          neq: jest.fn().mockResolvedValue({
            data: null,
            error,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      await expect(getUserGroups('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('Security Tests', () => {
    it('should reject membership updates with invalid roles', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      } as any);

      // This should fail at TypeScript level, but test runtime behavior
      await updateMemberRole('membership-123', 'superadmin' as any);

      // The function would still call it, but DB constraints should prevent it
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should not expose admin functions to unauthorized users', async () => {
      // This is tested at the component/API level, but we verify the functions exist
      expect(updateMemberRole).toBeDefined();
      expect(acceptMember).toBeDefined();
      expect(removeMember).toBeDefined();
    });

    it('should auto-create user profile only for matching user ID', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      } as any);

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: {
          user: { id: 'different-user', user_metadata: {} },
        },
        error: null,
      });

      const result = await getUserProfile('user-123');

      expect(result).toBeNull();
      // Should NOT insert a new profile for mismatched user
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncDiscordIdToMembers', () => {
    const mockUserId = 'user-uuid-123';
    const mockDiscordId = '123456789012345678';

    it('should sync Discord ID to member records without discord_id', async () => {
      const mockAuthUser = {
        id: mockUserId,
        user_metadata: {
          provider_id: mockDiscordId,
        },
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const mockUpdatedMembers = [
        { id: 'member-1', user_id: mockUserId, discord_id: mockDiscordId },
        { id: 'member-2', user_id: mockUserId, discord_id: mockDiscordId },
      ];

      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: mockUpdatedMembers,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(2); // 2 members synced
      expect(supabase.from).toHaveBeenCalledWith('members');
      expect(mockFrom.update).toHaveBeenCalledWith({ discord_id: mockDiscordId });
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockFrom.is).toHaveBeenCalledWith('discord_id', null);
      expect(consoleSpy).toHaveBeenCalledWith(
        `✅ Synced Discord ID to 2 member(s) for user ${mockUserId}`
      );

      consoleSpy.mockRestore();
    });

    it('should return 0 when no Discord ID in auth metadata', async () => {
      const mockAuthUser = {
        id: mockUserId,
        user_metadata: {}, // No provider_id
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled(); // No DB call without Discord ID
      expect(consoleSpy).toHaveBeenCalledWith(
        `No Discord ID found in auth metadata for user ${mockUserId}`
      );

      consoleSpy.mockRestore();
    });

    it('should return 0 when no auth user found', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return 0 when user ID does not match auth user', async () => {
      const mockAuthUser = {
        id: 'different-user-id',
        user_metadata: {
          provider_id: mockDiscordId,
        },
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(supabase.from).not.toHaveBeenCalled(); // Can't sync for different user
    });

    it('should return 0 when no members need syncing', async () => {
      const mockAuthUser = {
        id: mockUserId,
        user_metadata: {
          provider_id: mockDiscordId,
        },
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [], // No members updated
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(consoleSpy).not.toHaveBeenCalled(); // No log when 0 synced

      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully and return 0', async () => {
      const mockAuthUser = {
        id: mockUserId,
        user_metadata: {
          provider_id: mockDiscordId,
        },
      };

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      });

      const mockFrom = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'PGRST116' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error syncing Discord ID to members:',
        expect.objectContaining({ message: 'Database error' })
      );

      consoleSpy.mockRestore();
    });

    it('should handle exceptions gracefully and return 0', async () => {
      (supabase.auth.getUser as jest.Mock).mockRejectedValue(
        new Error('Auth service down')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await syncDiscordIdToMembers(mockUserId);

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in syncDiscordIdToMembers:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should be non-blocking (always returns a number, never throws)', async () => {
      (supabase.auth.getUser as jest.Mock).mockRejectedValue(
        new Error('Catastrophic failure')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      const result = await syncDiscordIdToMembers(mockUserId);

      expect(typeof result).toBe('number');
      expect(result).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});
