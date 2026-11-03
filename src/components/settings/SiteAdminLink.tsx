'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { webhookHeaders } from '@/lib/webhookClient';
import { useLanguage } from '@/contexts/LanguageContext';

export function SiteAdminLink() {
  const [allowed, setAllowed] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch('/api/admin/notifications/settings', {
          credentials: 'include', cache: 'no-store', headers: await webhookHeaders(),
        });
        if (!response.ok && response.status !== 401 && response.status !== 403) {
          throw new Error('Unable to check site administrator access');
        }
        if (active) setAllowed(response.ok);
      } catch {
        console.error('[admin-discord] Unable to check site administrator access');
      }
    }
    void check();
    return () => { active = false; };
  }, []);
  return allowed ? <Link href="/admin/notifications" className="block text-purple-400 py-3">{t('adminNotifications.siteTitle')}</Link> : null;
}
