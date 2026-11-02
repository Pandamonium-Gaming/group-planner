import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GroupRole } from '@/lib/permissions';
import { auth } from '@/auth';

interface PostgrestErrorWithDetails {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

// Get Supabase service role client for server-side operations
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

export type PermissionOverrides = {
  id: string;
  group_id: string;
  role: GroupRole;
  characters_create: boolean;
  characters_read_all: boolean;
  characters_edit_own: boolean;
  characters_edit_any: boolean;
  characters_delete_own: boolean;
  characters_delete_any: boolean;
  guild_bank_withdraw: boolean;
  guild_bank_deposit: boolean;
  guild_bank_view_history: boolean;
  events_create: boolean;
  events_read: boolean;
  events_edit_own: boolean;
  events_edit_any: boolean;
  events_delete_own: boolean;
  events_delete_any: boolean;
  events_rsvp: boolean;
  parties_create: boolean;
  parties_read: boolean;
  parties_edit_own: boolean;
  parties_edit_any: boolean;
  parties_delete_own: boolean;
  parties_delete_any: boolean;
  siege_view_rosters: boolean;
  siege_edit_rosters: boolean;
  siege_create_event: boolean;
  ships_create: boolean;
  ships_edit_own: boolean;
  ships_edit_any: boolean;
  ships_delete_own: boolean;
  ships_delete_any: boolean;
  announcements_create: boolean;
  announcements_edit: boolean;
  announcements_delete: boolean;
  recruitment_manage: boolean;
  settings_edit: boolean;
  settings_edit_roles: boolean;
  settings_view_permissions: boolean;
  created_at: string;
  updated_at: string;
};

async function resolveRequestUserId(request: NextRequest): Promise<string | null> {
  const nextAuthSession = await auth();
  if (nextAuthSession?.user?.id) {
    return nextAuthSession.user.id;
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return null;
  }

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return null;
  }

  return user.id;
}

// GET: Fetch permission overrides for a group
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Supabase admin client initialization failed - check environment variables');
    return NextResponse.json({ 
      error: 'Server not properly configured. Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY).' 
    }, { status: 500 });
  }

  try {
    const userId = await resolveRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of the group (any role)
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden - user is not a member of this group' }, { status: 403 });
    }

    // Fetch permission overrides - may not exist if table hasn't been created yet
    const { data, error } = await supabaseAdmin
      .from('group_permission_overrides')
      .select('*')
      .eq('group_id', groupId)
      .order('role', { ascending: true });

    if (error) {
      // If table doesn't exist yet (migration not applied), just return empty
      if (error.code === 'PGRST116' || error.message?.includes('relation')) {
        console.warn('clan_permission_overrides table not found, returning empty defaults');
        return NextResponse.json({ permissions: [] });
      }
      console.error('Error fetching permissions:', error);
      return NextResponse.json({ error: 'Failed to fetch permissions', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ permissions: data || [] });
  } catch (error) {
    console.error('Error in GET /api/group/permissions:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// POST: Save permission overrides for a group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, rolePermissions } = body;

    if (!groupId || !rolePermissions) {
      return NextResponse.json({ error: 'Missing required fields: groupId and rolePermissions' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Supabase admin client initialization failed - check environment variables');
      return NextResponse.json({ 
        error: 'Server not properly configured. Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY).' 
      }, { status: 500 });
    }

    // Verify user is admin of the group
    const userId = await resolveRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - user is not an admin' }, { status: 403 });
    }

    // Save each role's permissions
    const updates = Object.entries(rolePermissions).map(([role, permissions]) => {
      const permsRecord = permissions as Record<string, boolean>;
      return {
        group_id: groupId,
        role,
        ...permsRecord,
        updated_at: new Date().toISOString(),
      };
    });

    let result;
    try {
      result = await supabaseAdmin
        .from('group_permission_overrides')
        .upsert(updates, { onConflict: 'group_id,role' });
    } catch (upsertException) {
      console.error('Exception during upsert:', upsertException);
      throw upsertException;
    }

    const { error: upsertError } = result;

    if (upsertError) {
      const postgresError = upsertError as PostgrestErrorWithDetails;
      console.error('Upsert error response:', { 
        code: postgresError.code,
        message: postgresError.message,
        details: postgresError.details,
        hint: postgresError.hint
      });
      
      // If table doesn't exist yet (migration not applied)
      if (upsertError.code === 'PGRST116' || upsertError.message?.includes('relation') || upsertError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Permission system not yet initialized. Please run database migrations.' 
        }, { status: 503 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to save permissions', 
        details: upsertError.message,
        code: upsertError.code
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved: updates.length });
  } catch (error) {
    console.error('Error in POST /api/group/permissions:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

