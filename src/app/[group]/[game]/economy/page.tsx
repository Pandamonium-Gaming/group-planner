'use client';

import { useGameLayoutContext } from '@/contexts/GameLayoutContext';
import { EconomyTab } from '../tabs/EconomyTab';

export default function EconomyPage() {
  const { group, userId, gameSlug, hasPermission } = useGameLayoutContext();

  if (!group || !userId) {
    return null;
  }

  return <EconomyTab key={`${group.id}:${gameSlug}`} groupId={group.id} gameSlug={gameSlug}
    isOfficer={hasPermission('guild_bank_manage')}
    canDeposit={hasPermission('guild_bank_deposit')}
    canWithdraw={hasPermission('guild_bank_withdraw')} />;
}