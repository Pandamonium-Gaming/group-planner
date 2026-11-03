import type { SupabaseClient } from '@supabase/supabase-js';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';
import { PERMISSIONS, ROLE_CONFIG } from '@/lib/permissions';
import { isAdminRoleMentions, isDiscordRoleId, type AdminCategorySettings, type AdminRoleMentions } from '@/lib/adminNotifications';

export const ADMIN_EVENT_TITLES = {
  account_registered: 'New account registered',
  group_created: 'Group created',
  group_deleted: 'Group deleted',
  member_joined: 'Member joined',
  member_left_or_removed: 'Member left or was removed',
  member_requested: 'Membership requested',
  member_request_closed: 'Membership request closed',
  role_changed: 'Member role changed',
  permissions_changed: 'Permission overrides changed',
  webhook_changed: 'Discord configuration changed',
  game_deleted: 'Game deleted',
} as const;

const ADMIN_EVENT_COLORS: Record<keyof typeof ADMIN_EVENT_TITLES, number> = {
  account_registered: 0x22c55e,
  group_created: 0x14b8a6,
  group_deleted: 0xdc2626,
  member_joined: 0x84cc16,
  member_left_or_removed: 0xef4444,
  member_requested: 0x06b6d4,
  member_request_closed: 0x64748b,
  role_changed: 0xf59e0b,
  permissions_changed: 0xf97316,
  webhook_changed: 0x8b5cf6,
  game_deleted: 0xb91c1c,
};

export interface AdminNotification {
  id: string;
  kind: keyof typeof ADMIN_EVENT_TITLES;
  group_id: string | null;
  group_name: string | null;
  actor_id: string | null;
  subject_id: string | null;
  subject_name: string | null;
  destination: 'site' | 'group';
  destination_id: string | null;
  changes: Record<string, unknown>;
  attempts: number;
  created_at: string;
  mention_role_id?: string | null;
}

function text(value: string) {
  return value.replace(/[\\`*_~|<>\[\]()]/g, '\\$&').slice(0, 900);
}

interface NotificationDetails {
  actorName?: string | null;
  subjectName?: string | null;
  groupSlug?: string | null;
  mentionRoleId?: string | null;
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());
}

function roleName(value: string) {
  return Object.prototype.hasOwnProperty.call(ROLE_CONFIG, value)
    ? ROLE_CONFIG[value as keyof typeof ROLE_CONFIG].label : label(value);
}

function configurationLink(event: AdminNotification, slug?: string | null) {
  if (event.destination === 'group' && event.kind === 'group_deleted') return undefined;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return undefined;
  const base = new URL(site);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Invalid configured site URL for admin notification links');
  }
  if (event.destination === 'site') return new URL('/admin/notifications', base.origin).href;
  if (!slug) return undefined;
  const section = event.kind === 'permissions_changed' ? 'permissions'
    : event.kind === 'webhook_changed' ? Object.keys(event.changes).some(key => key.startsWith('admin_') || key === 'notification_role_mentions' || key === 'notification_preferences') ? 'admin' : 'discord'
      : event.kind.startsWith('member_') || event.kind === 'role_changed' ? 'members' : '';
  return new URL(`/${encodeURIComponent(slug)}/settings${section ? `#${section}` : ''}`, base.origin).href;
}

export function adminNotificationPayload(event: AdminNotification, details: NotificationDetails = {}) {
  const role = details.mentionRoleId;
  if (role && !isDiscordRoleId(role)) throw new Error('Invalid configured Discord role ID');
  const gameName = event.kind === 'game_deleted' && typeof event.changes.game === 'string' ? event.changes.game : null;
  const changes = Object.entries(event.changes).filter(([field]) => !(event.kind === 'game_deleted' && field === 'game')).map(([field, change]) => {
    const name = field === 'admin_webhook' ? 'Admin webhook'
      : Object.prototype.hasOwnProperty.call(PERMISSIONS, field) ? PERMISSIONS[field as keyof typeof PERMISSIONS].name
        : label(field);
    if (change && typeof change === 'object' && 'before' in change && 'after' in change) {
      const value = (input: unknown) => input == null ? 'not set / default'
        : typeof input === 'boolean' ? input ? 'Enabled' : 'Disabled'
          : text(field === 'role' ? roleName(String(input)) : String(input));
      return `${text(name)}: ${value(change.before)} -> ${value(change.after)}`;
    }
    return `${text(name)}: changed`;
  });
  const fields = [
    { name: 'Group', value: text(event.group_name || 'Site-wide'), inline: true },
    { name: 'Changed by', value: details.actorName ? text(details.actorName)
      : event.actor_id ? 'Name unavailable (account may have been deleted)' : 'Not available (system or server-side change)', inline: false },
  ];
  // game_deleted stores the game name as subject_name; it is not an account, so the Game field covers it.
  if (event.kind !== 'game_deleted' && (event.subject_name || event.subject_id)) {
    const name = details.subjectName || event.subject_name;
    fields.push({ name: event.kind === 'permissions_changed' ? 'Role' : 'Affected account',
      value: name ? text(event.kind === 'permissions_changed' ? roleName(name) : name) : 'Name unavailable (account may have been deleted)', inline: false });
  }
  if (gameName) fields.push({ name: 'Game', value: text(gameName), inline: true });
  if (changes.length) {
    fields.push({ name: 'Changes', value: changes.join('\n').slice(0, 1000), inline: false });
  }
  const timestamp = new Date(event.created_at);
  const link = configurationLink(event, details.groupSlug);
  if (link) fields.push({ name: 'Configuration', value: `[Open relevant settings](${link})`, inline: false });
  return {
    username: 'Group Planner Admin',
    ...(role ? { content: `<@&${role}>` } : {}),
    allowed_mentions: { parse: [], ...(role ? { roles: [role] } : {}) },
    embeds: [{
      title: ADMIN_EVENT_TITLES[event.kind],
      description: `Occurred <t:${Math.floor(timestamp.getTime() / 1000)}:F>`,
      color: ADMIN_EVENT_COLORS[event.kind],
      ...(link ? { url: link } : {}),
      fields,
      footer: { text: `Audit ID: ${event.id}` },
      timestamp: timestamp.toISOString(),
    }],
  };
}

type DeliveryResult = {
  status: 'pending' | 'sent' | 'failed' | 'uncertain' | 'skipped';
  http_status: number | null;
  error: string | null;
  available_at?: string;
};

async function send(event: AdminNotification, webhook: string | null, details: NotificationDetails): Promise<DeliveryResult> {
  if (!webhook) return { status: 'skipped', http_status: null, error: 'No admin webhook configured for this notification' };
  if (!isDiscordWebhookUrl(webhook)) return { status: 'failed', http_status: null, error: 'Invalid configured Discord webhook URL' };
  const payload = adminNotificationPayload(event, details);
  let response: Response;
  try {
    response = await fetch(webhook, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { status: 'uncertain', http_status: null, error: 'Delivery failed or timed out; check Discord before retrying' };
  }
  if (response.ok) return { status: 'sent', http_status: response.status, error: null };
  if (response.status === 429 && event.attempts < 5) {
    const header = Number(response.headers.get('retry-after'));
    const seconds = Number.isFinite(header) && header > 0 ? Math.max(60, Math.min(86400, header)) : 60;
    return {
      status: 'pending', http_status: 429, error: 'Discord rate limited this notification; retry scheduled',
      available_at: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }
  return {
    status: response.status >= 500 ? 'uncertain' : 'failed', http_status: response.status,
    error: response.status >= 500 ? 'Discord server error; check the channel before retrying' : `Discord rejected the notification (HTTP ${response.status})`,
  };
}

export async function processAdminNotifications(client: SupabaseClient) {
  const { data, error } = await client.rpc('claim_admin_discord_notifications');
  if (error) throw new Error('Unable to claim admin notifications');
  const events: AdminNotification[] = data || [];
  const settled = await Promise.allSettled(events.map(async event => {
    const configQuery = event.destination === 'site'
      ? client.from('site_admin_discord').select('categories,webhook_override,destination_id,role_mentions').eq('id', true)
      : client.from('group_admin_discord').select('categories').eq('group_id', event.group_id);
    const { data: configData, error: configError } = await configQuery.maybeSingle();
    if (configError) throw new Error('Unable to verify notification category');
    const config: {
      categories: AdminCategorySettings;
      webhook_override?: boolean;
      destination_id?: string | null;
      role_mentions?: AdminRoleMentions | null;
    } | null = configData;
    if (config?.categories?.[event.kind] === false) {
      const { data: skipped, error: skipError } = await client.from('admin_discord_notifications')
        .update({ status: 'skipped', error: 'Notification category disabled' })
        .eq('id', event.id).eq('status', 'processing').select('id').single();
      if (skipError || !skipped) throw new Error('Unable to record disabled notification');
      return 'skipped';
    }
    let webhook: string | null = null;
    let destinationId = event.destination_id;
    if (event.destination === 'site') {
      if (config?.webhook_override) destinationId = config.destination_id ?? null;
      else webhook = process.env.ADMIN_DISCORD_WEBHOOK_URL || null;
    }
    if ((event.destination === 'group' || config?.webhook_override) && destinationId) {
      const { data: destination, error: destinationError } = await client.from('admin_discord_destinations')
        .select('webhook_url').eq('id', destinationId).single();
      if (destinationError) throw new Error('Unable to load private admin destination; claimed delivery will become uncertain');
      webhook = destination.webhook_url;
    }
    const details: NotificationDetails = {};
    if (webhook) {
      if (event.destination === 'site') {
        const roles: unknown = config?.role_mentions ?? JSON.parse(process.env.ADMIN_DISCORD_ROLE_MENTIONS || '{}');
        if (!isAdminRoleMentions(roles)) throw new Error('Invalid site admin role mention configuration');
        details.mentionRoleId = roles[event.kind];
      } else {
        details.mentionRoleId = event.mention_role_id;
      }
      for (const [id, field] of [[event.actor_id, 'actorName'], [event.subject_id, 'subjectName']] as const) {
        if (!id) continue;
        const { data: user, error: userError } = await client.from('users')
          .select('display_name,discord_username').eq('id', id).maybeSingle();
        if (userError) throw new Error('Unable to resolve admin notification names');
        details[field] = user?.display_name?.trim() || user?.discord_username?.trim() || null;
      }
      if (event.group_id && event.kind !== 'group_deleted') {
        const { data: group, error: groupError } = await client.from('groups').select('slug').eq('id', event.group_id).maybeSingle();
        if (groupError) throw new Error('Unable to resolve admin notification settings link');
        details.groupSlug = group?.slug;
      }
    }
    const result = await send(event, webhook, details);
    const { data: updated, error: updateError } = await client.from('admin_discord_notifications').update(result)
      .eq('id', event.id).eq('status', 'processing').select('id').single();
    if (updateError || !updated) throw new Error('Unable to record admin delivery result; check Discord before retrying');
    if (result.status === 'failed' || result.status === 'uncertain') {
      console.error('[admin-discord] Notification not confirmed:', event.id, result.status, result.http_status);
    }
    return result.status;
  }));
  if (settled.some(result => result.status === 'rejected')) {
    throw new Error('Unable to complete admin notifications; inspect claimed deliveries before retrying');
  }
  const outcomes = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  return { processed: outcomes.length, sent: outcomes.filter(status => status === 'sent').length };
}
