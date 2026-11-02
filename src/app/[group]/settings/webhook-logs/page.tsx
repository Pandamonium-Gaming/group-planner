'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useGroupData } from '@/hooks/useGroupData';
import { useLanguage } from '@/contexts/LanguageContext';
import { webhookHeaders } from '@/lib/webhookClient';

interface WebhookLog {
  id: string;
  game_slug: string | null;
  kind: string;
  subject_id: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: string;
}

export default function WebhookLogsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = use(params);
  const { group, loading: groupLoading, error: groupError } = useGroupData(slug);
  const groupId = group?.id;
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!groupId) return;
    const id = groupId;
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/group/webhook-logs?group_id=${encodeURIComponent(id)}&page=${page}`, {
          credentials: 'include', cache: 'no-store', headers: await webhookHeaders(),
        });
        if (!response.ok) throw new Error(`Unable to load webhook logs (${response.status})`);
        const data = await response.json() as { logs: WebhookLog[]; hasMore: boolean };
        if (active) { setLogs(data.logs); setHasMore(data.hasMore); }
      } catch (error) {
        console.error('Unable to load webhook logs:', error);
        if (active) { setError(true); setLogs([]); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [groupId, page, refresh]);

  if (groupError || (!groupLoading && !group)) {
    return <main className="max-w-4xl mx-auto p-4">
      <Link href={`/${slug}/settings`} className="text-purple-400">{t('common.back')}</Link>
      <p role="alert" className="text-red-400">{t('webhooks.loadFailed')}</p>
    </main>;
  }

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4 pb-24">
      <Link href={`/${slug}/settings`} className="text-purple-400">{t('common.back')}</Link>
      <h1 className="text-2xl font-bold text-white">{t('webhooks.logs')}</h1>
      <p className="text-slate-400">{t('webhooks.logDescription')}</p>
      <button type="button" onClick={() => setRefresh(n => n + 1)} disabled={loading} className="px-3 py-2 bg-slate-700 rounded text-white disabled:opacity-50">{t('webhooks.refresh')}</button>
      {error && <p role="alert" className="text-red-400">{t('webhooks.loadFailed')}</p>}
      {loading ? <p role="status">{t('common.loading')}</p> : !error && (
        <div className="space-y-3">
          {logs.length === 0 && <p className="text-slate-400">{t('webhooks.empty')}</p>}
          {logs.map(log => (
            <article key={log.id} className="bg-slate-900 rounded border border-slate-700 p-4 break-words">
              <div className="flex flex-wrap gap-3 text-white">
                <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                <span>{t(`webhooks.kinds.${log.kind}`)}</span>
                <span className={log.status === 'failed' ? 'text-red-400' : log.status === 'sent' ? 'text-green-400' : 'text-slate-300'}>
                  {t(`webhooks.statuses.${log.status}`)}
                </span>
                {log.http_status && <span>HTTP {log.http_status}</span>}
              </div>
              <p className="text-slate-400">{log.game_slug || t('webhooks.groupWide')}</p>
              {log.subject_id && ['event', 'repost', 'reminder', 'announcement'].includes(log.kind) && (
                <Link className="text-purple-400" href={`/${slug}/${log.game_slug || 'aoc'}/events#${log.kind === 'announcement' ? 'announcement' : 'event'}-${log.subject_id}`}>
                  {t('webhooks.viewSubject')}
                </Link>
              )}
              {log.error && <p className="text-slate-300">{log.error}</p>}
            </article>
          ))}
        </div>
      )}
      <nav aria-label={t('webhooks.pagination')} className="flex gap-4">
        <button type="button" disabled={loading || page === 0} onClick={() => setPage(n => n - 1)} className="px-3 py-2 bg-slate-700 rounded disabled:opacity-50">{t('webhooks.previous')}</button>
        <button type="button" disabled={loading || error || !hasMore} onClick={() => setPage(n => n + 1)} className="px-3 py-2 bg-slate-700 rounded disabled:opacity-50">{t('webhooks.next')}</button>
      </nav>
    </main>
  );
}
