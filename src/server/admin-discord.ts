import type { SupabaseClient } from '@supabase/supabase-js';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';

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
} as const;

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
}

function text(value: string) {
  return value.replace(/[\\`*_~|<>\[\]()]/g, '\\$&').slice(0, 900);
}

export function adminNotificationPayload(event: AdminNotification) {
  const changes = Object.entries(event.changes).map(([field, change]) => {
    if (change && typeof change === 'object' && 'before' in change && 'after' in change) {
      const value = (input: unknown) => input == null ? 'not set / default' : text(String(input));
      return `${text(field)}: ${value(change.before)} -> ${value(change.after)}`;
    }
    return `${text(field)}: changed`;
  });
  const fields = [
    { name: 'Group', value: text(event.group_name || 'Site-wide'), inline: true },
    { name: 'Actor', value: event.actor_id ? text(event.actor_id) : 'Not available (system or server-side change)', inline: false },
  ];
  if (event.subject_name || event.subject_id) {
    fields.push({ name: 'Subject', value: text([event.subject_name, event.subject_id].filter(Boolean).join(' / ')), inline: false });
  }
  if (changes.length) {
    fields.push({ name: 'Changes', value: changes.join('\n').slice(0, 1000), inline: false });
  }
  const timestamp = new Date(event.created_at);
  return {
    username: 'Group Planner Admin',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: ADMIN_EVENT_TITLES[event.kind],
      description: `Occurred <t:${Math.floor(timestamp.getTime() / 1000)}:F>`,
      color: 0xa855f7,
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

async function send(event: AdminNotification, webhook: string | null): Promise<DeliveryResult> {
  if (!webhook) return { status: 'skipped', http_status: null, error: 'No admin webhook configured for this notification' };
  if (!isDiscordWebhookUrl(webhook)) return { status: 'failed', http_status: null, error: 'Invalid configured Discord webhook URL' };
  let response: Response;
  try {
    response = await fetch(webhook, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminNotificationPayload(event)),
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
    let webhook: string | null = null;
    if (event.destination === 'site') {
      webhook = process.env.ADMIN_DISCORD_WEBHOOK_URL || null;
    } else if (event.destination_id) {
      const { data: destination, error: destinationError } = await client.from('admin_discord_destinations')
        .select('webhook_url').eq('id', event.destination_id).single();
      if (destinationError) throw new Error('Unable to load private admin destination; claimed delivery will become uncertain');
      webhook = destination.webhook_url;
    }
    const result = await send(event, webhook);
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
