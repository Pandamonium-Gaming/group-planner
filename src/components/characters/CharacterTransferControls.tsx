'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClientAuthStack } from '@/lib/authStack';
import { supabase } from '@/lib/supabase';
import { TRANSFER_MAX_BYTES, type TransferPreview } from '@/lib/characterTransfer';

export function CharacterTransferControls({ groupId, gameSlug, archived, onImported }: {
  groupId: string; gameSlug: string; archived: boolean; onImported: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [document, setDocument] = useState<unknown>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const endpoint = `/api/group/character-transfer?group_id=${encodeURIComponent(groupId)}&game_slug=${encodeURIComponent(gameSlug)}`;

  async function request(method: 'GET' | 'POST', payload?: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (getClientAuthStack() !== 'v2') {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!data.session) throw new Error(t('common.signIn'));
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const response = await fetch(endpoint, { method, headers, credentials: 'include', cache: 'no-store',
      body: method === 'POST' ? JSON.stringify(payload) : undefined });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || `Transfer failed (${response.status})`);
    }
    return response;
  }

  async function exportData() {
    setBusy(true); setError(null); setSuccess(false);
    try {
      const response = await request('GET');
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = `characters-${gameSlug}.json`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('characterTransfer.failed'));
    } finally { setBusy(false); }
  }

  async function loadFile(file: File) {
    setPreview(null); setDocument(null); setConfirmation(''); setSuccess(false); setError(null); setBusy(true);
    try {
      if (file.size > TRANSFER_MAX_BYTES) throw new Error(t('characterTransfer.tooLarge'));
      const parsed: unknown = JSON.parse(await file.text());
      const response = await request('POST', { document: parsed });
      setDocument(parsed);
      setPreview(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : t('characterTransfer.failed'));
    } finally { setBusy(false); }
  }

  async function importData() {
    if (!preview || confirmation !== 'IMPORT') return;
    setBusy(true); setError(null);
    try {
      await request('POST', { document, token: preview.token, apply: true, confirmation });
      setPreview(null); setDocument(null); setConfirmation('');
      await onImported();
      setSuccess(true);
    } catch (error) {
      setPreview(null); setConfirmation('');
      setError(error instanceof Error ? error.message : t('characterTransfer.failed'));
    } finally { setBusy(false); }
  }

  return <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/80 p-4">
    <h2 className="font-semibold text-slate-200">{t('characterTransfer.title')}</h2>
    <p className="text-sm text-slate-400">{t('characterTransfer.description')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={exportData} disabled={busy} className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50">
        {t('characterTransfer.export')}
      </button>
      <label htmlFor="character-transfer-file" className="text-sm text-slate-300">{t('characterTransfer.import')}</label>
      <input id="character-transfer-file" type="file" accept=".json,application/json" disabled={busy || archived}
        className="max-w-full text-sm text-slate-400"
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void loadFile(file); }} />
    </div>
    {preview && <div className="space-y-3 rounded-lg border border-amber-500/30 p-3">
      <p className="text-sm text-slate-200">{t('characterTransfer.preview', {
        create: preview.create_count, update: preview.update_count,
      })}</p>
      <p className="text-sm text-slate-400">{t('characterTransfer.replacesChildren')}</p>
      {preview.warnings.length > 0 && <div className="text-sm text-amber-300">
        <p>{t('characterTransfer.unclaimedWarning')}</p>
        <ul>{preview.warnings.map((warning, index) =>
          <li key={index}>{warning.name} — {warning.owner || t('character.ownerUnknown')}</li>)}</ul>
      </div>}
      <label htmlFor="character-transfer-confirmation" className="block text-sm text-slate-300">
        {t('characterTransfer.confirmation')}
      </label>
      <input id="character-transfer-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)}
        className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      <button onClick={importData} disabled={busy || confirmation !== 'IMPORT' || archived}
        className="ml-3 rounded-lg bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50">{t('characterTransfer.confirm')}</button>
      <button onClick={() => { setPreview(null); setDocument(null); setConfirmation(''); }} disabled={busy}
        className="ml-3 text-sm text-slate-300">{t('common.cancel')}</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-300">{t('characterTransfer.success')}</p>}
  </section>;
}
