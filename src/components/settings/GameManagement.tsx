'use client';

import { useState, useEffect } from 'react';
import { Archive, ArchiveRestore, Loader2, Check, AlertCircle } from 'lucide-react';
import { getGroupGames, archiveGameForGroup, unarchiveGameForGroup } from '@/lib/group-games';
import { getAllGames } from '@/lib/games';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';

interface GameManagementProps {
  groupId: string;
  onUpdate?: () => void;
}

interface GameStatus {
  slug: string;
  name: string;
  icon: string;
  archived: boolean;
}

export function GameManagement({ groupId, onUpdate }: GameManagementProps) {
  const [games, setGames] = useState<GameStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { hasPermission, loading: permissionsLoading } = usePermissions(groupId);
  const { t } = useLanguage();
  const canEditSettings = hasPermission('settings_edit');

  const fetchGameStatuses = async () => {
    setLoading(true);
    try {
      // Get all active games
      const activeGames = await getGroupGames(groupId, false);
      // Get all games including archived
      const allGames = await getGroupGames(groupId, true);
      
      const allGamesList = getAllGames();
      
      // Build status for each game the group has enabled
      const gameStatuses: GameStatus[] = allGamesList
        .filter(game => allGames.includes(game.id))
        .map(game => ({
          slug: game.id,
          name: game.name,
          icon: game.icon,
          archived: !activeGames.includes(game.id),
        }));
      
      setGames(gameStatuses);
    } catch (err) {
      console.error('Error fetching game statuses:', err);
      setErrorMessage(t('gameManagement.loadError') || 'Failed to load game statuses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchGameStatuses();
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupId]);

  const handleArchive = async (gameSlug: string, gameName: string) => {
    if (!canEditSettings) {
      setErrorMessage(t('gameManagement.noPermission') || 'You do not have permission to manage games.');
      return;
    }

    setActionInProgress(gameSlug);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const success = await archiveGameForGroup(groupId, gameSlug);
      if (success) {
        setSuccessMessage(t('gameManagement.archivedSuccess', { gameName }) || `${gameName} has been archived`);
        await fetchGameStatuses();
        onUpdate?.();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(t('gameManagement.archiveFailed', { gameName }) || `Failed to archive ${gameName}`);
      }
    } catch (err) {
      setErrorMessage(t('gameManagement.archiveError', { gameName }) || `Error archiving ${gameName}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUnarchive = async (gameSlug: string, gameName: string) => {
    if (!canEditSettings) {
      setErrorMessage(t('gameManagement.noPermission') || 'You do not have permission to manage games.');
      return;
    }

    setActionInProgress(gameSlug);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const success = await unarchiveGameForGroup(groupId, gameSlug);
      if (success) {
        setSuccessMessage(t('gameManagement.restoredSuccess', { gameName }) || `${gameName} has been restored`);
        await fetchGameStatuses();
        onUpdate?.();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage(t('gameManagement.restoreFailed', { gameName }) || `Failed to restore ${gameName}`);
      }
    } catch (err) {
      setErrorMessage(t('gameManagement.restoreError', { gameName }) || `Error restoring ${gameName}`);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('gameManagement.title') || 'Game Management'}</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{t('gameManagement.title') || 'Game Management'}</h3>
        <p className="text-slate-400 text-sm">{t('gameManagement.noGames') || 'No games configured for this group.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-2">{t('gameManagement.title') || 'Game Management'}</h3>
      <p className="text-slate-400 text-sm mb-4">
        {t('gameManagement.description') || 'Archive games to hide them from the UI and prevent updates, while preserving all data.'}
      </p>

      {!canEditSettings && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
          <AlertCircle size={16} />
          {t('gameManagement.noPermission') || 'You do not have permission to manage games.'}
        </div>
      )}

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      {/* Games List */}
      <div className="space-y-3">
        {games.map((game) => (
          <div
            key={game.slug}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
              game.archived
                ? 'bg-slate-800/30 border-slate-700/50 opacity-60'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{game.icon}</span>
              <div>
                <div className="font-medium text-white">{game.name}</div>
                {game.archived && (
                  <div className="text-xs text-slate-500 mt-0.5">{t('common.archived') || 'Archived'}</div>
                )}
              </div>
            </div>

            <button
              onClick={() =>
                game.archived
                  ? handleUnarchive(game.slug, game.name)
                  : handleArchive(game.slug, game.name)
              }
              disabled={actionInProgress === game.slug || !canEditSettings}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                game.archived
                  ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                  : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {actionInProgress === game.slug ? (
                <Loader2 size={16} className="animate-spin" />
              ) : game.archived ? (
                <>
                  <ArchiveRestore size={16} />
                  {t('gameManagement.restore') || 'Restore'}
                </>
              ) : (
                <>
                  <Archive size={16} />
                  {t('gameManagement.archive') || 'Archive'}
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        <strong>{t('gameManagement.noteLabel') || 'Note:'}</strong> {t('gameManagement.note') || 'Archiving a game hides it from navigation and prevents any updates, but all characters, ships, and other data remain in the database and can be restored at any time.'}
      </div>
    </div>
  );
}
