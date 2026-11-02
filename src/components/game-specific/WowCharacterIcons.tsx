import React from 'react';
import { BowArrow, Leaf, Shield, Skull, Sparkles, Sword, Swords, WandSparkles, Zap } from 'lucide-react';
import { getWowForeverClass, type WowForeverFaction } from '@/games/wowforever/config';

const CLASS_ICONS = {
  druid: { icon: Leaf, color: '#ff7c0a' },
  hunter: { icon: BowArrow, color: '#aad372' },
  mage: { icon: WandSparkles, color: '#3fc7eb' },
  paladin: { icon: Shield, color: '#f48cba' },
  priest: { icon: Sparkles, color: '#ffffff' },
  rogue: { icon: Sword, color: '#fff468' },
  shaman: { icon: Zap, color: '#579aff' },
  warlock: { icon: Skull, color: '#8788ee' },
  warrior: { icon: Swords, color: '#c69b6d' },
} as const;

export function WowClassIcon({ classId }: { classId: string }) {
  const wowClass = getWowForeverClass(classId);
  if (!wowClass) return null;
  const { icon: Icon, color } = CLASS_ICONS[wowClass.id];
  return (
    <span title={wowClass.name} aria-label={wowClass.name} role="img"
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-current/30 bg-slate-950/60 p-1.5"
      style={{ color }}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

export function WowFactionIcon({ faction }: { faction: WowForeverFaction }) {
  return (
    <span title={faction} aria-label={faction} role="img"
      className={`inline-flex shrink-0 rounded-lg border p-1.5 ${
        faction === 'Alliance' ? 'border-blue-400/30 bg-blue-950/50 text-amber-300' : 'border-red-400/30 bg-red-950/50 text-red-400'
      }`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16v9c0 4-4 6-8 8-4-2-8-4-8-8Z" />
        {faction === 'Alliance'
          ? <><path d="m7 8 2 3 3-4 3 4 2-3v6H7Z" /><path d="M9 17h6" /></>
          : <><path d="m7 8 5 9 5-9M8 14h8M12 6v11" /><path d="m6 7 2 1m10-1-2 1" /></>}
      </svg>
    </span>
  );
}
