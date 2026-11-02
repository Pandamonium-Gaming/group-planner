"use client";
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/Skeleton';
import { GAME_DISCORD_COLUMNS, GameId } from '@/lib/discordConfig';

import { useState, useEffect } from 'react';
import { Webhook, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { testDiscordWebhook } from '@/lib/discord';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClientAuthStack } from '@/lib/authStack';

interface ClanSettingsProps {
  groupId: string;
  gameSlug: string;
  currentAocWebhookUrl?: string;
  currentAocEventsWebhookUrl?: string;
  currentScWebhookUrl?: string;
  currentScEventsWebhookUrl?: string;
  currentRorWebhookUrl?: string;
  currentRorEventsWebhookUrl?: string;
  currentWowForeverWebhookUrl?: string;
  currentWowForeverEventsWebhookUrl?: string;
  aocAnnouncementRoleId?: string;
  aocEventsRoleId?: string;
  scAnnouncementRoleId?: string;
  scEventsRoleId?: string;
  rorAnnouncementRoleId?: string;
  rorEventsRoleId?: string;
  wowForeverAnnouncementRoleId?: string;
  wowForeverEventsRoleId?: string;
  onUpdate?: () => void;
}

export function ClanSettings({
  groupId,
  gameSlug,
  currentAocWebhookUrl = '',
  currentAocEventsWebhookUrl = '',
  currentScWebhookUrl = '',
  currentScEventsWebhookUrl = '',
  currentRorWebhookUrl = '',
  currentRorEventsWebhookUrl = '',
  currentWowForeverWebhookUrl = '',
  currentWowForeverEventsWebhookUrl = '',
  aocAnnouncementRoleId = '',
  aocEventsRoleId = '',
  scAnnouncementRoleId = '',
  scEventsRoleId = '',
  rorAnnouncementRoleId = '',
  rorEventsRoleId = '',
  wowForeverAnnouncementRoleId = '',
  wowForeverEventsRoleId = '',
  onUpdate,
}: ClanSettingsProps) {
  const { loading } = usePermissions(groupId);

  // Game-specific webhooks and roles
  const [gameConfig, setGameConfig] = useState<
    Record<GameId, {
      webhookUrl: string;
      eventsWebhookUrl: string;
      announcementRoleId: string;
      eventsRoleId: string;
    }>
  >({
    aoc: {
      webhookUrl: currentAocWebhookUrl,
      eventsWebhookUrl: currentAocEventsWebhookUrl,
      announcementRoleId: aocAnnouncementRoleId,
      eventsRoleId: aocEventsRoleId,
    },
    sc: {
      webhookUrl: currentScWebhookUrl,
      eventsWebhookUrl: currentScEventsWebhookUrl,
      announcementRoleId: scAnnouncementRoleId,
      eventsRoleId: scEventsRoleId,
    },
    ror: {
      webhookUrl: currentRorWebhookUrl,
      eventsWebhookUrl: currentRorEventsWebhookUrl,
      announcementRoleId: rorAnnouncementRoleId,
      eventsRoleId: rorEventsRoleId,
    },
    wowforever: {
      webhookUrl: currentWowForeverWebhookUrl,
      eventsWebhookUrl: currentWowForeverEventsWebhookUrl,
      announcementRoleId: wowForeverAnnouncementRoleId,
      eventsRoleId: wowForeverEventsRoleId,
    },
    cc: {
      webhookUrl: '',
      eventsWebhookUrl: '',
      announcementRoleId: '',
      eventsRoleId: '',
    },
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; game?: string } | null>(null);
  const { t } = useLanguage();
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  // Sync state when props change (when group data loads)
  useEffect(() => {
    let isMounted = true;

    const syncFromProps = () => {
      if (!isMounted) {
        return;
      }

      setGameConfig({
        aoc: {
          webhookUrl: currentAocWebhookUrl,
          eventsWebhookUrl: currentAocEventsWebhookUrl,
          announcementRoleId: aocAnnouncementRoleId,
          eventsRoleId: aocEventsRoleId,
        },
        sc: {
          webhookUrl: currentScWebhookUrl,
          eventsWebhookUrl: currentScEventsWebhookUrl,
          announcementRoleId: scAnnouncementRoleId,
          eventsRoleId: scEventsRoleId,
        },
        ror: {
          webhookUrl: currentRorWebhookUrl,
          eventsWebhookUrl: currentRorEventsWebhookUrl,
          announcementRoleId: rorAnnouncementRoleId,
          eventsRoleId: rorEventsRoleId,
        },
        wowforever: {
          webhookUrl: currentWowForeverWebhookUrl,
          eventsWebhookUrl: currentWowForeverEventsWebhookUrl,
          announcementRoleId: wowForeverAnnouncementRoleId,
          eventsRoleId: wowForeverEventsRoleId,
        },
        cc: {
          webhookUrl: '',
          eventsWebhookUrl: '',
          announcementRoleId: '',
          eventsRoleId: '',
        },
      });
    };

    syncFromProps();

    async function refreshFromApi() {
      if (!canUseV2Api) {
        return;
      }

      try {
        const fields = [
          'aoc_webhook_url',
          'aoc_events_webhook_url',
          'sc_webhook_url',
          'sc_events_webhook_url',
          'ror_webhook_url',
          'ror_events_webhook_url',
          'wowforever_webhook_url',
          'wowforever_events_webhook_url',
          'aoc_announcement_role_id',
          'aoc_events_role_id',
          'sc_announcement_role_id',
          'sc_events_role_id',
          'ror_announcement_role_id',
          'ror_events_role_id',
          'wowforever_announcement_role_id',
          'wowforever_events_role_id',
        ].join(',');

        const response = await fetch(
          `/api/group/settings?group_id=${encodeURIComponent(groupId)}&view=group_fields&fields=${encodeURIComponent(fields)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { fields?: Record<string, unknown> };
        const apiFields = payload.fields || {};

        if (!isMounted) {
          return;
        }

        setGameConfig({
          aoc: {
            webhookUrl: (apiFields.aoc_webhook_url as string | null) || '',
            eventsWebhookUrl: (apiFields.aoc_events_webhook_url as string | null) || '',
            announcementRoleId: (apiFields.aoc_announcement_role_id as string | null) || '',
            eventsRoleId: (apiFields.aoc_events_role_id as string | null) || '',
          },
          sc: {
            webhookUrl: (apiFields.sc_webhook_url as string | null) || '',
            eventsWebhookUrl: (apiFields.sc_events_webhook_url as string | null) || '',
            announcementRoleId: (apiFields.sc_announcement_role_id as string | null) || '',
            eventsRoleId: (apiFields.sc_events_role_id as string | null) || '',
          },
          ror: {
            webhookUrl: (apiFields.ror_webhook_url as string | null) || '',
            eventsWebhookUrl: (apiFields.ror_events_webhook_url as string | null) || '',
            announcementRoleId: (apiFields.ror_announcement_role_id as string | null) || '',
            eventsRoleId: (apiFields.ror_events_role_id as string | null) || '',
          },
          wowforever: {
            webhookUrl: (apiFields.wowforever_webhook_url as string | null) || '',
            eventsWebhookUrl: (apiFields.wowforever_events_webhook_url as string | null) || '',
            announcementRoleId: (apiFields.wowforever_announcement_role_id as string | null) || '',
            eventsRoleId: (apiFields.wowforever_events_role_id as string | null) || '',
          },
          cc: {
            webhookUrl: '',
            eventsWebhookUrl: '',
            announcementRoleId: '',
            eventsRoleId: '',
          },
        });
      } catch (refreshError) {
        console.error('[ClanSettings] Failed to refresh settings from API:', refreshError);
      }
    }

    void refreshFromApi();

    const timerId = setTimeout(() => {
      syncFromProps();
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [
    canUseV2Api,
    groupId,
    currentAocWebhookUrl,
    currentAocEventsWebhookUrl,
    currentScWebhookUrl,
    currentScEventsWebhookUrl,
    currentRorWebhookUrl,
    currentRorEventsWebhookUrl,
    currentWowForeverWebhookUrl,
    currentWowForeverEventsWebhookUrl,
    aocAnnouncementRoleId,
    aocEventsRoleId,
    scAnnouncementRoleId,
    scEventsRoleId,
    rorAnnouncementRoleId,
    rorEventsRoleId,
    wowForeverAnnouncementRoleId,
    wowForeverEventsRoleId,
  ]);

  const normalizeGameId = (id: string): GameId => {
    if (id === 'starcitizen' || id === 'star-citizen') return 'sc';
    return id as GameId;
  };

  const currentGameId = normalizeGameId(gameSlug);
  const currentConfig = gameConfig[currentGameId];

  const updateGameConfig = (field: string, value: string) => {
    setGameConfig(prev => ({
      ...prev,
      [currentGameId]: {
        ...prev[currentGameId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);

    try {
      const updateData: Record<string, any> = {};

      // Save only the current game's configuration
      const columns = GAME_DISCORD_COLUMNS[currentGameId];
      updateData[columns.webhookUrl] = currentConfig.webhookUrl.trim() || null;
      updateData[columns.eventsWebhookUrl] = currentConfig.eventsWebhookUrl.trim() || null;
      updateData[columns.announcementRoleId] = currentConfig.announcementRoleId.trim() || null;
      updateData[columns.eventsRoleId] = currentConfig.eventsRoleId.trim() || null;

      if (canUseV2Api) {
        const response = await fetch('/api/group/settings', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_group_fields',
            group_id: groupId,
            changes: updateData,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to save settings (${response.status})`);
        }
      } else {
        const { error: updateError } = await supabase
          .from('groups')
          .update(updateData)
          .eq('id', groupId)
          .select();

        if (updateError) throw updateError;
      }

      setSaved(true);
      onUpdate?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const webhookToTest = currentConfig.eventsWebhookUrl || currentConfig.webhookUrl;
    
    if (!webhookToTest.trim()) {
      setTestResult({ success: false, message: `Please enter a webhook URL for ${gameSlug} first` });
      return;
    }

    setTesting(currentGameId);
    setTestResult(null);

    try {
      const result = await testDiscordWebhook(webhookToTest.trim(), { groupId, gameSlug, kind: 'test' });
      setTestResult({
        success: result.success,
        message: result.success 
          ? `Webhook test successful! Check your Discord channel.` 
          : result.error || 'Test failed',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(null);
    }
  };

  const isValidWebhookUrl = (url: string) => {
    return !url || 
      url.startsWith('https://discord.com/api/webhooks/') || 
      url.startsWith('https://discordapp.com/api/webhooks/');
  };

  const getGameDisplayName = () => {
    const names: Record<GameId, string> = {
      aoc: 'Ashes of Creation',
      sc: 'Star Citizen',
      ror: 'Return of Reckoning',
      wowforever: 'WoW Forever',
      cc: 'Crowfall',
    };
    return names[currentGameId] || gameSlug;
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Webhook className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">{getGameDisplayName()} Discord Integration</h3>
      </div>

      <p className="text-sm text-slate-400">
        Configure Discord webhooks and role mentions specifically for {getGameDisplayName()}.
      </p>

      {/* General Webhook */}
      <div>
        <label htmlFor="webhook-url" className="block text-sm font-medium text-slate-300 mb-2">
          General Webhook URL
        </label>
        <input
          id="webhook-url"
          type="url"
          value={currentConfig.webhookUrl}
          onChange={(e) => updateGameConfig('webhookUrl', e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            currentConfig.webhookUrl && !isValidWebhookUrl(currentConfig.webhookUrl) 
              ? 'border-red-500' 
              : 'border-slate-600'
          }`}
        />
        {currentConfig.webhookUrl && !isValidWebhookUrl(currentConfig.webhookUrl) && (
          <p className="text-xs text-red-400 mt-1">Invalid Discord webhook URL</p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Used for announcements and other general messages for {getGameDisplayName()}
        </p>
      </div>

      {/* Events Webhook */}
      <div>
        <label htmlFor="events-webhook-url" className="block text-sm font-medium text-slate-300 mb-2">
          Events Webhook URL (Optional)
        </label>
        <input
          id="events-webhook-url"
          type="url"
          value={currentConfig.eventsWebhookUrl}
          onChange={(e) => updateGameConfig('eventsWebhookUrl', e.target.value)}
          placeholder="https://discord.com/api/webhooks/... (leave empty to use general webhook)"
          className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            currentConfig.eventsWebhookUrl && !isValidWebhookUrl(currentConfig.eventsWebhookUrl) 
              ? 'border-red-500' 
              : 'border-slate-600'
          }`}
        />
        {currentConfig.eventsWebhookUrl && !isValidWebhookUrl(currentConfig.eventsWebhookUrl) && (
          <p className="text-xs text-red-400 mt-1">Invalid Discord webhook URL</p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          If set, event notifications will be sent to this webhook instead of the general one
        </p>
      </div>

      {/* Announcement Role */}
      <div>
        <label htmlFor="announcement-role-id" className="block text-sm font-medium text-slate-300 mb-2">
          Announcement Role ID (Optional)
        </label>
        <input
          id="announcement-role-id"
          type="text"
          value={currentConfig.announcementRoleId}
          onChange={(e) => updateGameConfig('announcementRoleId', e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="123456789012345678"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          Role to ping when posting announcements. Right-click role in Discord {'>'} Copy ID (Developer Mode required)
        </p>
      </div>

      {/* Events Role */}
      <div>
        <label htmlFor="events-role-id" className="block text-sm font-medium text-slate-300 mb-2">
          Events Role ID (Optional)
        </label>
        <input
          id="events-role-id"
          type="text"
          value={currentConfig.eventsRoleId}
          onChange={(e) => updateGameConfig('eventsRoleId', e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="123456789012345678"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          Role to ping when creating or reminding about events
        </p>
      </div>

      {/* Test Button */}
      {(currentConfig.eventsWebhookUrl || currentConfig.webhookUrl) && 
       (isValidWebhookUrl(currentConfig.eventsWebhookUrl) || isValidWebhookUrl(currentConfig.webhookUrl)) && (
        <button
          onClick={handleTest}
          disabled={testing === currentGameId}
          className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors disabled:opacity-50 cursor-pointer border border-purple-500/30 text-sm"
        >
          {testing === currentGameId ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Webhook size={14} />
              Test Webhook
            </>
          )}
        </button>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg ${
          testResult.success 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        {loading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !!(currentConfig.webhookUrl && !isValidWebhookUrl(currentConfig.webhookUrl)) ||
              !!(currentConfig.eventsWebhookUrl && !isValidWebhookUrl(currentConfig.eventsWebhookUrl))
            }
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('discord.saving')}
              </>
            ) : saved ? (
              <>
                <Check size={16} />
                {t('discord.saved')}
              </>
            ) : (
              t('discord.saveSettings')
            )}
          </button>
        )}
      </div>
    </div>
  );
}
