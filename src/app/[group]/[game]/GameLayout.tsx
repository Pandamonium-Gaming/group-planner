'use client';

import { use, ReactNode, useState, useEffect } from 'react';
import { Tab } from '@/components/common/tabs';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGroupData } from '@/hooks/useGroupData';
import { useGroupMembership } from '@/hooks/useGroupMembership';
import { usePermissions } from '@/hooks/usePermissions';
import { useGameArchiveStatus } from '@/hooks/useGameArchiveStatus';
import { ClanLoadingScreen } from '@/components/screens/ClanLoadingScreen';
import { ClanErrorScreen } from '@/components/screens/ClanErrorScreen';
import { ClanLoginScreen } from '@/components/screens/ClanLoginScreen';
import { GroupHeader } from './GroupHeader';
import { ClanTabNav } from '@/components/layout/ClanTabNav';
import { InlineFooter } from '@/components/layout/Footer';
import { ArchivedGameBanner } from '@/components/common/ArchivedGameBanner';
import { ArchiveStatusProvider } from '@/contexts/ArchiveStatusContext';
import { DynamicFavicon } from '@/components/common/DynamicFavicon';
import { Users, Clock, UserPlus } from 'lucide-react';
import { getAllGames } from '@/lib/games';
import { getGroupGamesWithStatus } from '@/lib/group-games';

interface GameLayoutProps {
  params: Promise<{ group: string; game: string }>;
  children: ReactNode;
  activeTab: Tab;
  characterCount?: number;
}

export function GameLayout({ params, children, activeTab, characterCount }: GameLayoutProps) {
  const { group: groupSlug, game: gameSlug } = use(params);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, signIn, signOut } = useAuthContext();
  const { t } = useLanguage();

  const {
    group,
    characters,
    loading: groupLoading,
    error: groupError,
  } = useGroupData(groupSlug, gameSlug);

  const {
    membership,
    loading: membershipLoading,
    apply,
  } = useGroupMembership(group?.id || null, user?.id || null);

  const { hasPermission } = usePermissions(group?.id || undefined);

  const { isArchived: isGameArchived } = useGameArchiveStatus(groupSlug, gameSlug);

  const [enabledGames, setEnabledGames] = useState<Array<{ slug: string; name: string; icon: string; iconUrl?: string; archived: boolean }>>([]);

  const displayName = profile?.display_name || user?.email || 'User';
  const guildIconUrl = group?.group_icon_url || undefined;

  // Fetch game status info
  useEffect(() => {
    async function fetchGames() {
      if (!group?.id) return;
      
      const gameStatuses = await getGroupGamesWithStatus(group.id);
      const allGames = getAllGames();
      
      const gamesWithStatus = allGames
        .map(game => {
          const status = gameStatuses.find(gs => gs.game_slug === game.id);
          return {
            slug: game.id,
            name: game.name,
            icon: game.icon,
            iconUrl: game.iconUrl,
            archived: status?.archived || false
          };
        })
        .filter(game => gameStatuses.some(gs => gs.game_slug === game.slug)); // Only show games that are enabled

      setEnabledGames(gamesWithStatus.length > 0
        ? gamesWithStatus
        : allGames.map((game) => ({
            slug: game.id,
            name: game.name,
            icon: game.icon,
            iconUrl: game.iconUrl,
            archived: false,
          }))
      );
    }
    
    fetchGames();
  }, [group?.id]);

  if (authLoading || groupLoading || membershipLoading) {
    return <ClanLoadingScreen />;
  }

  if (!user) {
    const redirectPath = `${pathname || `/${groupSlug}/${gameSlug}`}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    return (
      <ClanLoginScreen
        title={t('group.loginRequired')}
        message={t('group.signInToAccess', { name: groupSlug })}
        onSignIn={() => {
          localStorage.setItem('authRedirectTo', redirectPath);
          signIn();
        }}
        signInLabel={t('common.continueWithDiscord')}
        homeLabel={t('common.returnHome')}
      />
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Users className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t('group.joinClan')}</h2>
          <p className="text-slate-400 mb-6">
            {t('group.applyDescription', { name: group?.name || groupSlug })}
          </p>
          <button
            onClick={apply}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-5 h-5" />
            {t('group.applyToJoin')}
          </button>
          <Link
            href="/"
            className="inline-block mt-4 text-slate-400 hover:text-white transition-colors"
          >
            ← {t('common.returnHome')}
          </Link>
        </div>
      </div>
    );
  }

  if (membership.role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t('group.applicationPending')}</h2>
          <p className="text-slate-400 mb-6">
            {t('group.pendingApproval', { name: group?.name || groupSlug })}
          </p>
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400">
            {t('group.accessAfterApproval')}
          </div>
          <Link
            href="/"
            className="inline-block mt-6 text-slate-400 hover:text-white transition-colors"
          >
            ← {t('common.returnHome')}
          </Link>
        </div>
      </div>
    );
  }

  if (groupError) {
    return (
      <ClanErrorScreen 
        title={t('group.errorLoading')}
        message={t('group.connectionErrorMessage')}
        error={groupError}
        retryLabel={t('common.retryConnection')}
        onRetry={() => window.location.reload()}
        homeLabel={t('common.returnHome')}
      />
    );
  }

  const resolvedCharacterCount = characterCount ?? characters.length;

  // Get current game name for the banner
  const currentGame = enabledGames.find(g => g.slug === gameSlug);
  const gameName = currentGame?.name || gameSlug;

  return (
    <ArchiveStatusProvider isGameArchived={isGameArchived}>
      <div className="h-screen flex flex-col overflow-hidden">
        <DynamicFavicon iconUrl={guildIconUrl} />
        {isGameArchived && <ArchivedGameBanner gameName={gameName} />}
        <GroupHeader
          groupName={group?.name || ''}
          groupSlug={groupSlug}
          gameSlug={gameSlug}
          enabledGames={enabledGames}
          characterCount={resolvedCharacterCount}
          role={membership.role || ''}
          displayName={displayName}
          onSignOut={signOut}
          guildIconUrl={guildIconUrl}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 pb-4">
            {children}
          </div>
        </main>

        <div className="shrink-0">
          <ClanTabNav
            canManage={hasPermission('settings_edit')}
            initialTab={activeTab}
            gameSlug={gameSlug}
            groupSlug={groupSlug}
          />
          <InlineFooter />
        </div>
      </div>
    </ArchiveStatusProvider>
  );
}
