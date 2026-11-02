import { BottomNav } from '@/components/layout/BottomNav';
import { usePathname } from 'next/navigation';
import { Tab } from '@/components/common/tabs';

interface ClanTabNavProps {
  canManage: boolean;
  initialTab?: Tab;
  gameSlug?: string;
  groupSlug: string;
}

export function ClanTabNav({ canManage, initialTab = 'characters', gameSlug = 'aoc', groupSlug }: ClanTabNavProps) {
  const pathname = usePathname();
  
  // Determine active tab from pathname
  const getActiveTabFromPath = (): Tab => {
      if (!pathname) return initialTab;
    if (pathname.includes('/characters')) return 'characters';
    if (pathname.includes('/professions')) return 'professions';
    if (pathname.includes('/events')) return 'events';
    if (pathname.includes('/parties')) return 'parties';
    if (pathname.includes('/matrix')) return 'matrix';
    if (pathname.includes('/manage') || pathname.includes('/settings')) return 'manage';
    if (pathname.includes('/siege')) return 'siege';
    if (pathname.includes('/economy')) return 'economy';
    if (pathname.includes('/achievements')) return 'achievements';
    if (pathname.includes('/alliances')) return 'alliances';
    if (pathname.includes('/builds')) return 'builds';
    if (pathname.includes('/hangar')) return 'matrix'; // My Hangar uses matrix tab
    if (pathname.includes('/ships')) return 'ships'; // Guild Ships gets its own tab
    if (pathname.includes('/more')) return 'more';
    return initialTab;
  };

  const activeTab = getActiveTabFromPath();

  return (
    <BottomNav
      activeTab={activeTab}
      canManage={canManage}
      gameSlug={gameSlug}
      groupSlug={groupSlug}
    />
  );
}
