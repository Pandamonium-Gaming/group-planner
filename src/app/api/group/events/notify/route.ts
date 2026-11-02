import { NextRequest, NextResponse } from 'next/server';
import { GAME_DISCORD_COLUMNS, getGameEventsRoleId, getGameEventsWebhookUrl, type GameId } from '@/lib/discordConfig';
import { notifyNewEvent, notifyAnnouncement, type WebhookContext } from '@/lib/discord';
import { getGroupPermissionsSnapshot } from '@/server/permissions/group-permissions-service';
import { webhookSession, deliverWebhook } from '@/server/discord';

export async function POST(request: NextRequest) {
  try {
    const { client, userId } = await webhookSession(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const announcement = typeof body?.announcement_id === 'string';
    const id = announcement ? body.announcement_id : body?.event_id;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid notification subject id' }, { status: 400 });
    }
    const { data: event, error: eventError } = await client.from(announcement ? 'announcements' : 'events').select('*').eq('id', id).maybeSingle();
    if (eventError) throw new Error(`Failed to load event: ${eventError.message}`);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const snapshot = await getGroupPermissionsSnapshot(event.group_id, [userId]);
    if (!snapshot?.permissions.includes(announcement ? 'announcements_create' : 'events_create') ||
      (event.created_by !== userId && !snapshot.permissions.includes(announcement ? 'announcements_edit' : 'events_edit_any'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const gameSlug = announcement ? body.game_slug || 'aoc' : event.game_slug || 'aoc';
    const game = gameSlug === 'starcitizen' ? 'sc' : gameSlug;
    if (typeof gameSlug !== 'string' || !Object.prototype.hasOwnProperty.call(GAME_DISCORD_COLUMNS, game)) {
      return NextResponse.json({ error: 'Unsupported event game' }, { status: 400 });
    }
    const gameId = game as GameId;
    const { data: group, error: groupError } = await client.from('groups')
      .select('*')
      .eq('id', event.group_id).single();
    if (groupError || !group) throw new Error(`Failed to load notification settings: ${groupError?.message || 'Group not found'}`);
    const config = { ...group, group_announcement_role_id: group.discord_announcement_role_id };
    const webhook = announcement ? group.group_webhook_url : getGameEventsWebhookUrl(gameId, config);
    const context: WebhookContext = { groupId: event.group_id, gameSlug,
      kind: announcement ? 'announcement' : body.repost === true ? 'repost' : 'event', subjectId: event.id };
    const disabled = announcement ? group.notify_on_announcements === false : group.notify_on_events === false;
    const skipReason = disabled ? 'Notifications disabled in group settings' : !announcement && event.is_cancelled ? 'Event cancelled' : undefined;
    if (skipReason || !webhook) {
      const result = await deliverWebhook(client, userId, context, webhook, {}, skipReason);
      return NextResponse.json(result, { status: result.success ? 200 : 409 });
    }
    const send: typeof import('@/lib/discord').sendDiscordWebhook = (destination, payload) =>
      deliverWebhook(client, userId, context, destination, payload);
    const result = announcement
      ? await notifyAnnouncement(webhook, { ...event, game_slug: gameSlug }, group.name, group.slug, group.discord_announcement_role_id, send)
      : await notifyNewEvent(webhook, event, group.name, group.slug, getGameEventsRoleId(gameId, config), send);
    if (!result.success) throw new Error(result.error || 'Discord notification failed');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[event-notification] Failed:', error);
    return NextResponse.json({ error: 'Discord notification failed; check webhook logs and the Discord channel before retrying' }, { status: 500 });
  }
}
