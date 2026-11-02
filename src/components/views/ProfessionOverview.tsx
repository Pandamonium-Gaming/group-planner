'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Hammer, Users, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProfessionCoverage, type ProfessionCharacterFilter } from '@/lib/professionCoverage';
import { RANK_COLORS, RANK_NAMES, type CharacterWithProfessions } from '@/lib/types';
import { getWowForeverFaction } from '@/games/wowforever/config';
import { WowClassIcon, WowFactionIcon } from '@/components/game-specific/WowCharacterIcons';

export function ProfessionOverview({ characters, gameSlug, groupSlug }: {
  characters: CharacterWithProfessions[];
  gameSlug: string;
  groupSlug: string;
}) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ProfessionCharacterFilter>('all');
  const coverage = getProfessionCoverage(gameSlug, characters, filter);
  const covered = coverage.filter(profession => profession.characters.length > 0).length;
  const contributors = new Set(coverage.flatMap(profession => profession.characters.map(entry => entry.character.id))).size;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-white">
              <Hammer className="text-amber-300" aria-hidden="true" />{t('professionOverview.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{t('professionOverview.description')}</p>
          </div>
          <div>
            <label htmlFor="profession-character-filter" className="mb-1 block text-xs text-slate-400">
              {t('professionOverview.filter')}
            </label>
            <select id="profession-character-filter" value={filter}
              onChange={event => setFilter(event.target.value as ProfessionCharacterFilter)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
              {(['all', 'main', 'alt'] as const).map(value =>
                <option key={value} value={value}>{t(`professionOverview.${value}`)}</option>
              )}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-2 text-emerald-300"><CheckCircle2 size={18} aria-hidden="true" />
            {t('professionOverview.covered', { covered, total: coverage.length })}
          </span>
          <span className="flex items-center gap-2 text-indigo-200"><Users size={18} aria-hidden="true" />
            {t('professionOverview.contributors', { count: contributors })}
          </span>
        </div>
      </div>
      {coverage.length === 0 ? (
        <p className="text-slate-400">{t('professionOverview.unsupported')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coverage.map(profession => (
            <article key={profession.id} className={`overflow-hidden rounded-xl border bg-slate-900/80 ${
              profession.characters.length ? 'border-indigo-400/25' : 'border-dashed border-slate-700'
            }`}>
              <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-800/30 p-4">
                <h2 className="flex items-center gap-2 font-semibold text-white">
                  <span aria-hidden="true">{profession.icon}</span>{t(profession.labelKey)}
                </h2>
                <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-sm text-indigo-200">
                  {profession.characters.length}
                </span>
              </header>
              {profession.characters.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">{t('professionOverview.noCoverage')}</p>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {profession.characters.map(({ character, rank, wowRank }) => {
                    const faction = gameSlug === 'wowforever'
                      ? getWowForeverFaction(character.wow_race || '', character.wow_class || '', character.wow_faction)
                      : null;
                    return (
                      <li key={character.id} className="flex items-center gap-2 p-3">
                        {gameSlug === 'wowforever' && character.wow_class && <WowClassIcon classId={character.wow_class} />}
                        {faction && <WowFactionIcon faction={faction} />}
                        <Link href={`/${groupSlug}/${gameSlug}/characters`}
                          className="min-w-0 flex-1 truncate text-sm text-slate-200 hover:text-indigo-300" title={character.name}>
                          {character.name}
                        </Link>
                        <span className="max-w-24 truncate text-xs text-slate-400" title={t('character.owner')}>
                          {character.user_id
                            ? character.owner?.display_name || character.owner?.discord_username || t('character.ownerUnknown')
                            : t('character.unclaimed')}
                        </span>
                        {rank && <span className={`text-xs ${RANK_COLORS[rank].text}`}>{t(`character.${RANK_NAMES[rank].toLowerCase()}`)}</span>}
                        {gameSlug === 'wowforever' && <span className="text-xs text-indigo-200">
                          {t(wowRank ? `wowForever.professionRanks.${wowRank}` : 'wowForever.rankNotRecorded')}
                        </span>}
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
