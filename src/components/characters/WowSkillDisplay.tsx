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

export function getWowSkillRankColors(rank?: string | null) {
  return isWowForeverProfessionRank(rank) ? COLORS[rank] : null;
}

export function WowSkillRankBadge({ rank }: { rank?: string | null }) {
  const { t } = useLanguage();
  const colors = getWowSkillRankColors(rank);
  const label = isWowForeverProfessionRank(rank) ? t(`wowForever.professionRanks.${rank}`)
    : rank || t('wowForever.rankNotRecorded');
  return (
    <span title={t('wowSkills.rank')} className={`inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-0.5 text-sm font-medium [overflow-wrap:anywhere] ${
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
    <span className="text-sm tabular-nums text-slate-300" title={t('wowSkills.progress')}>
      {skill.current ?? t('wowSkills.unknown')} / {skill.max ?? t('wowSkills.unknown')}
    </span>
  );
}

export function WowTrainingRow({ name, detail, rank, progress }: {
  name: string;
  detail: string;
  rank?: string | null;
  progress?: Pick<WowSkill, 'current' | 'max'>;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-800/50 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 [overflow-wrap:anywhere]">
        <span className="text-base font-medium text-slate-200">{name}</span>
        <span className="text-sm text-slate-400">{detail}</span>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        {rank !== undefined && <WowSkillRankBadge rank={rank} />}
        {progress && <WowSkillProgress skill={progress} />}
      </div>
    </li>
  );
}

export function WowSkillDisplay({ skills }: { skills: WowSkill[] }) {
  const { t } = useLanguage();
  return (
    <section aria-label={t('wowSkills.title')} className="space-y-3 border-t border-slate-800 pt-4">
      <h4 className="text-base font-semibold text-slate-200">{t('wowSkills.title')}</h4>
      {skills.length === 0 ? <p className="text-sm text-slate-400">{t('wowSkills.noneRecorded')}</p> : (
        <ul className="space-y-2">
          {skills.map(skill => (
            <WowTrainingRow key={skill.name}
              name={skill.category === 'secondary' ? t(WOW_SECONDARY_SKILL_LABELS[skill.name]) : skill.name}
              detail={t(`wowSkills.categories.${skill.category}`)}
              rank={skill.rank} progress={skill} />
          ))}
        </ul>
      )}
    </section>
  );
}
