import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import { getServerAuthStack } from '@/lib/authStack';
import { createCharacterTransfer, validateCharacterTransfer, TRANSFER_MAX_BYTES, TRANSFER_MAX_CHARACTERS } from '@/lib/characterTransfer';

async function authorize(request: NextRequest, groupId: string, gameSlug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server missing Supabase service credentials');
  const client = createClient(url, key);
  const session = getServerAuthStack() === 'v2' ? await auth() : null;
  let userId = session?.user?.id;
  if (!userId) {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (token && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      const result = await userClient.auth.getUser(token);
      if (!result.error) userId = result.data.user?.id;
    }
  }
  if (!userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: membership, error } = await client.from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to verify administrator: ${error.message}`);
  if (membership?.role !== 'admin') return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  const { data: game, error: gameError } = await client.from('group_games').select('archived')
    .eq('group_id', groupId).eq('game_slug', gameSlug).maybeSingle();
  if (gameError) throw new Error(`Failed to verify game: ${gameError.message}`);
  if (!game) return { response: NextResponse.json({ error: 'Game not found in group' }, { status: 404 }) };
  return { client, archived: game.archived };
}

function target(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const groupId = params.get('group_id') || '';
  const gameSlug = params.get('game_slug') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId) ||
    !['aoc', 'wowforever', 'starcitizen', 'ror'].includes(gameSlug)) {
    return null;
  }
  return { groupId, gameSlug };
}

export async function GET(request: NextRequest) {
  try {
    const destination = target(request);
    if (!destination) return NextResponse.json({ error: 'Invalid group or game' }, { status: 400 });
    const { groupId, gameSlug } = destination;
    const access = await authorize(request, groupId, gameSlug);
    if (access.response) return access.response;
    const { data, error, count } = await access.client.from('members')
      .select('*, owner:users!members_user_id_fkey(discord_id, display_name, discord_username), member_professions(profession, rank, artisan_level, quality_score), character_ships(ship_id, ownership_type, notes)', { count: 'exact' })
      .eq('group_id', groupId).eq('game_slug', gameSlug).order('id').limit(TRANSFER_MAX_CHARACTERS);
    if (error) throw new Error(`Failed to export characters: ${error.message}`);
    if (count === null || count > TRANSFER_MAX_CHARACTERS || count !== data?.length) {
      return NextResponse.json({ error: 'Export exceeds the character limit or could not be read completely' }, { status: 413 });
    }
    const document = createCharacterTransfer(gameSlug, data || []);
    const json = JSON.stringify(document, null, 2);
    if (Buffer.byteLength(json) > TRANSFER_MAX_BYTES) {
      return NextResponse.json({ error: 'Export exceeds the 2 MB transfer limit' }, { status: 413 });
    }
    return new NextResponse(json, { headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="characters-${gameSlug}.json"`,
    } });
  } catch (error) {
    console.error('[character-transfer] Export failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const destination = target(request);
    if (!destination) return NextResponse.json({ error: 'Invalid group or game' }, { status: 400 });
    const { groupId, gameSlug } = destination;
    const access = await authorize(request, groupId, gameSlug);
    if (access.response) return access.response;
    if (access.archived) return NextResponse.json({ error: 'Cannot import into an archived game' }, { status: 409 });
    const body = await request.text();
    if (Buffer.byteLength(body) > TRANSFER_MAX_BYTES) return NextResponse.json({ error: 'File exceeds 2 MB' }, { status: 413 });
    let payload: { document?: unknown; apply?: unknown; token?: unknown; confirmation?: unknown };
    let document;
    try {
      payload = JSON.parse(body);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid request');
      document = validateCharacterTransfer(payload.document, gameSlug);
      if (payload.apply !== undefined && typeof payload.apply !== 'boolean') throw new Error('Invalid import action');
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid transfer file' }, { status: 400 });
    }
    if (payload.apply && (payload.confirmation !== 'IMPORT' || typeof payload.token !== 'string')) {
      return NextResponse.json({ error: 'Preview and explicit IMPORT confirmation are required' }, { status: 400 });
    }
    const { data, error } = await access.client.rpc('transfer_group_characters', {
      p_group_id: groupId, p_game_slug: gameSlug, p_document: document,
      p_apply: payload.apply === true, p_expected_token: payload.apply ? payload.token : null,
    });
    if (error) {
      console.error('[character-transfer] Import rejected:', error);
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (!data || typeof data.token !== 'string' || !Array.isArray(data.warnings) ||
      !Number.isInteger(data.create_count) || !Number.isInteger(data.update_count)) {
      throw new Error('Invalid database import result');
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[character-transfer] Request failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 });
  }
}
