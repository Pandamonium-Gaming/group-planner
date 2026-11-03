import { NextResponse } from 'next/server';

export const ADMIN_ERROR_MESSAGES = {
  server_credentials: 'Server is missing its Supabase credentials',
  site_allowlist: 'SITE_ADMIN_DISCORD_IDS must be comma-separated Discord user IDs of 17–20 digits',
  site_identity: 'Unable to verify the signed-in Discord identity',
  site_role_config: 'Role mentions must be a JSON object of notification type to role ID; check ADMIN_DISCORD_ROLE_MENTIONS and the saved site configuration',
  site_config_load: 'Unable to read the site notification configuration; check that migrations 015–017 are applied',
  site_history_load: 'Unable to read the site notification history; check that migrations 015–017 are applied',
  site_save_webhook: 'Unable to save the site webhook',
  site_save_preferences: 'Unable to save the site notification preferences',
  group_access: 'Unable to verify group administrator access',
  group_config_load: 'Unable to read the group notification configuration; check that migrations 015–017 are applied',
  group_history_load: 'Unable to read the group notification history; check that migrations 015–017 are applied',
  group_save_webhook: 'Unable to save the group webhook',
  group_save_roles: 'Unable to save the group role mentions',
  group_save_preferences: 'Unable to save the group notification preferences',
  unauthorized: 'Sign in to continue',
  game_forbidden: 'Only a group administrator can delete a game',
  game_not_found: 'That game was not found for this group',
  game_not_archived: 'Archive the game before deleting its data',
  game_confirmation: 'The confirmation name does not match the game name',
  game_last: 'A group must keep at least one game',
  game_delete: 'Unable to delete the game data',
  unknown: 'Unexpected server error',
} as const;

export type AdminErrorCode = keyof typeof ADMIN_ERROR_MESSAGES;

export class AdminError extends Error {
  constructor(readonly code: AdminErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** Builds an AdminError, keeping only the database error's own code and message in the server log. */
export function adminDatabaseError(code: AdminErrorCode, error?: { code?: string; message?: string } | null) {
  return new AdminError(code, [error?.code, error?.message].filter(Boolean).join(' '));
}

/**
 * Logs the real cause server-side and returns a stable, secret-free `code` plus message.
 * Only fixed strings from ADMIN_ERROR_MESSAGES reach the client.
 */
export function adminFailure(error: unknown, fallback: AdminErrorCode, status = 500) {
  const code = error instanceof AdminError ? error.code : fallback;
  console.error(`[admin-discord] ${code}:`, error instanceof Error ? error.message : 'non-Error thrown');
  return NextResponse.json({ error: ADMIN_ERROR_MESSAGES[code], code }, { status });
}
