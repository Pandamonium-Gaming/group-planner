'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Swords, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClassCoverage, type ClassCharacterFilter } from '@/lib/classCoverage';
import { ARCHETYPES, getClassName } from '@/lib/characters';
import { getWowForeverClass, getWowForeverFaction } from '@/games/wowforever/config';
import { WowClassIcon, WowFactionIcon } from '@/components/game-specific/WowCharacterIcons';
import type { CharacterWithProfessions } from '@/lib/types';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

export function ClassOverview({ characters, gameSlug, groupSlug }: {
  characters: CharacterWithProfessions[];
  gameSlug: string;
  groupSlug: string;
}) {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<ClassCharacterFilter>('all');
  const coverage = getClassCoverage(gameSlug, characters, filter);
  const classes = coverage.filter(entry => entry.id !== 'unknown');
  const total = coverage.reduce((count, entry) => count + entry.characters.length, 0);
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-white">
              <Swords className="text-amber-300" aria-hidden="true" />{t('classOverview.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{t('classOverview.description')}</p>
            {gameSlug === 'aoc' && <p className="mt-1 text-sm text-slate-400">{t('classOverview.archetypes')}</p>}
          </div>
          <div>
            <label htmlFor="class-character-filter" className="mb-1 block text-xs text-slate-400">
              {t('professionOverview.filter')}
            </label>
            <select id="class-character-filter" value={filter}
              onChange={event => setFilter(event.target.value as ClassCharacterFilter)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
              {(['all', 'main', 'alt'] as const).map(value =>
                <option key={value} value={value}>{t(`professionOverview.${value}`)}</option>
              )}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={18} aria-hidden="true" />
            {t('classOverview.covered', { covered: classes.filter(entry => entry.characters.length > 0).length, total: classes.length })}
          </span>
          <span className="flex items-center gap-2 text-indigo-200"><Users size={18} aria-hidden="true" />
            {t('classOverview.characters', { count: total })}
          </span>
        </div>
      </div>
      {coverage.length === 0 ? (
        <p className="text-slate-400">{t('classOverview.unsupported')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coverage.map(entry => (
            <article key={entry.id} className={`overflow-hidden rounded-xl border bg-slate-900/80 ${
              entry.characters.length ? 'border-indigo-400/25' : 'border-dashed border-slate-700'
            }`}>
              <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-800/30 p-4">
                <h2 className="flex items-center gap-2 font-semibold text-white">
                  {gameSlug === 'wowforever' && entry.id !== 'unknown' && <WowClassIcon classId={entry.id} />}
                  {entry.icon && <span aria-hidden="true">{entry.icon}</span>}
                  {entry.labelKey ? t(entry.labelKey) : entry.name}
                </h2>
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-sm text-indigo-200">
                  {t('classOverview.share', { count: entry.characters.length,
                    percent: percent.format(total ? entry.characters.length / total : 0) })}
                </span>
              </header>
              {entry.characters.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">{t('classOverview.noCoverage')}</p>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {entry.characters.map(character => {
                    const faction = gameSlug === 'wowforever'
                      ? getWowForeverFaction(character.wow_race || '', character.wow_class || '', character.wow_faction)
                      : null;
                    const detail = gameSlug === 'wowforever'
                      ? getWowForeverClass(character.wow_class || '')?.specs.find(spec => spec === character.wow_main_spec)
                      : gameSlug === 'aoc' && entry.id !== 'unknown' && character.primary_archetype
                        ? getClassName(character.primary_archetype,
                          character.secondary_archetype && Object.hasOwn(ARCHETYPES, character.secondary_archetype)
                            ? character.secondary_archetype : null)
                        : null;
                    return (
                      <li key={character.id} className="flex items-center gap-2 p-3">
                        {faction && <WowFactionIcon faction={faction} />}
                        <GuildRankBadge characterId={character.id} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/${groupSlug}/${gameSlug}/characters`}
                            className="block truncate text-sm text-slate-200 hover:text-indigo-300" title={character.name}>
                            {character.name}
                          </Link>
                          {detail && <p className="truncate text-xs text-slate-400">{detail}</p>}
                        </div>
                        <span className="max-w-24 truncate text-xs text-slate-400" title={t('character.owner')}>
                          {character.user_id
                            ? character.owner?.display_name || character.owner?.discord_username || t('character.ownerUnknown')
                            : t('character.unclaimed')}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${character.is_main
                          ? 'bg-amber-400/10 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                          {t(`professionOverview.${character.is_main ? 'mainLabel' : 'altLabel'}`)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
