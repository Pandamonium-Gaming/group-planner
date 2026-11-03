import { NextRequest, NextResponse } from 'next/server';
import { siteAdminContext } from '@/server/site-admin';
import { isAdminCategorySettings, isAdminRoleMentions } from '@/lib/adminNotifications';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';
import { AdminError, adminDatabaseError, adminFailure } from '@/server/admin-errors';

function siteRoleMentions(stored: unknown) {
  let roles = stored;
  if (roles == null) {
    try {
      roles = JSON.parse(process.env.ADMIN_DISCORD_ROLE_MENTIONS || '{}');
    } catch {
      throw new AdminError('site_role_config', 'ADMIN_DISCORD_ROLE_MENTIONS is not valid JSON');
    }
  }
  if (!isAdminRoleMentions(roles)) {
    throw new AdminError('site_role_config', `${stored == null ? 'ADMIN_DISCORD_ROLE_MENTIONS' : 'stored role_mentions'} failed validation`);
  }
  return roles;
}

export async function GET(request: NextRequest) {
  try {
    const { client, userId, allowed } = await siteAdminContext(request);
    if (!allowed) return NextResponse.json({ error: userId ? 'Forbidden' : 'Unauthorized' }, { status: userId ? 403 : 401 });
    const page = Number(request.nextUrl.searchParams.get('page') || '0');
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    const { data: config, error } = await client.from('site_admin_discord')
      .select('webhook_override,destination_id,role_mentions,categories').eq('id', true).maybeSingle();
    if (error) throw adminDatabaseError('site_config_load', error);
    const roles = siteRoleMentions(config?.role_mentions);
    const { data: logs, error: logError } = await client.from('admin_discord_notifications')
      .select('id,kind,status,http_status,error,created_at').eq('destination', 'site')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 20);
    if (logError) throw adminDatabaseError('site_history_load', logError);
    return NextResponse.json({
      configured: config?.webhook_override ? !!config.destination_id : !!process.env.ADMIN_DISCORD_WEBHOOK_URL,
      role_mentions: roles, categories: config?.categories || {}, logs: logs.slice(0, 20), hasMore: logs.length > 20,
    });
  } catch (error) {
    return adminFailure(error, 'unknown');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client, userId, allowed } = await siteAdminContext(request);
    if (!allowed) return NextResponse.json({ error: userId ? 'Forbidden' : 'Unauthorized' }, { status: userId ? 403 : 401 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    if ('webhook_url' in body) {
      if (typeof body.webhook_url !== 'string' || body.webhook_url.length > 2048
        || (body.webhook_url.trim() && !isDiscordWebhookUrl(body.webhook_url.trim()))
        || 'categories' in body || 'role_mentions' in body) {
        return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 });
      }
      const { error } = await client.rpc('save_site_admin_discord_webhook', { p_url: body.webhook_url.trim() || null, p_actor_id: userId });
      if (error) throw adminDatabaseError('site_save_webhook', error);
      return NextResponse.json({ configured: !!body.webhook_url.trim() });
    }
    if (!('categories' in body) || !('role_mentions' in body)
      || !isAdminCategorySettings(body.categories) || !isAdminRoleMentions(body.role_mentions)) {
      return NextResponse.json({ error: 'Invalid notification preferences' }, { status: 400 });
    }
    const { error } = await client.rpc('save_admin_discord_preferences', {
      p_group_id: null, p_categories: body.categories, p_roles: body.role_mentions, p_actor_id: userId,
    });
    if (error) throw adminDatabaseError('site_save_preferences', error);
    return NextResponse.json({ success: true });
  } catch (error) {
    return adminFailure(error, 'unknown');
  }
}
