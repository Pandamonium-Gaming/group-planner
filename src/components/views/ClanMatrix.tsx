'use client';

import { MemberWithProfessions, RankLevel, RANK_COLORS, RANK_NAMES } from '@/lib/types';
import { PROFESSIONS, PROFESSIONS_BY_TIER, TIER_CONFIG, PROFESSION_BY_ID, getFullDependencyChain } from '@/lib/professions';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Link2 } from 'lucide-react';
import { ProfessionHealth } from './ProfessionHealth';
import { SupplyChainView } from './SupplyChainView';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

interface ClanMatrixProps {
  members: MemberWithProfessions[];
}

interface MemberInfo {
  id: string;
  name: string;
  level: number;
}

interface ProfessionStats {
  professionId: string;
  name: string;
  byRank: Record<RankLevel, MemberInfo[]>; // members with levels by rank
  totalCoverage: number; // how many members have this at any level
  highestRank: RankLevel | 0;
}

function calculateProfessionStats(members: MemberWithProfessions[]): ProfessionStats[] {
  return PROFESSIONS.map((profession) => {
    const byRank: Record<RankLevel, MemberInfo[]> = { 1: [], 2: [], 3: [], 4: [] };
    let totalCoverage = 0;
    let highestRank: RankLevel | 0 = 0;

    for (const member of members) {
      const memberProf = member.professions.find((p) => p.profession === profession.id);
      if (memberProf) {
        byRank[memberProf.rank].push({ id: member.id, name: member.name, level: memberProf.artisan_level });
        totalCoverage++;
        if (memberProf.rank > highestRank) {
          highestRank = memberProf.rank;
        }
      }
    }

    return {
      professionId: profession.id,
      name: profession.name,
      byRank,
      totalCoverage,
      highestRank,
    };
  });
}

function ProfessionCard({ stats, showDependencies }: { stats: ProfessionStats; showDependencies: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const profession = PROFESSION_BY_ID.get(stats.professionId)!;
  const dependencies = getFullDependencyChain(stats.professionId);

  // Determine visual state based on highest rank
  const hasGrandmaster = stats.byRank[4].length > 0;
  const hasMaster = stats.byRank[3].length > 0;
  const hasJourneyman = stats.byRank[2].length > 0;
  const hasApprentice = stats.byRank[1].length > 0;

  let statusClass = 'border-slate-700 opacity-60'; // No coverage
  let statusGlow = '';

  if (hasGrandmaster) {
    statusClass = `${RANK_COLORS[4].border} ${RANK_COLORS[4].bg}`;
    statusGlow = `shadow-lg ${RANK_COLORS[4].glow}`;
  } else if (hasMaster) {
    statusClass = `${RANK_COLORS[3].border} ${RANK_COLORS[3].bg}`;
  } else if (hasJourneyman) {
    statusClass = `${RANK_COLORS[2].border} ${RANK_COLORS[2].bg}`;
  } else if (hasApprentice) {
    statusClass = `${RANK_COLORS[1].border} ${RANK_COLORS[1].bg}`;
  }

  return (
    <div
      className={`bg-slate-900/80 backdrop-blur-sm rounded-lg border ${statusClass} ${statusGlow} transition-all duration-300`}
    >
      <div
        className="p-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium text-white">{stats.name}</div>
          <div className="flex items-center gap-2">
            {/* Quick stats */}
            <div className="flex gap-1 text-xs">
              {stats.byRank[4].length > 0 && (
                <span className={`${RANK_COLORS[4].text} ${RANK_COLORS[4].bg} px-1.5 py-0.5 rounded`}>
                  {stats.byRank[4].length} GM
                </span>
              )}
              {stats.byRank[3].length > 0 && (
                <span className={`${RANK_COLORS[3].text} ${RANK_COLORS[3].bg} px-1.5 py-0.5 rounded`}>
                  {stats.byRank[3].length} M
                </span>
              )}
              {stats.byRank[2].length > 0 && (
                <span className={`${RANK_COLORS[2].text} ${RANK_COLORS[2].bg} px-1.5 py-0.5 rounded`}>
                  {stats.byRank[2].length} J
                </span>
              )}
              {stats.byRank[1].length > 0 && (
                <span className={`${RANK_COLORS[1].text} ${RANK_COLORS[1].bg} px-1.5 py-0.5 rounded`}>
                  {stats.byRank[1].length} A
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Users size={14} />
              <span className="text-xs">{stats.totalCoverage}</span>
            </div>
            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-800 pt-2 space-y-2">
          {/* Members by rank */}
          {([4, 3, 2, 1] as RankLevel[]).map((rank) => {
            if (stats.byRank[rank].length === 0) return null;
            return (
              <div key={rank} className="text-sm">
                <span className={`${RANK_COLORS[rank].text} font-medium`}>
                  {RANK_NAMES[rank]}:
                </span>
                <span className="text-slate-300 ml-2">
                  {stats.byRank[rank].map((member, index) => (
                    <span key={member.id}>
                      {index > 0 && ', '}{member.name} (L{member.level}) <GuildRankBadge characterId={member.id} />
                    </span>
                  ))}
                </span>
              </div>
            );
          })}

          {/* Dependencies */}
          {showDependencies && dependencies.length > 0 && (
            <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-800">
              <span className="font-medium">Requires:</span>{' '}
              {dependencies.map((depId) => PROFESSION_BY_ID.get(depId)?.name).join(' → ')}
            </div>
          )}

          {stats.totalCoverage === 0 && (
            <div className="text-sm text-slate-500 italic">No members have this profession</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClanMatrix({ members }: ClanMatrixProps) {
  const [showDependencies, setShowDependencies] = useState(true);
  const [viewMode, setViewMode] = useState<'coverage' | 'supplychain'>('coverage');
  const stats = calculateProfessionStats(members);

  const statsByTier = {
    gathering: stats.filter((s) => PROFESSION_BY_ID.get(s.professionId)?.tier === 'gathering'),
    processing: stats.filter((s) => PROFESSION_BY_ID.get(s.professionId)?.tier === 'processing'),
    crafting: stats.filter((s) => PROFESSION_BY_ID.get(s.professionId)?.tier === 'crafting'),
  };

  // Summary stats
  const totalGM = stats.reduce((sum, s) => sum + s.byRank[4].length, 0);
  const totalMaster = stats.reduce((sum, s) => sum + s.byRank[3].length, 0);
  const uncoveredCount = stats.filter((s) => s.totalCoverage === 0).length;

  return (
    <div className="space-y-6">
      {/* Profession Health Dashboard */}
      <ProfessionHealth members={members} />

      {/* View Mode Toggle */}
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View mode buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('coverage')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'coverage' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Users size={16} />
              Coverage
            </button>
            <button
              onClick={() => setViewMode('supplychain')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                viewMode === 'supplychain' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Link2 size={16} />
              Supply Chain
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div className="whitespace-nowrap">
              <span className="text-slate-400">GM:</span>
              <span className={`ml-1 font-semibold ${RANK_COLORS[4].text}`}>{totalGM}</span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-slate-400">Master:</span>
              <span className={`ml-1 font-semibold ${RANK_COLORS[3].text}`}>{totalMaster}</span>
            </div>
            {uncoveredCount > 0 && (
              <div className="whitespace-nowrap">
                <span className="text-slate-400">Missing:</span>
                <span className="ml-1 font-semibold text-red-400">{uncoveredCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conditional view */}
      {viewMode === 'supplychain' ? (
        <SupplyChainView members={members} />
      ) : (
        <>
          {/* Dependencies toggle */}
          <div className="flex justify-end">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showDependencies}
                onChange={(e) => setShowDependencies(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer"
              />
              Show dependencies
            </label>
          </div>

          {/* Profession grids by tier */}
          {(['gathering', 'processing', 'crafting'] as const).map((tier) => (
            <div key={tier}>
              <h3 className={`text-lg font-semibold ${TIER_CONFIG[tier].color} mb-3 flex items-center gap-2`}>
                <span>{TIER_CONFIG[tier].icon}</span>
                {TIER_CONFIG[tier].label}
                <span className="text-sm text-slate-500 font-normal">({statsByTier[tier].length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {statsByTier[tier].map((profStats) => (
                  <ProfessionCard key={profStats.professionId} stats={profStats} showDependencies={showDependencies} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
