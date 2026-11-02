'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Home, LogOut, User, Settings, Loader2 } from 'lucide-react';
import { PublicEventsView } from '@/components/views/PublicEventsView';
import { InlineFooter } from '@/components/layout/Footer';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { GameSwitcher } from '@/components/common/GameSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PublicEventsPage() {
  const { user, profile, loading, signIn, signOut } = useAuthContext();
  const { t } = useLanguage();
  const displayName = profile?.display_name || profile?.discord_username || 'User';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-grid-pattern">
      {/* Header - fixed at top */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
            title={t('common.home')}
          >
            <Home size={18} className="group-hover:text-indigo-400 transition-colors" />
            <span className="text-sm font-medium hidden sm:inline">{t('common.home')}</span>
          </Link>
          <div className="flex items-center justify-end">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <GameSwitcher />
                <div className="flex items-center gap-2 text-slate-300">
                  {profile?.discord_avatar ? (
                    <Image
                      src={profile.discord_avatar}
                      alt={displayName}
                      width={32}
                      height={32}
                      unoptimized
                      className="w-8 h-8 rounded-full ring-2 ring-slate-700"
                    />
                  ) : (
                    <User className="w-8 h-8 p-1 bg-slate-800 rounded-full" />
                  )}
                  <span className="text-sm hidden sm:inline">{displayName}</span>
                </div>
                <Link
                  href="/settings"
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
                  title={t('common.settings')}
                >
                  <Settings size={18} />
                </Link>
                <button
                  onClick={() => signOut()}
                  className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={t('common.signOut')}
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-[#5865F2]/20 hover:shadow-[#5865F2]/30 hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                {t('common.login')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <PublicEventsView />
        </div>
      </main>

      {/* Footer at the bottom */}
      <div className="shrink-0">
        <InlineFooter />
      </div>
    </div>
  );
}

