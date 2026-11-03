import { NextResponse } from 'next/server';

/**
 * Migration 023's require_enabled_game trigger raises GAME_NOT_ENABLED when a member, event or recruitment
 * application is inserted for a game the group no longer has enabled (for example, a form left open while the
 * game was permanently deleted).
 */
export function isGameNotEnabledError(error: { message?: string | null } | null | undefined) {
  return error?.message?.trim() === 'GAME_NOT_ENABLED';
}

export function gameNotEnabledResponse() {
  return NextResponse.json(
    { error: 'This game is no longer enabled for the group', code: 'game_not_enabled' },
    { status: 409 },
  );
}
