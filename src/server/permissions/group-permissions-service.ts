export type GroupRole = 'admin' | 'officer' | 'member' | 'trial' | 'pending' | null;

export interface GroupPermissionsSnapshot {
  groupId: string;
  userId: string;
  role: GroupRole;
  permissions: string[];
}

import { createClient } from '@supabase/supabase-js';
import { DEFAULT_ROLE_PERMISSIONS, getRoleHierarchy, PERMISSIONS } from '@/lib/permissions';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

type MembershipRow = {
  role: Exclude<GroupRole, null>;
  user_id: string;
};

function chooseHighestRoleMembership(rows: MembershipRow[]): MembershipRow | null {
  if (rows.length === 0) {
    return null;
  }

  const hierarchy = getRoleHierarchy();
  return [...rows].sort((a, b) => hierarchy[b.role] - hierarchy[a.role])[0];
}

function applyOverrides(
  role: Exclude<GroupRole, null>,
  overrides: Record<string, unknown> | null
): string[] {
  const effective = new Set(DEFAULT_ROLE_PERMISSIONS[role] ?? []);
  if (!overrides) {
    return Array.from(effective).sort();
  }

  Object.keys(PERMISSIONS).forEach((permissionId) => {
    const value = overrides[permissionId];
    if (typeof value !== 'boolean') {
      return;
    }

    if (value) {
      effective.add(permissionId);
    } else {
      effective.delete(permissionId);
    }
  });

  return Array.from(effective).sort();
}

export async function getGroupPermissionsSnapshot(
  groupId: string,
  userIds: string[]
): Promise<GroupPermissionsSnapshot | null> {
  if (!groupId || userIds.length === 0) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Server missing Supabase service credentials');
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('group_members')
    .select('role, user_id')
    .eq('group_id', groupId)
    .in('user_id', userIds);

  if (membershipError) {
    throw new Error(`Failed to resolve group membership: ${membershipError.message}`);
  }

  const validMemberships = (memberships || [])
    .filter((row): row is MembershipRow => {
      const role = row?.role as GroupRole;
      return role === 'admin' || role === 'officer' || role === 'member' || role === 'trial' || role === 'pending';
    });

  const selectedMembership = chooseHighestRoleMembership(validMemberships);
  if (!selectedMembership) {
    return null;
  }

  const role = selectedMembership.role;

  const { data: overridesRow, error: overridesError } = await supabaseAdmin
    .from('group_permission_overrides')
    .select('*')
    .eq('group_id', groupId)
    .eq('role', role)
    .maybeSingle();

  // Missing overrides table is allowed during staged rollout; fall back to defaults.
  const overridesMissingRelation =
    overridesError?.message?.includes('relation') ||
    overridesError?.message?.includes('Could not find the table');
  if (overridesError && !overridesMissingRelation) {
    throw new Error(`Failed to resolve permission overrides: ${overridesError.message}`);
  }

  const permissions = applyOverrides(role, overridesMissingRelation ? null : (overridesRow as Record<string, unknown> | null));

  return {
    groupId,
    userId: selectedMembership.user_id,
    role,
    permissions,
  };
}
