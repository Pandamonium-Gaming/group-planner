
"use client";
import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, ChevronRight, Home, Plus, Trash2, Shield, Loader, Archive } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { GameIcon } from '@/components/common/GameIcon';
import { createGroup, getGroupBySlug } from '@/lib/auth';
import { useGroupMembership } from '@/hooks/useGroupMembership';
import { usePermissions } from '@/hooks/usePermissions';
import { getGroupGamesWithStatus, addGameToGroup, removeGameFromGroup } from '@/lib/group-games';
import { getAllGames } from '@/lib/games';
import { ClanLoadingScreen } from '@/components/screens/ClanLoadingScreen';
import { ClanErrorScreen } from '@/components/screens/ClanErrorScreen';
import { ClanLoginScreen } from '@/components/screens/ClanLoginScreen';
import { InlineFooter } from '@/components/layout/Footer';


type GroupData = {
  id: string;
  slug: string;
  name: string;
  group_icon_url?: string | null;
};

export default function GroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group: groupSlug } = use(params);
  const { user, profile, loading: authLoading, signIn, signOut } = useAuthContext();
  const { t } = useLanguage();
  const ALL_AVAILABLE_GAMES = getAllGames().map(g => ({ slug: g.id, name: g.name, icon: g.icon, iconUrl: g.iconUrl, description: g.description }));

  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [groupExists, setGroupExists] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledGames, setEnabledGames] = useState<string[]>([]); // Start empty, load from database
  const [gamesWithStatus, setGamesWithStatus] = useState<Array<{ slug: string; archived: boolean }>>([]);
  const [showAddGame, setShowAddGame] = useState(false);
  const [addingGame, setAddingGame] = useState<string | null>(null);
  const [removingGame, setRemovingGame] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Load group games from database
  const loadGroupGames = async (gid: string) => {
    try {
      const gamesStatus = await getGroupGamesWithStatus(gid);
      if (gamesStatus.length === 0) {
        const allGames = getAllGames();
        setEnabledGames(allGames.map((game) => game.id));
        setGamesWithStatus(allGames.map((game) => ({ slug: game.id, archived: false })));
        return;
      }

      setEnabledGames(gamesStatus.map(g => g.game_slug));
      setGamesWithStatus(gamesStatus.map(g => ({ slug: g.game_slug, archived: g.archived })));
    } catch (err) {
      console.error('Error loading group games:', err);
      setEnabledGames([]);
      setGamesWithStatus([]);
    }
  };

  // Fetch group data
  useEffect(() => {
    async function checkGroup() {
      setCheckError(null);
      setLoading(true);
      try {
        // Add timeout to prevent infinite hanging
        const timeoutPromise = new Promise<{ id: string } | null>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout checking group')), 15000);
        });

        const group = await Promise.race([
          getGroupBySlug(groupSlug),
          timeoutPromise
        ]) as GroupData | null;
        if (group) {
          setGroupId(group.id);
          setGroupData(group);
          setGroupExists(true);
          
          // Load enabled games from database
          await loadGroupGames(group.id);
        } else {
          setGroupExists(false);
        }
      } catch (err) {
        console.error('Error checking group:', err);
        setCheckError(err instanceof Error ? err.message : 'Failed to check group');
      } finally {
        setLoading(false);
      }
    }
    checkGroup();
  }, [groupSlug]);

  // Add game to group
  const handleAddGame = async (gameSlug: string) => {
    if (!groupId) return;
    
    setAddingGame(gameSlug);
    try {
      const success = await addGameToGroup(groupId, gameSlug);
      if (success) {
        setEnabledGames([...enabledGames, gameSlug]);
        setShowAddGame(false);
      }
    } catch (err) {
      console.error('Error adding game:', err);
    } finally {
      setAddingGame(null);
    }
  };

  // Remove game from group
  const handleRemoveGame = async (gameSlug: string) => {
    if (!groupId) return;
    
    setRemovingGame(gameSlug);
    try {
      const success = await removeGameFromGroup(groupId, gameSlug);
      if (success) {
        setEnabledGames(enabledGames.filter(g => g !== gameSlug));
      }
    } catch (err) {
      console.error('Error removing game:', err);
    } finally {
      setRemovingGame(null);
    }
  };

  // Get membership info to check permissions
  const {
    membership,
    loading: membershipLoading,
    apply,
  } = useGroupMembership(groupId, user?.id || null);

  const { hasPermission } = usePermissions(groupId || undefined);
  const canEditSettings = hasPermission('settings_edit');

  const displayName = profile?.display_name || profile?.discord_username || 'User';

  // Create group handler
  const handleCreateGroup = async () => {
    if (!user) return;
    
    setCreating(true);
    setCreateError(null);
    
    try {
      const displayGroupName = groupSlug.charAt(0).toUpperCase() + groupSlug.slice(1).replace(/-/g, ' ');
      await createGroup(groupSlug, displayGroupName, user.id);
      window.location.reload();
    } catch (err) {
      console.error('Error creating group:', err);
      const error = err as { code?: string; message?: string };
      setCreateError(error.code === '23505' ? 'This group name is already taken' : (error.message || 'Failed to create group'));
    } finally {
      setCreating(false);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return <ClanLoadingScreen message={t('common.loading')} />;
  }

  // Check Error state (Timeout / Connection)
  if (checkError) {
    return (
      <ClanErrorScreen
        title={t('group.connectionError')}
        message={t('group.connectionErrorMessage')}
        error={checkError}
        retryLabel={t('common.retryConnection')}
        onRetry={() => window.location.reload()}
        homeLabel={t('common.returnHome')}
      />
    );
  }

  // Not logged in
  if (!user) {
    return (
      <ClanLoginScreen
        title={t('group.loginRequired')}
        message={t('group.signInToAccess', { name: groupSlug })}
        onSignIn={() => {
          localStorage.setItem('authRedirectTo', `/${groupSlug}`);
          signIn();
        }}
        signInLabel={t('common.continueWithDiscord')}
        homeLabel={t('common.returnHome')}
      />
    );
  }

  // Group doesn't exist - offer to create it
  if (!groupExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center max-w-md mx-auto p-6">
          <Plus className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t('clan.createGroupPrompt', { name: groupSlug })}</h2>
          <p className="text-slate-400 mb-6">
            {t('clan.createGroupDescription')}
          </p>
          
          {createError && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {createError}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white transition-all cursor-pointer"
            >
              <Home className="w-5 h-5" />
              {t('common.returnHome')}
            </Link>
            <button
              onClick={handleCreateGroup}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 rounded-xl text-white font-medium transition-all cursor-pointer shadow-lg shadow-indigo-500/25"
            >
              {creating ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Group exists - show game selector
  return (
    <div className="flex flex-col min-h-screen bg-grid-pattern">
      {/* Header */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer"
              title="Home"
            >
              <Home className="w-5 h-5" />
            </Link>
            {groupData?.group_icon_url && (
              <Image
                src={groupData.group_icon_url}
                alt={groupData.name}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-slate-700"
              />
            )}
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-white">{groupData?.name || groupSlug}</h1>
              <p className="text-xs text-slate-400 hidden sm:block">{t('common.selectGame')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!membershipLoading && membership?.role === 'admin' && (
              <Link
                href={`/${groupSlug}/settings`}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Group Settings"
              >
                <Shield className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">{t('common.settings')}</span>
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">{displayName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Not a member - show apply button */}
      {!membershipLoading && !membership && (
        <main className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <Shield className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">{t('clan.joinClan')}</h2>
            <p className="text-slate-400 mb-6">
              {t('clan.applyDescription', { name: groupData?.name || groupSlug })}
            </p>
            <button
              onClick={apply}
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              {t('clan.applyToJoin')}
            </button>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                {t('common.returnHome')}
              </Link>
            </div>
          </div>
        </main>
      )}

      {/* Pending approval */}
      {!membershipLoading && membership?.role === 'pending' && (
        <main className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-slate-800/50 border border-yellow-500/30 rounded-xl p-8 text-center">
            <Loader className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-3">{t('clan.applicationPending')}</h2>
            <p className="text-slate-400 mb-6">
              {t('clan.pendingApproval', { name: groupData?.name || groupSlug })}
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                {t('common.returnHome')}
              </Link>
            </div>
          </div>
        </main>
      )}

      {/* Member - show games */}
      {!membershipLoading && membership && membership.role !== 'pending' && (
        <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-8">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">{t('group.availableGames')}</h2>
            <p className="text-slate-400 text-sm">{t('group.availableGamesDesc')}</p>
          </div>
          {canEditSettings && enabledGames.length > 0 && (
            <button
              onClick={() => setShowAddGame(!showAddGame)}
              className="self-start flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/25 text-sm font-medium"
              title="Add a game to this group"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{t('group.addGame')}</span>
            </button>
          )}
        </div>

        {/* Add game dialog */}
        {showAddGame && canEditSettings && (
          <div className="mb-6 p-4 sm:p-5 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl">
            <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">{t('group.addGamePrompt')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {ALL_AVAILABLE_GAMES.filter(g => !enabledGames.includes(g.slug)).map((game) => (
                <button
                  key={game.slug}
                  onClick={() => handleAddGame(game.slug)}
                  disabled={addingGame === game.slug}
                  className="text-left p-3 sm:p-4 bg-slate-800/40 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <GameIcon 
                      icon={game.icon}
                      iconUrl={game.iconUrl}
                      alt={game.name}
                      size={32}
                    />
                    <span className="text-white font-medium text-sm sm:text-base">{game.name}</span>
                  </div>
                  {addingGame === game.slug && <Loader className="w-4 h-4 text-indigo-400 animate-spin" />}
                </button>
              ))}
            </div>
            {ALL_AVAILABLE_GAMES.every(g => enabledGames.includes(g.slug)) && (
              <p className="text-slate-400 text-sm">{t('group.allGamesEnabled')}</p>
            )}
          </div>
        )}

        {/* Game cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {ALL_AVAILABLE_GAMES.filter(g => enabledGames.includes(g.slug)).map((game) => {
            const gameStatus = gamesWithStatus.find(gs => gs.slug === game.slug);
            const isArchived = gameStatus?.archived || false;
            
            return (
            <div
              key={game.slug}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/40 backdrop-blur-sm text-left hover:border-indigo-500/30 transition-all duration-300"
            >
              {/* Background gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Archived badge */}
              {isArchived && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/40 border border-amber-700/50 rounded-full z-10">
                  <Archive className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">{t('common.archived')}</span>
                </div>
              )}

              {/* Main clickable Link */}
              <Link
                href={`/${groupSlug}/${game.slug}`}
                prefetch={true}
                className="relative flex items-center gap-3 sm:gap-4 p-5 sm:p-6"
              >
                <div className="shrink-0 group/icon">
                  <GameIcon 
                    icon={game.icon}
                    iconUrl={game.iconUrl}
                    alt={game.name}
                    size={80}
                    className="group-hover/icon:scale-105 transition-transform sm:w-24 sm:h-24"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-xl font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1">
                    {game.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 group-hover:text-slate-300 transition-colors line-clamp-2">
                    {game.description}
                  </p>
                </div>

                <div className="shrink-0 text-slate-500 group-hover:text-indigo-400 transition-all transform group-hover:translate-x-1">
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </Link>

              {/* Admin delete button */}
              {canEditSettings && !isArchived && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveGame(game.slug); }}
                  disabled={removingGame === game.slug}
                  className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all z-10"
                  title="Remove this game from the group"
                >
                  {removingGame === game.slug ? (
                    <Loader className="w-4 h-4 text-red-400 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-400" />
                  )}
                </button>
              )}
            </div>
          );
          })}
        </div>

        {enabledGames.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-lg p-8">
              <h3 className="text-xl font-semibold text-white mb-3">{t('group.getStarted')}</h3>
              <p className="text-slate-400 mb-6">
                {canEditSettings 
                  ? t('group.addGameToStart') 
                  : t('group.noGamesContactAdmin')}
              </p>
              {canEditSettings && (
                <button
                  onClick={() => setShowAddGame(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  {t('group.addYourFirstGame')}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      )}

      {/* Footer */}
      <div className="shrink-0">
        <InlineFooter />
      </div>
    </div>
  );
}


