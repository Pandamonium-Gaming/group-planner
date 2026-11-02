'use client';

import React, { useState } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { RACES, ARCHETYPES, RaceId, ArchetypeId } from '@/lib/characters';
import { getClassById, ROR_CLASSES, ROR_ROLE_CONFIG } from '@/games/returnofreckooning/config';
import { getGameConfig } from '@/config';
import { useLanguage } from '@/contexts/LanguageContext';
import { WOW_FOREVER_CLASSES, WOW_FOREVER_PROFESSIONS } from '@/games/wowforever/config';
import { getProfessionLabelKey } from '@/lib/professionCoverage';

interface GameRoleOption {
  id: string;
  name: string;
}

export interface CharacterFilters {
  search: string;
  race: RaceId | '';
  archetype: ArchetypeId | '';
  minLevel: number;
  maxLevel: number;
  hasProfessions: boolean | null; // null = any, true = has some, false = none
  // Star Citizen filters
  scRole: string | ''; // preferred_role (checks if array includes this role)
  subscriberTier: string | ''; // subscriber_tier (centurion | imperator)
  // Return of Reckoning filters
  rorFaction: string | ''; // ror_faction
  rorClass: string | ''; // ror_class (e.g., 'ironbreaker', 'black-orc')
  rorRole: string | ''; // ror role derived from class (e.g., 'tank', 'healer')
  // Universal filters
  characterType: 'all' | 'main' | 'alt'; // filter by main/alt characters
  wowClasses?: string[];
  wowProfessions?: string[];
}

interface CharacterFiltersProps {
  filters: CharacterFilters;
  onChange: (filters: CharacterFilters) => void;
  characterCount: number;
  filteredCount: number;
  gameSlug?: string;
}

export const DEFAULT_FILTERS: CharacterFilters = {
  search: '',
  race: '',
  archetype: '',
  minLevel: 1,
  maxLevel: 50,
  hasProfessions: null,
  scRole: '',
  subscriberTier: '',
  rorFaction: '',
  rorClass: '',
  rorRole: '',
  characterType: 'all',
  wowClasses: [],
  wowProfessions: [],
};

export function CharacterFiltersBar({
  filters,
  onChange,
  characterCount,
  filteredCount,
  gameSlug = 'aoc',
}: CharacterFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();
  
  // Get game-specific roles
  const gameConfig = getGameConfig(gameSlug);
  const gameRoles = ((gameConfig as { roles?: GameRoleOption[] }).roles || []);
  
  const hasActiveFilters = 
    filters.search !== '' || 
    filters.race !== '' || 
    filters.archetype !== '' || 
    filters.minLevel > 1 || 
    filters.maxLevel < 50 ||
    filters.hasProfessions !== null ||
    filters.scRole !== '' ||
    filters.subscriberTier !== '' ||
    filters.rorFaction !== '' ||
    filters.rorClass !== '' ||
    filters.rorRole !== '' ||
    filters.characterType !== 'all' ||
    (filters.wowClasses?.length || 0) > 0 ||
    (filters.wowProfessions?.length || 0) > 0;

  const clearFilters = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4 space-y-3">
      {/* Main search row */}
      <div className="flex gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t('character.searchPlaceholder')}
            aria-label={t('character.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
              title={t('common.clear')}
              aria-label={t('common.clear')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Expand filters button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
            hasActiveFilters 
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Filter size={16} />
          <span className="hidden sm:inline">{t('filters.title')}</span>
          {hasActiveFilters && (
            <span className="text-xs bg-orange-500 text-white px-1.5 rounded-full">!</span>
          )}
          <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gameSlug === 'wowforever' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 pt-3 border-t border-slate-800`}>
          {gameSlug === 'wowforever' && (
            <>
              <fieldset className="min-w-0 rounded-lg border border-slate-700 p-3">
                <legend className="px-1 text-xs text-slate-400">{t('wowForever.class')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {WOW_FOREVER_CLASSES.map(wowClass => (
                    <label key={wowClass.id} className="flex min-w-0 items-start gap-2 text-sm text-slate-300">
                      <input type="checkbox" className="mt-1 shrink-0" checked={(filters.wowClasses || []).includes(wowClass.id)}
                        onChange={event => onChange({ ...filters, wowClasses: event.target.checked
                          ? [...(filters.wowClasses || []), wowClass.id]
                          : (filters.wowClasses || []).filter(id => id !== wowClass.id) })} />
                      <span className="min-w-0 break-words">{wowClass.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="min-w-0 rounded-lg border border-slate-700 p-3">
                <legend className="px-1 text-xs text-slate-400">{t('professionOverview.title')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {WOW_FOREVER_PROFESSIONS.map(profession => (
                    <label key={profession} className="flex min-w-0 items-start gap-2 text-sm text-slate-300">
                      <input type="checkbox" className="mt-1 shrink-0" checked={(filters.wowProfessions || []).includes(profession)}
                        onChange={event => onChange({ ...filters, wowProfessions: event.target.checked
                          ? [...(filters.wowProfessions || []), profession]
                          : (filters.wowProfessions || []).filter(name => name !== profession) })} />
                      <span className="min-w-0 break-words">{t(getProfessionLabelKey(profession))}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {/* Race filter - AoC only */}
          {gameSlug === 'aoc' && (
            <div>
              <label htmlFor="filter-race" className="text-xs text-slate-400 mb-1 block">{t('filters.race')}</label>
              <select
                id="filter-race"
                value={filters.race}
                onChange={(e) => onChange({ ...filters, race: e.target.value as RaceId | '' })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allRaces')}</option>
                {Object.entries(RACES).map(([id, race]) => (
                  <option key={id} value={id}>{race.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Archetype filter - AoC only */}
          {gameSlug === 'aoc' && (
            <div>
              <label htmlFor="filter-archetype" className="text-xs text-slate-400 mb-1 block">{t('filters.class')}</label>
              <select
                id="filter-archetype"
                value={filters.archetype}
                onChange={(e) => onChange({ ...filters, archetype: e.target.value as ArchetypeId | '' })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allArchetypes')}</option>
                {Object.entries(ARCHETYPES).map(([id, arch]) => (
                  <option key={id} value={id}>{arch.icon} {arch.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Level range - AoC only */}
          {gameSlug === 'aoc' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t('filters.levelRange')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={filters.minLevel}
                  onChange={(e) => onChange({ ...filters, minLevel: parseInt(e.target.value) || 1 })}
                  className="w-16 px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-label={t('filters.minLevel')}
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={filters.maxLevel}
                  onChange={(e) => onChange({ ...filters, maxLevel: parseInt(e.target.value) || 50 })}
                  className="w-16 px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-label={t('filters.maxLevel')}
                />
              </div>
            </div>
          )}

          {/* Professions filter - AoC only */}
          {gameSlug === 'aoc' && (
            <div>
              <label htmlFor="filter-professions" className="text-xs text-slate-400 mb-1 block">{t('filters.professions')}</label>
              <select
                id="filter-professions"
                value={filters.hasProfessions === null ? '' : filters.hasProfessions ? 'yes' : 'no'}
                onChange={(e) => onChange({ 
                  ...filters, 
                  hasProfessions: e.target.value === '' ? null : e.target.value === 'yes' 
                })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('common.all')}</option>
                <option value="yes">{t('filters.hasProfessions')}</option>
                <option value="no">{t('filters.noProfessions')}</option>
              </select>
            </div>
          )}

          {/* Star Citizen role filter */}
          {gameSlug === 'starcitizen' && (
            <div>
              <label htmlFor="filter-sc-role" className="text-xs text-slate-400 mb-1 block">{t('filters.role')}</label>
              <select
                id="filter-sc-role"
                value={filters.scRole}
                onChange={(e) => onChange({ ...filters, scRole: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allRoles')}</option>
                {gameRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Return of Reckoning faction filter */}
          {gameSlug === 'ror' && (
            <div>
              <label htmlFor="filter-ror-faction" className="text-xs text-slate-400 mb-1 block">{t('filters.faction')}</label>
              <select
                id="filter-ror-faction"
                value={filters.rorFaction}
                onChange={(e) => onChange({ ...filters, rorFaction: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allFactions')}</option>
                <option value="destruction">{t('filters.destruction')}</option>
                <option value="order">{t('filters.order')}</option>
              </select>
            </div>
          )}

          {/* Return of Reckoning class filter */}
          {gameSlug === 'ror' && (
            <div>
              <label htmlFor="filter-ror-class" className="text-xs text-slate-400 mb-1 block">{t('filters.class')}</label>
              <select
                id="filter-ror-class"
                value={filters.rorClass}
                onChange={(e) => onChange({ ...filters, rorClass: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allClasses')}</option>
                {ROR_CLASSES.map((rorClass) => (
                  <option key={rorClass.id} value={rorClass.id}>{rorClass.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Return of Reckoning role filter */}
          {gameSlug === 'ror' && (
            <div>
              <label htmlFor="filter-ror-role" className="text-xs text-slate-400 mb-1 block">{t('filters.role')}</label>
              <select
                id="filter-ror-role"
                value={filters.rorRole}
                onChange={(e) => onChange({ ...filters, rorRole: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('filters.allRoles')}</option>
                {Object.entries(ROR_ROLE_CONFIG).map(([roleKey, roleConfig]) => (
                  <option key={roleKey} value={roleKey}>{roleConfig.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Star Citizen subscriber status filter */}
          {gameSlug === 'starcitizen' && (
            <div>
              <label htmlFor="filter-subscriber" className="text-xs text-slate-400 mb-1 block">{t('filters.subscriberStatus')}</label>
              <select
                id="filter-subscriber"
                value={filters.subscriberTier}
                onChange={(e) => onChange({ ...filters, subscriberTier: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="">{t('common.all')}</option>
                <option value="centurion">{t('filters.centurion')}</option>
                <option value="imperator">{t('filters.imperator')}</option>
              </select>
            </div>
          )}

          {/* Main / Alt filter - all games */}
          <div>
            <label htmlFor="filter-char-type" className="text-xs text-slate-400 mb-1 block">{t('filters.characterType')}</label>
            <select
              id="filter-char-type"
              value={filters.characterType}
              onChange={(e) => onChange({ ...filters, characterType: e.target.value as 'all' | 'main' | 'alt' })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">{t('filters.allCharacterTypes')}</option>
              <option value="main">{t('filters.mainCharacters')}</option>
              <option value="alt">{t('filters.alts')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Results count and clear */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {t('filters.showing')} <span className="text-white font-medium">{filteredCount}</span>
          {filteredCount !== characterCount && (
            <span> {t('filters.of')} {characterCount}</span>
          )} {t('filters.characters')}
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
          >
            <X size={14} />
            {t('filters.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function to filter characters
export function filterCharacters<T extends { 
  name: string; 
  race?: string | null; 
  primary_archetype?: string | null;
  level?: number;
  professions: unknown[];
  user_id?: string | null;
  is_main?: boolean;
  preferred_role?: string[] | null;
  subscriber_tier?: string | null;
  ror_faction?: string | null;
  ror_class?: string | null;
  wow_class?: string | null;
  wow_profession_1?: string | null;
  wow_profession_2?: string | null;
  rank?: string | null;
}>(
  characters: T[],
  filters: CharacterFilters
): T[] {
  // If there's a search term, we need to include related characters
  const matchedUserIds = new Set<string>();
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    characters.forEach(char => {
      if (char.name.toLowerCase().includes(searchLower) && char.user_id) {
        matchedUserIds.add(char.user_id);
      }
    });
  }
  
  return characters.filter(char => {
    if (filters.wowClasses?.length && !filters.wowClasses.includes(char.wow_class || '')) return false;
    if (filters.wowProfessions?.length && !filters.wowProfessions.some(profession =>
      profession === char.wow_profession_1 || profession === char.wow_profession_2)) return false;
    // Search filter - include character if:
    // 1. Name matches search, OR
    // 2. Has user_id and that user_id had a character that matched search
    if (filters.search) {
      const nameMatches = char.name.toLowerCase().includes(filters.search.toLowerCase());
      const relatedMatches = char.user_id && matchedUserIds.has(char.user_id);
      
      if (!nameMatches && !relatedMatches) {
        return false;
      }
    }

    // Race filter
    if (filters.race && char.race !== filters.race) {
      return false;
    }

    // Archetype filter
    if (filters.archetype && char.primary_archetype !== filters.archetype) {
      return false;
    }

    // Level filter
    const level = char.level || 1;
    if (level < filters.minLevel || level > filters.maxLevel) {
      return false;
    }

    // Professions filter
    if (filters.hasProfessions !== null) {
      const hasSome = char.professions.length > 0;
      if (filters.hasProfessions !== hasSome) {
        return false;
      }
    }

    // Star Citizen role filter
    if (filters.scRole) {
      if (!char.preferred_role || !char.preferred_role.includes(filters.scRole)) {
        return false;
      }
    }

    // Star Citizen subscriber tier filter
    if (filters.subscriberTier && char.subscriber_tier !== filters.subscriberTier) {
      return false;
    }

    // Return of Reckoning faction filter
    if (filters.rorFaction && char.ror_faction !== filters.rorFaction) {
      return false;
    }

    // Return of Reckoning class filter
    if (filters.rorClass && char.ror_class !== filters.rorClass) {
      return false;
    }

    // Return of Reckoning role filter - derive from class
    if (filters.rorRole && char.ror_class) {
      const rorClass = getClassById(char.ror_class);
      if (!rorClass || rorClass.role !== filters.rorRole) {
        return false;
      }
    }

    // Character type filter (main/alt)
    if (filters.characterType !== 'all') {
      const isMain = char.is_main === true;
      if (filters.characterType === 'main' && !isMain) {
        return false;
      }
      if (filters.characterType === 'alt' && isMain) {
        return false;
      }
    }

    return true;
  });
}
