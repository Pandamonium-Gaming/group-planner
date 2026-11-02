"use client";
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/Skeleton';

import { useState, useEffect } from 'react';
import { Globe, UserPlus, Save, Loader2, Check, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RecruitmentApplication } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { getClientAuthStack } from '@/lib/authStack';

interface RecruitmentSettingsProps {
  groupId: string;
  groupSlug: string;
}

export function RecruitmentSettings({ groupId, groupSlug }: RecruitmentSettingsProps) {
  const { loading, hasPermission } = usePermissions(groupId);
  const { t } = useLanguage();
  const [isPublic, setIsPublic] = useState(false);
  const [recruitmentOpen, setRecruitmentOpen] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [defaultRole, setDefaultRole] = useState<'trial' | 'member'>('trial');
  const [recruitmentMessage, setRecruitmentMessage] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageRecruitment = hasPermission('recruitment_manage');
  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  // Fetch current settings and applications
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!isMounted) return;
      setError(null);
      try {
        if (canUseV2Api) {
          const response = await fetch(
            `/api/group/settings?group_id=${encodeURIComponent(groupId)}&view=recruitment_overview`,
            {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
            throw new Error(payload.details || payload.error || `Failed to load recruitment settings (${response.status})`);
          }

          const payload = (await response.json()) as {
            settings?: {
              is_public?: boolean;
              recruitment_open?: boolean;
              approval_required?: boolean;
              default_role?: 'trial' | 'member';
              recruitment_message?: string | null;
              public_description?: string | null;
            } | null;
            applications?: RecruitmentApplication[];
          };

          if (!isMounted) return;

          if (payload.settings) {
            setIsPublic(payload.settings.is_public || false);
            setRecruitmentOpen(payload.settings.recruitment_open || false);
            setApprovalRequired(payload.settings.approval_required ?? true);
            setDefaultRole(payload.settings.default_role || 'trial');
            setRecruitmentMessage(payload.settings.recruitment_message || '');
            setPublicDescription(payload.settings.public_description || '');
          }

          setApplications(payload.applications || []);
        } else {
          const { data: clanData, error: clanError } = await supabase
            .from('groups')
            .select('is_public, recruitment_open, recruitment_message, public_description, approval_required, default_role')
            .eq('id', groupId)
            .single();
          if (!isMounted) return;
          if (clanError) {
            console.error('[RecruitmentSettings] Error fetching clan:', clanError);
          }

          if (clanData) {
            setIsPublic(clanData.is_public || false);
            setRecruitmentOpen(clanData.recruitment_open || false);
            setApprovalRequired(clanData.approval_required ?? true);
            setDefaultRole(clanData.default_role || 'trial');
            setRecruitmentMessage(clanData.recruitment_message || '');
            setPublicDescription(clanData.public_description || '');
          }

          const { data: appsData, error: appsError } = await supabase
            .from('recruitment_applications')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false });

          if (!isMounted) return;

          if (appsError) {
            console.error('[RecruitmentSettings] Error fetching applications:', appsError);
          }

          if (appsData) {
            setApplications(appsData);
          }
        }
      } catch (err) {
        console.error('[RecruitmentSettings] Unexpected error:', err);
        if (isMounted) {
          setError(t('recruitment.loadError') || 'Failed to load recruitment settings');
        }
      } finally {
        // no-op
      }
    }

    if (groupId) {
      const timerId = setTimeout(() => {
        void fetchData();
      }, 0);

      return () => {
        isMounted = false;
        clearTimeout(timerId);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [groupId, canUseV2Api, t]);

  const handleSave = async () => {
    if (!canManageRecruitment) {
      setError(t('recruitment.noPermission') || 'You do not have permission to manage recruitment settings.');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const updateData = {
        is_public: isPublic,
        recruitment_open: recruitmentOpen,
        approval_required: approvalRequired,
        default_role: defaultRole,
        recruitment_message: recruitmentMessage.trim() || null,
        public_description: publicDescription.trim() || null,
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
          const message = payload.details || payload.error || `Failed to save settings (${response.status})`;
          console.error('[RecruitmentSettings] Save error:', message);
          setError(message);
          return;
        }
      } else {
        const { error: updateError } = await supabase
          .from('groups')
          .update(updateData)
          .eq('id', groupId)
          .select();

        if (updateError) {
          console.error('[RecruitmentSettings] Save error:', updateError);
          setError(updateError.message);
          return;
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[RecruitmentSettings] Unexpected save error:', err);
      setError(err instanceof Error ? err.message : (t('recruitment.saveFailed') || 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleApplicationAction = async (appId: string, action: 'accepted' | 'rejected') => {
    if (!canManageRecruitment) {
      return;
    }
    try {
      if (canUseV2Api) {
        const response = await fetch('/api/group/settings', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_recruitment_application',
            group_id: groupId,
            application_id: appId,
            status: action,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to update application (${response.status})`);
        }
      } else {
        const { error } = await supabase
          .from('recruitment_applications')
          .update({
            status: action,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', appId)
          .select();

        if (error) throw error;
      }

      setApplications(prev => 
        prev.map(app => 
          app.id === appId ? { ...app, status: action } : app
        )
      );
    } catch (error) {
      console.error('Error updating application:', error);
    }
  };

  const pendingApps = applications.filter(a => a.status === 'pending');

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-orange-400" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recruitment Settings */}
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus size={20} className="text-orange-400" />
            {t('recruitment.settings') || 'Recruitment Settings'}
          </h3>
          {isPublic && (
            <a
              href={`/${groupSlug}/public`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300"
            >
              {t('recruitment.viewPublicPage') || 'View Public Page'}
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {!canManageRecruitment && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
            <XCircle size={16} />
            {t('recruitment.noPermission') || 'You do not have permission to manage recruitment settings.'}
          </div>
        )}

        {/* Toggles */}
        <div className="space-y-4">
          {/* Public Profile */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2 text-white font-medium">
                <Globe size={16} />
                {t('recruitment.publicProfile') || 'Public Profile'}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {t('recruitment.publicProfileDesc') || "Allow anyone to view your group's public page"}
              </p>
            </div>
            {/* axe-ignore aria-valid-attr-value */}
            <button
              onClick={() => canManageRecruitment && setIsPublic(!isPublic)}
              disabled={!canManageRecruitment}
              className={`flex items-center shrink-0 w-12 h-7 rounded-full transition-colors p-1 ${
                isPublic 
                  ? 'bg-indigo-500 justify-end' 
                  : 'bg-slate-600 justify-start'
              } ${canManageRecruitment ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              role="switch"
              aria-checked={isPublic}
              aria-label="Toggle public visibility"
              title="Toggle public visibility"
            >
              <span className="block w-5 h-5 bg-white rounded-full shadow-md" />
            </button>
          </div>

          {/* Open Recruitment */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2 text-white font-medium">
                <UserPlus size={16} />
                {t('recruitment.openRecruitment') || 'Open Recruitment'}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {t('recruitment.openRecruitmentDesc') || 'Allow players to submit applications'}
              </p>
            </div>
            {/* axe-ignore aria-valid-attr-value */}
            <button
              onClick={() => canManageRecruitment && setRecruitmentOpen(!recruitmentOpen)}
              disabled={!canManageRecruitment}
              className={`flex items-center shrink-0 w-12 h-7 rounded-full transition-colors p-1 ${
                recruitmentOpen 
                  ? 'bg-green-500 justify-end' 
                  : 'bg-slate-600 justify-start'
              } ${canManageRecruitment ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              role="switch"
              aria-checked={recruitmentOpen}
              aria-label="Toggle recruitment status"
              title="Toggle recruitment status"
            >
              <span className="block w-5 h-5 bg-white rounded-full shadow-md" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
          <div>
            <div className="flex items-center gap-2 text-white font-medium">
              <CheckCircle size={16} />
              {t('recruitment.approvalRequired') || 'Approval Required'}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {t('recruitment.approvalRequiredDesc') || 'When off, new members join immediately'}
            </p>
          </div>
          {/* axe-ignore aria-valid-attr-value */}
          <button
            onClick={() => canManageRecruitment && setApprovalRequired(!approvalRequired)}
            disabled={!canManageRecruitment}
            className={`flex items-center shrink-0 w-12 h-7 rounded-full transition-colors p-1 ${
              approvalRequired
                ? 'bg-indigo-500 justify-end'
                : 'bg-slate-600 justify-start'
            } ${canManageRecruitment ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            role="switch"
            aria-checked={approvalRequired}
            aria-label="Toggle approval requirement"
            title="Toggle approval requirement"
          >
            <span className="block w-5 h-5 bg-white rounded-full shadow-md" />
          </button>
        </div>

        {/* Starting Role */}
        <div>
          <label htmlFor="default-role" className="block text-sm font-medium text-slate-300 mb-1">
            {t('recruitment.startingRole') || 'Starting Role for New Members'}
          </label>
          <select
            id="default-role"
            value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value as 'trial' | 'member')}
            disabled={!canManageRecruitment}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="trial">{t('recruitment.trialMember') || 'Trial Member'}</option>
            <option value="member">{t('recruitment.fullMember') || 'Full Member'}</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {approvalRequired
              ? (t('recruitment.roleAssignedOnApproval') || 'Role assigned when applications are approved')
              : (t('recruitment.roleAssignedOnAuto') || 'Role assigned when members join automatically')}
          </p>
        </div>

        {/* Public Description */}
        <div>
          <label htmlFor="recruitment-public-description" className="block text-sm font-medium text-slate-300 mb-1">
            {t('recruitment.publicDescription') || 'Public Description'}
          </label>
          <textarea
            id="recruitment-public-description"
            value={publicDescription}
            onChange={(e) => setPublicDescription(e.target.value)}
            placeholder={t('recruitment.publicDescriptionPlaceholder') || "Tell potential recruits about your group..."}
            rows={3}
            disabled={!canManageRecruitment}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Recruitment Message */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t('recruitment.recruitmentMessage') || 'Recruitment Message'}
          </label>
          <input
            type="text"
            value={recruitmentMessage}
            onChange={(e) => setRecruitmentMessage(e.target.value)}
            placeholder={t('recruitment.recruitmentMessagePlaceholder') || 'e.g., Looking for active raiders for launch!'}
            disabled={!canManageRecruitment}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canManageRecruitment}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saved ? (
                <Check size={16} />
              ) : (
                <Save size={16} />
              )}
              {saved ? (t('common.saved') || 'Saved!') : (t('recruitment.saveSettings') || 'Save Settings')}
            </button>
          )}
        </div>
      </div>

      {/* Applications */}
      {pendingApps.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {t('members.pendingApplications') || 'Pending Applications'} ({pendingApps.length})
          </h3>
          <div className="space-y-3">
            {pendingApps.map(app => (
              <div 
                key={app.id}
                className="p-4 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">{app.discord_username}</div>
                    {app.character_name && (
                      <div className="text-sm text-slate-400">
                        {t('recruitment.characterName') || 'Character Name'}: {app.character_name}
                      </div>
                    )}
                    {app.primary_class && (
                      <div className="text-sm text-slate-400">
                        {t('filters.class') || 'Class'}: {app.primary_class}
                      </div>
                    )}
                    {app.message && (
                      <p className="text-sm text-slate-300 mt-2">{app.message}</p>
                    )}
                    <div className="text-xs text-slate-500 mt-2">
                      {t('recruitment.appliedOn', {
                        date: new Date(app.created_at).toLocaleDateString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
                      }) || `Applied ${new Date(app.created_at).toLocaleDateString('en-GB', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => canManageRecruitment && handleApplicationAction(app.id, 'accepted')}
                      disabled={!canManageRecruitment}
                      className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title={t('common.accept') || 'Accept'}
                      aria-label={t('common.accept') || 'Accept'}
                    >
                      <CheckCircle size={20} />
                    </button>
                    <button
                      onClick={() => canManageRecruitment && handleApplicationAction(app.id, 'rejected')}
                      disabled={!canManageRecruitment}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title={t('common.reject') || 'Reject'}
                      aria-label={t('common.reject') || 'Reject'}
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

