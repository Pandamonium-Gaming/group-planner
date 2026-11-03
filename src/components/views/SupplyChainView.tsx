'use client';

import { useState } from 'react';
import { MemberWithProfessions, RANK_COLORS } from '@/lib/types';
import { PROFESSION_BY_ID, PROFESSIONS_BY_TIER, TIER_CONFIG, getFullDependencyChain } from '@/lib/professions';
import { ChevronRight, Users, AlertTriangle, CheckCircle, Link2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

interface SupplyChainViewProps {
  members: MemberWithProfessions[];
}

interface CrafterInfo {
  professionId: string;
  professionName: string;
  dependencies: {
    id: string;
    name: string;
    tier: string;
    providers: { id: string; name: string; rank: number }[];
    hasMaster: boolean;
  }[];
  crafters: { id: string; name: string; rank: number }[];
}

function getCrafterInfo(members: MemberWithProfessions[]): CrafterInfo[] {
  return PROFESSIONS_BY_TIER.crafting.map(prof => {
    // Get all crafters for this profession
    const crafters: CrafterInfo['crafters'] = [];
    for (const member of members) {
      const mp = member.professions.find(p => p.profession === prof.id);
      if (mp) {
        crafters.push({ id: member.id, name: member.name, rank: mp.rank });
      }
    }

    // Get full dependency chain
    const depIds = getFullDependencyChain(prof.id);
    const dependencies = depIds.map(depId => {
      const depProf = PROFESSION_BY_ID.get(depId)!;
      const providers: CrafterInfo['crafters'] = [];
      
      for (const member of members) {
        const mp = member.professions.find(p => p.profession === depId);
        if (mp) {
          providers.push({ id: member.id, name: member.name, rank: mp.rank });
        }
      }

      return {
        id: depId,
        name: depProf.name,
        tier: depProf.tier,
        providers,
        hasMaster: providers.some(p => p.rank >= 3),
      };
    });

    // Sort by tier (gathering first, then processing)
    dependencies.sort((a, b) => {
      const tierOrder = { gathering: 0, processing: 1, crafting: 2 };
      return (tierOrder[a.tier as keyof typeof tierOrder] || 0) - 
             (tierOrder[b.tier as keyof typeof tierOrder] || 0);
    });

    return {
      professionId: prof.id,
      professionName: prof.name,
      dependencies,
      crafters: crafters.sort((a, b) => b.rank - a.rank),
    };
  });
}

function SupplyChainCard({ info }: { info: CrafterInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();
  
  const hasCrafters = info.crafters.length > 0;
  const hasMasterCrafter = info.crafters.some(c => c.rank >= 3);
  const missingDeps = info.dependencies.filter(d => !d.hasMaster);
  const hasSupplyIssue = hasMasterCrafter && missingDeps.length > 0;

  return (
    <div className={`bg-slate-900/80 backdrop-blur-sm rounded-lg border transition-all ${
      !hasCrafters ? 'border-slate-700 opacity-60' :
      hasSupplyIssue ? 'border-yellow-500/50' :
      hasMasterCrafter ? 'border-green-500/30' :
      'border-slate-700'
    }`}>
      {/* Header */}
      <div 
        className="p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-rose-400">🔨</span>
            <span className="font-medium text-white">{info.professionName}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Status indicators */}
            {hasSupplyIssue && (
              <span className="text-yellow-400" title={t('matrix.missingSuppliers')}>
                <AlertTriangle size={14} />
              </span>
            )}
            {hasMasterCrafter && !hasSupplyIssue && (
              <span className="text-green-400" title={t('matrix.fullySupplied')}>
                <CheckCircle size={14} />
              </span>
            )}
            
            {/* Crafter count */}
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Users size={12} />
              <span>{info.crafters.length}</span>
            </div>

            <ChevronRight 
              size={16} 
              className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-3 space-y-4">
          {/* Crafters */}
          <div>
            <h4 className="text-xs text-slate-500 mb-2">Crafters:</h4>
            {info.crafters.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {info.crafters.map((c, i) => (
                  <span 
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded ${RANK_COLORS[c.rank as 1|2|3|4]?.bg || 'bg-slate-800'} ${RANK_COLORS[c.rank as 1|2|3|4]?.text || 'text-slate-300'}`}
                  >
                    {c.name}
                    {' '}<GuildRankBadge characterId={c.id} />
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">{t('party.noChars')}</span>
            )}
          </div>

          {/* Supply Chain */}
          {info.dependencies.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Link2 size={12} />
                Supply Chain:
              </h4>
              <div className="space-y-2">
                {info.dependencies.map((dep, i) => {
                  const tierIcon = TIER_CONFIG[dep.tier as keyof typeof TIER_CONFIG]?.icon || '📦';
                  const tierColor = TIER_CONFIG[dep.tier as keyof typeof TIER_CONFIG]?.color || 'text-slate-400';
                  
                  return (
                    <div 
                      key={i}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        dep.hasMaster ? 'bg-slate-800/30' : 'bg-red-500/10 border border-red-500/20'
                      }`}
                    >
                      <span>{tierIcon}</span>
                      <span className={`${tierColor} font-medium`}>{dep.name}</span>
                      <span className="text-slate-600">→</span>
                      {dep.providers.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {dep.providers.slice(0, 3).map((p, j) => (
                            <span 
                              key={j}
                              className={`text-xs px-1.5 py-0.5 rounded ${RANK_COLORS[p.rank as 1|2|3|4]?.bg || 'bg-slate-800'} ${RANK_COLORS[p.rank as 1|2|3|4]?.text || 'text-slate-300'}`}
                            >
                              {p.name}
                              {' '}<GuildRankBadge characterId={p.id} />
                            </span>
                          ))}
                          {dep.providers.length > 3 && (
                            <span className="text-xs text-slate-500">+{dep.providers.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-red-400 italic">{t('matrix.noSuppliers')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SupplyChainView({ members }: SupplyChainViewProps) {
  const crafterInfo = getCrafterInfo(members);
  
  // Stats
  const withMasterCrafter = crafterInfo.filter(c => c.crafters.some(cr => cr.rank >= 3)).length;
  const withSupplyIssues = crafterInfo.filter(c => {
    const hasMaster = c.crafters.some(cr => cr.rank >= 3);
    const missingDeps = c.dependencies.filter(d => !d.hasMaster);
    return hasMaster && missingDeps.length > 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-400">Crafting Professions:</span>
            <span className="ml-2 font-medium text-white">{crafterInfo.length}</span>
          </div>
          <div>
            <span className="text-slate-400">With Master+ Crafter:</span>
            <span className={`ml-2 font-medium ${withMasterCrafter > 0 ? 'text-green-400' : 'text-slate-500'}`}>
              {withMasterCrafter}
            </span>
          </div>
          {withSupplyIssues > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle size={14} className="text-yellow-400" />
              <span className="text-yellow-400">{withSupplyIssues} with supply issues</span>
            </div>
          )}
        </div>
      </div>

      {/* Crafting professions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {crafterInfo.map(info => (
          <SupplyChainCard key={info.professionId} info={info} />
        ))}
      </div>
    </div>
  );
}
