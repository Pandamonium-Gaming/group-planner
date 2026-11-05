'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClanErrorScreen } from '@/components/screens/ClanErrorScreen';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useLanguage();

  return (
    <AuthContext.Provider value={auth}>
      {auth.error ? (
        <ClanErrorScreen
          title={t('auth.sessionUnavailable')}
          message={t('auth.sessionUnavailableDescription')}
          retryLabel={t('common.retryConnection')}
          onRetry={() => { void auth.refresh(); }}
          homeLabel={t('common.returnHome')}
        />
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
