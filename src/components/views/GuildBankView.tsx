'use client';

import { useState } from 'react';
import { Warehouse, Coins, Package, Search, TrendingUp, TrendingDown, Clock, Plus } from 'lucide-react';
import { 
  GuildBank, 
  BankInventoryWithResource, 
  BankTransactionWithDetails,
  ResourceCategory,
  ResourceCatalog,
  RESOURCE_CATEGORY_CONFIG,
  ITEM_RARITY_CONFIG
} from '@/lib/types';
import { ResourceTransactionData } from '@/hooks/useGuildBank';
import { useLanguage } from '@/contexts/LanguageContext';
import { BankTransactionForm } from '@/components/forms/BankTransactionForm';
import { BankMoney } from '@/components/game-specific/BankMoney';

interface GuildBankViewProps {
  bank: GuildBank;
  inventory: BankInventoryWithResource[];
  transactions: BankTransactionWithDetails[];
  resourceCatalog?: ResourceCatalog[];
  onDeposit?: (data: ResourceTransactionData) => Promise<void>;
  onWithdraw?: (data: ResourceTransactionData) => Promise<void>;
  onDepositGold?: (amount: number, notes?: string) => Promise<void>;
  onWithdrawGold?: (amount: number, notes?: string) => Promise<void>;
  isOfficer?: boolean;
}

const CATEGORIES: ResourceCategory[] = ['raw_material', 'processed', 'consumable', 'equipment', 'currency', 'blueprint', 'other'];

export function GuildBankView({
  bank,
  inventory,
  transactions,
  resourceCatalog = [],
  onDeposit,
  onWithdraw,
  onDepositGold,
  onWithdrawGold,
  isOfficer = false,
}: GuildBankViewProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory');
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.resource.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.resource.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.resource.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<ResourceCategory, BankInventoryWithResource[]>);

  // Total value calculation
  const totalValue = inventory.reduce((sum, item) => {
    return sum + (item.quantity * (item.resource.base_value || 0));
  }, 0);

  // Get inventory quantity for a resource
  const getInventoryQuantity = (resourceId: string) => {
    const item = inventory.find(i => i.resource_id === resourceId);
    return item ? item.quantity - (item.reserved_quantity || 0) : 0;
  };

  // Handle transactions
  const handleDeposit = async (resourceId: string, quantity: number, notes?: string) => {
    if (onDeposit) {
      await onDeposit({ resource_id: resourceId, quantity, notes });
      setShowDepositForm(false);
    }
  };

  const handleWithdraw = async (resourceId: string, quantity: number, notes?: string) => {
    if (onWithdraw) {
      await onWithdraw({ resource_id: resourceId, quantity, notes });
      setShowWithdrawForm(false);
    }
  };

  return (
    <>
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Warehouse className="w-8 h-8 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-white">{bank.name}</h2>
              {bank.description && (
                <p className="text-sm text-slate-400">{bank.description}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-2xl font-bold text-yellow-400">
              <Coins className="w-6 h-6" />
              <BankMoney amount={bank.gold_balance} gameSlug={bank.game_slug} />
            </div>
            <div className="text-xs text-slate-400">{t(bank.game_slug === 'wowforever' ? 'bank.categories.currency' : 'bank.gold')}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{inventory.length}</div>
            <div className="text-xs text-slate-400">{t('bank.uniqueItems')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">
              {inventory.reduce((sum, i) => sum + i.quantity, 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">{t('bank.totalItems')}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{totalValue.toLocaleString()}</div>
            <div className="text-xs text-slate-400">{t('bank.estimatedValue')}</div>
          </div>
        </div>

        {/* Action Buttons */}
        {(onDeposit || onWithdraw || onDepositGold || onWithdrawGold) && (
          <div className="flex gap-2 mt-4">
            {(onDeposit || onDepositGold) && (
              <button
                onClick={() => setShowDepositForm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                {t('bank.deposit')}
              </button>
            )}
            {(onWithdraw || onWithdrawGold) && (
              <button
                onClick={() => setShowWithdrawForm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <TrendingDown className="w-4 h-4" />
                {t('bank.withdraw')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 inline mr-1" />
          {t('bank.inventory')}
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'transactions'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          {t('bank.transactions')}
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('bank.searchResources')}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ResourceCategory | 'all')}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label={t('bank.allCategories')}
            >
              <option value="all">{t('bank.allCategories')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {RESOURCE_CATEGORY_CONFIG[cat].icon} {t(`bank.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Inventory Grid */}
          {Object.keys(groupedInventory).length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                {t('bank.emptyInventory')}
              </h3>
              <p className="text-sm text-slate-500">
                {t('bank.emptyInventoryDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((category) => {
                const items = groupedInventory[category];
                if (!items || items.length === 0) return null;

                const config = RESOURCE_CATEGORY_CONFIG[category];

                return (
                  <div key={category}>
                    <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${config.color}`}>
                      <span>{config.icon}</span>
                      {t(`bank.categories.${category}`)} ({items.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {items.map((item) => {
                        const rarityConfig = ITEM_RARITY_CONFIG[item.resource.rarity];
                        return (
                          <div
                            key={item.id}
                            className={`${rarityConfig.bgColor} rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors`}
                          >
                            <div className={`font-medium text-sm ${rarityConfig.color} truncate`}>
                              {item.resource.name}
                            </div>
                            <div className="text-xl font-bold text-white mt-1">
                              {item.quantity.toLocaleString()}
                            </div>
                            {item.reserved_quantity > 0 && (
                              <div className="text-xs text-amber-400 mt-1">
                                {item.reserved_quantity} {t('bank.reserved')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-300">
                {t('bank.noTransactions')}
              </h3>
            </div>
          ) : (
            transactions.map((tx) => {
              const isDeposit = tx.transaction_type === 'deposit' || tx.quantity > 0;
              const txDate = new Date(tx.created_at);

              return (
                <div
                  key={tx.id}
                  className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDeposit ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {isDeposit ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {tx.resource?.name || (tx.gold_amount !== 0 ? t(bank.game_slug === 'wowforever' ? 'bank.categories.currency' : 'bank.gold') : t('bank.adjustment'))}
                      </div>
                      <div className="text-xs text-slate-500">
                        {tx.user?.display_name || t('bank.system')} • {txDate.toLocaleDateString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${isDeposit ? 'text-green-400' : 'text-red-400'}`}>
                    {isDeposit ? '+' : ''}{tx.quantity !== 0 ? tx.quantity.toLocaleString()
                      : <BankMoney amount={tx.gold_amount} gameSlug={bank.game_slug} />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>

    {/* Transaction Modals */}
    <BankTransactionForm
      isOpen={showDepositForm}
      onClose={() => setShowDepositForm(false)}
      onSubmit={handleDeposit}
      transactionType="deposit"
      resourceCatalog={onDeposit ? resourceCatalog : []}
      onGoldSubmit={onDepositGold}
      gameSlug={bank.game_slug}
    />
    <BankTransactionForm
      isOpen={showWithdrawForm}
      onClose={() => setShowWithdrawForm(false)}
      onSubmit={handleWithdraw}
      transactionType="withdraw"
      resourceCatalog={onWithdraw ? resourceCatalog : []}
      inventoryQuantity={getInventoryQuantity}
      onGoldSubmit={onWithdrawGold}
      goldBalance={bank.gold_balance}
      gameSlug={bank.game_slug}
    />
    </>
  );
}
