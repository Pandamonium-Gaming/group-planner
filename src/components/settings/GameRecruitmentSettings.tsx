"use client";
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/Skeleton';

import { useState, useEffect } from 'react';
import { UserPlus, Save, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClientAuthStack } from '@/lib/authStack';

interface GameRecruitmentSettingsProps {
  groupId: string;
  gameSlug: string;
}

export function GameRecruitmentSettings({ groupId, gameSlug }: GameRecruitmentSettingsProps) {
  const { loading, hasPermission } = usePermissions(groupId);
  const { t } = useLanguage();
  const [recruitmentOpen, setRecruitmentOpen] = useState(false);
  const [recruitmentMessage, setRecruitmentMessage] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManageRecruitment = hasPermission('recruitment_manage');
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  // Map game slug to column names
  const getColumnNames = () => {
    const gameId = gameSlug === 'starcitizen' ? 'sc' : gameSlug;
    return {
      recruitmentOpen: `${gameId}_recruitment_open`,
      recruitmentMessage: `${gameId}_recruitment_message`,
      publicDescription: `${gameId}_public_description`,
    };
  };

  const getGameDisplayName = () => {
    const names: Record<string, string> = {
      aoc: 'Ashes of Creation',
      sc: 'Star Citizen',
      starcitizen: 'Star Citizen',
      ror: 'Return of Reckoning',
      wowforever: 'WoW Forever',
    };
    return names[gameSlug] || gameSlug.toUpperCase();
  };

  // Fetch current settings
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isMounted) return;
      setError(null);
      try {
        const columns = getColumnNames();
        let groupData: Record<string, any> | null = null;
        let groupError: Error | null = null;

        if (canUseV2Api) {
          const fields = [columns.recruitmentOpen, columns.recruitmentMessage, columns.publicDescription]
            .map(encodeURIComponent)
            .join(',');

          const response = await fetch(
            `/api/group/settings?group_id=${encodeURIComponent(groupId)}&view=group_fields&fields=${fields}`,
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
            throw new Error(payload.details || payload.error || `Failed to load settings (${response.status})`);
          }

          const payload = (await response.json()) as { fields?: Record<string, unknown> };
          groupData = (payload.fields || {}) as Record<string, any>;
        } else {
          const result = await supabase
            .from('groups')
            .select(`${columns.recruitmentOpen}, ${columns.recruitmentMessage}, ${columns.publicDescription}`)
            .eq('id', groupId)
            .single();

          groupData = (result.data as Record<string, any> | null) || null;
          groupError = result.error as Error | null;
        }
        
        if (!isMounted) return;
        if (groupError) {
          console.error('[GameRecruitmentSettings] Error fetching group:', groupError);
        }

        if (groupData) {
          const data = groupData as Record<string, any>;
          setRecruitmentOpen(data[columns.recruitmentOpen] ?? false);
          setRecruitmentMessage(data[columns.recruitmentMessage] || '');
          setPublicDescription(data[columns.publicDescription] || '');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[GameRecruitmentSettings] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (isMounted) setLocalLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [groupId, gameSlug, canUseV2Api]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const columns = getColumnNames();
      const updateData: Record<string, any> = {
        [columns.recruitmentOpen]: recruitmentOpen,
        [columns.recruitmentMessage]: recruitmentMessage.trim() || null,
        [columns.publicDescription]: publicDescription.trim() || null,
      };

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
          .eq('id', groupId);

        if (updateError) throw updateError;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[GameRecruitmentSettings] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || localLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  if (!canManageRecruitment) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
        <p className="text-sm text-slate-400">{t('recruitment.noPermission')}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold text-white">{getGameDisplayName()} Recruitment</h3>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Recruitment Open Toggle */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={recruitmentOpen}
            onChange={(e) => setRecruitmentOpen(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-2 focus:ring-purple-500"
          />
          <div>
            <span className="text-sm font-medium text-slate-200">
              Open for Recruitment
            </span>
            <p className="text-xs text-slate-400">
              Allow new players to apply for {getGameDisplayName()}
            </p>
          </div>
        </label>
      </div>

      {/* Recruitment Message */}
      <div>
        <label htmlFor="recruitment-message" className="block text-sm font-medium text-slate-300 mb-2">
          Recruitment Message
        </label>
        <textarea
          id="recruitment-message"
          value={recruitmentMessage}
          onChange={(e) => setRecruitmentMessage(e.target.value)}
          placeholder={`What are you looking for in ${getGameDisplayName()} recruits?`}
          rows={4}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          This message appears on your {getGameDisplayName()} recruitment page
        </p>
      </div>

      {/* Public Description */}
      <div>
        <label htmlFor="public-description" className="block text-sm font-medium text-slate-300 mb-2">
          Public Description
        </label>
        <textarea
          id="public-description"
          value={publicDescription}
          onChange={(e) => setPublicDescription(e.target.value)}
          placeholder={`Describe your ${getGameDisplayName()} guild/organization...`}
          rows={4}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          Public description shown on your {getGameDisplayName()} guild page
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('discord.saving')}
          </>
        ) : saved ? (
          <>
            <Check className="w-4 h-4" />
            {t('discord.saved')}
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {t('recruitment.saveSettings')}
          </>
        )}
      </button>
    </div>
  );
}
