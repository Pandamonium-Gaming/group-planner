'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { webhookHeaders } from '@/lib/webhookClient';
import { ADMIN_NOTIFICATION_KINDS, type AdminRoleMentions } from '@/lib/adminNotifications';

interface AdminLog {
  id: string;
  kind: string;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: string;
}

export function AdminDiscordSettings({ groupId }: { groupId: string }) {
  const { t } = useLanguage();
  const [webhook, setWebhook] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [roleMentions, setRoleMentions] = useState<AdminRoleMentions>({});
  const [rolesDirty, setRolesDirty] = useState(false);
  const rolesEdited = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/group/admin-notifications?group_id=${encodeURIComponent(groupId)}&page=${page}`, {
          credentials: 'include', cache: 'no-store', headers: await webhookHeaders(),
        });
        if (!response.ok) throw new Error(`Unable to load admin notifications (${response.status})`);
        const data = await response.json() as { configured: boolean; role_mentions?: AdminRoleMentions; logs: AdminLog[]; hasMore: boolean };
        if (active) {
          setConfigured(data.configured);
          setLogs(data.logs);
          setHasMore(data.hasMore);
          if (!rolesEdited.current) setRoleMentions(data.role_mentions || {});
        }
      } catch {
        console.error('[admin-discord] Unable to load private group notification settings');
        if (active) { setError(true); setLogs([]); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [groupId, page, refresh]);

  async function saveRoles() {
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const response = await fetch('/api/group/admin-notifications', {
        method: 'POST', credentials: 'include', headers: await webhookHeaders(),
        body: JSON.stringify({ group_id: groupId, role_mentions: roleMentions }),
      });
      if (!response.ok) throw new Error('Unable to save admin role mentions');
      setRolesDirty(false);
      rolesEdited.current = false;
      setSaved(true);
      setRefresh(value => value + 1);
    } catch {
      console.error('[admin-discord] Unable to save notification role mentions');
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function save(disable: boolean) {
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      const response = await fetch('/api/group/admin-notifications', {
        method: 'POST', credentials: 'include', headers: await webhookHeaders(),
        body: JSON.stringify({ group_id: groupId, webhook_url: disable ? '' : webhook.trim() }),
      });
      if (!response.ok) throw new Error(`Unable to save admin webhook (${response.status})`);
      setConfigured(!disable);
      setWebhook('');
      setSaved(true);
      setRefresh(value => value + 1);
    } catch {
      console.error('[admin-discord] Unable to save private group notification settings');
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={t('adminNotifications.title')} className="bg-slate-900 rounded-lg border border-slate-700 p-4 sm:p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">{t('adminNotifications.title')}</h3>
      <p className="text-sm text-slate-400">{t('adminNotifications.description')}</p>
      <p className="text-sm text-slate-300">{t(configured ? 'adminNotifications.configured' : 'adminNotifications.notConfigured')}</p>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(false); }}>
        <label htmlFor="admin-discord-webhook" className="block text-sm text-slate-300">{t('adminNotifications.webhook')}</label>
        <input id="admin-discord-webhook" type="password" autoComplete="new-password" value={webhook}
          onChange={event => { setWebhook(event.target.value); setSaved(false); }}
          disabled={loading || saving} required maxLength={2048}
          className="w-full min-w-0 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white" />
        <p className="text-xs text-slate-400">{t('adminNotifications.private')}</p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={loading || saving || !webhook.trim()} className="px-3 py-2 rounded bg-purple-700 text-white disabled:opacity-50">
            {t(saving ? 'common.saving' : 'common.save')}
          </button>
          <button type="button" onClick={() => void save(true)} disabled={loading || saving || !configured}
            className="px-3 py-2 rounded bg-slate-700 text-white disabled:opacity-50">{t('adminNotifications.disable')}</button>
        </div>
      </form>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveRoles(); }}>
        <h4 className="text-white font-medium">{t('adminNotifications.roleMentions')}</h4>
        <p className="text-xs text-slate-400">{t('adminNotifications.roleMentionsHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ADMIN_NOTIFICATION_KINDS.filter(kind => kind !== 'account_registered' && kind !== 'group_created').map(kind => (
            <label key={kind} className="block text-sm text-slate-300">
              {t(`adminNotifications.kinds.${kind}`)}
              <input type="text" inputMode="numeric" pattern="[0-9]{17,20}" maxLength={20}
                value={roleMentions[kind] || ''} disabled={loading || saving}
                placeholder={t('adminNotifications.noMention')}
                onChange={event => {
                  const value = event.target.value.trim();
                  setRoleMentions(previous => {
                    const next = { ...previous };
                    if (value) next[kind] = value;
                    else delete next[kind];
                    return next;
                  });
                  setRolesDirty(true);
                  rolesEdited.current = true;
                  setSaved(false);
                }}
                className="block w-full min-w-0 mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white" />
            </label>
          ))}
        </div>
        <button type="submit" disabled={loading || saving || !rolesDirty}
          className="px-3 py-2 rounded bg-purple-700 text-white disabled:opacity-50">{t('adminNotifications.saveRoles')}</button>
      </form>
      {saved && <p role="status" className="text-green-400">{t('common.saved')}</p>}
      {error && <p role="alert" className="text-red-400">{t('adminNotifications.failed')}</p>}
      <h4 className="text-white font-medium">{t('adminNotifications.history')}</h4>
      <p className="text-xs text-slate-400">{t('adminNotifications.delivery')}</p>
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading || saving}
        className="px-3 py-2 rounded bg-slate-700 text-white disabled:opacity-50">{t('webhooks.refresh')}</button>
      {loading ? <p role="status">{t('common.loading')}</p> : !error && (
        <ul className="space-y-2">
          {logs.length === 0 && <li className="text-slate-400">{t('webhooks.empty')}</li>}
          {logs.map(log => <li key={log.id} className="border border-slate-700 rounded p-3 break-words space-y-1">
            <p className="text-white">{t(`adminNotifications.kinds.${log.kind}`)}</p>
            <p className="text-sm text-slate-300">
              <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
              {' · '}{t(`adminNotifications.statuses.${log.status}`)}
              {log.http_status ? ` · HTTP ${log.http_status}` : ''}
            </p>
            {log.error && <p className="text-xs text-slate-400">{log.error}</p>}
          </li>)}
        </ul>
      )}
      <nav aria-label={t('webhooks.pagination')} className="flex flex-wrap gap-3">
        <button type="button" disabled={loading || saving || page === 0} onClick={() => setPage(value => value - 1)}
          className="px-3 py-2 rounded bg-slate-700 text-white disabled:opacity-50">{t('webhooks.previous')}</button>
        <button type="button" disabled={loading || saving || error || !hasMore} onClick={() => setPage(value => value + 1)}
          className="px-3 py-2 rounded bg-slate-700 text-white disabled:opacity-50">{t('webhooks.next')}</button>
      </nav>
    </section>
  );
}
