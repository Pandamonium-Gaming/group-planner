export const ADMIN_NOTIFICATION_KINDS = [
  'account_registered', 'group_created', 'group_deleted', 'member_joined',
  'member_left_or_removed', 'member_requested', 'member_request_closed',
  'role_changed', 'permissions_changed', 'webhook_changed',
] as const;

export type AdminNotificationKind = typeof ADMIN_NOTIFICATION_KINDS[number];
export type AdminRoleMentions = Partial<Record<AdminNotificationKind, string>>;
export type AdminCategorySettings = Partial<Record<AdminNotificationKind, boolean>>;
export const SITE_NOTIFICATION_KINDS = ['account_registered', 'group_created', 'group_deleted'] as const;

export function isAdminCategorySettings(value: unknown): value is AdminCategorySettings {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, enabled]) =>
      ADMIN_NOTIFICATION_KINDS.some(kind => kind === key) && typeof enabled === 'boolean');
}

export function isDiscordRoleId(value: string) {
  return /^[0-9]{17,20}$/.test(value);
}

export function isAdminRoleMentions(value: unknown): value is AdminRoleMentions {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, role]) =>
      ADMIN_NOTIFICATION_KINDS.some(kind => kind === key) && typeof role === 'string' && isDiscordRoleId(role));
}
