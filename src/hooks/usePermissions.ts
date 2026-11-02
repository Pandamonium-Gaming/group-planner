'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useGroupMembership } from './useGroupMembership';
import { supabase } from '@/lib/supabase';
import { getClientAuthStack } from '@/lib/authStack';
import { GroupRole, roleHasPermission, canManageRole, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

export interface RolePermissions {
  role: GroupRole;
  permissions: Set<string>;
}

export function usePermissions(groupId ?: string) {
  const { user } = useAuth();
  const { membership } = useGroupMembership(groupId || null, user?.id || null);
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean> | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<Set<string> | null>(null);
  const [resolvedRole, setResolvedRole] = useState<GroupRole | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Fetch custom permission overrides from the server
  useEffect(() => {
    if (!groupId || !user) {
      queueMicrotask(() => {
        setCustomPermissions(null);
        setEffectivePermissions(null);
        setResolvedRole(null);
      });
      return;
    }

    let isCancelled = false;

    const fetchPermissions = async () => {
      let didStartLoading = false;

      try {
        const authStack = getClientAuthStack();
        let headers: HeadersInit | undefined;

        if (authStack !== 'v2') {
          const sessionResponse = await supabase.auth.getSession();
          const session = sessionResponse?.data?.session ?? null;
          if (!session) return;
          headers = {
            'Authorization': `Bearer ${session.access_token}`,
          };
        }

        if (authStack === 'v2') {
          if (!isCancelled) {
            setLoading(true);
            didStartLoading = true;
          }

          const response = await fetch(`/api/groups/${encodeURIComponent(groupId!)}/permissions`, {
            credentials: 'include',
            cache: 'no-store',
          });

          if (response.ok) {
            const payload = await response.json() as {
              role?: GroupRole;
              permissions?: string[];
            };

            if (!isCancelled) {
              setResolvedRole(payload.role ?? null);
              setEffectivePermissions(new Set(payload.permissions ?? []));
              setCustomPermissions(null);
            }
          }
          return;
        }

        if (!membership?.role) {
          if (!isCancelled) {
            setCustomPermissions(null);
            setEffectivePermissions(null);
            setResolvedRole(null);
          }
          return;
        }

        // v1 path: include group_id as query parameter and apply role overrides client-side.
        if (!isCancelled) {
          setLoading(true);
          didStartLoading = true;
        }

        const response = await fetch(`/api/group/permissions?group_id=${encodeURIComponent(groupId!)}` , {
          headers,
          credentials: 'include',
        });

        if (response.ok) {
          const { permissions } = await response.json();
          const overrides = permissions?.find((o: any) => o.role === membership?.role);
          if (overrides) {
            const perms: Record<string, boolean> = {};
            Object.keys(overrides).forEach(key => {
              if (key !== 'id' && key !== 'clan_id' && key !== 'role' && key !== 'created_at' && key !== 'updated_at') {
                perms[key] = overrides[key];
              }
            });
            if (!isCancelled) {
              setCustomPermissions(perms);
              setEffectivePermissions(null);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      } finally {
        if (!isCancelled && didStartLoading) {
          setLoading(false);
        }
      }
    };

    void fetchPermissions();

    return () => {
      isCancelled = true;
    };
  }, [groupId, user, membership?.role]);
  
  // Check if current user has a specific permission
  // First checks custom overrides, then falls back to default role permissions
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;

    // v2 path: use authoritative effective permission snapshot from server.
    if (effectivePermissions !== null) {
      return effectivePermissions.has(permission);
    }

    if (!membership) return false;

    // v1 path: if custom role overrides are loaded, check those first.
    if (customPermissions !== null) {
      // Convert permission ID to database column name (convert underscores to match DB format)
      const dbColumnName = permission; // Already in correct format from PERMISSIONS object
      if (dbColumnName in customPermissions) {
        return customPermissions[dbColumnName];
      }
    }

    // Fall back to default role permissions
    const userRole = membership.role as GroupRole;
    return roleHasPermission(userRole, permission);
  }, [user, membership, customPermissions, effectivePermissions]);

  // Get current user's role
  const getUserRole = useCallback((): GroupRole => {
    return resolvedRole ?? (membership?.role as GroupRole) ?? 'pending';
  }, [membership, resolvedRole]);

  // Check if user can manage another role
  const canManage = useCallback((targetRole: GroupRole): boolean => {
    const userRole = getUserRole();
    return canManageRole(userRole, targetRole);
  }, [getUserRole]);

  // Check multiple permissions (all must be true)
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(perm => hasPermission(perm));
  }, [hasPermission]);

  // Check multiple permissions (any must be true)
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(perm => hasPermission(perm));
  }, [hasPermission]);

  // Check if user is admin
  const isAdmin = useCallback((): boolean => {
    return getUserRole() === 'admin';
  }, [getUserRole]);

  // Check if user is admin or officer
  const isLeadership = useCallback((): boolean => {
    const role = getUserRole();
    return role === 'admin' || role === 'officer';
  }, [getUserRole]);

  return {
    userRole: getUserRole(),
    hasPermission,
    canManage,
    hasAllPermissions,
    hasAnyPermission,
    isAdmin,
    isLeadership,
    rolePermissions: customPermissions,
    loading,
  };
}

