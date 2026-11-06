'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { isWowForeverProfessionRank } from '@/games/wowforever/config';
import { WOW_SECONDARY_SKILL_LABELS, type WowSkill } from '@/games/wowforever/config/skills';
import { RANK_COLORS } from '@/lib/types';

const COLORS = {
  apprentice: RANK_COLORS[1],
  journeyman: RANK_COLORS[2],
  expert: RANK_COLORS[3],
  artisan: RANK_COLORS[4],
};

export function WowSkillRankBadge({ rank }: { rank?: string | null }) {
  const { t } = useLanguage();
  const colors = isWowForeverProfessionRank(rank) ? COLORS[rank] : null;
  const label = isWowForeverProfessionRank(rank) ? t(`wowForever.professionRanks.${rank}`)
    : rank || t('wowForever.rankNotRecorded');
  return (
    <span title={t('wowSkills.rank')} className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium [overflow-wrap:anywhere] ${
      colors ? `${colors.text} ${colors.border} ${colors.bg}` : 'border-slate-700 bg-slate-800/60 text-slate-400'
    }`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function WowSkillProgress({ skill }: { skill: Pick<WowSkill, 'current' | 'max'> }) {
  const { t } = useLanguage();
  return (
    <span className="text-xs tabular-nums text-slate-300" title={t('wowSkills.progress')}>
      {skill.current ?? t('wowSkills.unknown')} / {skill.max ?? t('wowSkills.unknown')}
    </span>
  );
}

export function WowSkillDisplay({ skills }: { skills: WowSkill[] }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3 border-t border-slate-800 pt-3">
      <h3 className="font-medium text-slate-300">{t('wowSkills.title')}</h3>
      {skills.length === 0 ? <p className="text-slate-500">{t('wowSkills.noneRecorded')}</p> : (
        <ul className="space-y-2">
          {skills.map(skill => (
            <li key={skill.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="text-slate-200">{skill.category === 'secondary'
                  ? t(WOW_SECONDARY_SKILL_LABELS[skill.name]) : skill.name}</span>
                <span className="ml-2 text-xs text-slate-500">{t(`wowSkills.categories.${skill.category}`)}</span>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2">
                <WowSkillRankBadge rank={skill.rank} />
                <WowSkillProgress skill={skill} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
