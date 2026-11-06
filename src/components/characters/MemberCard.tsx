'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Edit2, Check, X, AlertTriangle, Star } from 'lucide-react';
import { CharacterWithProfessions, RankLevel, RANK_COLORS } from '@/lib/types';
import { SUBSCRIBER_COLORS, SUBSCRIBER_TIERS } from '@/games/starcitizen/config/subscriber-ships';
import { CenturionStarSVG, ImperatorStarSVG, CenturionSVG, ImperatorSVG } from '@/components/game-specific/SubscriberIcons';
import { getRankSummary, checkRankLimits, PROFESSIONS_BY_TIER, TIER_CONFIG } from '@/lib/professions';
import { RACES, ARCHETYPES, getClassName, RaceId, ArchetypeId } from '@/lib/characters';
import { ROR_FACTIONS, ROR_CLASSES, ROR_ROLE_CONFIG, RORRole } from '@/games/returnofreckooning/config';
import { ProfessionSelector } from '@/components/game-specific/ProfessionSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGameConfig } from '@/config';
import { Clan } from '@/lib/types';
import { getConfiguredGameRanks, resolveConfiguredRankLabel } from '@/lib/gameRankSettings';
import { getWowForeverClass, getWowForeverFaction } from '@/games/wowforever/config';
import { WowClassIcon, WowFactionIcon } from '@/components/game-specific/WowCharacterIcons';
import { GuildRankBadge } from './GuildRankBadge';
import { WowSkillDisplay } from './WowSkillDisplay';

interface CharacterCardProps {
  character: CharacterWithProfessions;
  onUpdate: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetProfessionRank: (characterId: string, professionId: string, rank: RankLevel | null, level?: number, quality?: number) => Promise<void>;
  onEdit?: (character: CharacterWithProfessions) => void;
  readOnly?: boolean;
  mainCharacterName?: string; // Name of the main character this alt belongs to
  altCharacters?: Array<{ id: string; name: string }>; // List of alts for this main character
  gameSlug?: string; // Game slug to determine if professions should be shown
  group?: Clan | null;
}

export function CharacterCard({ 
  character, 
  onUpdate, 
  onDelete, 
  onSetProfessionRank, 
  onEdit,
  readOnly = false,
  mainCharacterName,
  altCharacters = [],
  gameSlug = 'aoc',
  group = null,
}: CharacterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useLanguage();

  const warnings = checkRankLimits(character.professions);
  const summary = getRankSummary(character.professions);

  // Get highest rank for border color
  const highestRank = character.professions.length > 0 
    ? (Math.max(...character.professions.map(p => p.rank)) as RankLevel)
    : 0;
  const borderColor = highestRank > 0 ? RANK_COLORS[highestRank as RankLevel].border : 'border-slate-700';
  const glowEffect = highestRank === 4 ? `shadow-lg ${RANK_COLORS[4].glow}` : '';

  // Get race and class info
  const raceInfo = character.race ? RACES[character.race as RaceId] : null;
  const primaryInfo = character.primary_archetype ? ARCHETYPES[character.primary_archetype as ArchetypeId] : null;
  const className = character.primary_archetype 
    ? getClassName(character.primary_archetype as ArchetypeId, character.secondary_archetype as ArchetypeId | null)
    : null;

  const subscriberTier = character.subscriber_tier || null;
  const subscriberSince = character.subscriber_since ? new Date(character.subscriber_since) : null;

  // Get game config for Star Citizen ranks/roles
  const gameConfig = gameSlug ? getGameConfig(gameSlug) : null;
  const gameRanks = getConfiguredGameRanks(group, gameSlug);
  const gameRoles = (gameConfig as any)?.roles || [];
  
  // Get Star Citizen rank name from ID
  const scRankName = gameSlug === 'starcitizen'
    ? resolveConfiguredRankLabel(gameRanks, character.rank)
    : character.rank;

  // Get Star Citizen role names from IDs
  const scRoleNames = character.preferred_role && character.preferred_role.length > 0
    ? character.preferred_role
        .map(roleId => {
          const role = gameRoles.find((r: any) => r.id === roleId);
          return role ? role.name : roleId;
        })
        .filter(Boolean)
    : null;

  // Get RoR character info
  const rorFaction = character.ror_faction ? ROR_FACTIONS[character.ror_faction as keyof typeof ROR_FACTIONS] : null;
  const rorClass = character.ror_class ? ROR_CLASSES.find(c => c.id === character.ror_class) : null;
  const rorRole = rorClass ? ROR_ROLE_CONFIG[rorClass.role] : null;
  const wowClass = character.wow_class ? getWowForeverClass(character.wow_class) : null;
  const wowFaction = character.wow_race && character.wow_class
    ? getWowForeverFaction(character.wow_race, character.wow_class, character.wow_faction)
    : null;

  const handleSave = async () => {
    if (editName.trim() && editName !== character.name) {
      await onUpdate(character.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(character.id);
    setIsDeleting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(character.name);
      setIsEditing(false);
    }
  };

  // Get profession rank for a character
  const getProfessionRank = (professionId: string): RankLevel | null => {
    const prof = character.professions.find((p) => p.profession === professionId);
    return prof ? prof.rank : null;
  };

  // Get profession level for a character
  const getProfessionLevel = (professionId: string): number => {
    const prof = character.professions.find((p) => p.profession === professionId);
    return prof ? prof.artisan_level : 0;
  };

  // Get profession quality for a character
  const getProfessionQuality = (professionId: string): number => {
    const prof = character.professions.find((p) => p.profession === professionId);
    return prof ? prof.quality_score : 0;
  };

  return (
    <div
      id={`character-${character.id}`}
      className={`scroll-mt-4 bg-slate-900/80 backdrop-blur-sm rounded-lg border ${borderColor} ${glowEffect} transition-all duration-300 hover:border-slate-600`}
    >
      {/* Header - clickable to expand/collapse */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          {/* Name and Character Info */}
          <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 w-full max-w-[200px]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  title={t('character.name')}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleSave(); }}
                  className="p-1 text-green-400 hover:text-green-300 transition-colors cursor-pointer"
                  title={t('common.save')}
                  aria-label={t('common.save')}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditName(character.name);
                    setIsEditing(false);
                  }}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  title={t('common.cancel')}
                  aria-label={t('common.cancel')}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  {character.is_main && (
                    <span role="img" aria-label={t('character.mainCharacter')} title={t('character.mainCharacter')}>
                      <Star size={14} className="text-amber-400 fill-amber-400" aria-hidden="true" />
                    </span>
                  )}
                  <h3 className="text-white font-semibold truncate">{character.name}</h3>
                  <GuildRankBadge characterId={character.id} />
                  <span className="truncate text-xs text-slate-400" title={t('character.owner')}>
                    {character.user_id
                      ? character.owner?.display_name || character.owner?.discord_username || t('character.ownerUnknown')
                      : t('character.unclaimed')}
                  </span>
                  {character.level > 1 && (
                    <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                      Lv.{character.level}
                    </span>
                  )}
                  {gameSlug === 'starcitizen' && subscriberTier && (
                    <span
                      className="text-sm font-bold px-2 py-1 rounded border-2 flex items-center gap-2"
                      style={{
                        borderColor: SUBSCRIBER_COLORS[subscriberTier].primary,
                        color: SUBSCRIBER_COLORS[subscriberTier].primary,
                        backgroundColor: SUBSCRIBER_COLORS[subscriberTier].bg,
                      }}
                    >
                      <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 translate-y-[1px]">
                        {subscriberTier === 'centurion' ? <CenturionStarSVG /> : <ImperatorStarSVG />}
                      </div>
                      <span className="leading-none">{SUBSCRIBER_TIERS[subscriberTier].label}</span>
                    </span>
                  )}
                  {gameSlug === 'ror' && rorRole && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-600 flex items-center gap-1 ${rorRole.color}`}
                    >
                      <span>{rorRole.icon}</span>
                      {rorRole.label}
                    </span>
                  )}
                </div>
                {/* Race and Class info */}
                {gameSlug === 'aoc' && (
                  <div className="flex items-center gap-2 mt-0.5 text-sm">
                    {raceInfo && (
                      <span className="text-slate-400">{raceInfo.name}</span>
                    )}
                    {className && (
                      <>
                        {raceInfo && <span className="text-slate-600">•</span>}
                        <span style={{ color: primaryInfo?.color }}>{className}</span>
                      </>
                    )}
                  </div>
                )}
                {gameSlug === 'ror' && rorClass && rorFaction && (
                  <div className="flex items-center gap-2 mt-0.5 text-sm">
                    <span className={rorFaction.color}>{rorFaction.name}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300">{rorClass.name}</span>
                  </div>
                )}
                {gameSlug === 'wowforever' && (
                  <div className="mt-0.5 text-sm">
                    <div className="flex items-center gap-2">
                      {wowClass && <WowClassIcon classId={wowClass.id} />}
                      {wowFaction && <WowFactionIcon faction={wowFaction} />}
                      {character.wow_race && <span className="text-slate-400">{character.wow_race}</span>}
                      {character.wow_race && wowClass && <span className="text-slate-600">•</span>}
                      {wowClass && <span className="text-slate-300">{wowClass.name}</span>}
                      {wowFaction && <span className="text-slate-500">({wowFaction})</span>}
                    </div>
                    {(character.wow_main_spec || character.wow_secondary_spec) && (
                      <div className="text-xs text-slate-400 mt-1">
                        {[character.wow_main_spec, character.wow_secondary_spec].filter(Boolean).join(' / ')}
                      </div>
                    )}
                    {(character.wow_profession_1 || character.wow_profession_2) && (
                      <div className="text-xs text-slate-500 mt-1">
                        {[character.wow_profession_1, character.wow_profession_2].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                )}
                {/* Main/Alt relationship */}
                {mainCharacterName && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <span>Alt of</span>
                    <span className="text-amber-400">{mainCharacterName}</span>
                  </div>
                )}
                {altCharacters.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <span>Alts:</span>
                    <span className="text-slate-400">{altCharacters.map(alt => alt.name).join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3 ml-4">
            {gameSlug === 'aoc' && (
              <span className="text-sm text-slate-400 hidden sm:inline">{summary}</span>
            )}

            {/* Warning indicator */}
            {gameSlug === 'aoc' && warnings.length > 0 && (
              <div className="relative group">
                <AlertTriangle size={16} className="text-yellow-500" />
                <div className="absolute right-0 top-6 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-yellow-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions - stop propagation to prevent toggle */}
            {!isEditing && !readOnly && (
              <>
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(character); }}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title={t('character.editDetails')}
                    aria-label={t('character.editDetails')}
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {isDeleting ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      title={t('common.confirmDelete')}
                      aria-label={t('common.confirmDelete')}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsDeleting(false); }}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title={t('common.cancelDelete')}
                      aria-label={t('common.cancelDelete')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsDeleting(true); }}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}

            {/* Expand indicator */}
            <div className="p-1 text-slate-400">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {/* Mobile summary */}
        <div className="sm:hidden mt-2 text-sm text-slate-400">{summary}</div>
      </div>

      {/* Expanded content - Professions only for AoC */}
      {isExpanded && gameSlug === 'aoc' && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {(['gathering', 'processing', 'crafting'] as const).map((tier) => (
            <div key={tier}>
              <h4 className={`text-sm font-medium ${TIER_CONFIG[tier].color} mb-2 flex items-center gap-2`}>
                <span>{TIER_CONFIG[tier].icon}</span>
                {TIER_CONFIG[tier].label}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PROFESSIONS_BY_TIER[tier].map((profession) => (
                  <ProfessionSelector
                    key={profession.id}
                    profession={profession}
                    currentRank={getProfessionRank(profession.id)}
                    currentLevel={getProfessionLevel(profession.id)}
                    currentQuality={getProfessionQuality(profession.id)}
                    onChange={(rank: RankLevel | null, level?: number, quality?: number) => 
                      onSetProfessionRank(character.id, profession.id, rank, level, quality)
                    }
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))}
          {/* Debug info for editability - only show if window.DEBUG_PERMISSIONS is true */}
          {typeof window !== 'undefined' && window.DEBUG_PERMISSIONS && (
            <div className="mt-6 text-xs text-slate-400 border-t border-slate-700 pt-2">
              <div>user_id: {character.user_id}</div>
              <div>readOnly: {String(readOnly)}</div>
            </div>
          )}

        </div>
      )}

      {isExpanded && gameSlug === 'wowforever' && (
        <div className="border-t border-slate-800 p-4 space-y-2 text-sm">
          <div className="text-slate-300">
            <span className="text-slate-500">{t('wowForever.mainSpec')}:</span>{' '}
            {character.wow_main_spec || '—'}
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">{t('wowForever.secondarySpec')}:</span>{' '}
            {character.wow_secondary_spec || '—'}
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">{t('wowForever.firstProfession')}:</span>{' '}
            {character.wow_profession_1 || '—'}
            {character.wow_profession_1 && <span className="ml-2 text-xs text-indigo-200">
              {t(character.wow_profession_1_rank ? `wowForever.professionRanks.${character.wow_profession_1_rank}` : 'wowForever.rankNotRecorded')}
            </span>}
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">{t('wowForever.secondProfession')}:</span>{' '}
            {character.wow_profession_2 || '—'}
            {character.wow_profession_2 && <span className="ml-2 text-xs text-indigo-200">
              {t(character.wow_profession_2_rank ? `wowForever.professionRanks.${character.wow_profession_2_rank}` : 'wowForever.rankNotRecorded')}
            </span>}
          </div>
          <WowSkillDisplay skills={character.wow_skills || []} />
        </div>
      )}

      {/* Expanded content - Non-profession content for Return of Reckoning */}
      {isExpanded && gameSlug === 'ror' && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Faction</div>
              <div className={`text-sm font-medium ${rorFaction?.color || 'text-slate-200'}`}>
                {rorFaction?.name || '—'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Class</div>
              <div className="text-sm text-slate-200">
                {rorClass?.name || '—'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Role</div>
              <div className={`text-sm font-medium flex items-center gap-1.5 ${rorRole?.color || 'text-slate-200'}`}>
                {rorRole && <span className="text-base">{rorRole.icon}</span>}
                {rorRole?.label || '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded content - Non-profession content for Star Citizen */}
      {isExpanded && gameSlug === 'starcitizen' && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {subscriberTier && (
            <div className="flex items-center justify-center mb-4">
              <div 
                className="inline-flex items-center px-4 py-2 rounded-lg border-2 gap-2"
                style={{
                  borderColor: SUBSCRIBER_COLORS[subscriberTier].primary,
                  backgroundColor: SUBSCRIBER_COLORS[subscriberTier].bg,
                }}
              >
                <div className="h-6">
                  {subscriberTier === 'centurion' ? <CenturionSVG /> : <ImperatorSVG />}
                </div>
                <span
                  className="text-sm font-semibold whitespace-nowrap"
                  style={{ color: SUBSCRIBER_COLORS[subscriberTier].primary }}
                >
                  {SUBSCRIBER_TIERS[subscriberTier].label}
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Rank</div>
              <div className="text-sm text-slate-200">
                {scRankName || '—'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Preferred Roles</div>
              <div className="text-sm text-slate-200">
                {scRoleNames && scRoleNames.length > 0 ? scRoleNames.join(', ') : '—'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Subscriber Tier</div>
              <div className="text-sm text-slate-200">
                {subscriberTier ? SUBSCRIBER_TIERS[subscriberTier].label : 'None'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Subscriber Since</div>
              <div className="text-sm text-slate-200">
                {subscriberSince ? subscriberSince.toLocaleDateString('en-GB') : '—'}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500">Ships Synced For</div>
              <div className="text-sm text-slate-200">
                {character.subscriber_ships_month || '—'}
              </div>
            </div>
            {subscriberTier && (
              <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
                <div className="text-xs text-slate-500">Perks</div>
                <div className="text-sm text-slate-200">
                  {SUBSCRIBER_TIERS[subscriberTier].shipsPerMonth} ship(s)/month ·
                  {` ${SUBSCRIBER_TIERS[subscriberTier].insurance}`}
                </div>
              </div>
            )}
          </div>
          {/* Debug info for editability - only show if window.DEBUG_PERMISSIONS is true */}
          {typeof window !== 'undefined' && window.DEBUG_PERMISSIONS && (
            <div className="text-xs text-slate-400 border-t border-slate-700 pt-2">
              <div>user_id: {character.user_id}</div>
              <div>readOnly: {String(readOnly)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Legacy alias for backward compatibility
export { CharacterCard as MemberCard };
