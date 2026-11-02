// Permission system for the Group Planner
// Defines all available permissions and their configuration

export type GroupRole = 'admin' | 'officer' | 'member' | 'trial' | 'pending';

export type PermissionCategory = 'characters' | 'guild_bank' | 'events' | 'parties' | 'siege' | 'ships' | 'announcements' | 'recruitment' | 'settings';

export interface Permission {
  id: string;
  category: PermissionCategory;
  name: string;
  description: string;
}

// All available permissions
export const PERMISSIONS = {
  // Characters
  'characters_create': {
    id: 'characters_create',
    category: 'characters' as PermissionCategory,
    name: 'Create Character',
    description: 'Create a new character'
  },
  'characters_read_all': {
    id: 'characters_read_all',
    category: 'characters' as PermissionCategory,
    name: 'View All Characters',
    description: 'View all characters in the guild'
  },
  'characters_edit_own': {
    id: 'characters_edit_own',
    category: 'characters' as PermissionCategory,
    name: 'Edit Own Character',
    description: 'Edit your own characters'
  },
  'characters_edit_any': {
    id: 'characters_edit_any',
    category: 'characters' as PermissionCategory,
    name: 'Edit Any Character',
    description: 'Edit other members\' characters'
  },
  'characters_delete_own': {
    id: 'characters_delete_own',
    category: 'characters' as PermissionCategory,
    name: 'Delete Own Character',
    description: 'Delete your own characters'
  },
  'characters_delete_any': {
    id: 'characters_delete_any',
    category: 'characters' as PermissionCategory,
    name: 'Delete Any Character',
    description: 'Delete other members\' characters'
  },

  // Guild Bank
  'guild_bank_deposit': {
    id: 'guild_bank_deposit',
    category: 'guild_bank' as PermissionCategory,
    name: 'Deposit to Guild Bank',
    description: 'Deposit items to the guild bank'
  },
  'guild_bank_withdraw': {
    id: 'guild_bank_withdraw',
    category: 'guild_bank' as PermissionCategory,
    name: 'Withdraw from Guild Bank',
    description: 'Withdraw items from the guild bank'
  },
  'guild_bank_view_history': {
    id: 'guild_bank_view_history',
    category: 'guild_bank' as PermissionCategory,
    name: 'View Bank History',
    description: 'View bank transaction history'
  },
  'guild_bank_manage': {
    id: 'guild_bank_manage',
    category: 'guild_bank' as PermissionCategory,
    name: 'Manage Guild Bank',
    description: 'Full management of guild bank including settings'
  },

  // Events
  'events_create': {
    id: 'events_create',
    category: 'events' as PermissionCategory,
    name: 'Create Event',
    description: 'Create new events'
  },
  'events_read': {
    id: 'events_read',
    category: 'events' as PermissionCategory,
    name: 'View Events',
    description: 'View all events'
  },
  'events_edit_own': {
    id: 'events_edit_own',
    category: 'events' as PermissionCategory,
    name: 'Edit Own Event',
    description: 'Edit events you created'
  },
  'events_edit_any': {
    id: 'events_edit_any',
    category: 'events' as PermissionCategory,
    name: 'Edit Any Event',
    description: 'Edit other members\' events'
  },
  'events_delete_own': {
    id: 'events_delete_own',
    category: 'events' as PermissionCategory,
    name: 'Delete Own Event',
    description: 'Delete events you created'
  },
  'events_delete_any': {
    id: 'events_delete_any',
    category: 'events' as PermissionCategory,
    name: 'Delete Any Event',
    description: 'Delete other members\' events'
  },
  'events_rsvp': {
    id: 'events_rsvp',
    category: 'events' as PermissionCategory,
    name: 'RSVP to Events',
    description: 'Respond to event invitations'
  },

  // Parties
  'parties_create': {
    id: 'parties_create',
    category: 'parties' as PermissionCategory,
    name: 'Create Party',
    description: 'Create new parties'
  },
  'parties_read': {
    id: 'parties_read',
    category: 'parties' as PermissionCategory,
    name: 'View Parties',
    description: 'View all parties'
  },
  'parties_edit_own': {
    id: 'parties_edit_own',
    category: 'parties' as PermissionCategory,
    name: 'Edit Own Party',
    description: 'Edit parties you created'
  },
  'parties_edit_any': {
    id: 'parties_edit_any',
    category: 'parties' as PermissionCategory,
    name: 'Edit Any Party',
    description: 'Edit other members\' parties'
  },
  'parties_delete_own': {
    id: 'parties_delete_own',
    category: 'parties' as PermissionCategory,
    name: 'Delete Own Party',
    description: 'Delete parties you created'
  },
  'parties_delete_any': {
    id: 'parties_delete_any',
    category: 'parties' as PermissionCategory,
    name: 'Delete Any Party',
    description: 'Delete other members\' parties'
  },

  // Siege
  'siege_view_rosters': {
    id: 'siege_view_rosters',
    category: 'siege' as PermissionCategory,
    name: 'View Siege Rosters',
    description: 'View siege rosters'
  },
  'siege_edit_rosters': {
    id: 'siege_edit_rosters',
    category: 'siege' as PermissionCategory,
    name: 'Edit Siege Rosters',
    description: 'Edit siege rosters'
  },
  'siege_create_event': {
    id: 'siege_create_event',
    category: 'siege' as PermissionCategory,
    name: 'Create Siege Event',
    description: 'Create new siege events'
  },

  // Ships (Star Citizen)
  'ships_create': {
    id: 'ships_create',
    category: 'ships' as PermissionCategory,
    name: 'Add Ships',
    description: 'Add ships to characters'
  },
  'ships_edit_own': {
    id: 'ships_edit_own',
    category: 'ships' as PermissionCategory,
    name: 'Edit Own Ships',
    description: 'Edit ships on your own characters'
  },
  'ships_edit_any': {
    id: 'ships_edit_any',
    category: 'ships' as PermissionCategory,
    name: 'Edit Any Ships',
    description: 'Edit ships on any character'
  },
  'ships_delete_own': {
    id: 'ships_delete_own',
    category: 'ships' as PermissionCategory,
    name: 'Delete Own Ships',
    description: 'Delete ships from your own characters'
  },
  'ships_delete_any': {
    id: 'ships_delete_any',
    category: 'ships' as PermissionCategory,
    name: 'Delete Any Ships',
    description: 'Delete ships from any character'
  },

  // Announcements
  'announcements_create': {
    id: 'announcements_create',
    category: 'announcements' as PermissionCategory,
    name: 'Create Announcement',
    description: 'Create new announcements'
  },
  'announcements_edit': {
    id: 'announcements_edit',
    category: 'announcements' as PermissionCategory,
    name: 'Edit Announcement',
    description: 'Edit existing announcements'
  },
  'announcements_delete': {
    id: 'announcements_delete',
    category: 'announcements' as PermissionCategory,
    name: 'Delete Announcement',
    description: 'Delete announcements'
  },

  // Recruitment
  'recruitment_manage': {
    id: 'recruitment_manage',
    category: 'recruitment' as PermissionCategory,
    name: 'Manage Recruitment',
    description: 'Manage recruitment applications and messages'
  },

  // Settings
  'settings_edit': {
    id: 'settings_edit',
    category: 'settings' as PermissionCategory,
    name: 'Edit Guild Settings',
    description: 'Edit guild general settings'
  },
  'settings_edit_roles': {
    id: 'settings_edit_roles',
    category: 'settings' as PermissionCategory,
    name: 'Manage Roles',
    description: 'Change member roles'
  },
  'settings_view_permissions': {
    id: 'settings_view_permissions',
    category: 'settings' as PermissionCategory,
    name: 'View Permissions',
    description: 'View the guild\'s permission structure'
  },
} as const;

// Get all permissions for a category
export function getPermissionsForCategory(category: PermissionCategory): Permission[] {
  return Object.values(PERMISSIONS).filter(p => p.category === category);
}

// Get all permission categories
export function getAllPermissionCategories(): PermissionCategory[] {
  const categories = new Set<PermissionCategory>();
  Object.values(PERMISSIONS).forEach(p => categories.add(p.category));
  return Array.from(categories);
}

// Default permissions for each role
// Admin gets all permissions, Officer gets most, Member gets basic, Trial gets very limited
export const DEFAULT_ROLE_PERMISSIONS: Record<GroupRole, Set<string>> = {
  admin: new Set([
    // All permissions for admins
    ...Object.keys(PERMISSIONS),
  ]),
  
  officer: new Set([
    // Characters
    'characters_create',
    'characters_edit_any',
    'characters_delete_any',
    // Guild Bank
    'guild_bank_deposit',
    'guild_bank_withdraw',
    'guild_bank_manage',
    // Events
    'events_create',
    'events_edit_any',
    'events_delete_any',
    // Parties
    'parties_create',
    'parties_edit_any',
    'parties_delete_any',
    // Siege
    'siege_create_event',
    'siege_edit_rosters',
    // Announcements
    'announcements_create',
    'announcements_edit',
    'announcements_delete',
    // Recruitment
    'recruitment_manage',
    // Settings
    'settings_edit_roles',
  ]),
  
  member: new Set([
    // Characters
    'characters_create',
    'characters_edit_own',
    'characters_delete_own',
    // Guild Bank
    'guild_bank_deposit',
    'guild_bank_withdraw',
    // Events
    'events_create',
    'events_edit_own',
    'events_delete_own',
    // Parties
    'parties_create',
    'parties_edit_own',
    'parties_delete_own',
    // Siege
    'siege_create_event',
    'siege_edit_rosters',
    // Ships
    'ships_create',
    'ships_edit_own',
    'ships_delete_own',
    // Announcements
    'announcements_create',
  ]),
  
  trial: new Set([
    // Characters
    'characters_create',
    // Ships
    'ships_create',
    'ships_edit_own',
    'ships_delete_own',
    // Events
    // Can RSVP but not create
    // Guild Bank - read only
  ]),
  
  pending: new Set([
    // No permissions until approved
  ]),
};

// Check if a role has a permission
export function roleHasPermission(role: GroupRole, permission: string): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

// Get all permissions for a role
export function getRolePermissions(role: GroupRole): Permission[] {
  const permIds = DEFAULT_ROLE_PERMISSIONS[role] ?? new Set();
  return Object.values(PERMISSIONS).filter(p => permIds.has(p.id));
}

// Role hierarchy: admin > officer > member > trial > pending
export function getRoleHierarchy(): Record<GroupRole, number> {
  return {
    admin: 5,
    officer: 4,
    member: 3,
    trial: 2,
    pending: 1,
  };
}

export function canManageRole(userRole: GroupRole, targetRole: GroupRole): boolean {
  const hierarchy = getRoleHierarchy();
  return hierarchy[userRole] > hierarchy[targetRole];
}

// Role display configuration
export const ROLE_CONFIG: Record<GroupRole, { label: string; color: string; borderColor: string; description: string }> = {
  admin: {
    label: 'Admin',
    color: 'text-orange-400', // legendary
    borderColor: 'border-orange-400',
    description: 'Full permissions to manage clan',
  },
  officer: {
    label: 'Officer',
    color: 'text-purple-400', // epic (was orange, now purple)
    borderColor: 'border-purple-400',
    description: 'Can manage members and events',
  },
  member: {
    label: 'Member',
    color: 'text-blue-400', // rare
    borderColor: 'border-blue-400',
    description: 'Can create events and manage own content',
  },
  trial: {
    label: 'Trial',
    color: 'text-green-400', // uncommon
    borderColor: 'border-green-400',
    description: 'Limited access while being evaluated',
  },
  pending: {
    label: 'Pending',
    color: 'text-slate-400', // common (white/gray)
    borderColor: 'border-slate-400',
    description: 'Application awaiting approval',
  }
};

