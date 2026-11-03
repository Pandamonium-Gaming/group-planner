import type { NextRequest } from 'next/server';
import { webhookSession } from '@/server/discord';
import { isDiscordRoleId } from '@/lib/adminNotifications';
import { auth } from '@/auth';
import { getServerAuthStack } from '@/lib/authStack';

export async function siteAdminContext(request: NextRequest) {
  const { client, userId } = await webhookSession(request);
  if (!userId) return { client, userId, allowed: false };
  const ids = (process.env.SITE_ADMIN_DISCORD_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (!ids.length) return { client, userId, allowed: false };
  if (!ids.every(isDiscordRoleId)) throw new Error('Invalid site administrator allowlist');
  let discordId: unknown;
  if (getServerAuthStack() === 'v2') {
    discordId = (await auth())?.user?.discordId;
  } else {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { client, userId, allowed: false };
    const { data, error } = await client.auth.getUser(token);
    if (error) throw new Error('Unable to verify site administrator identity');
    const identity = data.user?.identities?.find(item => item.provider === 'discord');
    discordId = identity?.id;
  }
  return { client, userId, allowed: typeof discordId === 'string' && ids.includes(discordId) };
}
