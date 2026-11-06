'use client';

import React, { useState } from 'react';
import { X, Sword, Star, RefreshCw } from 'lucide-react';
import { Race, Archetype } from '@/lib/types';
import { 
  RACES, 
  ARCHETYPES, 
  PARENT_RACES, 
  getClassName,
  MAX_LEVEL,
  SECONDARY_ARCHETYPE_LEVEL,
  RaceId,
  ArchetypeId
} from '@/lib/characters';
import { ROR_FACTIONS, ROR_CLASSES, ROR_ROLE_CONFIG, getClassesByFaction, RORRole } from '@/games/returnofreckooning/config';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGameConfig } from '@/config';
import { SUBSCRIBER_TIERS, SUBSCRIBER_COLORS, getCurrentMonthKey } from '@/games/starcitizen/config/subscriber-ships';
import { syncSubscriberShips } from '@/lib/subscriberShips';
import { supabase } from '@/lib/supabase';
import { getClientAuthStack } from '@/lib/authStack';
import { CenturionSVG, ImperatorSVG } from '@/components/game-specific/SubscriberIcons';
import { Clan } from '@/lib/types';
import { getConfiguredGameRanks, isGameRankEnabled } from '@/lib/gameRankSettings';
import {
  getWowForeverClass,
  getWowForeverClassesForRace,
  getWowForeverRaceFaction,
  getWowForeverFaction,
  isValidWowForeverSelection,
  WOW_FOREVER_CLASSES,
  WOW_FOREVER_PROFESSIONS,
  WOW_FOREVER_PROFESSION_RANKS,
  isWowForeverProfessionRank,
  type WowForeverProfessionRank,
  WOW_FOREVER_RACES,
} from '@/games/wowforever/config';
import { WowClassIcon, WowFactionIcon } from '@/components/game-specific/WowCharacterIcons';
import { isValidWowSkills, type WowSkill } from '@/games/wowforever/config/skills';
import { WowSkillEditor } from './WowSkillEditor';

export interface CharacterFormData {
  name: string;
  race: Race | null;
  primary_archetype: Archetype | null;
  secondary_archetype: Archetype | null;
  level: number;
  is_main: boolean;
  preferred_role?: string[] | null;
  rank?: string | null;
  ror_faction?: string | null;
  ror_class?: string | null;
  wow_race?: string | null;
  wow_faction?: 'Alliance' | 'Horde' | null;
  wow_class?: string | null;
  wow_main_spec?: string | null;
  wow_secondary_spec?: string | null;
  wow_profession_1?: string | null;
  wow_profession_2?: string | null;
  wow_profession_1_rank?: WowForeverProfessionRank | null;
  wow_profession_2_rank?: WowForeverProfessionRank | null;
  wow_skills?: WowSkill[];
  subscriber_tier?: 'centurion' | 'imperator' | null;
  subscriber_since?: string | null;
  subscriber_ships_month?: string | null;
  ships?: Array<{
    ship_id: string;
    ownership_type: 'owned-pledge' | 'owned-auec' | 'concept-pledge' | 'loaner';
    notes?: string;
  }>;
  vehicles?: Array<{
    ship_id: string;
    ownership_type: 'owned-pledge' | 'owned-auec' | 'concept-pledge' | 'loaner';
    notes?: string;
  }>;
}

interface CharacterFormProps {
  initialData?: Partial<CharacterFormData>;
  onSubmit: (data: CharacterFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  gameSlug?: string;
  characterId?: string; // Character ID when editing (for re-sync ships)
  group?: Clan | null;
}

export function CharacterForm({ 
  initialData, 
  onSubmit, 
  onCancel,
  isEditing = false,
  gameSlug = 'aoc',
  characterId,
  group = null,
}: CharacterFormProps) {
  const [formData, setFormData] = useState<CharacterFormData>({
    name: initialData?.name || '',
    race: initialData?.race || null,
    primary_archetype: initialData?.primary_archetype || null,
    secondary_archetype: initialData?.secondary_archetype || null,
    level: initialData?.level || 1,
    is_main: initialData?.is_main || false,
    preferred_role: initialData?.preferred_role || [],
    rank: initialData?.rank || null,
    ror_faction: (initialData as any)?.ror_faction || null,
    ror_class: (initialData as any)?.ror_class || null,
    wow_race: initialData?.wow_race || null,
    wow_faction: getWowForeverFaction(initialData?.wow_race || '', initialData?.wow_class || '', initialData?.wow_faction),
    wow_class: initialData?.wow_class || null,
    wow_main_spec: initialData?.wow_main_spec || null,
    wow_secondary_spec: initialData?.wow_secondary_spec || null,
    wow_profession_1: initialData?.wow_profession_1 || null,
    wow_profession_2: initialData?.wow_profession_2 || null,
    wow_profession_1_rank: initialData?.wow_profession_1_rank || null,
    wow_profession_2_rank: initialData?.wow_profession_2_rank || null,
    wow_skills: initialData?.wow_skills || [],
    subscriber_tier: (initialData as any)?.subscriber_tier || null,
    subscriber_since: (initialData as any)?.subscriber_since || null,
    subscriber_ships_month: (initialData as any)?.subscriber_ships_month || null,
    ships: initialData?.ships || [],
    vehicles: initialData?.vehicles || [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const { t } = useLanguage();
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  const isAoC = gameSlug === 'aoc';
  const isStarCitizen = gameSlug === 'starcitizen';
  const isRoR = gameSlug === 'ror';
  const isWowForever = gameSlug === 'wowforever';
  const gameConfig = getGameConfig(gameSlug);
  const gameRoles = (gameConfig as any)?.roles || [];
  const gameRanks = getConfiguredGameRanks(group, gameSlug);
  const ranksEnabled = isGameRankEnabled(group, gameSlug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (isAoC && (!formData.race || !formData.primary_archetype)) {
      setError('Race and Primary Archetype are required for Ashes of Creation');
      return;
    }
    
    if (isRoR && (!formData.ror_faction || !formData.ror_class)) {
      setError('Faction and Class are required for Return of Reckoning');
      return;
    }

    const wowSkills = (formData.wow_skills || []).map(skill => ({
      ...skill, name: skill.name.trim(), rank: skill.rank?.trim() || null,
    }));
    if (isWowForever) {
      if (!isValidWowSkills(wowSkills)) {
        setError(t('wowSkills.invalid'));
        return;
      }
      if (!formData.wow_race || !formData.wow_class || !formData.wow_main_spec) {
        setError(t('wowForever.requiredFieldsError'));
        return;
      }

      if (!isValidWowForeverSelection({
        race: formData.wow_race,
        faction: formData.wow_faction,
        classId: formData.wow_class,
        mainSpec: formData.wow_main_spec,
        secondarySpec: formData.wow_secondary_spec,
        profession1: formData.wow_profession_1,
        profession2: formData.wow_profession_2,
        profession1Rank: formData.wow_profession_1_rank,
        profession2Rank: formData.wow_profession_2_rank,
      })) {
        setError(t('wowForever.invalidCombinationError'));
        return;
      }
      if (formData.wow_race === 'Skyborne' && !formData.wow_faction) {
        setError(t('professionOverview.factionRequired'));
        return;
      }
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit(isWowForever ? { ...formData, wow_skills: wowSkills } : formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResyncShips = async () => {
    if (!isEditing || !characterId || !formData.subscriber_tier) return;
    
    setIsSyncing(true);
    setSyncSuccess(false);
    setError(null);
    
    try {
      let result: { success: boolean; error?: string } = { success: false };

      if (canUseV2Api && group?.id) {
        const response = await fetch('/api/group/members', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'sync_subscriber_tier',
            group_id: group.id,
            character_id: characterId,
            old_tier: initialData?.subscriber_tier ?? null,
            new_tier: formData.subscriber_tier,
            force: true,
          }),
        });

        if (response.ok) {
          result = { success: true };
        } else {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          result = { success: false, error: payload.details || payload.error || `Failed to sync ships (${response.status})` };
        }
      }

      if (!result.success) {
        result = await syncSubscriberShips(
          supabase,
          characterId,
          formData.subscriber_tier,
        );
      }
      
      if (result.success) {
        const currentMonth = getCurrentMonthKey();
        setFormData({ ...formData, subscriber_ships_month: currentMonth });
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to sync ships');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync ships');
    } finally {
      setIsSyncing(false);
    }
  };

  const canHaveSecondary = formData.level >= SECONDARY_ARCHETYPE_LEVEL;
  const className = formData.primary_archetype 
    ? getClassName(formData.primary_archetype as ArchetypeId, formData.secondary_archetype as ArchetypeId | null)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 pb-24">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sword className="w-5 h-5 text-orange-400" />
            {isEditing ? 'Edit Character' : 'Create Character'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          <div>
            <label htmlFor="character-name" className="block text-sm font-medium text-slate-300 mb-2">
              Character Name *
            </label>
            <input
              id="character-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter character name"
              autoFocus
            />
          </div>

          {isAoC && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Race *</label>
                <div className="space-y-3">
                  {Object.entries(PARENT_RACES).map(([parentRace, races]) => (
                    <div key={parentRace}>
                      <div className="text-xs text-slate-500 mb-1">{parentRace}</div>
                      <div className="flex flex-wrap gap-2">
                        {races.map((raceId) => {
                          const race = RACES[raceId as RaceId];
                          const isSelected = formData.race === raceId;
                          return (
                            <button
                              key={raceId}
                              type="button"
                              onClick={() => setFormData({ ...formData, race: raceId as Race })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                              style={isSelected ? { backgroundColor: race.color } : undefined}
                            >
                              {race.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Primary Archetype *</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(ARCHETYPES).map(([id, archetype]) => {
                    const isSelected = formData.primary_archetype === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          primary_archetype: id as Archetype,
                          secondary_archetype: formData.secondary_archetype === id ? null : formData.secondary_archetype
                        })}
                        className={`flex flex-col items-center p-2 rounded-lg text-sm transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                        style={isSelected ? { backgroundColor: archetype.color + '30' } : undefined}
                      >
                        <span className="text-lg">{archetype.icon}</span>
                        <span className={isSelected ? 'text-white' : 'text-slate-300'}>
                          {archetype.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  Secondary Archetype
                  <span className="text-xs text-slate-500">(Unlocks at level {SECONDARY_ARCHETYPE_LEVEL})</span>
                </label>
                <div className={`grid grid-cols-4 gap-2 ${!canHaveSecondary ? 'opacity-50' : ''}`}>
                  {Object.entries(ARCHETYPES).map(([id, archetype]) => {
                    const isSelected = formData.secondary_archetype === id;
                    const isDisabled = !canHaveSecondary || id === formData.primary_archetype;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setFormData({ 
                          ...formData, 
                          secondary_archetype: isSelected ? null : id as Archetype 
                        })}
                        className={`flex flex-col items-center p-2 rounded-lg text-sm transition-all ${
                          isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                        style={isSelected ? { backgroundColor: archetype.color + '30' } : undefined}
                      >
                        <span className="text-lg">{archetype.icon}</span>
                        <span className={isSelected ? 'text-white' : 'text-slate-300'}>
                          {archetype.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {className && (
                  <div className="mt-2 text-sm text-slate-400">
                    Class: <span className="text-orange-400 font-medium">{className}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Level</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={MAX_LEVEL}
                    value={formData.level}
                    onChange={(e) => {
                      const level = parseInt(e.target.value);
                      setFormData({ 
                        ...formData, 
                        level,
                        secondary_archetype: level < SECONDARY_ARCHETYPE_LEVEL ? null : formData.secondary_archetype
                      });
                    }}
                    className="flex-1 accent-orange-500 cursor-pointer"
                    title={t('character.level')}
                  />
                  <span className="w-12 text-center text-white font-medium bg-slate-800 rounded px-2 py-1">
                    {formData.level}
                  </span>
                </div>
              </div>
            </>
          )}

          {isRoR && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Faction *</label>
                <div className="flex gap-3">
                  {Object.entries(ROR_FACTIONS).map(([factionId, faction]) => {
                    const isSelected = formData.ror_faction === factionId;
                    return (
                      <button
                        key={factionId}
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          ror_faction: factionId,
                          ror_class: null
                        })}
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all cursor-pointer border-2 ${
                          isSelected
                            ? `${faction.borderColor} ${faction.bgColor} ${faction.color}`
                            : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {faction.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.ror_faction && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Class *</label>
                  <div className="space-y-3">
                    {/* Group classes by role */}
                    {Object.entries(
                      getClassesByFaction(formData.ror_faction as any).reduce((acc, rorClass) => {
                        if (!acc[rorClass.role]) acc[rorClass.role] = [];
                        acc[rorClass.role].push(rorClass);
                        return acc;
                      }, {} as Record<RORRole, typeof ROR_CLASSES>)
                    ).map(([role, classes]) => {
                      const roleConfig = ROR_ROLE_CONFIG[role as RORRole];
                      return (
                        <div key={role} className="bg-slate-800/30 rounded-lg p-3">
                          <div className={`flex items-center gap-2 mb-2 text-sm font-medium ${roleConfig.color}`}>
                            <span className="text-lg">{roleConfig.icon}</span>
                            <span>{roleConfig.label}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {classes.map((rorClass) => {
                              const isSelected = formData.ror_class === rorClass.id;
                              const faction = ROR_FACTIONS[formData.ror_faction as keyof typeof ROR_FACTIONS];
                              return (
                                <button
                                  key={rorClass.id}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, ror_class: rorClass.id })}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer text-left border ${
                                    isSelected
                                      ? `${faction.borderColor} ${faction.bgColor} ${faction.color} border-2`
                                      : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                                  }`}
                                >
                                  {rorClass.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {isWowForever && (
            <div className="space-y-4">
              <div>
                <label htmlFor="wow-race" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('wowForever.race')} *
                </label>
                <select
                  id="wow-race"
                  value={formData.wow_race || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    wow_race: e.target.value || null,
                    wow_faction: null,
                    wow_class: null,
                    wow_main_spec: null,
                    wow_secondary_spec: null,
                  })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">{t('wowForever.selectRace')}</option>
                  {WOW_FOREVER_RACES.map((race) => (
                    <option key={race} value={race}>{race}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="wow-class" className="block text-sm font-medium text-slate-300 mb-2">
                  {t('wowForever.class')} *
                </label>
                <select
                  id="wow-class"
                  value={formData.wow_class || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    wow_class: e.target.value || null,
                    wow_faction: getWowForeverFaction(formData.wow_race || '', e.target.value, formData.wow_faction),
                    wow_main_spec: null,
                    wow_secondary_spec: null,
                  })}
                  disabled={!formData.wow_race}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  <option value="">{t('wowForever.selectClass')}</option>
                  {(formData.wow_race
                    ? getWowForeverClassesForRace(formData.wow_race)
                    : WOW_FOREVER_CLASSES
                  ).map((wowClass) => {
                    const faction = formData.wow_race
                      ? getWowForeverRaceFaction(formData.wow_race, wowClass.id)
                      : null;
                    return (
                      <option key={wowClass.id} value={wowClass.id}>
                        {wowClass.name}{faction ? ` (${faction})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {(() => {
                const wowClass = getWowForeverClass(formData.wow_class || '');
                if (!wowClass) return null;

                const specs = wowClass.specs as readonly string[];
                const faction = formData.wow_race
                  ? getWowForeverFaction(formData.wow_race, wowClass.id, formData.wow_faction)
                  : null;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <WowClassIcon classId={wowClass.id} />
                      <span className="text-sm text-slate-300">{wowClass.name}</span>
                      {faction && <><WowFactionIcon faction={faction} /><span className="text-sm text-slate-300">{faction}</span></>}
                    </div>
                    {formData.wow_race === 'Skyborne' && !getWowForeverRaceFaction(formData.wow_race, wowClass.id) && (
                      <div>
                        <label htmlFor="wow-faction" className="mb-2 block text-sm font-medium text-slate-300">
                          {t('professionOverview.faction')} *
                        </label>
                        <select id="wow-faction" value={formData.wow_faction || ''}
                          onChange={event => setFormData({
                            ...formData,
                            wow_faction: event.target.value === 'Alliance' || event.target.value === 'Horde' ? event.target.value : null,
                          })}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white">
                          <option value="">{t('professionOverview.selectFaction')}</option>
                          <option value="Alliance">Alliance</option>
                          <option value="Horde">Horde</option>
                        </select>
                      </div>
                    )}
                    {formData.wow_race && getWowForeverRaceFaction(formData.wow_race, wowClass.id) && (
                      <p className="text-sm text-slate-400">
                        {t('wowForever.factionRestriction', { faction: faction || '' })}
                      </p>
                    )}
                    <div>
                      <label htmlFor="wow-main-spec" className="block text-sm font-medium text-slate-300 mb-2">
                        {t('wowForever.mainSpec')} *
                      </label>
                      <select
                        id="wow-main-spec"
                        value={formData.wow_main_spec || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          wow_main_spec: e.target.value || null,
                          wow_secondary_spec: e.target.value === formData.wow_secondary_spec
                            ? null
                            : formData.wow_secondary_spec,
                        })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">{t('wowForever.selectSpec')}</option>
                        {specs.map((spec) => <option key={spec} value={spec}>{spec}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="wow-secondary-spec" className="block text-sm font-medium text-slate-300 mb-2">
                        {t('wowForever.secondarySpec')}
                      </label>
                      <select
                        id="wow-secondary-spec"
                        value={formData.wow_secondary_spec || ''}
                        onChange={(e) => setFormData({ ...formData, wow_secondary_spec: e.target.value || null })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">{t('wowForever.selectSpec')}</option>
                        {specs
                          .filter((spec) => spec !== formData.wow_main_spec)
                          .map((spec) => <option key={spec} value={spec}>{spec}</option>)}
                      </select>
                    </div>
                  </>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wow-profession-1" className="block text-sm font-medium text-slate-300 mb-2">
                    {t('wowForever.firstProfession')}
                  </label>
                  <select
                    id="wow-profession-1"
                    value={formData.wow_profession_1 || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      wow_profession_1: e.target.value || null,
                      wow_profession_1_rank: e.target.value === formData.wow_profession_1 ? formData.wow_profession_1_rank : null,
                      wow_profession_2_rank: e.target.value === formData.wow_profession_2 ? null : formData.wow_profession_2_rank,
                      wow_profession_2: e.target.value === formData.wow_profession_2
                        ? null
                        : formData.wow_profession_2,
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">{t('wowForever.selectProfession')}</option>
                    {WOW_FOREVER_PROFESSIONS.map((profession) => (
                      <option key={profession} value={profession}>{profession}</option>
                    ))}
                  </select>
                  {formData.wow_profession_1 && (
                    <div className="mt-3">
                      <label htmlFor="wow-profession-1-rank" className="mb-2 block text-sm font-medium text-slate-300">
                        {t('wowForever.firstProfessionRank')}
                      </label>
                      <select id="wow-profession-1-rank" value={formData.wow_profession_1_rank || ''}
                        onChange={event => setFormData({ ...formData, wow_profession_1_rank:
                          isWowForeverProfessionRank(event.target.value) ? event.target.value : null })}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white">
                        <option value="">{t('wowForever.rankNotRecorded')}</option>
                        {WOW_FOREVER_PROFESSION_RANKS.map(rank => (
                          <option key={rank} value={rank}>{t(`wowForever.professionRanks.${rank}`)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="wow-profession-2" className="block text-sm font-medium text-slate-300 mb-2">
                    {t('wowForever.secondProfession')}
                  </label>
                  <select
                    id="wow-profession-2"
                    value={formData.wow_profession_2 || ''}
                    onChange={(e) => setFormData({ ...formData, wow_profession_2: e.target.value || null,
                      wow_profession_2_rank: e.target.value === formData.wow_profession_2 ? formData.wow_profession_2_rank : null })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">{t('wowForever.selectProfession')}</option>
                    {WOW_FOREVER_PROFESSIONS
                      .filter((profession) => profession !== formData.wow_profession_1)
                      .map((profession) => (
                        <option key={profession} value={profession}>{profession}</option>
                      ))}
                  </select>
                  {formData.wow_profession_2 && (
                    <div className="mt-3">
                      <label htmlFor="wow-profession-2-rank" className="mb-2 block text-sm font-medium text-slate-300">
                        {t('wowForever.secondProfessionRank')}
                      </label>
                      <select id="wow-profession-2-rank" value={formData.wow_profession_2_rank || ''}
                        onChange={event => setFormData({ ...formData, wow_profession_2_rank:
                          isWowForeverProfessionRank(event.target.value) ? event.target.value : null })}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white">
                        <option value="">{t('wowForever.rankNotRecorded')}</option>
                        {WOW_FOREVER_PROFESSION_RANKS.map(rank => (
                          <option key={rank} value={rank}>{t(`wowForever.professionRanks.${rank}`)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <WowSkillEditor skills={formData.wow_skills || []}
                onChange={wow_skills => setFormData({ ...formData, wow_skills })} />
            </div>
          )}

          {gameSlug === 'starcitizen' && gameRoles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Preferred Roles</label>
              <div className="space-y-2">
                {gameRoles.map((role: any) => (
                  <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.preferred_role || []).includes(role.id)}
                      onChange={(e) => {
                        const currentRoles = formData.preferred_role || [];
                        const newRoles = e.target.checked
                          ? [...currentRoles, role.id]
                          : currentRoles.filter(r => r !== role.id);
                        setFormData({ ...formData, preferred_role: newRoles.length > 0 ? newRoles : null });
                      }}
                      className="w-4 h-4 bg-slate-800 border-slate-600 rounded text-orange-500 focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-300">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isAoC && ranksEnabled && gameRanks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Group Rank</label>
              <select
                value={formData.rank || ''}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value || null })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a rank...</option>
                {gameRanks
                  .slice()
                  .sort((a: any, b: any) => (b.hierarchy || 0) - (a.hierarchy || 0))
                  .map((rank: any) => (
                  <option key={rank.id} value={rank.id}>
                    {rank.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isStarCitizen && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subscriber Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* None */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, subscriber_tier: null })}
                    className={`px-4 py-3 rounded-lg font-medium transition-all cursor-pointer border-2 ${
                      formData.subscriber_tier === null
                        ? 'border-slate-400 bg-slate-700 text-white'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                    None
                  </button>

                  {/* Centurion */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, subscriber_tier: 'centurion' })}
                    className={`px-4 py-3 rounded-lg font-medium transition-all cursor-pointer border-2 ${
                      formData.subscriber_tier === 'centurion'
                        ? 'text-white'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                    style={formData.subscriber_tier === 'centurion' ? {
                      borderColor: SUBSCRIBER_COLORS.centurion.primary,
                      backgroundColor: SUBSCRIBER_COLORS.centurion.bg,
                      color: SUBSCRIBER_COLORS.centurion.primary
                    } : undefined}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-4">
                        <CenturionSVG />
                      </div>
                      <span className="text-xs">{SUBSCRIBER_TIERS.centurion.label}</span>
                    </div>
                  </button>

                  {/* Imperator */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, subscriber_tier: 'imperator' })}
                    className={`px-4 py-3 rounded-lg font-medium transition-all cursor-pointer border-2 ${
                      formData.subscriber_tier === 'imperator'
                        ? 'text-white'
                        : 'border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                    style={formData.subscriber_tier === 'imperator' ? {
                      borderColor: SUBSCRIBER_COLORS.imperator.primary,
                      backgroundColor: SUBSCRIBER_COLORS.imperator.bg,
                      color: SUBSCRIBER_COLORS.imperator.primary
                    } : undefined}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-4">
                        <ImperatorSVG />
                      </div>
                      <span className="text-xs">{SUBSCRIBER_TIERS.imperator.label}</span>
                    </div>
                  </button>
                </div>
                {formData.subscriber_tier && (
                  <p className="mt-2 text-xs text-slate-400">
                    {SUBSCRIBER_TIERS[formData.subscriber_tier].shipsPerMonth} ship(s)/month · 
                    {SUBSCRIBER_TIERS[formData.subscriber_tier].insurance} insurance
                  </p>
                )}
              </div>
              {formData.subscriber_tier && (
                <div>
                  <label htmlFor="subscriber-since" className="block text-sm font-medium text-slate-300 mb-2">
                    Subscriber Since
                  </label>
                  <input
                    id="subscriber-since"
                    type="date"
                    value={formData.subscriber_since ? formData.subscriber_since.split('T')[0] : ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      subscriber_since: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    style={{
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              )}
              {formData.subscriber_tier && (
                <div className="space-y-2">
                  {formData.subscriber_ships_month && (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 px-3 py-2">
                      <div className="text-xs text-slate-500">Ships Synced For</div>
                      <div className="text-sm text-slate-200">{formData.subscriber_ships_month}</div>
                    </div>
                  )}
                  {isEditing && characterId && (
                    <button
                      type="button"
                      onClick={handleResyncShips}
                      disabled={isSyncing}
                      className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing ? 'Syncing...' : syncSuccess ? '✓ Ships Updated!' : 'Re-sync Subscriber Ships'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_main: !formData.is_main })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                formData.is_main
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                  : 'bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500'
              }`}
            >
              <Star size={18} className={formData.is_main ? 'fill-amber-400' : ''} />
              Main Character
            </button>
            <p className="text-xs text-slate-500">
              Characters with the same login are automatically linked
            </p>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
