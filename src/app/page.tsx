'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sword, LogOut, User, Shield, Users, Settings, Loader2, Globe } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { InlineFooter } from '@/components/layout/Footer';
import { getUserGroups } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import { LandingHero } from '@/components/landing/LandingHero';
import { LandingClanForm } from '@/components/forms/LandingClanForm';
import { LandingFeatureHighlights } from '@/components/landing/LandingFeatureHighlights';
import { GameSwitcher } from '@/components/common/GameSwitcher';

interface UserClan {
  id: string;
  slug: string;
  name: string;
  role: string;
  isCreator: boolean;
  group_icon_url?: string;
}

interface PublicGroup {
  id: string;
  slug: string;
  name: string;
  group_icon_url?: string | null;
  public_description?: string | null;
  recruitment_open?: boolean | null;
}

export default function Home() {
  const [groupName, setGroupName] = useState('');
  const [userClans, setUserClans] = useState<UserClan[]>([]);
  const [clansLoading, setClansLoading] = useState(false);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [publicGroupsLoading, setPublicGroupsLoading] = useState(false);
  const { user, profile, loading, signIn, signOut } = useAuthContext();
  const { t, isLoading } = useLanguage();

  // Fetch user's clans when logged in
  useEffect(() => {
    async function fetchClans() {
      if (!user) {
        setUserClans([]);
        return;
      }
      
      setClansLoading(true);
      try {
        const clans = await getUserGroups(user.id);
        setUserClans(clans as UserClan[]);
      } catch (err) {
        console.error('Error fetching user groups:', err);
      } finally {
        setClansLoading(false);
      }
    }
    
    if (!loading) {
      fetchClans();
    }
  }, [user, loading]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPublicGroups() {
      setPublicGroupsLoading(true);
      try {
        const response = await fetch('/api/groups/public', { cache: 'no-store' });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to load public groups (${response.status})`);
        }

        const payload = (await response.json()) as { groups?: PublicGroup[] };

        if (isMounted) {
          setPublicGroups((payload.groups || []) as PublicGroup[]);
        }
      } catch (err) {
        console.error('Error fetching public groups:', err);
        if (isMounted) {
          setPublicGroups([]);
        }
      } finally {
        if (isMounted) {
          setPublicGroupsLoading(false);
        }
      }
    }

    fetchPublicGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = profile?.display_name || profile?.discord_username || 'User';

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-orange-400';
      case 'officer': return 'text-purple-400';
      default: return 'text-cyan-400';
    }
  };

  if (isLoading) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-grid-pattern">
      {/* Header - fixed at top */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/events"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
            title={t('home.publicEventsLink')}
          >
            <Sword size={18} className="group-hover:text-indigo-400 transition-colors" />
            <span className="text-sm font-medium hidden sm:inline">{t('home.publicEventsLink')}</span>
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
      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center p-8 min-h-full">
          <LandingHero />
          <LandingClanForm groupName={groupName} setGroupName={setGroupName} user={user} />

      <div className="mt-12 w-full max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 justify-center">
          <Globe className="w-5 h-5 text-cyan-400" />
          {t('home.publicGroupsTitle')}
        </h2>
        {publicGroupsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : publicGroups.length > 0 ? (
          <div className="grid gap-3">
            {publicGroups.map((group) => (
              <Link
                key={group.id}
                href={`/${group.slug}`}
                className="flex items-center justify-between bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-sm border border-slate-700 hover:border-slate-600 rounded-lg p-4 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  {group.group_icon_url ? (
                    <Image
                      src={group.group_icon_url}
                      alt={group.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800"
                    />
                  ) : (
                    <Users className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                  )}
                  <div>
                    <span className="text-white font-medium group-hover:text-orange-300 transition-colors">
                      {group.name}
                    </span>
                    {group.public_description && (
                      <p className="text-sm text-slate-400 mt-1">
                        {group.public_description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-slate-400">
                  {group.recruitment_open ? t('home.openRecruitmentStatus') : t('home.viewGroupStatus')}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-4">
            {t('home.noPublicGroups')}
          </p>
        )}
      </div>

      {/* User's clans section - show for logged in users */}
      {user && (
        <div className="mt-16 w-full max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
            {t('home.yourClans')}
          </h2>
          {clansLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : userClans.length > 0 ? (
            <div className="grid gap-3">
              {userClans.map((group) => (
                <Link
                  key={group.id}
                  href={`/${group.slug}`}
                  className="flex items-center justify-between bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-sm border border-slate-800/50 hover:border-indigo-500/30 rounded-xl p-4 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {group.group_icon_url ? (
                      <Image
                        src={group.group_icon_url}
                        alt={group.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-800 group-hover:border-indigo-500/50 transition-colors"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center group-hover:border-indigo-500/30 transition-colors">
                        <Users className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    )}
                    <span className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                      {group.name}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${getRoleColor(group.role)}`}>
                    {t(`clan.${group.role}`)}
                    {group.isCreator && ` (${t('clan.creator')})`}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-4">
              {t('home.noClans')}
            </p>
          )}
        </div>
      )}

      <LandingFeatureHighlights />


        </div>
      </main>
      
      {/* Footer at the bottom */}
      <div className="shrink-0">
        <InlineFooter />
      </div>
    </div>
  );
}

