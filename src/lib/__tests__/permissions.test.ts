/**
 * Tests for the permission system
 * This is critical security logic that must be thoroughly tested
 */

import {
  type GroupRole,
  type PermissionCategory,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getPermissionsForCategory,
  getAllPermissionCategories,
  roleHasPermission,
  getRolePermissions,
  getRoleHierarchy,
  canManageRole,
  ROLE_CONFIG,
} from '../permissions';
import enGB from '../../../public/locales/en-GB.json';
import es from '../../../public/locales/es.json';
import nl from '../../../public/locales/nl.json';

describe('Permission System', () => {
  it.each([['en-GB', enGB], ['es', es], ['nl', nl]] as const)(
    'has a translated name and description for every permission in %s',
    (_language, translations) => {
      const labels: Record<string, string | { name: string; description: string }> = translations.permissions;
      for (const permission of Object.values(PERMISSIONS)) {
        const label = labels[permission.id];
        expect(label).toBeDefined();
        expect(typeof label).toBe('object');
        if (typeof label !== 'object' || label === null) {
          throw new Error(`Missing permission labels for ${permission.id}`);
        }
        expect(label.name).toEqual(expect.stringMatching(/\S/));
        expect(label.description).toEqual(expect.stringMatching(/\S/));
      }
    }
  );

  describe('PERMISSIONS constant', () => {
    it('should have all permissions defined with required fields', () => {
      const permissionKeys = Object.keys(PERMISSIONS);
      expect(permissionKeys.length).toBeGreaterThan(0);

      permissionKeys.forEach((key) => {
        const permission = PERMISSIONS[key as keyof typeof PERMISSIONS];
        expect(permission).toHaveProperty('id');
        expect(permission).toHaveProperty('category');
        expect(permission).toHaveProperty('name');
        expect(permission).toHaveProperty('description');
        expect(permission.id).toBe(key); // ID should match the key
      });
    });

    it('should have valid permission IDs without spaces', () => {
      Object.keys(PERMISSIONS).forEach((key) => {
        expect(key).toMatch(/^[a-z_]+$/); // Only lowercase letters and underscores
      });
    });
  });

  describe('getPermissionsForCategory', () => {
    it('should return all permissions for a given category', () => {
      const characterPerms = getPermissionsForCategory('characters');
      expect(characterPerms.length).toBeGreaterThan(0);
      characterPerms.forEach((perm) => {
        expect(perm.category).toBe('characters');
      });
    });

    it('should return empty array for non-existent category', () => {
      const result = getPermissionsForCategory('nonexistent' as PermissionCategory);
      expect(result).toEqual([]);
    });

    it('should group permissions correctly by category', () => {
      const categories: PermissionCategory[] = ['characters', 'guild_bank', 'events', 'settings'];
      
      categories.forEach((category) => {
        const perms = getPermissionsForCategory(category);
        perms.forEach((perm) => {
          expect(perm.category).toBe(category);
        });
      });
    });
  });

  describe('getAllPermissionCategories', () => {
    it('should return all unique categories', () => {
      const categories = getAllPermissionCategories();
      expect(categories.length).toBeGreaterThan(0);
      
      // Check for duplicates
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(categories.length);
    });

    it('should include expected core categories', () => {
      const categories = getAllPermissionCategories();
      expect(categories).toContain('characters');
      expect(categories).toContain('events');
      expect(categories).toContain('settings');
    });
  });

  describe('Role Hierarchy', () => {
    it('should have correct hierarchy order', () => {
      const hierarchy = getRoleHierarchy();
      
      expect(hierarchy.admin).toBeGreaterThan(hierarchy.officer);
      expect(hierarchy.officer).toBeGreaterThan(hierarchy.member);
      expect(hierarchy.member).toBeGreaterThan(hierarchy.trial);
      expect(hierarchy.trial).toBeGreaterThan(hierarchy.pending);
    });

    it('should define hierarchy for all roles', () => {
      const hierarchy = getRoleHierarchy();
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];
      
      roles.forEach((role) => {
        expect(hierarchy[role]).toBeDefined();
        expect(typeof hierarchy[role]).toBe('number');
      });
    });
  });

  describe('canManageRole', () => {
    it('should allow admin to manage all other roles', () => {
      const otherRoles: GroupRole[] = ['officer', 'member', 'trial', 'pending'];
      otherRoles.forEach((role) => {
        expect(canManageRole('admin', role)).toBe(true);
      });
    });

    it('should NOT allow admin to manage admin', () => {
      expect(canManageRole('admin', 'admin')).toBe(false);
    });

    it('should allow officer to manage member, trial, and pending', () => {
      expect(canManageRole('officer', 'member')).toBe(true);
      expect(canManageRole('officer', 'trial')).toBe(true);
      expect(canManageRole('officer', 'pending')).toBe(true);
    });

    it('should NOT allow officer to manage admin or officer', () => {
      expect(canManageRole('officer', 'admin')).toBe(false);
      expect(canManageRole('officer', 'officer')).toBe(false);
    });

    it('should allow member to manage lower roles only', () => {
      // Members CAN manage trial and pending (lower in hierarchy)
      expect(canManageRole('member', 'trial')).toBe(true);
      expect(canManageRole('member', 'pending')).toBe(true);
      
      // But NOT admin, officer, or other members
      expect(canManageRole('member', 'admin')).toBe(false);
      expect(canManageRole('member', 'officer')).toBe(false);
      expect(canManageRole('member', 'member')).toBe(false);
    });

    it('should allow trial to manage pending only', () => {
      // Trial CAN manage pending (lower in hierarchy)
      expect(canManageRole('trial', 'pending')).toBe(true);
      
      // But NOT anyone else
      expect(canManageRole('trial', 'admin')).toBe(false);
      expect(canManageRole('trial', 'officer')).toBe(false);
      expect(canManageRole('trial', 'member')).toBe(false);
      expect(canManageRole('trial', 'trial')).toBe(false);
      
      // Pending can't manage anyone
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];
      roles.forEach((role) => {
        expect(canManageRole('pending', role)).toBe(false);
      });
    });
  });

  describe('roleHasPermission', () => {
    it('should grant admin ALL permissions', () => {
      const allPermissionIds = Object.keys(PERMISSIONS);
      allPermissionIds.forEach((permId) => {
        expect(roleHasPermission('admin', permId)).toBe(true);
      });
    });

    it('should grant pending NO permissions', () => {
      const allPermissionIds = Object.keys(PERMISSIONS);
      allPermissionIds.forEach((permId) => {
        expect(roleHasPermission('pending', permId)).toBe(false);
      });
    });

    it('should allow members to create their own characters', () => {
      expect(roleHasPermission('member', 'characters_create')).toBe(true);
      expect(roleHasPermission('member', 'characters_edit_own')).toBe(true);
    });

    it('should NOT allow members to edit other characters', () => {
      expect(roleHasPermission('member', 'characters_edit_any')).toBe(false);
      expect(roleHasPermission('member', 'characters_delete_any')).toBe(false);
    });

    it('should allow officers to edit any character', () => {
      expect(roleHasPermission('officer', 'characters_edit_any')).toBe(true);
      expect(roleHasPermission('officer', 'characters_delete_any')).toBe(true);
    });

    it('should NOT allow trial members to edit settings', () => {
      expect(roleHasPermission('trial', 'settings_edit')).toBe(false);
      expect(roleHasPermission('trial', 'settings_edit_roles')).toBe(false);
    });

    it('should return false for invalid permission names', () => {
      expect(roleHasPermission('admin', 'nonexistent_permission')).toBe(false);
      expect(roleHasPermission('member', 'invalid_perm')).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return Permission objects for a role', () => {
      const memberPerms = getRolePermissions('member');
      expect(memberPerms.length).toBeGreaterThan(0);
      
      memberPerms.forEach((perm) => {
        expect(perm).toHaveProperty('id');
        expect(perm).toHaveProperty('name');
        expect(perm).toHaveProperty('description');
        expect(perm).toHaveProperty('category');
      });
    });

    it('should return all permissions for admin', () => {
      const adminPerms = getRolePermissions('admin');
      const allPerms = Object.keys(PERMISSIONS);
      expect(adminPerms.length).toBe(allPerms.length);
    });

    it('should return empty array for pending role', () => {
      const pendingPerms = getRolePermissions('pending');
      expect(pendingPerms).toEqual([]);
    });

    it('should return progressively fewer permissions down the hierarchy', () => {
      const adminPerms = getRolePermissions('admin');
      const officerPerms = getRolePermissions('officer');
      const memberPerms = getRolePermissions('member');
      const trialPerms = getRolePermissions('trial');

      expect(adminPerms.length).toBeGreaterThan(officerPerms.length);
      expect(officerPerms.length).toBeGreaterThan(memberPerms.length);
      expect(memberPerms.length).toBeGreaterThan(trialPerms.length);
    });
  });

  describe('DEFAULT_ROLE_PERMISSIONS', () => {
    it('should have permissions for all roles', () => {
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];
      roles.forEach((role) => {
        expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
        expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
      });
    });

    it('should have valid permission IDs in each role', () => {
      const allPermIds = Object.keys(PERMISSIONS);
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];

      roles.forEach((role) => {
        const perms = DEFAULT_ROLE_PERMISSIONS[role];
        perms.forEach((permId) => {
          expect(allPermIds).toContain(permId);
        });
      });
    });

    it('should ensure higher roles include permissions from lower roles for core actions', () => {
      // Officers should be able to do everything members can do with "any" permissions
      const memberCreate = DEFAULT_ROLE_PERMISSIONS.member.has('characters_create');
      const officerCreate = DEFAULT_ROLE_PERMISSIONS.officer.has('characters_create');
      
      // If member can create, officer should also be able to
      if (memberCreate) {
        expect(officerCreate || DEFAULT_ROLE_PERMISSIONS.officer.has('characters_edit_any')).toBe(true);
      }
    });
  });

  describe('ROLE_CONFIG', () => {
    it('should have configuration for all roles', () => {
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];
      roles.forEach((role) => {
        expect(ROLE_CONFIG[role]).toBeDefined();
        expect(ROLE_CONFIG[role]).toHaveProperty('label');
        expect(ROLE_CONFIG[role]).toHaveProperty('color');
        expect(ROLE_CONFIG[role]).toHaveProperty('borderColor');
        expect(ROLE_CONFIG[role]).toHaveProperty('description');
      });
    });

    it('should have valid Tailwind CSS class names', () => {
      const roles: GroupRole[] = ['admin', 'officer', 'member', 'trial', 'pending'];
      roles.forEach((role) => {
        expect(ROLE_CONFIG[role].color).toMatch(/^text-/);
        expect(ROLE_CONFIG[role].borderColor).toMatch(/^border-/);
      });
    });

    it('should have unique colors for each role', () => {
      const colors = Object.values(ROLE_CONFIG).map((config) => config.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('Permission Security Tests', () => {
    it('should NOT allow trial members to manage group bank', () => {
      expect(roleHasPermission('trial', 'guild_bank_withdraw')).toBe(false);
      expect(roleHasPermission('trial', 'guild_bank_deposit')).toBe(false);
    });

    it('should NOT allow members to edit permissions', () => {
      expect(roleHasPermission('member', 'settings_view_permissions')).toBe(false);
    });

    it('should require officer or higher for role management', () => {
      expect(roleHasPermission('member', 'settings_edit_roles')).toBe(false);
      expect(roleHasPermission('trial', 'settings_edit_roles')).toBe(false);
      expect(roleHasPermission('officer', 'settings_edit_roles')).toBe(true);
      expect(roleHasPermission('admin', 'settings_edit_roles')).toBe(true);
    });

    it('should protect sensitive permissions from unauthorized roles', () => {
      const sensitivePermissions = [
        'characters_delete_any',
        'events_delete_any',
        'settings_edit_roles',
      ];

      sensitivePermissions.forEach((perm) => {
        expect(roleHasPermission('member', perm)).toBe(false);
        expect(roleHasPermission('trial', perm)).toBe(false);
        expect(roleHasPermission('pending', perm)).toBe(false);
      });
    });
  });
});





