import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/server/data/prisma';
import { isDiscordRoleId } from '@/lib/adminNotifications';

export async function resolveStandaloneDiscordUser(
  discordId: string,
  profile: { displayName: string | null; avatarUrl: string | null },
) {
  if (!isDiscordRoleId(discordId)) throw new Error('Invalid verified Discord identity');
  return getPrisma().$transaction(async transaction => {
    // Serialize first-login creation without ever adopting an Auth.js UUID.
    await transaction.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${discordId}, 0))`);
    const existing = await transaction.public_users.findUnique({ where: { discord_id: discordId } });
    if (existing) {
      await transaction.public_users.update({
        where: { id: existing.id },
        data: {
          ...(profile.displayName ? { discord_username: profile.displayName } : {}),
          ...(!existing.display_name && profile.displayName ? { display_name: profile.displayName } : {}),
          ...(profile.avatarUrl ? { discord_avatar: profile.avatarUrl } : {}),
        },
      });
      return existing.id;
    }
    const created = await transaction.public_users.create({
      data: {
        id: randomUUID(), discord_id: discordId, discord_username: profile.displayName,
        display_name: profile.displayName || 'User', discord_avatar: profile.avatarUrl, timezone: 'UTC',
      },
    });
    return created.id;
  });
}
