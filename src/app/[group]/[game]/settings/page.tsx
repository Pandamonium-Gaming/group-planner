'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGameLayoutContext } from '@/contexts/GameLayoutContext';
import { useGroupMembership } from '@/hooks/useGroupMembership';
import { RankManagement } from '@/components/settings/RankManagement';
import { ClanSettings } from '@/components/settings/ClanSettings';
import { GameRecruitmentSettings } from '@/components/settings/GameRecruitmentSettings';
import { GameRankSettings } from '@/components/settings/GameRankSettings';
import { getGroupBySlug } from '@/lib/auth';
import type { GroupRole } from '@/lib/permissions';
import { ArrowLeft } from 'lucide-react';
import { getConfiguredGameRanks, isGameRankEnabled } from '@/lib/gameRankSettings';

export default function SettingsPage() {
  const { group, groupSlug, gameSlug, userId, hasPermission, membership, refreshGroupData } = useGameLayoutContext();
  const { t } = useLanguage();

  // Settings page needs full membership management functions
  const {
    members,
    canManageMembers,
    updateRank,
  } = useGroupMembership(group?.id || null, userId, gameSlug);

  const canEditSettings = hasPermission('settings_edit');

  const [_guildIconUrl, _setGuildIconUrl] = useState(group?.group_icon_url || '');
  const prevIconUrlRef = useRef<string | undefined>(group?.group_icon_url);

  useEffect(() => {
    const newUrl = group?.group_icon_url || '';
    if (prevIconUrlRef.current !== newUrl) {
      prevIconUrlRef.current = newUrl;
      _setGuildIconUrl(newUrl);
    }
  }, [group?.group_icon_url]);

  async function _refreshGuildIcon() {
    if (!groupSlug) return;
    const latest = await getGroupBySlug(groupSlug);
    if (latest?.group_icon_url) _setGuildIconUrl(latest.group_icon_url);
  }

  if (!group || !userId || !membership) {
    return null;
  }

  const gameHasRanks = isGameRankEnabled(group, gameSlug);
  const configuredRanks = getConfiguredGameRanks(group, gameSlug);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-2">{t('settings.gameSettingsTitle') || `${gameSlug.toUpperCase()} Settings`}</h2>
        <p className="text-sm text-slate-400 mb-3">
          Configure game-specific settings for {gameSlug === 'aoc' ? 'Ashes of Creation' : gameSlug === 'sc' || gameSlug === 'starcitizen' ? 'Star Citizen' : gameSlug === 'ror' ? 'Return of Reckoning' : gameSlug.toUpperCase()}.
        </p>
        <Link 
          href={`/${groupSlug}/settings`}
          className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          View Group-wide Settings
        </Link>
      </div>

      {/* Rank Management - Only for games with member ranks (Star Citizen) */}
      {gameHasRanks && canManageMembers && (
        <RankManagement
          members={members}
          onUpdateRank={updateRank}
          currentUserId={userId}
          currentUserRole={(membership.role || 'member') as GroupRole}
          gameSlug={gameSlug}
          ranks={configuredRanks}
        />
      )}

      {/* Game-Specific Rank Settings */}
      {canEditSettings && group && (
        <GameRankSettings
          groupId={group.id}
          gameSlug={gameSlug}
          group={group}
          onSaved={() => {
            void refreshGroupData();
          }}
        />
      )}

      {/* Game-Specific Discord Settings */}
      {canEditSettings && group && (
        <ClanSettings
          groupId={group.id}
          gameSlug={gameSlug}
          currentAocWebhookUrl={group.aoc_webhook_url || ''}
          currentAocEventsWebhookUrl={group.aoc_events_webhook_url || ''}
          currentScWebhookUrl={group.sc_webhook_url || ''}
          currentScEventsWebhookUrl={group.sc_events_webhook_url || ''}
          currentRorWebhookUrl={group.ror_webhook_url || ''}
          currentRorEventsWebhookUrl={group.ror_events_webhook_url || ''}
          aocAnnouncementRoleId={group.aoc_announcement_role_id || ''}
          aocEventsRoleId={group.aoc_events_role_id || ''}
          scAnnouncementRoleId={group.sc_announcement_role_id || ''}
          scEventsRoleId={group.sc_events_role_id || ''}
          rorAnnouncementRoleId={group.ror_announcement_role_id || ''}
          rorEventsRoleId={group.ror_events_role_id || ''}
        />
      )}

      {/* Game-Specific Recruitment Settings */}
      {canEditSettings && group && (
        <GameRecruitmentSettings groupId={group.id} gameSlug={gameSlug} />
      )}
    </div>
  );
}