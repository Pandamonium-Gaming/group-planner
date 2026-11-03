'use client';

import React from 'react';
import { useCharacterGuildRank } from '@/contexts/GuildRankContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface GuildRankProps {
  characterId: string | null | undefined;
}

export function GuildRankBadge({ characterId }: GuildRankProps) {
  const rank = useCharacterGuildRank(characterId);
  const { t } = useLanguage();
  if (!rank) return null;

  const label = `${t('character.guildRank')}: ${rank.name}`;
  return (
    <span title={label} aria-label={label}
      className={`inline-flex max-w-32 shrink-0 items-center gap-1 rounded border border-current/20 bg-slate-800/80 px-1.5 py-0.5 align-middle text-[10px] font-medium ${rank.color}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{rank.name}</span>
    </span>
  );
}

export function GuildRankText({ characterId }: GuildRankProps) {
  const rank = useCharacterGuildRank(characterId);
  return rank ? ` (${rank.name})` : null;
}
