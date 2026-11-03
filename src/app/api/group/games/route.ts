import { NextRequest, NextResponse } from 'next/server';
import { GAMES, type GameId } from '@/lib/games';
import { webhookSession } from '@/server/discord';
import { AdminError, adminDatabaseError, adminFailure, type AdminErrorCode } from '@/server/admin-errors';

type GroupMembershipRole = 'admin' | 'officer' | 'member' | 'trial' | 'pending' | null;

/**
 * Resolves the signed-in user on either auth stack (v2 session cookie, or the
 * v1 Supabase bearer token verified server-side) and their role in the group.
 */
async function getAuthorizedMembership(request: NextRequest, groupId: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 }),
      role: null as GroupMembershipRole,
    };
  }

  const { client: supabaseAdmin, userId } = await webhookSession(request);

  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), role: null as GroupMembershipRole };
  }

  const { data: membership, error } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: 'Failed to verify membership' }, { status: 500 }), role: null as GroupMembershipRole };
  }

  if (!membership || membership.role === 'pending') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), role: null as GroupMembershipRole };
  }

  return { error: null, role: membership.role as GroupMembershipRole, supabaseAdmin, userId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const { error, supabaseAdmin } = await getAuthorizedMembership(request, groupId);
  if (error || !supabaseAdmin) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from('group_games')
    .select('game_slug, archived')
    .eq('group_id', groupId)
    .order('created_at');

  if (queryError) {
    return NextResponse.json({ error: 'Failed to load games', details: queryError.message }, { status: 500 });
  }

  return NextResponse.json({ games: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const groupId = body?.groupId as string | undefined;
  const gameSlug = body?.gameSlug as string | undefined;

  if (!groupId || !gameSlug) {
    return NextResponse.json({ error: 'Missing groupId or gameSlug' }, { status: 400 });
  }

  const { error, role, supabaseAdmin } = await getAuthorizedMembership(request, groupId);
  if (error || !supabaseAdmin) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: insertError } = await supabaseAdmin
    .from('group_games')
    .upsert({ group_id: groupId, game_slug: gameSlug, archived: false }, { onConflict: 'group_id,game_slug' });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to add game', details: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

const GAME_DELETE_ERRORS = new Map<string, { code: AdminErrorCode; status: number }>(Object.entries({
  NOT_ADMIN: { code: 'game_forbidden', status: 403 },
  GAME_NOT_FOUND: { code: 'game_not_found', status: 404 },
  GAME_NOT_ARCHIVED: { code: 'game_not_archived', status: 409 },
  CONFIRMATION_MISMATCH: { code: 'game_confirmation', status: 400 },
  LAST_GAME: { code: 'game_last', status: 409 },
} as Record<string, { code: AdminErrorCode; status: number }>));

/** Adds a stable `code` to the shared helper's bare error responses (DELETE only; GET/POST bodies unchanged). */
function withErrorCode(response: NextResponse) {
  const status = response.status;
  const code: AdminErrorCode = status === 401 ? 'unauthorized' : status === 403 ? 'game_forbidden' : 'game_delete';
  return adminFailure(new AdminError(code, `membership check returned ${status}`), code, status);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const groupId = body?.groupId;
  const gameSlug = body?.gameSlug;
  const confirmName = body?.confirmName;

  if (typeof groupId !== 'string' || !groupId || typeof gameSlug !== 'string' || !gameSlug || typeof confirmName !== 'string' || !confirmName) {
    return NextResponse.json({ error: 'Missing groupId, gameSlug or confirmName', code: 'bad_request' }, { status: 400 });
  }

  const { error, role, supabaseAdmin, userId } = await getAuthorizedMembership(request, groupId);
  if (error || !supabaseAdmin) {
    return (error ? withErrorCode(error) : null) ?? adminFailure(new AdminError('unauthorized'), 'unauthorized', 401);
  }

  if (role !== 'admin') {
    return adminFailure(new AdminError('game_forbidden'), 'game_forbidden', 403);
  }

  if (!Object.hasOwn(GAMES, gameSlug)) {
    return adminFailure(new AdminError('game_not_found', 'slug not in registry'), 'game_not_found', 404);
  }

  const { error: rpcError } = await supabaseAdmin.rpc('delete_group_game', {
    p_group_id: groupId,
    p_game_slug: gameSlug,
    p_confirm_name: confirmName,
    p_expected_name: GAMES[gameSlug as GameId].name,
    p_actor_id: userId,
  });

  if (rpcError) {
    const mapped = GAME_DELETE_ERRORS.get(rpcError.message?.trim());
    return adminFailure(
      adminDatabaseError(mapped?.code ?? 'game_delete', rpcError),
      mapped?.code ?? 'game_delete',
      mapped?.status ?? 500,
    );
  }

  return NextResponse.json({ success: true });
}
