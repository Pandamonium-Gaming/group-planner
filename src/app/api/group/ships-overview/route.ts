import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    return null;
  }

  if (!key) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    return null;
  }

  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({
      error: 'Server not properly configured. Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY).'
    }, { status: 500 });
  }

  try {
    const nextAuthSession = await auth();
    let userId = nextAuthSession?.user?.id || null;
    const sessionDiscordId = nextAuthSession?.user?.discordId || null;
    const resolvedUserIds = new Set<string>();

    if (!userId) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user }, error: authError } = await userClient.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorised - invalid or expired token' }, { status: 401 });
      }

      userId = user.id;
    }

    if (userId) {
      resolvedUserIds.add(userId);
    }

    if (sessionDiscordId) {
      const { data: linkedUsers, error: linkedUsersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('discord_id', sessionDiscordId);

      if (linkedUsersError) {
        console.error('Error resolving linked users by discord_id:', linkedUsersError);
      } else {
        ((linkedUsers || []) as Array<{ id: string | null }>).forEach((linkedUser) => {
          if (linkedUser?.id) {
            resolvedUserIds.add(linkedUser.id);
          }
        });
      }
    }

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden - not a group member' }, { status: 403 });
    }

    const { data: characters, error: charactersError } = await supabaseAdmin
      .from('members')
      .select('id, group_id, user_id, discord_id, game_slug, name, race, primary_archetype, secondary_archetype, level, is_main, created_at')
      .eq('group_id', groupId)
      .order('is_main', { ascending: false })
      .order('name');

    if (charactersError) {
      console.error('Error fetching characters:', charactersError);
      return NextResponse.json({ error: 'Failed to load characters' }, { status: 500 });
    }

    const charactersWithProfessions = (characters || []).map((char) => ({
      ...char,
      professions: [],
    }));

    const ownCharacterIds = charactersWithProfessions
      .filter((char) => {
        const byResolvedUserId = !!char.user_id && resolvedUserIds.has(char.user_id);
        const byDiscordId = !!sessionDiscordId && char.discord_id === sessionDiscordId;
        return byResolvedUserId || byDiscordId;
      })
      .map((char) => char.id);

    const characterIds = charactersWithProfessions.map((char) => char.id);

    let ships: unknown[] = [];
    if (characterIds.length > 0) {
      const { data: shipsData, error: shipsError } = await supabaseAdmin
        .from('character_ships')
        .select('*')
        .in('character_id', characterIds);

      if (shipsError) {
        console.error('Error fetching character ships:', shipsError);
        return NextResponse.json({ error: 'Failed to load ships' }, { status: 500 });
      }

      ships = shipsData || [];
    }

    return NextResponse.json({
      characters: charactersWithProfessions,
      ships,
      ownCharacterIds,
    });
  } catch (error) {
    console.error('Error fetching ships overview:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
