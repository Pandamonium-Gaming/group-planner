'use client';

import { useState } from 'react';
import { History, Gift, User, Calendar, Search } from 'lucide-react';
import { LootHistoryWithDetails, ITEM_RARITY_CONFIG, ItemRarity } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { GuildRankBadge } from '@/components/characters/GuildRankBadge';

interface LootHistoryViewProps {
  history: LootHistoryWithDetails[];
  onDistribute?: (lootId: string) => void;
}

export function LootHistoryView({
  history,
  onDistribute,
}: LootHistoryViewProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');

  // Filter history
  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = rarityFilter === 'all' || item.item_rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  // Group by distributed/pending
  const pendingLoot = filteredHistory.filter((h) => !h.distributed_at);
  const distributedLoot = filteredHistory.filter((h) => h.distributed_at);

  if (history.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 text-center">
        <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">
          {t('loot.noHistory')}
        </h3>
        <p className="text-sm text-slate-500">
          {t('loot.noHistoryDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          {t('loot.history')}
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('loot.searchItems')}
              className="pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as ItemRarity | 'all')}
            className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label={t('loot.allRarities')}
          >
            <option value="all">{t('loot.allRarities')}</option>
            {Object.entries(ITEM_RARITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {t(`loot.rarity.${key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pending Loot */}
      {pendingLoot.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
            <Gift className="w-4 h-4" />
            {t('loot.pending')} ({pendingLoot.length})
          </h4>
          <div className="space-y-2">
            {pendingLoot.map((item) => (
              <LootHistoryItem
                key={item.id}
                item={item}
                onDistribute={onDistribute}
                isPending
              />
            ))}
          </div>
        </div>
      )}

      {/* Distributed Loot */}
      <div className="space-y-2">
        {pendingLoot.length > 0 && (
          <h4 className="text-sm font-medium text-slate-400">
            {t('loot.distributed')} ({distributedLoot.length})
          </h4>
        )}
        <div className="space-y-2">
          {distributedLoot.map((item) => (
            <LootHistoryItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {filteredHistory.length === 0 && (
        <div className="text-center text-slate-500 py-8">
          {t('loot.noMatchingItems')}
        </div>
      )}
    </div>
  );
}

// Individual loot item component
function LootHistoryItem({
  item,
  onDistribute,
  isPending = false,
}: {
  item: LootHistoryWithDetails;
  onDistribute?: (lootId: string) => void;
  isPending?: boolean;
}) {
  const { t } = useLanguage();
  const rarityConfig = ITEM_RARITY_CONFIG[item.item_rarity];
  const droppedAt = new Date(item.dropped_at);

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 ${isPending ? 'border border-amber-500/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${rarityConfig.color}`}>
              {item.item_name}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${rarityConfig.bgColor} ${rarityConfig.color}`}>
              {t(`loot.rarity.${item.item_rarity}`)}
            </span>
            {item.item_slot && (
              <span className="text-xs text-slate-500">
                {item.item_slot}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {item.source_name && (
              <span>{item.source_name}</span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {droppedAt.toLocaleDateString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
            </span>
          </div>

          {item.awarded_to_character && (
            <div className="flex items-center gap-2 mt-2 text-sm">
              <User className="w-4 h-4 text-green-400" />
              <span className="text-green-400">{item.awarded_to_character.name} <GuildRankBadge characterId={item.awarded_to} /></span>
              {item.dkp_cost > 0 && (
                <span className="text-slate-500">
                  (-{item.dkp_cost} DKP)
                </span>
              )}
            </div>
          )}
        </div>

        {isPending && onDistribute && (
          <button
            onClick={() => onDistribute(item.id)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            {t('loot.distribute')}
          </button>
        )}
      </div>
    </div>
  );
}
