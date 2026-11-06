'use client';

import React, { useId } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WOW_FOREVER_PROFESSION_RANKS } from '@/games/wowforever/config';
import {
  WOW_OTHER_SKILL_CATEGORIES, WOW_SECONDARY_SKILLS, WOW_SECONDARY_SKILL_LABELS,
  type WowSkill,
} from '@/games/wowforever/config/skills';

const INPUT_CLASS = 'min-w-0 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white';

export function WowSkillEditor({ skills, onChange }: { skills: WowSkill[]; onChange: (skills: WowSkill[]) => void }) {
  const { t } = useLanguage();
  const id = useId();
  const update = (index: number, changes: Partial<WowSkill>) =>
    onChange(skills.map((skill, position) => position === index ? { ...skill, ...changes } : skill));
  const remove = (index: number) => onChange(skills.filter((_, position) => position !== index));
  const fields = (skill: WowSkill, index: number, label: string) => (
    <div className="mt-3 space-y-3">
      <div>
        <label htmlFor={`${id}-${index}-rank`} className="mb-1 block text-xs text-slate-400">{t('wowSkills.rank')}</label>
        {skill.category === 'secondary' ? (
          <select id={`${id}-${index}-rank`} aria-label={`${t('wowSkills.rank')}: ${label}`}
            value={skill.rank || ''} onChange={event => update(index, { rank: event.target.value || null })}
            className={INPUT_CLASS}>
            <option value="">{t('wowForever.rankNotRecorded')}</option>
            {WOW_FOREVER_PROFESSION_RANKS.map(rank =>
              <option key={rank} value={rank}>{t(`wowForever.professionRanks.${rank}`)}</option>)}
          </select>
        ) : (
          <input id={`${id}-${index}-rank`} aria-label={`${t('wowSkills.rank')}: ${label}`}
            value={skill.rank || ''} maxLength={80} placeholder={t('wowForever.rankNotRecorded')}
            onChange={event => update(index, { rank: event.target.value || null })} className={INPUT_CLASS} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(['current', 'max'] as const).map(field => (
          <div key={field}>
            <label htmlFor={`${id}-${index}-${field}`} className="mb-1 block text-xs text-slate-400">{t(`wowSkills.${field}`)}</label>
            <input id={`${id}-${index}-${field}`} aria-label={`${t(`wowSkills.${field}`)}: ${label}`}
              type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} value={skill[field] ?? ''}
              placeholder={t('wowForever.rankNotRecorded')} className={INPUT_CLASS}
              onChange={event => update(index, { [field]: event.target.value === '' ? null : event.target.valueAsNumber })} />
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4 border-t border-slate-700 pt-4">
      <h3 className="font-medium text-slate-200">{t('wowSkills.secondaryTitle')}</h3>
      <p className="text-xs text-slate-400">{t('wowSkills.help')}</p>
      {WOW_SECONDARY_SKILLS.map(name => {
        const index = skills.findIndex(skill => skill.category === 'secondary' && skill.name === name);
        const label = t(WOW_SECONDARY_SKILL_LABELS[name]);
        return (
          <fieldset key={name} className="rounded-lg border border-slate-700 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={index !== -1} onChange={event => event.target.checked
                ? onChange([...skills, { name, category: 'secondary', rank: null, current: null, max: null }])
                : remove(index)} />
              {label}
            </label>
            {index !== -1 && fields(skills[index], index, label)}
          </fieldset>
        );
      })}
      <h3 className="font-medium text-slate-200">{t('wowSkills.otherTitle')}</h3>
      <p className="text-xs text-slate-400">{t('wowSkills.otherHelp')}</p>
      {skills.map((skill, index) => skill.category !== 'secondary' && (
        <fieldset key={index} className="min-w-0 rounded-lg border border-slate-700 p-3">
          <legend className="px-1 text-xs text-slate-400">{t('wowSkills.entry', { number: index + 1 })}</legend>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-${index}-name`} className="mb-1 block text-xs text-slate-400">{t('wowSkills.name')}</label>
              <input id={`${id}-${index}-name`} value={skill.name} required maxLength={80} className={INPUT_CLASS}
                onChange={event => update(index, { name: event.target.value })} />
            </div>
            <button type="button" onClick={() => remove(index)} className="mt-5 text-xs text-red-400 hover:text-red-300"
              aria-label={`${t('wowSkills.remove')}: ${skill.name || t('wowSkills.entry', { number: index + 1 })}`}>
              {t('wowSkills.remove')}
            </button>
          </div>
          <div className="mt-3">
            <label htmlFor={`${id}-${index}-category`} className="mb-1 block text-xs text-slate-400">{t('wowSkills.category')}</label>
            <select id={`${id}-${index}-category`} value={skill.category} className={INPUT_CLASS}
              onChange={event => {
                const category = WOW_OTHER_SKILL_CATEGORIES.find(value => value === event.target.value);
                if (category) update(index, { category });
              }}>
              {WOW_OTHER_SKILL_CATEGORIES.map(category =>
                <option key={category} value={category}>{t(`wowSkills.categories.${category}`)}</option>)}
            </select>
          </div>
          {fields(skill, index, skill.name || t('wowSkills.entry', { number: index + 1 }))}
        </fieldset>
      ))}
      <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-indigo-300 hover:bg-slate-800"
        onClick={() => onChange([...skills, { name: '', category: 'class', rank: null, current: null, max: null }])}>
        {t('wowSkills.add')}
      </button>
    </div>
  );
}
