import Image from 'next/image';
import { Clock, Users } from 'lucide-react';
import { ROLE_CONFIG, GroupRole } from '@/lib/permissions';
import { getGameConfig } from '@/config';
import { useLanguage } from '@/contexts/LanguageContext';

type GameRank = {
  id: string;
  name: string;
  hierarchy?: number;
};

type GameConfig = {
  professions?: {
    ranks?: Record<string, { name: string }>;
  };
  ranks?: GameRank[];
};

type GameUser = {
  display_name: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
};

type GroupMember = {
  id: string;
  user_id: string;
  role: string | null;
  guild_rank: string | null;
  is_creator: boolean;
  user: GameUser | null;
};

interface ManageTabProps {
  members: GroupMember[];
  pendingMembers: GroupMember[];
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onUpdateRole?: (id: string, role: GroupRole) => Promise<void>;
  onUpdateRank?: (id: string, rank: string | null) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
  currentUserId: string;
  currentUserRole: GroupRole;
  gameSlug?: string;
  t: (key: string) => string;
}

export function ManageTab({
  members,
  pendingMembers,
  onAccept,
  onReject,
  onUpdateRole,
  onUpdateRank,
  onRemove,
  currentUserId,
  currentUserRole,
  gameSlug = 'aoc',
  t: tProp,
}: ManageTabProps) {
  const { t: tContext } = useLanguage();
  const t = tProp || tContext;
  const gameConfig = getGameConfig(gameSlug) as GameConfig;
  
  // Convert ranks to array format (handle both AoC and Star Citizen structures)
  let gameRanks: GameRank[] = [];
  
  // Star Citizen: ranks is an array
  if (Array.isArray(gameConfig?.ranks)) {
    gameRanks = (gameConfig?.ranks || []) as GameRank[];
  } 
  // AoC: ranks is in professions.ranks as an object
  else {
    const ranksObj = (gameConfig?.professions?.ranks || {}) as Record<string, {name: string}>;
    gameRanks = Object.entries(ranksObj).map(([id, data]) => ({
      id,
      name: data.name,
      hierarchy: parseInt(id, 10)
    }));
  }
  
  // Helper to get rank hierarchy level
  const getRankHierarchy = (rankId: string | null): number => {
    if (!rankId) return 0;
    const rank = gameRanks.find((r: GameRank) => r.id === rankId);
    return rank?.hierarchy || 0;
  };

  // Helper to check if current user can edit member's rank
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

  // Helper to get current user's rank hierarchy
  const getCurrentUserRankHierarchy = (): number => {
    const currentUserMember = members.find(m => m.user_id === currentUserId);
    return getRankHierarchy(currentUserMember?.guild_rank || null);
  };

  return (
    <div className="space-y-6">
      {/* Pending Applications */}
      {pendingMembers.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="text-yellow-400" size={20} />
            {t('members.pendingApplications')} ({pendingMembers.length})
          </h2>
          <div className="space-y-2">
            {pendingMembers.map((member) => (
              <div
                key={member.id}
                className="bg-slate-900/80 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {member.user?.discord_avatar ? (
                    <Image
                      src={member.user.discord_avatar}
                      alt={member.user.display_name || 'User avatar'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-slate-700 rounded-full" />
                  )}
                  <span className="text-white">
                    {member.user?.display_name || member.user?.discord_username || 'Unknown'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(member.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm cursor-pointer"
                  >
                    {t('members.accept')}
                  </button>
                  <button
                    onClick={() => onReject(member.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm cursor-pointer"
                  >
                    {t('members.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Members */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="text-cyan-400" size={20} />
          {t('members.title')} ({members.length})
        </h2>
        <div className="space-y-2">
          {(() => {
            // Sort members by game rank hierarchy (highest first), then display name.

            const getMemberRoleConfig = (member: { role: string | null; is_creator: boolean }) => {
              if (member.is_creator) return ROLE_CONFIG.admin;
              const validRole = (role: string | null): role is GroupRole =>
                role !== null && Object.prototype.hasOwnProperty.call(ROLE_CONFIG, role);
              const roleKey: GroupRole = validRole(member.role) ? member.role : 'member';
              return ROLE_CONFIG[roleKey];
            };

            return members
              .slice()
              .sort((a, b) => {
                const rankDiff = getRankHierarchy(b.guild_rank) - getRankHierarchy(a.guild_rank);
                if (rankDiff !== 0) return rankDiff;
                const nameA = (a.user?.display_name || a.user?.discord_username || '').toLowerCase();
                const nameB = (b.user?.display_name || b.user?.discord_username || '').toLowerCase();
                return nameA.localeCompare(nameB);
              })
              .map((member) => {
                const roleConfig = getMemberRoleConfig(member);
                return (
                  <div
                    key={member.id}
                    className={[
                      "bg-slate-900/80",
                      "backdrop-blur-sm",
                      "rounded-lg",
                      "border",
                      roleConfig.borderColor,
                      "transition-all",
                      "duration-300",
                      "hover:border-slate-600",
                      "p-4",
                      "flex",
                      "items-center",
                      "justify-between"
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      {/* Colored dot for role */}
                      <span className={roleConfig.color}>{String.fromCharCode(9679)}</span>
                    {member.user?.discord_avatar ? (
                      <Image
                        src={member.user.discord_avatar}
                        alt={member.user.display_name || 'User avatar'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-700 rounded-full" />
                    )}
                    <div>
                      <span className="text-white">
                        {member.user?.display_name || member.user?.discord_username || 'Unknown'}
                      </span>
                      <span className={`ml-2 text-sm ${roleConfig.color}`}>
                        {member.role}{member.is_creator && ' (creator)'}
                      </span>
                    </div>
                  </div>
                  {(onUpdateRole || onUpdateRank || onRemove) && (
                    <div className="flex items-center gap-2">
                      {onUpdateRole && member.user_id !== currentUserId && (
                        <select
                          value={member.role || 'member'}
                          onChange={(e) => onUpdateRole(member.id, e.target.value as GroupRole)}
                          className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white text-sm cursor-pointer"
                          title={t('members.changeRole')}
                        >
                          {Object.entries(ROLE_CONFIG)
                            .filter(([role]) => role !== 'pending')
                            .filter(([role]) => {
                              // Only allow managing roles below your own
                              if (currentUserRole === 'admin') return true;
                              if (currentUserRole === 'officer') return ['member', 'trial'].includes(role);
                              return false;
                            })
                            .map(([role, config]) => (
                              <option
                                key={role}
                                value={role}
                                title={config.description}
                              >
                                {t(`clan.${role}`) || config.label}
                              </option>
                            ))}
                        </select>
                      )}

                      {onUpdateRank && gameRanks.length > 0 && (
                        canEditMemberRank(member.user_id, member.role) ? (
                          <select
                            value={member.guild_rank || ''}
                            onChange={(e) => onUpdateRank(member.id, e.target.value || null)}
                            className="bg-slate-800 border border-slate-600 rounded px-3 py-1 text-white text-sm cursor-pointer"
                            title="Guild Rank"
                          >
                            <option value="">{t('members.noRank')}</option>
                            {gameRanks
                              .slice()
                              .sort((a: GameRank, b: GameRank) => (b.hierarchy || 0) - (a.hierarchy || 0))
                              .filter((rank: GameRank) => {
                                // Admins can assign any rank
                                if (currentUserRole === 'admin') return true;
                                
                                // Officers can assign ranks below their own rank
                                if (currentUserRole === 'officer') {
                                  const currentUserRankLevel = getCurrentUserRankHierarchy();
                                  const rankLevel = rank.hierarchy || 0;
                                  return rankLevel < currentUserRankLevel;
                                }
                                
                                return false;
                              })
                              .map((rank: GameRank) => (
                                <option key={rank.id} value={rank.id}>
                                  {rank.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <div className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-slate-400 text-sm">
                            {member.guild_rank 
                              ? gameRanks.find((r: GameRank) => r.id === member.guild_rank)?.name || 'Unknown Rank'
                              : t('members.noRank')}
                          </div>
                        )
                      )}

                      {onRemove && (
                        <button
                          onClick={() => onRemove(member.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm cursor-pointer"
                        >
                          {t('members.remove')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )});
          })()}
        </div>
      </div>
    </div>
  );}
