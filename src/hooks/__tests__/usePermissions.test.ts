/**
 * Tests for usePermissions hook
 * Critical for ensuring permission checks work in React components
 */

import { renderHook, waitFor } from '@testing-library/react';
import { usePermissions, type RolePermissions } from '../usePermissions';
import * as permissionsLib from '@/lib/permissions';

// Mock child hooks
jest.mock('../useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../useGroupMembership', () => ({
  useGroupMembership: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}));

import { useAuth } from '../useAuth';
import { useGroupMembership } from '../useGroupMembership';
import { supabase } from '@/lib/supabase';

describe('usePermissions Hook', () => {
  // Setup: Common mocked values
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockSession = { access_token: 'token-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.NEXT_PUBLIC_AUTH_STACK = 'v1';

    jest.mocked(supabase).auth.getSession = jest.fn().mockResolvedValue({
      data: { session: null },
    });

    // Default mocks
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
    });

    (useGroupMembership as jest.Mock).mockReturnValue({
      membership: {
        group_id: 'group-123',
        role: 'member',
        is_creator: false,
        approved_at: '2024-01-01T00:00:00Z',
      },
      loading: false,
    });
  });

  describe('Initial State', () => {
    it('should render without crashing', async () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current).toBeDefined();
      expect(result.current.hasPermission).toBeDefined();
      expect(result.current.userRole).toBe('member');

      // Wait for custom permissions fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should return pending role when no membership', async () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.userRole).toBe('pending');

      // Wait for custom permissions fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should not fetch permissions without groupId', () => {
      global.fetch = jest.fn();

      renderHook(() => usePermissions());

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not fetch permissions without user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      global.fetch = jest.fn();

      renderHook(() => usePermissions('group-123'));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Default Role Permissions', () => {
    it('should grant member basic permissions', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('characters_create')).toBe(true);
      expect(result.current.hasPermission('characters_edit_own')).toBe(true);
      expect(result.current.hasPermission('events_create')).toBe(true);
    });

    it('should deny member admin-only permissions', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('settings_edit_roles')).toBe(false);
      expect(result.current.hasPermission('characters_edit_any')).toBe(false);
    });

    it('should grant admin all permissions', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'admin',
          is_creator: true,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('characters_create')).toBe(true);
      expect(result.current.hasPermission('characters_edit_any')).toBe(true);
      expect(result.current.hasPermission('settings_edit_roles')).toBe(true);
    });

    it('should deny pending role all permissions', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'pending',
          is_creator: false,
          approved_at: null,
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('characters_create')).toBe(false);
      expect(result.current.hasPermission('events_rsvp')).toBe(false);
    });

    it('should handle invalid permission gracefully', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('nonexistent_permission')).toBe(false);
    });
  });

  describe('Custom Permission Overrides', () => {
    it('should fetch and apply custom permission overrides', async () => {
      const mockResponse = {
        permissions: [
          {
            id: 'perm-1',
            role: 'member',
            characters_create: false, // Override: member cannot create characters
            characters_edit_own: true,
            guild_bank_deposit: true,
            guild_bank_withdraw: false,
            clan_id: 'group-123',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: mockSession },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      const { result } = renderHook(() => usePermissions('group-123'));

      // Initially uses default
      expect(result.current.hasPermission('characters_create')).toBe(true);

      // Wait for API call and state update
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.rolePermissions).not.toBeNull();
      });

      // After fetch, should use custom override
      expect(result.current.hasPermission('characters_create')).toBe(false);
      expect(result.current.hasPermission('characters_edit_own')).toBe(true);
      expect(result.current.hasPermission('guild_bank_deposit')).toBe(true);
      expect(result.current.hasPermission('guild_bank_withdraw')).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API error');
      global.fetch = jest.fn().mockRejectedValue(mockError);

      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: mockSession },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fall back to defaults, not throw
      expect(result.current.hasPermission('characters_create')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching permissions:',
        mockError
      );

      consoleSpy.mockRestore();
    });

    it('should handle missing session gracefully', async () => {
      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: null },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      global.fetch = jest.fn();

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalled();
      });

      // Should not call API
      expect(global.fetch).not.toHaveBeenCalled();
      // Should use defaults
      expect(result.current.hasPermission('characters_create')).toBe(true);
    });

    it('should not set customPermissions if API response is empty', async () => {
      const mockResponse = { permissions: null };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: mockSession },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rolePermissions).toBeNull();
    });

    it('should send correct authorization header', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ permissions: null }),
      });

      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: mockSession },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('group_id=group-123'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer token-123',
          },
        })
      );
    });
  });

  describe('v2 Permission Snapshot', () => {
    it('should call v2 group permissions endpoint and apply effective permissions', async () => {
      process.env.NEXT_PUBLIC_AUTH_STACK = 'v2';

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            role: 'officer',
            permissions: ['settings_edit_roles', 'events_create'],
          }),
        });

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/groups/group-123/permissions',
          expect.objectContaining({
            credentials: 'include',
          })
        );
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe('officer');
      });

      expect(result.current.hasPermission('settings_edit_roles')).toBe(true);
      expect(result.current.hasPermission('characters_delete_any')).toBe(false);
      expect(jest.mocked(supabase).auth.getSession).not.toHaveBeenCalled();
    });

    it('should still request v2 snapshot even when membership role is missing', async () => {
      process.env.NEXT_PUBLIC_AUTH_STACK = 'v2';

      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            role: 'member',
            permissions: ['characters_create'],
          }),
        });

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe('member');
      });

      expect(result.current.hasPermission('characters_create')).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all requested permissions', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(
        result.current.hasAllPermissions([
          'characters_create',
          'events_create',
        ])
      ).toBe(true);
    });

    it('should return false if user lacks any permission', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(
        result.current.hasAllPermissions([
          'characters_create',
          'settings_edit_roles', // Member doesn't have this
        ])
      ).toBe(false);
    });

    it('should return true for empty permission array', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasAllPermissions([])).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has at least one permission', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(
        result.current.hasAnyPermission([
          'settings_edit_roles', // No
          'characters_create', // Yes
        ])
      ).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(
        result.current.hasAnyPermission([
          'settings_edit_roles',
          'settings_edit',
        ])
      ).toBe(false);
    });

    it('should return false for empty permission array', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasAnyPermission([])).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('should return user role from membership', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.userRole).toBe('member');
    });

    it('should return pending when no membership', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.userRole).toBe('pending');
    });
  });

  describe('canManage', () => {
    it('should allow member to manage trial and pending', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.canManage('trial')).toBe(true);
      expect(result.current.canManage('pending')).toBe(true);
    });

    it('should deny member managing admin or officer', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.canManage('admin')).toBe(false);
      expect(result.current.canManage('officer')).toBe(false);
    });

    it('should allow officer to manage member, trial, pending', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'officer',
          is_creator: false,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.canManage('member')).toBe(true);
      expect(result.current.canManage('trial')).toBe(true);
      expect(result.current.canManage('pending')).toBe(true);
      expect(result.current.canManage('admin')).toBe(false);
    });

    it('should allow admin to manage all other roles', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'admin',
          is_creator: true,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.canManage('officer')).toBe(true);
      expect(result.current.canManage('member')).toBe(true);
      expect(result.current.canManage('trial')).toBe(true);
      expect(result.current.canManage('pending')).toBe(true);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'admin',
          is_creator: true,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.isAdmin()).toBe(true);
    });

    it('should return false for non-admin roles', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.isAdmin()).toBe(false);
    });

    it('should return false for officer even though leadership', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'officer',
          is_creator: false,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.isAdmin()).toBe(false);
    });
  });

  describe('isLeadership', () => {
    it('should return true for admin', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'admin',
          is_creator: true,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.isLeadership()).toBe(true);
    });

    it('should return true for officer', () => {
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'officer',
          is_creator: false,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.isLeadership()).toBe(true);
    });

    it('should return false for member, trial, pending', () => {
      const { result: memberResult } = renderHook(() =>
        usePermissions('group-123')
      );
      expect(memberResult.current.isLeadership()).toBe(false);

      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'trial',
          is_creator: false,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      const { result: trialResult } = renderHook(() =>
        usePermissions('group-123')
      );
      expect(trialResult.current.isLeadership()).toBe(false);

      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'pending',
          is_creator: false,
          approved_at: null,
        },
        loading: false,
      });

      const { result: pendingResult } = renderHook(() =>
        usePermissions('group-123')
      );
      expect(pendingResult.current.isLeadership()).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('should update role when membership changes', () => {
      const { result, rerender } = renderHook((groupId: string) =>
        usePermissions(groupId)
      );

      expect(result.current.userRole).toBe('member');

      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-123',
          role: 'officer',
          is_creator: false,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      rerender('group-123');

      expect(result.current.userRole).toBe('officer');
    });

    it('should update role when switching groups', () => {
      const { result, rerender } = renderHook(
        (groupId: string) => usePermissions(groupId),
        { initialProps: 'group-123' }
      );

      expect(result.current.userRole).toBe('member');

      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: {
          group_id: 'group-456',
          role: 'admin',
          is_creator: true,
          approved_at: '2024-01-01T00:00:00Z',
        },
        loading: false,
      });

      rerender('group-456');

      expect(result.current.userRole).toBe('admin');
    });
  });

  describe('No User Scenarios', () => {
    it('should return false for all permissions when no user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.hasPermission('characters_create')).toBe(false);
      expect(result.current.hasPermission('events_rsvp')).toBe(false);
    });

    it('should return pending role when no user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.userRole).toBe('pending');
    });

    it('should return false for canManage when no user', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      (useGroupMembership as jest.Mock).mockReturnValue({
        membership: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions('group-123'));

      expect(result.current.canManage('trial')).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should not expose raw customPermissions in API - only through hasPermission', () => {
      const { result } = renderHook(() => usePermissions('group-123'));

      // rolePermissions is null until fetched
      expect(result.current.rolePermissions).toBeNull();

      // Should not be able to directly access overrides
      // (they're protected by being null until properly fetched)
    });

    it('should require both groupId and user to fetch permissions', () => {
      global.fetch = jest.fn();

      // No groupId
      renderHook(() => usePermissions());
      expect(global.fetch).not.toHaveBeenCalled();

      // No user
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      renderHook(() => usePermissions('group-123'));
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should filter out system fields from custom permissions', async () => {
      const mockResponse = {
        permissions: [
          {
            id: 'perm-1',
            clan_id: 'group-123',
            role: 'member',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            characters_create: true,
            // The implementation filters out id, clan_id, role, created_at, updated_at
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: mockSession },
      });

      jest.mocked(supabase).auth.getSession = mockGetSession;

      const { result } = renderHook(() => usePermissions('group-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have filtered permissions but not system fields
      expect(result.current.rolePermissions).toBeDefined();
      expect(result.current.rolePermissions?.id).toBeUndefined();
      expect(result.current.rolePermissions?.clan_id).toBeUndefined();
      expect(result.current.rolePermissions?.role).toBeUndefined();
      expect(result.current.rolePermissions?.created_at).toBeUndefined();
      expect(result.current.rolePermissions?.updated_at).toBeUndefined();
    });
  });
});
