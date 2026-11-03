'use client';

import React, { useState } from 'react';
import { Warehouse, Home, Truck, Coins } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGuildBank } from '@/hooks/useGuildBank';
import { useFreeholds } from '@/hooks/useFreeholds';
import { useCaravans } from '@/hooks/useCaravans';
import { GuildBankView } from './GuildBankView';
import { FreeholdDirectoryView } from './FreeholdDirectoryView';
import { CaravanListView } from './CaravanListView';

type EconomySubTab = 'bank' | 'freeholds' | 'caravans';

interface EconomyTabContentProps {
  groupId: string;
  gameSlug?: string;
  isOfficer: boolean;
  canManageBank: boolean;
  canDeposit?: boolean;
  canWithdraw?: boolean;
}

export function EconomyTabContent({
  groupId, gameSlug = 'aoc', isOfficer, canManageBank, canDeposit = true, canWithdraw = true,
}: EconomyTabContentProps) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<EconomySubTab>('bank');
  const [initializing, setInitializing] = useState(false);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const ashesGroupId = gameSlug === 'aoc' ? groupId : null;

  const {
    bank,
    inventory,
    transactions,
    resourceCatalog,
    loading: bankLoading,
    error: bankError,
    initializeBank,
    deposit,
    withdraw,
    adjustGold,
  } = useGuildBank(groupId, gameSlug);

  const {
    freeholds,
    loading: freeholdsLoading,
    createFreehold,
    addBuilding,
  } = useFreeholds(ashesGroupId);

  const {
    upcomingCaravans,
    loading: caravansLoading,
    createCaravan,
    signUpAsEscort,
    withdrawEscort,
  } = useCaravans(ashesGroupId);

  const handleInitialize = async () => {
    setInitializing(true);
    setInitializeError(null);
    try {
      await initializeBank();
    } catch (error) {
      console.error('Error initializing guild bank:', error);
      setInitializeError(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setInitializing(false);
    }
  };

  const SUB_TABS = [
    { id: 'bank', icon: Warehouse, label: t('bank.title') },
    { id: 'freeholds', icon: Home, label: t('freehold.title') },
    { id: 'caravans', icon: Truck, label: t('caravan.title') },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SUB_TABS.filter(tab => tab.id === 'bank' || gameSlug === 'aoc').map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSubTab(id as EconomySubTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              subTab === id
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'bank' && (
        bankLoading ? (
          <div className="text-center py-8 text-slate-400">{t('common.loading')}</div>
        ) : bankError ? (
          <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
            {t('common.error')}: {bankError}
          </p>
        ) : bank ? (
          <GuildBankView
            bank={bank}
            inventory={inventory}
            transactions={transactions}
            resourceCatalog={resourceCatalog}
            onDeposit={canDeposit ? deposit : undefined}
            onWithdraw={canWithdraw ? withdraw : undefined}
            onDepositGold={canDeposit ? (amount, notes) => adjustGold(amount, notes) : undefined}
            onWithdrawGold={canWithdraw ? (amount, notes) => adjustGold(-amount, notes) : undefined}
            isOfficer={isOfficer}
          />
        ) : (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center">
            <Coins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              {t('bank.emptyInventory')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('bank.emptyInventoryDesc')}
            </p>
            {canManageBank && (
              <button
                onClick={handleInitialize}
                disabled={initializing}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {initializing ? t('common.loading') : t('bank.title')}
              </button>
            )}
            {initializeError && <p role="alert" className="mt-4 text-sm text-red-400">{initializeError}</p>}
          </div>
        )
      )}

      {gameSlug === 'aoc' && subTab === 'freeholds' && (
        freeholdsLoading ? (
          <div className="text-center py-8 text-slate-400">{t('common.loading')}</div>
        ) : (
          <FreeholdDirectoryView
            freeholds={freeholds}
            onAddFreehold={createFreehold}
            onAddBuilding={addBuilding}
          />
        )
      )}

      {gameSlug === 'aoc' && subTab === 'caravans' && (
        caravansLoading ? (
          <div className="text-center py-8 text-slate-400">{t('common.loading')}</div>
        ) : (
          <CaravanListView
            caravans={upcomingCaravans}
            onCreateCaravan={isOfficer ? createCaravan : undefined}
            onSignUp={signUpAsEscort}
            onWithdraw={withdrawEscort}
            isOfficer={isOfficer}
          />
        )
      )}
    </div>
  );
}
