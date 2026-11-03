"use client";

import { EconomyTabContent } from '@/components/views/EconomyTabContent';

export interface EconomyTabProps {
  groupId: string;
  isOfficer: boolean;
}

export function EconomyTab({ groupId, isOfficer }: EconomyTabProps) {
  return <EconomyTabContent groupId={groupId} isOfficer={isOfficer} canManageBank={isOfficer} />;
}
