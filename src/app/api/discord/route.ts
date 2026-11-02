import { NextRequest, NextResponse } from 'next/server';
import { deliverWebhook, webhookSession } from '@/server/discord';
import { getGroupPermissionsSnapshot } from '@/server/permissions/group-permissions-service';

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
      !['announcement', 'reminder', 'test', 'welcome'].includes(context.kind) ||
      (context.gameSlug !== undefined && typeof context.gameSlug !== 'string') ||
      (context.subjectId !== undefined && typeof context.subjectId !== 'string') ||
      typeof webhookUrl !== 'string' || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 });
    }
    const snapshot = await getGroupPermissionsSnapshot(context.groupId, [userId]);
    const permission = context.kind === 'announcement' ? 'announcements_create' :
      context.kind === 'test' ? 'settings_edit' : context.kind === 'welcome' ? 'recruitment_manage' : 'events_create';
    if (!snapshot?.permissions.includes(permission)) {
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
      context.kind === 'reminder' && group.notify_on_events === false;
    const result = await deliverWebhook(client, userId, context, webhookUrl, payload,
      disabled ? 'Notifications disabled in group settings' : undefined);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('[discord] Webhook request failed:', error);
    return NextResponse.json({ error: 'Webhook delivery could not be completed; check logs and Discord before retrying' }, { status: 500 });
  }
}
