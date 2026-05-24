"use client";

import { useState } from 'react';
import { Webhook, Bell, BellOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { testDiscordWebhook } from '@/lib/discord';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClientAuthStack } from '@/lib/authStack';

interface GroupDiscordSettingsProps {
  groupId: string;
  currentWebhookUrl?: string;
  currentWelcomeWebhookUrl?: string;
  notifyOnEvents?: boolean;
  notifyOnAnnouncements?: boolean;
  onUpdate?: () => void;
}

export function GroupDiscordSettings({
  groupId,
  currentWebhookUrl = '',
  currentWelcomeWebhookUrl = '',
  notifyOnEvents = true,
  notifyOnAnnouncements = true,
  onUpdate,
}: GroupDiscordSettingsProps) {
  const [webhookUrl, setWebhookUrl] = useState(currentWebhookUrl);
  const [welcomeWebhookUrl, setWelcomeWebhookUrl] = useState(currentWelcomeWebhookUrl);
  const [eventsEnabled, setEventsEnabled] = useState(notifyOnEvents);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(notifyOnAnnouncements);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { t } = useLanguage();

  const isValidWebhookUrl = (url: string) => {
    return !url || 
      url.startsWith('https://discord.com/api/webhooks/') || 
      url.startsWith('https://discordapp.com/api/webhooks/');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);

    try {
      const updateData = {
        group_webhook_url: webhookUrl.trim() || null,
        group_welcome_webhook_url: welcomeWebhookUrl.trim() || null,
        notify_on_events: eventsEnabled,
        notify_on_announcements: announcementsEnabled,
      };

      if (getClientAuthStack() === 'v2') {
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
          .eq('id', groupId);

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
    const webhookToTest = webhookUrl.trim();
    
    if (!webhookToTest) {
      setTestResult({ success: false, message: 'Please enter a webhook URL first' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testDiscordWebhook(webhookToTest);
      setTestResult({
        success: result.success,
        message: result.success 
          ? 'Webhook test successful! Check your Discord channel.' 
          : result.error || 'Test failed',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Webhook className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Group-Wide Discord Integration</h3>
      </div>

      <p className="text-sm text-slate-400">
        Configure group-wide Discord webhooks for cross-game notifications and member welcomes.
      </p>

      {/* Main Webhook URL */}
      <div>
        <label htmlFor="guild-webhook-url" className="block text-sm font-medium text-slate-300 mb-2">
          {t('discord.webhookUrl')} (Group-Wide)
        </label>
        <input
          id="guild-webhook-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder={t('discord.webhookPlaceholder')}
          className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            webhookUrl && !isValidWebhookUrl(webhookUrl) 
              ? 'border-red-500' 
              : 'border-slate-600'
          }`}
        />
        {webhookUrl && !isValidWebhookUrl(webhookUrl) && (
          <p className="text-xs text-red-400 mt-1">
            {t('discord.invalidWebhook')}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          Used for group-wide announcements and as a fallback for game-specific notifications.
        </p>
      </div>

      {/* Welcome Webhook URL */}
      <div>
        <label htmlFor="guild-welcome-webhook-url" className="block text-sm font-medium text-slate-300 mb-2">
          Welcome Webhook URL (Optional)
        </label>
        <input
          id="guild-welcome-webhook-url"
          type="url"
          value={welcomeWebhookUrl}
          onChange={(e) => setWelcomeWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/... (for welcome messages)"
          className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            welcomeWebhookUrl && !isValidWebhookUrl(welcomeWebhookUrl) 
              ? 'border-red-500' 
              : 'border-slate-600'
          }`}
        />
        {welcomeWebhookUrl && !isValidWebhookUrl(welcomeWebhookUrl) && (
          <p className="text-xs text-red-400 mt-1">
            Invalid Discord webhook URL
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          If set, new member welcome messages will be sent here. Otherwise, the main webhook is used.
        </p>
      </div>

      {/* Test Button */}
      {webhookUrl && isValidWebhookUrl(webhookUrl) && (
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors disabled:opacity-50 cursor-pointer border border-purple-500/30 text-sm"
        >
          {testing ? (
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

      {/* Notification toggles */}
      <div className="border-t border-slate-700 pt-6 space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Notification Settings</h4>
        
        <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-3">
            <Bell size={18} className={eventsEnabled ? 'text-green-400' : 'text-slate-500'} />
            <div>
              <span className="text-white text-sm font-medium">{t('discord.eventNotifications')}</span>
              <p className="text-xs text-slate-500">{t('discord.eventNotificationsDesc')}</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={eventsEnabled}
            onChange={(e) => setEventsEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
          <div className="flex items-center gap-3">
            {announcementsEnabled ? (
              <Bell size={18} className="text-green-400" />
            ) : (
              <BellOff size={18} className="text-slate-500" />
            )}
            <div>
              <span className="text-white text-sm font-medium">{t('discord.announcementNotifications')}</span>
              <p className="text-xs text-slate-500">{t('discord.announcementNotificationsDesc')}</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={announcementsEnabled}
            onChange={(e) => setAnnouncementsEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={
            saving ||
            !!(webhookUrl && !isValidWebhookUrl(webhookUrl)) ||
            !!(welcomeWebhookUrl && !isValidWebhookUrl(welcomeWebhookUrl))
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
      </div>
    </div>
  );
}
