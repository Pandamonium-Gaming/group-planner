'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClientAuthStack } from '@/lib/authStack';
import { getSession, syncDiscordIdToMembers } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const authStack = getClientAuthStack();

      if (authStack === 'v2') {
        router.push('/');
        return;
      }

      let session = null;
      try {
        session = await getSession();
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/?error=auth_failed');
        return;
      }

      // Phase 3: Sync Discord ID to members table (Discord ID Migration)
      if (session?.user?.id) {
        try {
          await syncDiscordIdToMembers(session.user.id);
        } catch (err) {
          console.error('Error syncing Discord ID:', err);
          // Don't fail login - this is a background sync
        }
      }

      // Redirect to home - getURL() already ensures we're on the correct domain
      router.push('/');
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Completing login...</p>
      </div>
    </div>
  );
}

