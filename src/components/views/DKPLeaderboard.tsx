'use client';

import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

import { Trophy, TrendingUp, TrendingDown, Medal } from 'lucide-react';
import { DKPPointsWithCharacter } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface DKPLeaderboardProps {
  leaderboard: DKPPointsWithCharacter[];
  systemName?: string;
  onCharacterClick?: (characterId: string) => void;
}

export function DKPLeaderboard({
  leaderboard,
  systemName = 'DKP',
  onCharacterClick,
}: DKPLeaderboardProps) {
  const { t } = useLanguage();

  if (leaderboard.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 text-center">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">
          {t('loot.noPoints')}
        </h3>
        <p className="text-sm text-slate-500">
          {t('loot.noPointsDesc')}
        </p>
      </div>
    );
  }

  // Get top 3 for podium
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          {systemName} {t('loot.leaderboard')}
        </h3>
        <span className="text-sm text-slate-400">
          {leaderboard.length} {t('loot.participants')}
        </span>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 0, 2].map((idx) => { // Order: 2nd, 1st, 3rd
          const entry = top3[idx];
          if (!entry) return <div key={idx} />;
          
          const medals = ['🥇', '🥈', '🥉'];
          const heights = ['h-24', 'h-32', 'h-20'];
          const bgColors = [
            'bg-gradient-to-t from-amber-500/20 to-amber-500/5',
            'bg-gradient-to-t from-slate-400/20 to-slate-400/5',
            'bg-gradient-to-t from-orange-600/20 to-orange-600/5',
          ];

          return (
            <div
              key={entry.id}
              onClick={() => onCharacterClick?.(entry.character_id)}
              className={`flex flex-col items-center justify-end ${heights[idx]} ${bgColors[idx]} rounded-t-lg cursor-pointer hover:opacity-80 transition-opacity`}
            >
              <span className="text-2xl mb-1">{medals[idx]}</span>
              <span className="text-sm font-medium text-white truncate max-w-full px-2">
                {entry.character?.name || t('loot.unknown')}
                {' '}<GuildRankBadge characterId={entry.character_id} />
              </span>
              <span className="text-lg font-bold text-amber-400 mb-2">
                {entry.current_points.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg divide-y divide-slate-700/50">
          {rest.map((entry) => (
            <div
              key={entry.id}
              onClick={() => onCharacterClick?.(entry.character_id)}
              className="flex items-center justify-between p-3 hover:bg-slate-700/30 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-sm text-slate-500 font-medium">
                  #{entry.rank}
                </span>
                <div>
                  <div className="font-medium text-white">
                    {entry.character?.name || t('loot.unknown')}
                    {' '}<GuildRankBadge characterId={entry.character_id} />
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-green-400">
                      <TrendingUp className="w-3 h-3" />
                      {entry.earned_total.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-0.5 text-red-400">
                      <TrendingDown className="w-3 h-3" />
                      {entry.spent_total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {entry.current_points.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">
                  {t('loot.points')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
