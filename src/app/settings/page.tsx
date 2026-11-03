'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, Save, Check, ArrowLeft, User, Languages } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { COMMON_TIMEZONES } from '@/lib/events';
import { InlineFooter } from '@/components/layout/Footer';
import { getClientAuthStack } from '@/lib/authStack';
import { SiteAdminLink } from '@/components/settings/SiteAdminLink';

export default function SettingsPage() {
  const { user, profile, loading, refresh } = useAuthContext();
  const { language, setLanguage, t } = useLanguage();
  const [timezone, setTimezone] = useState('UTC');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from profile
  useEffect(() => {
    if (!profile) return;

    const timerId = setTimeout(() => {
      setTimezone(profile.timezone || 'UTC');
      setDisplayName(profile.display_name || '');
    }, 0);

    return () => clearTimeout(timerId);
  }, [profile]);

  // Auto-detect timezone
  const detectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detected);
  };

  // Save settings
  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      if (getClientAuthStack() === 'v2') {
        const response = await fetch('/api/me/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timezone,
            display_name: displayName.trim() || null,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(payload.details || payload.error || `Failed to save settings (${response.status})`);
        }
      } else {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            timezone,
            display_name: displayName.trim() || null,
          })
          .eq('id', user.id)
          .select();

        if (updateError) throw updateError;
      }
      
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t('common.signIn')}</p>
          <Link 
            href="/login"
            className="text-orange-400 hover:text-orange-300 underline"
          >
            {t('common.signIn')}
          </Link>
        </div>
      </div>
    );
  }

  // Current time example
  const localeMap: Record<string, string> = { en: 'en-GB', es: 'es-ES', nl: 'nl-NL' };
  const currentTime = new Date().toLocaleString(localeMap[language] || 'en-GB', {
    timeZone: typeof window !== 'undefined' && window.Intl ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-grid-pattern">
      {/* Header */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base sm:text-lg font-semibold text-white">{t('settings.title')}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 sm:space-y-6">
        <SiteAdminLink />
        {/* Profile Section */}
        <section className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
            {t('settings.profile')}
          </h2>

          {/* Display Name */}
          <div>
            <label htmlFor="profile-display-name" className="block text-sm font-medium text-slate-300 mb-2">
              {t('settings.displayName')}
            </label>
            <input
              id="profile-display-name"
              maxLength={100}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('settings.displayName')}
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
            <p className="text-xs text-slate-500 mt-2">
              {t('settings.displayNameHint')}
            </p>
          </div>
        </section>

        {/* Language Section */}
        <section className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Languages className="w-4 h-4 text-indigo-400" />
            </div>
            {t('settings.language')}
          </h2>

          {/* Language Selector */}
          <div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 transition-all cursor-pointer ${
                    language === lang.code
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="text-lg sm:text-xl">{lang.flag}</span>
                  <span className="font-medium text-sm sm:text-base">{lang.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {t('settings.languageHint')}
            </p>
          </div>
        </section>

        {/* Timezone Section */}
        <section className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-indigo-400" />
            </div>
            {t('settings.timezone')}
          </h2>

          {/* Timezone Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {t('settings.yourTimezone')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1.25rem',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <button
                onClick={detectTimezone}
                className="shrink-0 px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-white rounded-xl transition-all cursor-pointer text-sm font-medium"
                title={t('settings.autoDetect')}
              >
                {t('settings.autoDetect')}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
            <p className="text-sm text-slate-400 mb-1">{t('settings.currentTime')}</p>
            <p className="text-white font-medium">{currentTime}</p>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link
            href="/"
            className="px-5 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-white rounded-xl transition-all cursor-pointer text-center"
          >
            {t('common.cancel')}
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            {saving ? (
              <>{t('common.saving')}</>
            ) : saved ? (
              <>
                <Check size={18} />
                {t('common.saved')}
              </>
            ) : (
              <>
                <Save size={18} />
                {t('settings.saveChanges')}
              </>
            )}
          </button>
        </div>
        </div>
      </main>
      
      {/* Footer */}
      <div className="shrink-0">
        <InlineFooter />
      </div>
    </div>
  );
}
