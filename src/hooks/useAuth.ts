'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getClientAuthStack } from '@/lib/authStack';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import { 
  UserProfile, 
  getUserProfile, 
  getSession as getAuthSession,
  onAuthStateChange,
  signInWithDiscord, 
  signOut as authSignOut,
  updateDisplayName as authUpdateDisplayName
} from '@/lib/auth';

interface UseAuthReturn {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signIn: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

type V2SessionPayload = {
  stack: 'v2';
} & ({
  authenticated: false;
  user: null;
} | {
  authenticated: true;
  user: { id: string; discordId: string | null; displayName: string | null };
});

function isV2SessionPayload(payload: unknown): payload is V2SessionPayload {
  if (!payload || typeof payload !== 'object'
    || !('stack' in payload) || payload.stack !== 'v2'
    || !('authenticated' in payload) || !('user' in payload)) return false;
  if (payload.authenticated === false) return payload.user === null;
  const user = payload.user;
  return payload.authenticated === true && !!user && typeof user === 'object'
    && 'id' in user && typeof user.id === 'string' && user.id.length > 0
    && 'discordId' in user && (user.discordId === null || typeof user.discordId === 'string')
    && 'displayName' in user && (user.displayName === null || typeof user.displayName === 'string');
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const buildFallbackV2Profile = useCallback((payloadUser: {
    id: string;
    discordId: string | null;
    displayName: string | null;
  }): UserProfile => ({
    id: payloadUser.id,
    discord_id: payloadUser.discordId,
    discord_username: null,
    discord_avatar: null,
    display_name: payloadUser.displayName,
    timezone: 'UTC',
  }), []);

  const fetchV2Profile = useCallback(async (fallbackProfile: UserProfile) => {
    try {
      const response = await fetch('/api/me/profile', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        setProfile(fallbackProfile);
        return;
      }

      const payload = await response.json() as { profile?: UserProfile | null };
      setProfile(payload.profile ?? fallbackProfile);
    } catch (error) {
      console.error('Error fetching v2 profile:', error);
      setProfile(fallbackProfile);
    }
  }, []);

  const fetchV2Session = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch v2 session: ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isV2SessionPayload(payload)) {
        throw new Error('Invalid v2 session response; check client and server authentication configuration');
      }

      if (!payload.authenticated) {
        setUser(null);
        setSession(null);
        setProfile(null);
        return;
      }

      // Keep current hook contract for consumers while v2 rollout is gated.
      setUser({ id: payload.user.id } as User);
      setSession(null);

      const fallbackProfile = buildFallbackV2Profile(payload.user);
      await fetchV2Profile(fallbackProfile);
    } catch (error) {
      console.error('Error fetching v2 session:', error);
      setError(error instanceof Error ? error : new Error('Unable to verify session'));
    }
  }, [buildFallbackV2Profile, fetchV2Profile]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const timeoutPromise = new Promise<UserProfile | null>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout fetching profile')), 5000);
      });

      const userProfile = await Promise.race([
        getUserProfile(userId),
        timeoutPromise
      ]) as UserProfile | null;

      setProfile(userProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Even if profile fetch fails/times out, we shouldn't block the UI forever
    }
  }, []);

  useEffect(() => {
    const authStack = getClientAuthStack();

    if (authStack === 'v2') {
      let isCancelled = false;
      const timerId = setTimeout(() => {
        fetchV2Session().finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
      }, 0);

      return () => {
        isCancelled = true;
        clearTimeout(timerId);
      };
    }

    // Get initial session
    getAuthSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { subscription } = onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchV2Session]);

  const signIn = async (redirectTo?: string) => {
    if (getClientAuthStack() === 'v2') {
      await nextAuthSignIn('discord', { callbackUrl: redirectTo || '/' });
      return;
    }

    await signInWithDiscord(redirectTo);
  };

  const signOut = async () => {
    if (getClientAuthStack() === 'v2') {
      await nextAuthSignOut({ callbackUrl: '/' });
      setUser(null);
      setProfile(null);
      setSession(null);
      return;
    }

    await authSignOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateDisplayName = async (name: string) => {
    if (!user) throw new Error('Not authenticated');
    await authUpdateDisplayName(user.id, name);
    setProfile(prev => prev ? { ...prev, display_name: name } : null);
  };

  const refresh = async () => {
    if (getClientAuthStack() === 'v2') {
      setLoading(true);
      try {
        await fetchV2Session();
      } finally {
        setLoading(false);
      }
      return;
    }

    if (user) {
      await fetchProfile(user.id);
    }
  };

  return {
    user,
    profile,
    session,
    loading,
    error,
    signIn,
    signOut,
    updateDisplayName,
    refresh,
  };
}
