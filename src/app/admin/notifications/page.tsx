'use client';

import React from 'react';
import Link from 'next/link';
import { AdminDiscordSettings } from '@/components/settings/AdminDiscordSettings';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SiteNotificationsPage() {
  const { t, isLoading } = useLanguage();
  if (isLoading) return <main className="max-w-4xl mx-auto p-4 py-8" aria-busy="true" />;
  return <main className="max-w-4xl mx-auto p-4 py-8 space-y-4">
    <Link href="/settings" className="text-purple-400">{t('common.back')}</Link>
    <AdminDiscordSettings siteWide />
  </main>;
}
