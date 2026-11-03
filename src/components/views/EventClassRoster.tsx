'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EventCharacter, EventWithRsvps } from '@/lib/events';
import { ARCHETYPES, getClassName, type ArchetypeId } from '@/lib/characters';
import { ROR_CLASSES } from '@/games/returnofreckooning/config';
import { getWowForeverClass } from '@/games/wowforever/config';
import { WowClassIcon } from '@/components/game-specific/WowCharacterIcons';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

function isArchetype(value: string | null | undefined): value is ArchetypeId {
  return !!value && Object.prototype.hasOwnProperty.call(ARCHETYPES, value);
}

function characterClass(game: string, character?: EventCharacter | null, guestClass?: string | null) {
  if (game === 'wowforever') {
    const info = getWowForeverClass(character?.wow_class || guestClass || '');
    return { className: info?.name, wowId: info?.id,
      spec: info?.specs.find(spec => spec === character?.wow_main_spec) };
  }
  if (game === 'ror') {
    return { className: ROR_CLASSES.find(info => info.id === (character?.ror_class || guestClass))?.name };
  }
  const primary = character?.primary_archetype || guestClass;
  const secondary = character?.secondary_archetype;
  return { className: isArchetype(primary) ? getClassName(primary, isArchetype(secondary) ? secondary : null) : undefined };
}

export function EventClassRoster({ event }: { event: Pick<EventWithRsvps, 'game_slug' | 'rsvps' | 'guest_rsvps'> }) {
  const { t } = useLanguage();
  const game = event.game_slug || 'aoc';
  if (!['aoc', 'ror', 'wowforever'].includes(game)) return null;

  const rows = [
    ...event.rsvps.map(rsvp => ({
      id: `member-${rsvp.id}`, status: rsvp.status,
      name: rsvp.character?.name || rsvp.user?.display_name || t('eventRoster.unknownCharacter'),
      owner: rsvp.character?.name ? rsvp.user?.display_name : null,
      characterId: rsvp.character?.id || rsvp.character_id,
      guest: false, linked: !!rsvp.character,
      ...characterClass(game, rsvp.character),
    })),
    ...(event.guest_rsvps || []).map(guest => ({
      id: `guest-${guest.id}`, status: guest.status, name: guest.guest_name, owner: null,
      characterId: null,
      guest: true, linked: false,
      ...characterClass(game, undefined, guest.class_id),
    })),
  ].filter(row => row.status === 'attending' || row.status === 'maybe');
  const totals = new Map<string, { attending: number; maybe: number }>();
  for (const row of rows) {
    const className = rowClassName(row);
    const counts = totals.get(className) || { attending: 0, maybe: 0 };
    if (row.status === 'attending') counts.attending++;
    else counts.maybe++;
    totals.set(className, counts);
  }

  function rowClassName(row: { className?: string }) {
    return row.className || t('eventRoster.unknownClass');
  }

  return (
    <section aria-label={t('eventRoster.title')} className="space-y-4 border border-slate-700 rounded-lg p-3 bg-slate-800/30">
      <h4 className="font-medium text-white">{t('eventRoster.title')}</h4>
      <p className="text-xs text-slate-400">{t('eventRoster.description')}</p>
      {rows.length === 0 ? <p className="text-sm text-slate-400">{t('eventRoster.empty')}</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <caption className="sr-only">{t('eventRoster.totals')}</caption>
              <thead className="text-slate-400"><tr>
                <th scope="col" className="py-2 pr-3">{t('eventRoster.class')}</th>
                <th scope="col" className="py-2 px-2">{t('eventRoster.attending')}</th>
                <th scope="col" className="py-2 pl-2">{t('eventRoster.maybe')}</th>
              </tr></thead>
              <tbody className="text-slate-200">
                {[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([name, counts]) => (
                  <tr key={name} className="border-t border-slate-700">
                    <th scope="row" className="py-2 pr-3 font-normal">{name}</th>
                    <td className="py-2 px-2 text-green-300">{counts.attending}</td>
                    <td className="py-2 pl-2 text-yellow-300">{counts.maybe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['attending', 'maybe'] as const).map(status => (
              <section key={status} aria-label={t(`eventRoster.${status}`)} className="min-w-0">
                <h5 className="text-sm font-medium text-white mb-2">
                  {t(`eventRoster.${status}`)} ({rows.filter(row => row.status === status).length})
                </h5>
                <ul className="space-y-2">
                  {rows.filter(row => row.status === status).map(row => (
                    <li key={row.id} className="flex items-start gap-2 min-w-0 text-sm">
                      {row.wowId && <WowClassIcon classId={row.wowId} />}
                      <div className="min-w-0 break-words">
                        <p className="text-slate-200">{row.name}{row.owner && ` (${row.owner})`}
                          {' '}<GuildRankBadge characterId={row.characterId} />
                          {row.guest && <span className="text-slate-400"> · {t('eventRoster.guest')}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {rowClassName(row)}
                          {game === 'wowforever' && ` · ${row.spec || t('eventRoster.unknownSpec')}`}
                          {!row.linked && !row.guest && ` · ${t('eventRoster.noCharacter')}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
