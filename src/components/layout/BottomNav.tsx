"use client";
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { Users, Calendar, Grid3X3, Settings, Sword, Trophy, Handshake, Hammer, TrendingUp, Ship } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { Tab, GAME_TAB_EXCLUSIONS } from '@/components/common/tabs';

interface BottomNavProps {
  activeTab: Tab;
  canManage: boolean;
  gameSlug?: string;
  groupSlug: string;
}

// All available nav items - order matters for display
const ALL_NAV_ITEMS: { tab: Tab; icon: React.ElementType; labelKey: string; requiresManage?: boolean }[] = [
  { tab: 'characters', icon: Users, labelKey: 'nav.characters' },
  { tab: 'professions', icon: Hammer, labelKey: 'professionOverview.title' },
  { tab: 'events', icon: Calendar, labelKey: 'nav.events' },
  { tab: 'matrix', icon: Grid3X3, labelKey: 'nav.matrix' },
  { tab: 'ships', icon: Ship, labelKey: 'nav.guild-ships' },
  { tab: 'parties', icon: Users, labelKey: 'nav.parties' },
  { tab: 'siege', icon: Sword, labelKey: 'nav.siege' },
  { tab: 'achievements', icon: Trophy, labelKey: 'nav.achievements' },
  { tab: 'alliances', icon: Handshake, labelKey: 'nav.alliances' },
  { tab: 'builds', icon: Hammer, labelKey: 'nav.builds' },
  { tab: 'economy', icon: TrendingUp, labelKey: 'nav.economy' },
  { tab: 'manage', icon: Settings, labelKey: 'nav.manage', requiresManage: true },
];

export function BottomNav({ activeTab, canManage, gameSlug = 'aoc', groupSlug }: BottomNavProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  
  const getTabPath = (tab: Tab): string => {
    const basePath = `/${groupSlug}/${gameSlug}`;
    switch (tab) {
      case 'characters': return `${basePath}/characters`;
      case 'professions': return `${basePath}/professions`;
      case 'events': return `${basePath}/events`;
      case 'matrix': return gameSlug === 'starcitizen' ? `${basePath}/hangar` : `${basePath}/matrix`;
      case 'parties': return `${basePath}/parties`;
      case 'siege': return `${basePath}/siege`;
      case 'achievements': return `${basePath}/achievements`;
      case 'alliances': return `${basePath}/alliances`;
      case 'builds': return `${basePath}/builds`;
      case 'economy': return `${basePath}/economy`;
      case 'ships': return `${basePath}/ships`;
      case 'more': return `${basePath}/more`;
      case 'manage': return `${basePath}/settings`;
      default: return `${basePath}/characters`;
    }
  };

  // Get custom label for specific game/tab combinations
  const getTabLabel = (tab: Tab, labelKey: string): string => {
    if (gameSlug === 'starcitizen' && tab === 'matrix') {
      return t('nav.fleet');
    }
    return t(labelKey);
  };
  
  const excludedTabs = GAME_TAB_EXCLUSIONS[gameSlug] || [];
  const visibleItems = ALL_NAV_ITEMS.filter(item => {
    if (excludedTabs.includes(item.tab)) return false;
    if (item.requiresManage && !canManage) return false;
    return true;
  });

  // Scroll active tab into view on mount
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeEl = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      
      // Center the active item
      const scrollLeft = activeEl.offsetLeft - (containerRect.width / 2) + (activeRect.width / 2);
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeTab]);
  
  return (
    <nav 
      className="relative z-50"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(3, 7, 18, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(99, 102, 241, 0.1)',
      }}
    >
      {/* Scrollable tab container */}
      <div 
        ref={scrollRef}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {visibleItems.map(({ tab, icon: Icon, labelKey }) => {
          const isActive = activeTab === tab;
          return (
            <Link
              key={tab}
              ref={isActive ? activeRef : null}
              href={getTabPath(tab)}
              prefetch={true}
              className={`
                relative flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap
                transition-all duration-200 shrink-0
                ${isActive 
                  ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }
              `}
            >
              <Icon 
                size={18} 
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'text-indigo-400' : ''}
              />
              <span 
                className={`text-sm font-medium ${isActive ? 'text-indigo-300' : ''}`}
              >
                {getTabLabel(tab, labelKey)}
              </span>
              
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </div>
      
      {/* Gradient fade indicators for scroll */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-950/90 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-950/90 to-transparent pointer-events-none" />
    </nav>
  );
}
