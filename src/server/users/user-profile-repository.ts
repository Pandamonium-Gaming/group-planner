import { createClient } from '@supabase/supabase-js';
import { getDataBackend } from '@/server/data/backend';
import { getPrisma } from '@/server/data/prisma';

export interface UserProfileRecord {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  display_name: string | null;
  timezone: string;
}

export interface UserProfileSeed {
  discordId?: string | null;
  discordUsername?: string | null;
  discordAvatar?: string | null;
  displayName?: string | null;
  timezone?: string | null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

export async function findUserProfileById(userId: string): Promise<UserProfileRecord | null> {
  if (getDataBackend() === 'postgres') {
    const user = await getPrisma().public_users.findUnique({
      where: { id: userId },
      select: { id: true, discord_id: true, discord_username: true, discord_avatar: true, display_name: true, timezone: true },
    });
    return user ? { ...user, timezone: user.timezone || 'UTC' } : null;
  }
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Server missing Supabase service credentials');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, discord_id, discord_username, discord_avatar, display_name, timezone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read user profile: ${error.message}`);
  }

  return (data as UserProfileRecord | null) ?? null;
}

export async function findOrCreateUserProfileById(
  userId: string,
  seed: UserProfileSeed = {}
): Promise<UserProfileRecord | null> {
  const existing = await findUserProfileById(userId);
  if (existing) {
    return existing;
  }

  if (getDataBackend() === 'postgres') {
    throw new Error('Authenticated standalone profile is missing; sign in again to resolve identity');
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Server missing Supabase service credentials');
  }

  const payload = {
    id: userId,
    discord_id: seed.discordId ?? null,
    discord_username: seed.discordUsername ?? null,
    discord_avatar: seed.discordAvatar ?? null,
    display_name: seed.displayName ?? 'User',
    timezone: seed.timezone ?? 'UTC',
  };

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(payload)
    .select('id, discord_id, discord_username, discord_avatar, display_name, timezone')
    .maybeSingle();

  if (!error && data) {
    return data as UserProfileRecord;
  }

  // Handle race where another request created the profile first.
  const reread = await findUserProfileById(userId);
  if (reread) {
    return reread;
  }

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }

  return null;
}
