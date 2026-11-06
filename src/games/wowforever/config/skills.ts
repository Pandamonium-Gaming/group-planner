import { isWowForeverProfessionRank, WOW_FOREVER_PROFESSIONS } from './index';

export const WOW_SECONDARY_SKILLS = ['Cooking', 'First Aid', 'Fishing'] as const;
export const WOW_OTHER_SKILL_CATEGORIES = ['class', 'weapon', 'defence', 'riding'] as const;
export type WowSkillCategory = 'secondary' | (typeof WOW_OTHER_SKILL_CATEGORIES)[number];

export interface WowSkill {
  name: string;
  category: WowSkillCategory;
  rank: string | null;
  current: number | null;
  max: number | null;
}

export const WOW_SECONDARY_SKILL_LABELS: Record<string, string> = {
  Cooking: 'wowSkills.cooking',
  'First Aid': 'wowSkills.firstAid',
  Fishing: 'wowSkills.fishing',
};

export function isValidWowSkills(value: unknown): value is WowSkill[] {
  if (!Array.isArray(value)) return false;
  const names = new Set<string>();
  return value.every((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const skill = entry as Record<string, unknown>;
    if (Object.keys(skill).length !== 5 ||
      !['name', 'category', 'rank', 'current', 'max'].every(key => Object.hasOwn(skill, key)) ||
      typeof skill.name !== 'string' || !skill.name.trim() || skill.name !== skill.name.trim() ||
      skill.name.length > 80 || /[\u0000-\u001f\u007f]/.test(skill.name)) return false;
    const name = skill.name.toLowerCase();
    if (names.has(name) || WOW_FOREVER_PROFESSIONS.some(profession => profession.toLowerCase() === name)) return false;
    names.add(name);
    const secondary = WOW_SECONDARY_SKILLS.some(option => option.toLowerCase() === name);
    if (skill.category === 'secondary') {
      if (!(WOW_SECONDARY_SKILLS as readonly string[]).includes(skill.name) ||
        (skill.rank !== null && !isWowForeverProfessionRank(skill.rank))) return false;
    } else if (secondary || !(WOW_OTHER_SKILL_CATEGORIES as readonly unknown[]).includes(skill.category) ||
      (skill.rank !== null && (typeof skill.rank !== 'string' || !skill.rank.trim() ||
        skill.rank !== skill.rank.trim() || skill.rank.length > 80 || /[\u0000-\u001f\u007f]/.test(skill.rank)))) return false;
    for (const field of ['current', 'max'] as const) {
      if (skill[field] !== null && (typeof skill[field] !== 'number' ||
        !Number.isSafeInteger(skill[field]) || skill[field] < 0)) return false;
    }
    return skill.current === null || skill.max === null ||
      (typeof skill.current === 'number' && typeof skill.max === 'number' && skill.current <= skill.max);
  });
}
