import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

type GroupMembershipRole = 'admin' | 'officer' | 'member' | 'trial' | 'pending' | null;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

async function getAuthorizedMembership(groupId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), role: null as GroupMembershipRole };
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      error: NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 }),
      role: null as GroupMembershipRole,
    };
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

  return { error: null, role: membership.role as GroupMembershipRole, supabaseAdmin };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const { error, supabaseAdmin } = await getAuthorizedMembership(groupId);
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

  const { error, role, supabaseAdmin } = await getAuthorizedMembership(groupId);
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

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const groupId = body?.groupId as string | undefined;
  const gameSlug = body?.gameSlug as string | undefined;

  if (!groupId || !gameSlug) {
    return NextResponse.json({ error: 'Missing groupId or gameSlug' }, { status: 400 });
  }

  const { error, role, supabaseAdmin } = await getAuthorizedMembership(groupId);
  if (error || !supabaseAdmin) {
    return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('group_games')
    .delete()
    .eq('group_id', groupId)
    .eq('game_slug', gameSlug);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to remove game', details: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
