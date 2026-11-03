
"use client";
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/Skeleton';

import { useState } from 'react';
import { PartyWithRoster, PartyRole, PARTY_ROLES, CharacterWithProfessions } from '@/lib/types';
import { ARCHETYPES } from '@/lib/characters';
import { ChevronDown, ChevronUp, Users, Trash2, UserPlus, Check, X, Edit2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { GuildRankBadge, GuildRankText } from '@/components/characters/GuildRankBadge';

interface PartyCardProps {
  party: PartyWithRoster;
  characters: CharacterWithProfessions[];
  canManage: boolean;
  onAssign: (characterId: string, role: PartyRole) => Promise<void>;
  onRemove: (characterId: string) => Promise<void>;
  onToggleConfirmed: (characterId: string, confirmed: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit: () => void;
}

function getRoleCounts(party: PartyWithRoster): Record<PartyRole, number> {
  return {
    tank: party.roster.filter(r => r.role === 'tank').length,
    cleric: party.roster.filter(r => r.role === 'cleric').length,
    bard: party.roster.filter(r => r.role === 'bard').length,
    ranged_dps: party.roster.filter(r => r.role === 'ranged_dps').length,
    melee_dps: party.roster.filter(r => r.role === 'melee_dps').length,
  };
}

function getRoleNeeded(party: PartyWithRoster): Record<PartyRole, number> {
  return {
    tank: party.tanks_needed,
    cleric: party.clerics_needed,
    bard: party.bards_needed,
    ranged_dps: party.ranged_dps_needed,
    melee_dps: party.melee_dps_needed,
  };
}

export function PartyCard({
  party,
  characters,
  canManage,
  onAssign,
  onRemove,
  onToggleConfirmed,
  onDelete,
  onEdit,
}: PartyCardProps) {
  // Use permissions for this party's clan
  const { loading, hasPermission, isLeadership, isAdmin } = usePermissions(party.group_id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PartyRole>('ranged_dps');
  const [assigning, setAssigning] = useState(false);
  const { t } = useLanguage();

  const roleCounts = getRoleCounts(party);
  const roleNeeded = getRoleNeeded(party);
  const totalNeeded = party.tanks_needed + party.clerics_needed + party.bards_needed + party.ranged_dps_needed + party.melee_dps_needed;
  const totalFilled = party.roster.length;
  const fillPercent = totalNeeded > 0 ? Math.min(100, (totalFilled / totalNeeded) * 100) : 0;

  // Characters not already in this party
  const availableCharacters = characters.filter(
    c => !party.roster.find(r => r.character_id === c.id)
  );

  const handleAssign = async (characterId: string) => {
    setAssigning(true);
    try {
      await onAssign(characterId, selectedRole);
      setShowAssign(false);
    } finally {
      setAssigning(false);
    }
  };

  // Use the canManage prop passed from parent
  const effectiveCanManage = canManage;

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-orange-400" />
              <h3 className="font-semibold text-white">{party.name}</h3>
            </div>
            {party.description && (
              <span className="text-sm text-slate-400 hidden sm:inline">
                - {party.description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Fill indicator */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    fillPercent >= 100 ? 'bg-green-500' : 
                    fillPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              <span className="text-sm text-slate-400">
                {totalFilled}/{totalNeeded}
              </span>
            </div>

            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {/* Role summary */}
        <div className="flex gap-4 mt-2">
          {(['tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'] as PartyRole[]).map(role => {
            const needed = roleNeeded[role];
            if (needed === 0) return null;
            const filled = roleCounts[role];
            const isFull = filled >= needed;
            
            return (
              <div key={role} className="flex items-center gap-1 text-sm">
                <span>{PARTY_ROLES[role].icon}</span>
                <span className={isFull ? 'text-green-400' : 'text-slate-400'}>
                  {filled}/{needed}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Role sections */}
          {(['tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'] as PartyRole[]).map(role => {
            const needed = roleNeeded[role];
            if (needed === 0) return null;
            const roleRoster = party.roster.filter(r => r.role === role);
            
            return (
              <div key={role}>
                <h4 className={`text-sm font-medium ${PARTY_ROLES[role].color} mb-2 flex items-center gap-2`}>
                  <span>{PARTY_ROLES[role].icon}</span>
                  {PARTY_ROLES[role].name}
                  <span className="text-slate-500">
                    ({roleRoster.length}/{needed})
                  </span>
                </h4>
                
                <div className="space-y-1">
                  {roleRoster.map(r => {
                    const char = r.character;
                    const archetype = char?.primary_archetype ? ARCHETYPES[char.primary_archetype as keyof typeof ARCHETYPES] : null;
                    
                    return (
                      <div 
                        key={r.id}
                        className={`flex items-center justify-between p-2 rounded ${
                          r.is_confirmed ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {archetype && <span>{archetype.icon}</span>}
                          <span className="text-white">{char?.name || 'Unknown'}</span>
                          <GuildRankBadge characterId={r.character_id} />
                          {r.is_confirmed && (
                            <Check size={14} className="text-green-400" />
                          )}
                        </div>
                        
                        {canManage && (
                          loading ? (
                            <Skeleton className="h-8 w-16" />
                          ) : effectiveCanManage && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleConfirmed(r.character_id, !r.is_confirmed);
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  r.is_confirmed 
                                    ? 'text-green-400 hover:bg-green-500/20' 
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                                title={r.is_confirmed ? 'Unconfirm' : 'Confirm'}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(r.character_id);
                                }}
                                className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                                title="Remove"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, needed - roleRoster.length) }).map((_, i) => (
                    <div 
                      key={`empty-${i}`}
                      className="p-2 rounded border border-dashed border-slate-700 text-slate-500 text-sm italic"
                    >
                      {t('party.emptySlot')}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Actions */}
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : effectiveCanManage ? (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {/* Assign character */}
              {showAssign ? (
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as PartyRole)}
                    className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm cursor-pointer"
                    aria-label="Select role"
                  >
                    {(['tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'] as PartyRole[]).map(role => (
                      <option key={role} value={role}>
                        {PARTY_ROLES[role].icon} {PARTY_ROLES[role].name}
                      </option>
                    ))}
                  </select>
                  <select
                    onChange={(e) => e.target.value && handleAssign(e.target.value)}
                    disabled={assigning || availableCharacters.length === 0}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm cursor-pointer truncate"
                    defaultValue=""
                    aria-label="Select character"
                  >
                    <option value="" disabled>
                      {availableCharacters.length === 0 ? 'No chars' : 'Select...'}
                    </option>
                    {availableCharacters.map(c => {
                      const arch = c.primary_archetype ? ARCHETYPES[c.primary_archetype as keyof typeof ARCHETYPES] : null;
                      return (
                        <option key={c.id} value={c.id}>
                          {arch?.icon || ''} {c.name}
                          <GuildRankText characterId={c.id} />
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={() => setShowAssign(false)}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Cancel"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAssign(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors cursor-pointer"
                >
                  <UserPlus size={14} />
                  {t('party.addCharacterToParty')}
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onEdit}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
                  title={t('party.editParty')}                  aria-label={t('party.editParty')}                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                  title={t('party.deleteParty')}                  aria-label={t('party.deleteParty')}                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
