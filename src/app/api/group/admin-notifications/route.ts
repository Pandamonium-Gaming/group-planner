import { NextRequest, NextResponse } from 'next/server';
import { webhookSession } from '@/server/discord';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';
import { isAdminRoleMentions, isAdminCategorySettings } from '@/lib/adminNotifications';
import { adminDatabaseError, adminFailure } from '@/server/admin-errors';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminContext(request: NextRequest, groupId: unknown) {
  const session = await webhookSession(request);
  if (!session.userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (typeof groupId !== 'string' || !uuid.test(groupId)) {
    return { response: NextResponse.json({ error: 'Invalid group' }, { status: 400 }) };
  }
  const { data, error } = await session.client.from('group_members').select('role')
    .eq('group_id', groupId).eq('user_id', session.userId).maybeSingle();
  if (error) throw adminDatabaseError('group_access', error);
  if (data?.role !== 'admin') return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { client: session.client, userId: session.userId, groupId };
}

export async function GET(request: NextRequest) {
  try {
    const context = await adminContext(request, request.nextUrl.searchParams.get('group_id'));
    if (context.response) return context.response;
    const page = Number(request.nextUrl.searchParams.get('page') || '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }
    const { client, groupId } = context;
    const { data: config, error: configError } = await client.from('group_admin_discord')
      .select('destination_id,role_mentions,categories').eq('group_id', groupId).maybeSingle();
    if (configError) throw adminDatabaseError('group_config_load', configError);
    const { data: logs, error: logsError } = await client.from('admin_discord_notifications')
      .select('id,kind,status,http_status,error,created_at')
      .eq('group_id', groupId).eq('destination', 'group')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(page * 20, page * 20 + 20);
    if (logsError) throw adminDatabaseError('group_history_load', logsError);
    return NextResponse.json({ configured: !!config?.destination_id, role_mentions: config?.role_mentions || {}, categories: config?.categories || {}, logs: logs.slice(0, 20), hasMore: logs.length > 20 });
  } catch (error) {
    return adminFailure(error, 'unknown');
  }
}

export async function POST(request: NextRequest) {
  let body: { group_id?: unknown; webhook_url?: unknown; role_mentions?: unknown; categories?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const context = await adminContext(request, body.group_id);
    if (context.response) return context.response;
    if ('categories' in body) {
      if (!isAdminCategorySettings(body.categories) || !isAdminRoleMentions(body.role_mentions) || 'webhook_url' in body) {
        return NextResponse.json({ error: 'Invalid notification preferences' }, { status: 400 });
      }
      const { error } = await context.client.rpc('save_admin_discord_preferences', {
        p_group_id: context.groupId, p_categories: body.categories, p_roles: body.role_mentions, p_actor_id: context.userId,
      });
      if (error) throw adminDatabaseError('group_save_preferences', error);
      return NextResponse.json({ success: true });
    }
    if ('role_mentions' in body) {
      if (!isAdminRoleMentions(body.role_mentions) || 'webhook_url' in body) {
        return NextResponse.json({ error: 'Invalid notification role configuration' }, { status: 400 });
      }
      const { error } = await context.client.rpc('save_group_admin_discord_roles', {
        p_group_id: context.groupId, p_roles: body.role_mentions, p_actor_id: context.userId,
      });
      if (error) throw adminDatabaseError('group_save_roles', error);
      return NextResponse.json({ success: true });
    }
    if (typeof body.webhook_url !== 'string') {
      return NextResponse.json({ error: 'Webhook URL must be a string (empty to disable)' }, { status: 400 });
    }
    const url = body.webhook_url.trim();
    if (url.length > 2048 || (url && !isDiscordWebhookUrl(url))) {
      return NextResponse.json({ error: 'Invalid Discord webhook URL' }, { status: 400 });
    }
    const { error } = await context.client.rpc('save_group_admin_discord', {
      p_group_id: context.groupId, p_webhook_url: url || null, p_actor_id: context.userId,
    });
    if (error) throw adminDatabaseError('group_save_webhook', error);
    return NextResponse.json({ configured: !!url });
  } catch (error) {
    return adminFailure(error, 'unknown');
  }
}
