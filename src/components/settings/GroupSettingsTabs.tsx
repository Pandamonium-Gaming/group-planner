'use client';

import React, { useSyncExternalStore, type ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const TABS = ['general', 'members', 'permissions', 'discord', 'admin', 'recruitment', 'games'] as const;
type SettingsTab = typeof TABS[number];

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function GroupSettingsTabs({ panels }: { panels: Record<SettingsTab, ReactNode> }) {
  const { t } = useLanguage();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => 'general');
  const active = TABS.find(tab => tab === hash) || 'general';
  return <>
    <div role="tablist" aria-label={t('groupSettingsTabs.title')} className="flex flex-wrap gap-2 mb-6">
      {TABS.map((tab, index) => <button key={tab} type="button" role="tab" id={`tab-${tab}`}
        aria-controls={tab} aria-selected={tab === active} tabIndex={tab === active ? 0 : -1}
        onClick={() => { window.location.hash = tab; }}
        onKeyDown={event => {
          let next: number;
          if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
          else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = TABS.length - 1;
          else return;
          event.preventDefault();
          window.location.hash = TABS[next];
          document.getElementById(`tab-${TABS[next]}`)?.focus();
        }}
        className={`px-3 py-2 rounded text-sm ${tab === active ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
        {t(`groupSettingsTabs.${tab}`)}
      </button>)}
    </div>
    {TABS.map(tab => <div key={tab} role="tabpanel" id={tab} aria-labelledby={`tab-${tab}`}
      hidden={tab !== active} tabIndex={0} className="space-y-6">
      {panels[tab]}
    </div>)}
  </>;
}
