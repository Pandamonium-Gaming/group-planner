'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, ArchiveRestore, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';
import { getGroupGames, archiveGameForGroup, unarchiveGameForGroup, deleteGameForGroup } from '@/lib/group-games';
import { getAllGames } from '@/lib/games';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Modal, ModalFooter } from '@/components/ui/Modal';

interface GameManagementProps {
  groupId: string;
  onUpdate?: () => void;
}

const DELETE_ERROR_CODES = [
  'unauthorized',
  'game_forbidden',
  'game_not_found',
  'game_not_archived',
  'game_confirmation',
  'game_last',
  'game_delete',
] as const;

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
  const [deleteTarget, setDeleteTarget] = useState<GameStatus | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { hasPermission, userRole, loading: permissionsLoading } = usePermissions(groupId);
  const { t } = useLanguage();
  const canEditSettings = hasPermission('settings_edit');
  // The server only lets a group admin delete, so officers with a settings_edit override must not see the button.
  const canDeleteGames = canEditSettings && userRole === 'admin';

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

  const openDelete = (game: GameStatus) => {
    setDeleteTarget(game);
    setConfirmText('');
    setDeleteError(null);
  };

  const closeDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setConfirmText('');
    setDeleteError(null);
  }, [deleting]);

  const handleDelete = async () => {
    if (!deleteTarget || deleting || confirmText !== deleteTarget.name) return;
    const { slug, name } = deleteTarget;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteGameForGroup(groupId, slug, confirmText);
      if (result.ok) {
        setDeleteTarget(null);
        setConfirmText('');
        setErrorMessage(null);
        setSuccessMessage(t('gameManagement.deleteSuccess', { gameName: name }));
        setGames((prev) => prev.filter((g) => g.slug !== slug));
        await fetchGameStatuses();
        onUpdate?.();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const known = (DELETE_ERROR_CODES as readonly (string | null)[]).includes(result.code);
        setDeleteError(
          known ? t(`gameManagement.errors.${result.code}`) : t('gameManagement.deleteFailed'),
        );
      }
    } catch {
      setDeleteError(t('gameManagement.deleteFailed'));
    } finally {
      setDeleting(false);
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

            <div className="flex items-center gap-2">
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
              {game.archived && canDeleteGames && (
                <button
                  onClick={() => openDelete(game)}
                  disabled={actionInProgress === game.slug || !canEditSettings}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                  {t('gameManagement.deleteButton')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        <strong>{t('gameManagement.noteLabel') || 'Note:'}</strong> {t('gameManagement.note') || 'Archiving a game hides it from navigation and prevents any updates, but all characters, ships, and other data remain in the database and can be restored at any time.'}
      </div>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={closeDelete}
        title={t('gameManagement.deleteTitle', { gameName: deleteTarget?.name ?? '' })}
        size="md"
      >
        {deleteTarget && (
          <div>
            <p className="text-sm text-slate-300 mb-4">
              {t('gameManagement.deleteBody', { gameName: deleteTarget.name })}
            </p>
            <label htmlFor="delete-game-confirm" className="block text-sm text-slate-300 mb-2">
              {t('gameManagement.deleteConfirmLabel', { gameName: deleteTarget.name })}
            </label>
            <input
              id="delete-game-confirm"
              type="text"
              autoFocus
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleDelete();
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
            />
            {deleteError && (
              <div role="alert" className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle size={16} />
                {deleteError}
              </div>
            )}
            <ModalFooter>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50"
              >
                {t('gameManagement.deleteCancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting || confirmText !== deleteTarget.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t('gameManagement.deleteButton')}
              </button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
}
