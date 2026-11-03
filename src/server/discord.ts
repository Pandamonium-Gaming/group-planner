import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getServerAuthStack } from '@/lib/authStack';
import type { DiscordWebhookPayload, WebhookContext } from '@/lib/discord';
import { isDiscordWebhookUrl } from '@/lib/discordConfig';

export async function webhookSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server missing Supabase service credentials');
  const client = createClient(url, key);
  let userId = getServerAuthStack() === 'v2' ? (await auth())?.user?.id : undefined;
  if (!userId) {
    const header = request.headers.get('authorization');
    const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (token) {
      const { data, error } = await client.auth.getUser(token);
      if (!error) userId = data.user?.id;
    }
  }
  return { client, userId };
}

export async function deliverWebhook(
  client: SupabaseClient, actorId: string, context: WebhookContext,
  webhook: string | null, payload: DiscordWebhookPayload, skipReason?: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const { data: log, error: insertError } = await client.from('discord_webhook_logs').insert({
    group_id: context.groupId, game_slug: context.gameSlug || null, kind: context.kind,
    subject_id: context.subjectId || null, actor_id: actorId,
  }).select('id').single();
  if (insertError || !log) throw new Error('Unable to record webhook attempt; notification was not sent');
  let status: 'sent' | 'failed' | 'skipped' = 'failed';
  let httpStatus: number | null = null;
  let message: string | null = null;
  if (skipReason) {
    status = 'skipped';
    message = skipReason;
  } else if (!webhook) {
    message = 'No Discord webhook configured';
  } else if (!isDiscordWebhookUrl(webhook)) {
    message = 'Invalid configured Discord webhook URL';
  } else {
    try {
      const response = await fetch(webhook, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Group Planner', ...payload }),
      });
      httpStatus = response.status;
      if (response.ok) status = 'sent';
      else message = `Discord rejected the notification (HTTP ${response.status})`;
    } catch {
      message = 'Discord delivery failed or timed out; check the channel before retrying';
    }
  }
  const { error: updateError } = await client.from('discord_webhook_logs').update({
    status, http_status: httpStatus, error: message,
  }).eq('id', log.id);
  if (updateError) {
    console.error('[discord] Unable to update webhook log:', updateError.code);
    throw new Error('Webhook delivery was attempted but its final status could not be recorded; check Discord before retrying');
  }
  if (status === 'failed') console.error('[discord] Delivery failed:', message);
  return { success: status !== 'failed', skipped: status === 'skipped', error: message || undefined };
}
