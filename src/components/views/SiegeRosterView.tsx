'use client';

import { GuildRankBadge, GuildRankText } from '@/components/characters/GuildRankBadge';

import { useState } from 'react';
import { Swords, Users, CheckCircle, Clock, UserPlus, Crown, Calendar } from 'lucide-react';
import { 
  SiegeEventWithRoster, 
  SiegeRole,
  CharacterWithProfessions,
  SIEGE_TYPE_CONFIG, 
  SIEGE_ROLE_CONFIG 
} from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

interface SiegeRosterViewProps {
  siege: SiegeEventWithRoster;
  characters: CharacterWithProfessions[]; // User's characters for signup
  onSignUp?: (role: SiegeRole, characterId: string) => void;
  onWithdraw?: (characterId: string) => void;
  onConfirm?: (rosterId: string) => void;
  onCheckIn?: (rosterId: string) => void;
  isOfficer?: boolean;
}

const SIEGE_ROLES: SiegeRole[] = ['frontline', 'ranged', 'healer', 'siege_operator', 'scout', 'reserve'];

export function SiegeRosterView({
  siege,
  characters,
  onSignUp,
  onWithdraw,
  onConfirm,
  onCheckIn,
}: SiegeRosterViewProps) {
  const { t } = useLanguage();
  const { hasPermission } = usePermissions(siege.group_id);
  const [selectedRole, setSelectedRole] = useState<SiegeRole | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');

  const typeConfig = SIEGE_TYPE_CONFIG[siege.siege_type];
  const startsAt = new Date(siege.starts_at);
  const isUpcoming = startsAt > new Date();

  // Get roster counts by role
  const rosterByRole = SIEGE_ROLES.reduce((acc, role) => {
    acc[role] = siege.roster.filter((r) => r.role === role);
    return acc;
  }, {} as Record<SiegeRole, typeof siege.roster>);

  // Get role requirements
  const roleNeeded: Record<SiegeRole, number> = {
    frontline: siege.frontline_needed,
    ranged: siege.ranged_needed,
    healer: siege.healer_needed,
    siege_operator: siege.siege_operator_needed,
    scout: siege.scout_needed,
    reserve: siege.reserve_needed,
  };

  // Check if user's characters are signed up
  const signedUpCharacterIds = siege.roster
    .filter((r) => characters.some((c) => c.id === r.character_id))
    .map((r) => r.character_id);

  const availableCharacters = characters.filter((c) => !signedUpCharacterIds.includes(c.id));

  const totalSignups = siege.roster.length;
  const totalNeeded = Object.values(roleNeeded).reduce((sum, n) => sum + n, 0);
  const confirmedCount = siege.roster.filter((r) => r.status === 'confirmed' || r.status === 'checked_in').length;

  const handleSignUp = () => {
    if (selectedRole && selectedCharacter && onSignUp) {
      onSignUp(selectedRole, selectedCharacter);
      setSelectedRole(null);
      setSelectedCharacter('');
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`p-4 border-b border-slate-700 ${typeConfig.isDefence ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{typeConfig.icon}</span>
              <h3 className="text-lg font-bold text-white">{siege.title}</h3>
              {siege.is_cancelled && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                  {t('siege.cancelled')}
                </span>
              )}
              {siege.result && (
                <span className={`px-2 py-0.5 text-xs rounded ${
                  siege.result === 'victory' ? 'bg-green-500/20 text-green-400' :
                  siege.result === 'defeat' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {t(`siege.result.${siege.result}`)}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400 flex items-center gap-3">
              <span>{t(`siege.types.${siege.siege_type}`)}</span>
              <span>•</span>
              <span>{siege.target_name}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-slate-300">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {startsAt.toLocaleDateString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })} {startsAt.toLocaleTimeString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-400">{t('siege.roster')}</span>
            <span className="text-white font-medium">{totalSignups}/{totalNeeded}</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
            {SIEGE_ROLES.map((role) => {
              const count = rosterByRole[role].length;
              const needed = roleNeeded[role];
              if (needed === 0) return null;
              const width = (needed / totalNeeded) * 100;
              const fillPercent = Math.min(100, (count / needed) * 100);
              const config = SIEGE_ROLE_CONFIG[role];
              return (
                <div
                  key={role}
                  className="h-full relative"
                  style={{ width: `${width}%` }}
                  title={`${config.label}: ${count}/${needed}`}
                >
                  <div
                    className={`h-full ${
                      role === 'frontline' ? 'bg-red-500' :
                      role === 'ranged' ? 'bg-orange-500' :
                      role === 'healer' ? 'bg-green-500' :
                      role === 'siege_operator' ? 'bg-purple-500' :
                      role === 'scout' ? 'bg-cyan-500' :
                      'bg-slate-500'
                    }`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
            <CheckCircle className="w-3 h-3" />
            {confirmedCount} {t('siege.confirmed')}
          </div>
        </div>
      </div>

      {/* Role Sections */}
      <div className="p-4 space-y-4">
        {SIEGE_ROLES.map((role) => {
          const config = SIEGE_ROLE_CONFIG[role];
          const roster = rosterByRole[role];
          const needed = roleNeeded[role];
          const isFull = roster.length >= needed;

          return (
            <div key={role} className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{config.icon}</span>
                  <span className={`font-medium ${config.color}`}>
                    {t(`siege.roles.${role}`)}
                  </span>
                </div>
                <span className={`text-sm ${isFull ? 'text-green-400' : 'text-slate-400'}`}>
                  {roster.length}/{needed}
                </span>
              </div>

              {roster.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roster.map((entry) => {
                    const isOwn = characters.some((c) => c.id === entry.character_id);
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                          entry.status === 'checked_in' ? 'bg-green-500/20 text-green-400' :
                          entry.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {entry.is_leader && <Crown className="w-3 h-3 text-amber-400" />}
                        <span>{entry.character?.name || t('siege.unknown')}</span>
                        <GuildRankBadge characterId={entry.character_id} />
                        {entry.status === 'checked_in' && <CheckCircle className="w-3 h-3" />}
                        {entry.status === 'confirmed' && <Clock className="w-3 h-3" />}
                        
                        {/* Actions for own entries */}
                        {isOwn && isUpcoming && !siege.is_cancelled && (
                          <div className="flex gap-1 ml-1">
                            {entry.status === 'signed_up' && onConfirm && (
                              <button
                                onClick={() => onConfirm(entry.id)}
                                className="text-blue-400 hover:text-blue-300 cursor-pointer"
                                title={t('siege.confirm')}
                              >
                                ✓
                              </button>
                            )}
                            {onWithdraw && (
                              <button
                                onClick={() => onWithdraw(entry.character_id)}
                                className="text-red-400 hover:text-red-300 cursor-pointer"
                                title={t('siege.withdraw')}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Officer check-in (permission-based) */}
                        {hasPermission('siege_edit_rosters') && entry.status === 'confirmed' && onCheckIn && (
                          <button
                            onClick={() => onCheckIn(entry.id)}
                            className="text-green-400 hover:text-green-300 cursor-pointer ml-1"
                            title={t('siege.checkIn')}
                          >
                            ✓✓
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">
                  {t('siege.noSignups')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sign Up Section */}
      {isUpcoming && !siege.is_cancelled && availableCharacters.length > 0 && onSignUp && (
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">{t('siege.signUp')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label={t('siege.selectCharacter')}
            >
              <option value="">{t('siege.selectCharacter')}</option>
              {availableCharacters.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                  <GuildRankText characterId={char.id} />
                </option>
              ))}
            </select>
            <select
              value={selectedRole || ''}
              onChange={(e) => setSelectedRole(e.target.value as SiegeRole)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label={t('siege.selectRole')}
            >
              <option value="">{t('siege.selectRole')}</option>
              {SIEGE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {SIEGE_ROLE_CONFIG[role].icon} {t(`siege.roles.${role}`)}
                </option>
              ))}
            </select>
            <button
              onClick={handleSignUp}
              disabled={!selectedCharacter || !selectedRole}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('siege.joinSiege')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
