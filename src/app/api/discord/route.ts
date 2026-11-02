import { NextRequest, NextResponse } from 'next/server';
import { deliverWebhook, webhookSession } from '@/server/discord';
import { roleHasPermission, type GroupRole } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { client, userId } = await webhookSession(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { webhookUrl, payload, context } = body || {};
    if (!context || typeof context.groupId !== 'string' ||
      !['event', 'repost', 'announcement', 'reminder', 'test', 'welcome'].includes(context.kind) ||
      (context.gameSlug !== undefined && typeof context.gameSlug !== 'string') ||
      (context.subjectId !== undefined && typeof context.subjectId !== 'string') ||
      typeof webhookUrl !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 });
    }
    const { data: member, error: memberError } = await client.from('group_members').select('role')
      .eq('group_id', context.groupId).eq('user_id', userId).maybeSingle();
    if (memberError) throw memberError;
    const permission = context.kind === 'announcement' ? 'announcements_create' :
      context.kind === 'test' ? 'settings_edit' : context.kind === 'welcome' ? 'recruitment_manage' : 'events_create';
    if (!member || !roleHasPermission(member.role as GroupRole, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data: group, error } = await client.from('groups').select('*').eq('id', context.groupId).single();
    if (error) throw error;
    // Test buttons may send to an unsaved URL; other sends must target this group's configuration.
    const configured = Object.entries(group).some(([key, value]) => key.endsWith('_webhook_url') && value === webhookUrl);
    if (context.kind !== 'test' && !configured) {
      return NextResponse.json({ error: 'Webhook does not belong to this group' }, { status: 400 });
    }
    const disabled = context.kind === 'announcement' ? group.notify_on_announcements === false :
      ['event', 'repost', 'reminder'].includes(context.kind) && group.notify_on_events === false;
    const result = await deliverWebhook(client, userId, context, webhookUrl, payload,
      disabled ? 'Notifications disabled in group settings' : undefined);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('[discord] Webhook request failed:', error);
    return NextResponse.json({ error: 'Webhook delivery could not be completed; check logs and Discord before retrying' }, { status: 500 });
  }
}
