"use client";

import { EconomyTabContent } from '@/components/views/EconomyTabContent';

export interface EconomyTabProps {
  groupId: string;
  gameSlug: string;
  isOfficer: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
}

export function EconomyTab(props: EconomyTabProps) {
  return <EconomyTabContent {...props} />;
}
