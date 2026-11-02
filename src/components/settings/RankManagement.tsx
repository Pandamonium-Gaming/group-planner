'use client';

import { Users } from 'lucide-react';
import { GroupRole } from '@/lib/permissions';
import { getGameConfig } from '@/config';
import { useProcessingSet } from '@/hooks/useProcessingSet';

interface RankManagementProps {
  members: Array<{
    id: string;
    user_id: string;
    role: string | null;
    guild_rank: string | null;
    is_creator: boolean;
    user: { display_name: string | null; discord_username: string | null; discord_avatar: string | null } | null;
  }>;
  onUpdateRank?: (id: string, rank: string | null) => Promise<void>;
  currentUserId: string;
  currentUserRole: GroupRole;
  gameSlug: string;
  ranks?: Array<{
    id: string;
    name: string;
    hierarchy?: number;
  }>;
}

export function RankManagement({
  members,
  onUpdateRank,
  currentUserId,
  currentUserRole,
  gameSlug,
  ranks,
}: RankManagementProps) {
  const { processing, add, remove } = useProcessingSet();
  const gameConfig = getGameConfig(gameSlug);
  const defaultRanks = (gameConfig as any)?.ranks || [];
  const gameRanks = ranks && ranks.length > 0 ? ranks : defaultRanks;

  const handleRankUpdate = async (memberId: string, newRank: string) => {
    if (!onUpdateRank) return;
    add(memberId);
    try {
      await onUpdateRank(memberId, newRank || null);
    } finally {
      remove(memberId);
    }
  };

  const canEditMemberRank = (memberUserId: string, memberRole: string | null): boolean => {
    // Only admins can edit their own rank.
    if (memberUserId === currentUserId && currentUserRole !== 'admin') return false;
    
    // Admins can edit any rank
    if (currentUserRole === 'admin') return true;
    
    // Officers can edit ranks of members and trials
    if (currentUserRole === 'officer') {
      return memberRole === 'member' || memberRole === 'trial';
    }
    
    // Members and trials cannot edit ranks
    return false;
  };

  const getRankHierarchy = (rankId: string | null): number => {
    if (!rankId) return 0;
    const rank = gameRanks.find((r: any) => r.id === rankId);
    return rank?.hierarchy || 0;
  };

  const getCurrentUserRankHierarchy = (): number => {
    const currentUserMember = members.find(m => m.user_id === currentUserId);
    return getRankHierarchy(currentUserMember?.guild_rank || null);
  };

  const sortedMembers = members
    .slice()
    .sort((a, b) => {
      const rankDiff = getRankHierarchy(b.guild_rank) - getRankHierarchy(a.guild_rank);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const nameA = (a.user?.display_name || a.user?.discord_username || '').toLowerCase();
      const nameB = (b.user?.display_name || b.user?.discord_username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="text-blue-400" size={20} />
          Game Rank Management ({members.length} members)
        </h3>
        
        <div className="text-sm text-slate-400 mb-4">
          Manage game-specific ranks for members. Role management is in Group Settings.
        </div>

        <div className="space-y-2">
          {sortedMembers.map((member) => {
            const canEdit = canEditMemberRank(member.user_id, member.role);
            const isCurrentUser = member.user_id === currentUserId;
            const currentUserRankHierarchy = getCurrentUserRankHierarchy();
            const memberRankHierarchy = getRankHierarchy(member.guild_rank);

            return (
              <div
                key={member.id}
                className="bg-slate-800/60 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {member.user?.discord_avatar ? (
                      <img
                        src={member.user.discord_avatar}
                        alt=""
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {member.user?.display_name || member.user?.discord_username || 'Unknown User'}
                        {isCurrentUser && <span className="text-slate-400 ml-2">(You)</span>}
                      </div>
                      <div className="text-xs text-slate-400 capitalize">
                        {member.role || 'member'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Rank Selector */}
                    {onUpdateRank && gameRanks.length > 0 && (
                      <select
                        value={member.guild_rank || ''}
                        onChange={(e) => handleRankUpdate(member.id, e.target.value)}
                        disabled={!canEdit || processing.has(member.id)}
                        className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                      >
                        <option value="">No Rank</option>
                        {gameRanks
                          .slice()
                          .sort((a: any, b: any) => (b.hierarchy || 0) - (a.hierarchy || 0))
                          .map((rank: any) => {
                          const disabled = canEdit && currentUserRole !== 'admin' && rank.hierarchy >= currentUserRankHierarchy && rank.hierarchy > memberRankHierarchy;
                          return (
                            <option key={rank.id} value={rank.id} disabled={disabled}>
                              {rank.name}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
