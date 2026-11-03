import { getServerSession, type NextAuthOptions } from 'next-auth';
import Discord from 'next-auth/providers/discord';
import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { getServerAuthStack } from '@/lib/authStack';
import { getDataBackend } from '@/server/data/backend';
import { resolveStandaloneDiscordUser } from '@/server/users/discord-identity';

const discordClientId = process.env.AUTH_DISCORD_ID || process.env.DISCORD_CLIENT_ID;
const discordClientSecret = process.env.AUTH_DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET;
const authDatabaseUrl = process.env.AUTH_DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const requestedSessionStrategy = (process.env.AUTH_SESSION_STRATEGY || '').trim().toLowerCase() === 'jwt'
  ? 'jwt'
  : 'database';
const useDatabaseSessions = requestedSessionStrategy === 'database' && !!authDatabaseUrl;
const standalone = getDataBackend() === 'postgres';

if (standalone && (!useDatabaseSessions || !process.env.AUTH_SECRET)) {
  throw new Error('Standalone authentication requires database sessions, AUTH_DATABASE_URL and AUTH_SECRET');
}

if (requestedSessionStrategy === 'database' && !authDatabaseUrl) {
  console.warn('AUTH_SESSION_STRATEGY=database but no AUTH_DATABASE_URL set; falling back to jwt sessions.');
}

if (!discordClientId || !discordClientSecret) {
  console.warn('Discord OAuth credentials are missing for Auth.js (AUTH_DISCORD_ID/AUTH_DISCORD_SECRET).');
}

const pool = useDatabaseSessions
  ? new Pool({
      connectionString: authDatabaseUrl,
      ...(standalone ? { options: '-c search_path=authjs,pg_catalog' } : {}),
    })
  : null;

const supabaseAdmin = !standalone && supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

async function getDiscordAccountId(authUserId: string): Promise<string | null> {
  if (!pool) {
    return null;
  }

  try {
    const result = await pool.query<{ providerAccountId: string }>(
      'SELECT "providerAccountId" FROM accounts WHERE "userId" = $1 AND provider = $2 LIMIT 1',
      [authUserId, 'discord']
    );

    return result.rows[0]?.providerAccountId ?? null;
  } catch (error) {
    console.error('Unable to resolve Discord account id from Auth.js accounts table:', error);
    return null;
  }
}

async function getLegacySupabaseUserId(discordId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) {
      console.error('Unable to resolve legacy Supabase user id from discord_id:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('Unexpected error resolving legacy Supabase user id:', error);
    return null;
  }
}

  async function getOrCreateLegacySupabaseUserId(
    discordId: string,
    profile: { displayName: string | null; avatarUrl: string | null }
  ): Promise<string | null> {
    if (standalone) return resolveStandaloneDiscordUser(discordId, profile);
    if (!supabaseAdmin) {
      return null;
    }

    try {
      const { data: existingUser, error: existingUserError } = await supabaseAdmin
        .from('users')
        .select('id, discord_username, discord_avatar, display_name')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (existingUserError) {
        console.error('Unable to resolve legacy Supabase user id from discord_id:', existingUserError);
        return null;
      }

      if (existingUser) {
        const updates: Record<string, string> = {};

        if (profile.displayName && profile.displayName !== existingUser.discord_username) {
          updates.discord_username = profile.displayName;
          if (!existingUser.display_name) {
            updates.display_name = profile.displayName;
          }
        }

        if (profile.avatarUrl && profile.avatarUrl !== existingUser.discord_avatar) {
          updates.discord_avatar = profile.avatarUrl;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update(updates)
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('Unable to refresh legacy Supabase Discord profile fields:', updateError);
          }
        }

        return existingUser.id;
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          discord_id: discordId,
          discord_username: profile.displayName,
          display_name: profile.displayName || 'User',
          discord_avatar: profile.avatarUrl,
          timezone: 'UTC',
        })
        .select('id')
        .single();

      if (error) {
        // If another concurrent request inserted first, retry lookup.
        const resolvedAfterError = await getLegacySupabaseUserId(discordId);
        if (resolvedAfterError) {
          return resolvedAfterError;
        }

        console.error('Unable to auto-provision legacy Supabase user by discord_id:', error);
        return null;
      }

      return data?.id ?? null;
    } catch (error) {
      console.error('Unexpected error auto-provisioning legacy Supabase user:', error);
      return null;
    }
  }

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  adapter: pool ? PostgresAdapter(pool) : undefined,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: useDatabaseSessions ? 'database' : 'jwt',
  },
  providers:
    discordClientId && discordClientSecret
      ? [
          Discord({
            clientId: discordClientId,
            clientSecret: discordClientSecret,
            issuer: 'https://discord.com',
            authorization: {
              params: {
                scope: 'identify',
              },
            },
          }),
        ]
      : [],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === 'discord') {
        const discordId = typeof (profile as { id?: unknown } | undefined)?.id === 'string'
          ? (profile as { id: string }).id
          : null;

        if (discordId) {
          const userId = await getOrCreateLegacySupabaseUserId(discordId, {
            displayName: user?.name || null,
            avatarUrl: user?.image || null,
          });
          return !!userId;
        }
      }

      console.error('[auth] Sign-in rejected: verified Discord identity could not be linked');
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'discord' && profile && typeof profile === 'object') {
        const discordProfile = profile as { id?: string };
        if (discordProfile.id) {
          token.discordId = discordProfile.id;
        }
      }
      return token;
    },
    async session({ session, token, user }) {
      const authUserId = user?.id || (typeof token?.sub === 'string' ? token.sub : undefined) || null;
      let tokenDiscordId = token && typeof token.discordId === 'string' ? token.discordId : null;

      if (!tokenDiscordId && authUserId) {
        tokenDiscordId = await getDiscordAccountId(authUserId);
      }

      let resolvedUserId: string | null = null;
      if (tokenDiscordId) {
          const legacyUserId = await getOrCreateLegacySupabaseUserId(tokenDiscordId, {
            displayName: user?.name || session.user?.name || null,
            avatarUrl: user?.image || session.user?.image || null,
          });
        if (legacyUserId) {
          resolvedUserId = legacyUserId;
        }
      }

      if (!resolvedUserId) {
        console.error('[auth] Session rejected: application account mapping unavailable');
        throw new Error('Unable to resolve application account for authenticated session');
      }

      if (session.user) {
        session.user.id = resolvedUserId;
        session.user.discordId = tokenDiscordId;
      }

      return session;
    },
  },
};

export async function auth() {
  if (getServerAuthStack() !== 'v2') return null;
  return getServerSession(authOptions);
}