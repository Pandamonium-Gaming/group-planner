import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create service role client only if key is available
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clanSlug = searchParams.get('slug');

  if (!clanSlug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // Get clan
    const { data: clan, error: clanError } = await supabaseAdmin
      .from('groups')
      .select('id, name, slug, is_public, recruitment_open, recruitment_message, public_description')
      .eq('slug', clanSlug)
      .single();

    if (clanError || !clan) {
      return NextResponse.json({ error: 'Clan not found' }, { status: 404 });
    }

    // Check if public
    if (!clan.is_public) {
      return NextResponse.json({ error: 'Clan is not public' }, { status: 403 });
    }

    // Get member count (approved members = not pending)
    const { count: memberCount } = await supabaseAdmin
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', clan.id)
      .in('role', ['admin', 'officer', 'member']);

    // Get upcoming events count
    const { count: eventCount } = await supabaseAdmin
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', clan.id)
      .eq('is_cancelled', false)
      .gte('starts_at', new Date().toISOString());

    // Get character count for profession coverage
    const { count: characterCount } = await supabaseAdmin
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', clan.id);

    // Games the group has configured (public, non-sensitive); used by the recruitment form
    const { data: groupGames } = await supabaseAdmin
      .from('group_games')
      .select('game_slug, archived')
      .eq('group_id', clan.id);

    return NextResponse.json({
      clan,
      groupGames: groupGames || [],
      memberCount: memberCount || 0,
      characterCount: characterCount || 0,
      upcomingEvents: eventCount || 0,
    });
  } catch (error) {
    console.error('Error fetching public clan data:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

