import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

async function resolveRequestUserId(request: NextRequest): Promise<string | null> {
  const nextAuthSession = await auth();
  const sessionUserId = nextAuthSession?.user?.id;
  if (sessionUserId) {
    return sessionUserId;
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  try {
    const body = (await request.json()) as {
      group_id?: string;
      character_id?: string;
      ship_id?: string;
      ownership_type?: 'pledged' | 'in-game' | 'loaner' | 'subscriber';
      notes?: string | null;
    };

    const groupId = body.group_id;
    const characterId = body.character_id;
    const shipId = body.ship_id;

    if (!groupId || !characterId || !shipId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('id', characterId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: 'Failed to verify character', details: memberError.message }, { status: 500 });
    }

    if (!memberRow) {
      return NextResponse.json({ error: 'Character not found in group' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('character_ships')
      .insert({
        character_id: characterId,
        ship_id: shipId,
        ownership_type: body.ownership_type || 'pledged',
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to add ship', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ship: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  try {
    const body = (await request.json()) as {
      group_id?: string;
      ship_record_id?: string;
    };

    const groupId = body.group_id;
    const shipRecordId = body.ship_record_id;

    if (!groupId || !shipRecordId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: shipRow, error: shipRowError } = await supabaseAdmin
      .from('character_ships')
      .select('id, character_id')
      .eq('id', shipRecordId)
      .maybeSingle();

    if (shipRowError) {
      return NextResponse.json({ error: 'Failed to verify ship', details: shipRowError.message }, { status: 500 });
    }

    if (!shipRow) {
      return NextResponse.json({ error: 'Ship not found' }, { status: 404 });
    }

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('id', shipRow.character_id)
      .eq('group_id', groupId)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: 'Failed to verify ship ownership', details: memberError.message }, { status: 500 });
    }

    if (!memberRow) {
      return NextResponse.json({ error: 'Ship does not belong to this group' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('character_ships')
      .delete()
      .eq('id', shipRecordId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete ship', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
