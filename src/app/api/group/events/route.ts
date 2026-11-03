import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import { roleHasPermission, type GroupRole } from '@/lib/permissions';
import { isEventTypeAllowedForGame } from '@/lib/events';
import { gameNotEnabledResponse, isGameNotEnabledError } from '@/server/game-write-errors';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

async function requireGroupMembership(
  supabaseAdmin: SupabaseClient,
  groupId: string,
  userId: string
): Promise<{ role: GroupRole } | null> {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .neq('role', 'pending')
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed to verify membership: ${membershipError.message}`);
  }

  if (!membership) {
    return null;
  }

  return membership as { role: GroupRole };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const gameSlug = searchParams.get('game_slug') || 'aoc';

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  let membership: { role: GroupRole } | null = null;
  try {
    membership = await requireGroupMembership(supabaseAdmin, groupId, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify membership';
    return NextResponse.json({ error: 'Failed to verify membership', details: message }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const eventsQuery = supabaseAdmin
    .from('events')
    .select(`
      *,
      event_rsvps (
        *,
        character:members(id, name, primary_archetype, secondary_archetype, ror_class, wow_class, wow_main_spec),
        user:users(id, display_name)
      ),
      guest_event_rsvps (*)
    `)
    .eq('group_id', groupId)
    .eq('game_slug', gameSlug)
    .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true });

  const announcementsQuery = supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('group_id', groupId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  const [{ data: events, error: eventsError }, { data: announcements, error: announcementsError }] = await Promise.all([
    eventsQuery,
    announcementsQuery,
  ]);

  if (eventsError) {
    return NextResponse.json({ error: 'Failed to load events', details: eventsError.message }, { status: 500 });
  }

  if (announcementsError) {
    return NextResponse.json({ error: 'Failed to load announcements', details: announcementsError.message }, { status: 500 });
  }

  return NextResponse.json({
    events: events || [],
    announcements: announcements || [],
  });
}

type EventMutationPayload =
  | {
      action: 'create_event';
      group_id: string;
      event: Record<string, unknown>;
    }
  | {
      action: 'update_event';
      group_id: string;
      id: string;
      updates: Record<string, unknown>;
    }
  | {
      action: 'cancel_event';
      group_id: string;
      id: string;
    }
  | {
      action: 'delete_event';
      group_id: string;
      id: string;
    }
  | {
      action: 'set_rsvp';
      group_id: string;
      event_id: string;
      status: string;
      role?: string | null;
      character_id?: string | null;
      target_user_id?: string;
      note?: string | null;
    }
  | {
      action: 'remove_rsvp';
      group_id: string;
      event_id: string;
      target_user_id?: string;
    }
  | {
      action: 'create_announcement';
      group_id: string;
      announcement: Record<string, unknown>;
    }
  | {
      action: 'update_announcement';
      group_id: string;
      id: string;
      updates: Record<string, unknown>;
    }
  | {
      action: 'delete_announcement';
      group_id: string;
      id: string;
    };

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  try {
    const payload = (await request.json()) as EventMutationPayload;
    const groupId = payload.group_id;
    if (!groupId) {
      return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
    }

    const membership = await requireGroupMembership(supabaseAdmin, groupId, userId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = membership.role;

    if (payload.action === 'create_event') {
      if (!roleHasPermission(role, 'events_create')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const gameSlug = typeof payload.event.game_slug === 'string' ? payload.event.game_slug : 'aoc';
      if (!isEventTypeAllowedForGame(payload.event.event_type, gameSlug)) {
        return NextResponse.json({ error: 'Invalid event type for this game' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('events')
        .insert(payload.event)
        .select()
        .single();

      if (error) {
        if (isGameNotEnabledError(error)) return gameNotEnabledResponse();
        return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ event: data });
    }

    if (payload.action === 'update_event' || payload.action === 'cancel_event' || payload.action === 'delete_event') {
      const eventId = payload.id;
      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from('events')
        .select('id, group_id, created_by, game_slug, event_type')
        .eq('id', eventId)
        .eq('group_id', groupId)
        .maybeSingle();

      if (eventError) {
        return NextResponse.json({ error: 'Failed to load event', details: eventError.message }, { status: 500 });
      }

      if (!eventRow) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const isOwner = eventRow.created_by === userId;
      const canEdit = roleHasPermission(role, 'events_edit_any') || (isOwner && roleHasPermission(role, 'events_edit_own'));
      const canDelete = roleHasPermission(role, 'events_delete_any') || (isOwner && roleHasPermission(role, 'events_delete_own'));

      if (payload.action === 'update_event') {
        if (!canEdit) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const gameSlug = eventRow.game_slug || 'aoc';
        if (payload.updates.game_slug !== undefined && payload.updates.game_slug !== gameSlug) {
          return NextResponse.json({ error: 'Cannot change an event game' }, { status: 400 });
        }
        if (payload.updates.event_type !== undefined &&
          !isEventTypeAllowedForGame(payload.updates.event_type, gameSlug, eventRow.event_type)) {
          return NextResponse.json({ error: 'Invalid event type for this game' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from('events')
          .update({ ...payload.updates, updated_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('group_id', groupId);

        if (error) {
          return NextResponse.json({ error: 'Failed to update event', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (payload.action === 'cancel_event') {
        if (!canEdit) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
          .from('events')
          .update({ is_cancelled: true, updated_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('group_id', groupId);

        if (error) {
          return NextResponse.json({ error: 'Failed to cancel event', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (!canDelete) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('group_id', groupId);

      if (error) {
        return NextResponse.json({ error: 'Failed to delete event', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'set_rsvp') {
      const rsvpUserId = payload.target_user_id || userId;
      const { error } = await supabaseAdmin
        .from('event_rsvps')
        .upsert(
          {
            event_id: payload.event_id,
            user_id: rsvpUserId,
            status: payload.status,
            role: payload.role || null,
            character_id: payload.character_id || null,
            note: payload.note || null,
            responded_at: new Date().toISOString(),
          },
          { onConflict: 'event_id,user_id' }
        );

      if (error) {
        return NextResponse.json({ error: 'Failed to set RSVP', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'remove_rsvp') {
      const rsvpUserId = payload.target_user_id || userId;
      const { error } = await supabaseAdmin
        .from('event_rsvps')
        .delete()
        .eq('event_id', payload.event_id)
        .eq('user_id', rsvpUserId);

      if (error) {
        return NextResponse.json({ error: 'Failed to remove RSVP', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'create_announcement') {
      if (!roleHasPermission(role, 'announcements_create')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data, error } = await supabaseAdmin
        .from('announcements')
        .insert(payload.announcement)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to create announcement', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ announcement: data });
    }

    if (payload.action === 'update_announcement') {
      if (!roleHasPermission(role, 'announcements_edit')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('announcements')
        .update({ ...payload.updates, updated_at: new Date().toISOString() })
        .eq('id', payload.id)
        .eq('group_id', groupId);

      if (error) {
        return NextResponse.json({ error: 'Failed to update announcement', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'delete_announcement') {
      if (!roleHasPermission(role, 'announcements_delete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error } = await supabaseAdmin
        .from('announcements')
        .delete()
        .eq('id', payload.id)
        .eq('group_id', groupId);

      if (error) {
        return NextResponse.json({ error: 'Failed to delete announcement', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
