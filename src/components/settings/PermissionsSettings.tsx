'use client';

import { useState, useEffect } from 'react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { getClientAuthStack } from '@/lib/authStack';
import { 
  GroupRole, 
  PERMISSIONS, 
  ROLE_CONFIG, 
  getAllPermissionCategories,
  getPermissionsForCategory,
  DEFAULT_ROLE_PERMISSIONS,
  getRoleHierarchy
} from '@/lib/permissions';

interface PermissionsSettingsProps {
  groupId: string;
  userRole: GroupRole;
  onSave?: (rolePermissions: Record<GroupRole, Set<string>>) => Promise<void>;
}

export function PermissionsSettings({ groupId, userRole, onSave }: PermissionsSettingsProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const authStack = getClientAuthStack();
  const [selectedRole, setSelectedRole] = useState<GroupRole>('member');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(() => userRole === 'admin' && (authStack === 'v2' || !!session));
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Track custom permissions for each role
  const [customPermissions, setCustomPermissions] = useState<Record<GroupRole, Set<string>>>(() => {
    const perms: Record<GroupRole, Set<string>> = {
      admin: new Set(DEFAULT_ROLE_PERMISSIONS.admin),
      officer: new Set(DEFAULT_ROLE_PERMISSIONS.officer),
      member: new Set(DEFAULT_ROLE_PERMISSIONS.member),
      trial: new Set(DEFAULT_ROLE_PERMISSIONS.trial),
      pending: new Set(DEFAULT_ROLE_PERMISSIONS.pending),
    };
    return perms;
  });

  // Load permissions from database on mount (optional - will use defaults if not found)
  useEffect(() => {
    if (userRole !== 'admin') {
      return;
    }

    const loadPermissions = async () => {
      try {
        const headers: HeadersInit | undefined = authStack === 'v2'
          ? undefined
          : (session
              ? { 'Authorization': `Bearer ${session.access_token}` }
              : undefined);

        if (authStack !== 'v2' && !headers) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `/api/group/permissions?group_id=${groupId}`,
          {
            headers,
            credentials: 'include',
          }
        );

        if (!response.ok) {
          // If not found or error, just use defaults
          setIsLoading(false);
          return;
        }

        const { permissions } = await response.json();

        // If no custom permissions exist, use defaults
        if (!permissions || permissions.length === 0) {
          setIsLoading(false);
          return;
        }

        // Build Sets from boolean fields
        const loaded: Record<GroupRole, Set<string>> = {
          admin: new Set(),
          officer: new Set(),
          member: new Set(),
          trial: new Set(),
          pending: new Set(),
        };

        permissions.forEach((perm: any) => {
          const role = perm.role as GroupRole;
          const perms = new Set<string>();

          // Check each permission field
          Object.keys(perm).forEach(key => {
            if (key !== 'id' && key !== 'clan_id' && key !== 'role' && 
                key !== 'created_at' && key !== 'updated_at') {
              if (perm[key] === true) {
                perms.add(key);
              }
            }
          });

          loaded[role] = perms;
        });

        setCustomPermissions(loaded);
      } catch (error) {
        console.error('Error loading permissions:', error);
        // Silently fail and use defaults
      } finally {
        setIsLoading(false);
      }
    };

    const timerId = setTimeout(() => {
      void loadPermissions();
    }, 0);

    return () => clearTimeout(timerId);
  }, [session, groupId, userRole, authStack]);

  const hierarchy = getRoleHierarchy();
  const canEditRole = userRole === 'admin';

  // Get roles that current user can manage
  const manageableRoles = (Object.keys(ROLE_CONFIG) as GroupRole[])
    .filter(role => hierarchy[userRole] > hierarchy[role])
    .sort((a, b) => hierarchy[b] - hierarchy[a]);

  const togglePermission = (role: GroupRole, permissionId: string) => {
    if (!canEditRole || role === 'admin' || role === 'pending') return;

    setCustomPermissions(prev => {
      const updated = { ...prev };
      const rolePerms = new Set(updated[role]);
      
      if (rolePerms.has(permissionId)) {
        rolePerms.delete(permissionId);
      } else {
        rolePerms.add(permissionId);
      }
      
      updated[role] = rolePerms;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!canEditRole) return;
    
    setIsSaving(true);
    setMessage(null);
    
    try {
      // Convert Sets to objects for API
      const rolePermissions: Record<string, Record<string, boolean>> = {};
      
      Object.entries(customPermissions).forEach(([role, perms]) => {
        rolePermissions[role] = {};
        
        // Start with all permissions set to false
        Object.keys(PERMISSIONS).forEach(permId => {
          rolePermissions[role][permId] = perms.has(permId);
        });
      });

      const payload = {
        groupId,
        rolePermissions,
      };

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (authStack !== 'v2') {
        if (!session?.access_token) {
          throw new Error('Missing Supabase auth session');
        }
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/group/permissions', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error response:', errorData);
        throw new Error(errorData.error || `Failed to save permissions: ${response.statusText}`);
      }

      const result = await response.json();
      setMessage({ type: 'success', text: 'Permissions updated successfully!' });
      
      // Call optional callback if provided
      if (onSave) {
        await onSave(customPermissions);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save permissions' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCustomPermissions({
      admin: new Set(DEFAULT_ROLE_PERMISSIONS.admin),
      officer: new Set(DEFAULT_ROLE_PERMISSIONS.officer),
      member: new Set(DEFAULT_ROLE_PERMISSIONS.member),
      trial: new Set(DEFAULT_ROLE_PERMISSIONS.trial),
      pending: new Set(DEFAULT_ROLE_PERMISSIONS.pending),
    });
    setMessage(null);
  };

  const categories = getAllPermissionCategories().sort();
  const selectedRoleConfig = ROLE_CONFIG[selectedRole];
  const selectedRolePerms = customPermissions[selectedRole];

  if (isLoading) {
    // Show skeletons for the main permissioned UI
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-40 bg-slate-700/50 rounded mb-2 animate-pulse" />
            <div className="h-4 w-64 bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="h-8 w-32 bg-slate-700/50 rounded animate-pulse" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Only render permissioned UI after loading is complete
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Role Permissions</h3>
          <p className="text-sm text-slate-400 mt-1">
            {canEditRole 
              ? 'Customise what each role can do in your guild' 
              : 'You do not have permission to manage permissions'}
          </p>
        </div>
        {canEditRole && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            Reset to Default
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Role Selection */}
      <div className="flex gap-2 flex-wrap">
        {/* Show only manageable roles, with colored dot on left, invert selected style */}
        {(() => {
          // Map role to rarity bgColor
          const rarityBg: Record<string, string> = {
            admin: 'bg-amber-500/20', // legendary
            officer: 'bg-purple-500/20', // epic/heroic
            member: 'bg-blue-500/20', // rare
            trial: 'bg-green-500/20', // uncommon
            pending: 'bg-slate-500/20', // common
          };
          return manageableRoles.map((role) => {
            const roleConfig = ROLE_CONFIG[role];
            const selectedBg = rarityBg[role] || 'bg-slate-900';
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                disabled={!canEditRole}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border transition-all ${
                  selectedRole === role
                    ? `${selectedBg} text-white ${roleConfig.borderColor}`
                    : `bg-slate-900 text-slate-300 ${roleConfig.borderColor}`
                } ${!canEditRole ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                style={selectedRole === role ? { boxShadow: '0 0 0 2px rgba(0,0,0,0.2)' } : undefined}
              >
                <span className={roleConfig.color}>{String.fromCharCode(9679)}</span>
                <span className={selectedRole === role ? 'text-white' : roleConfig.color}>{roleConfig.label}</span>
              </button>
            );
          });
        })()}
        {/* Show Admin and Pending as immutable, as disabled buttons */}
        <button disabled className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-amber-400/20 text-amber-400 cursor-not-allowed opacity-50">
          <span className={ROLE_CONFIG.admin.color}>{String.fromCharCode(9679)}</span>
          {ROLE_CONFIG.admin.label}
          <span className="text-xs ml-1">(immutable)</span>
        </button>
        <button disabled className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-slate-700 text-slate-400 cursor-not-allowed opacity-50">
          <span className={ROLE_CONFIG.pending.color}>{String.fromCharCode(9679)}</span>
          {ROLE_CONFIG.pending.label}
          <span className="text-xs ml-1">(immutable)</span>
        </button>
      </div>

      {/* Permissions Grid */}
      {canEditRole && manageableRoles.includes(selectedRole) ? (
        <div className="space-y-4">
          {categories.map((category) => {
            const categoryPermissions = getPermissionsForCategory(category);
            return (
              <div key={category} className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-white capitalize">
                  {category.replace('_', ' ')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryPermissions.map((perm) => {
                    const isChecked = selectedRolePerms.has(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className="flex items-start gap-2 p-2 rounded hover:bg-slate-700/50 transition-colors cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(selectedRole, perm.id)}
                          disabled={selectedRole === 'admin' || selectedRole === 'pending'}
                          className="mt-1 w-4 h-4 rounded border-slate-600 accent-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                            {t(`permissions.${perm.id}.name`)}
                          </div>
                          <div className="text-xs text-slate-400">{t(`permissions.${perm.id}.description`)}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-lg p-8 text-center text-slate-400">
          <p>You cannot modify permissions for this role.</p>
          <p className="text-sm mt-1">Only admins can change role permissions.</p>
        </div>
      )}

      {/* Save Button */}
      {canEditRole && (
        <div className="flex gap-2 pt-4 border-t border-slate-700">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

