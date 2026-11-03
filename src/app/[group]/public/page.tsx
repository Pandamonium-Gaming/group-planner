'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Users, Briefcase, Calendar, ChevronRight, ExternalLink, Home } from 'lucide-react';
import { Clan, PARTY_ROLES } from '@/lib/types';
import { ARCHETYPES } from '@/lib/characters';
import { RecruitmentForm } from '@/components/forms/RecruitmentForm';
import { InlineFooter } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

interface PublicGroupData {
  group: Clan & {
    is_public: boolean;
    recruitment_open: boolean;
    recruitment_message?: string;
    public_description?: string;
  };
  groupGames: Array<{ game_slug: string; archived: boolean }>;
  memberCount: number;
  professionCoverage: number;
  upcomingEvents: number;
}

export default function PublicGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group: groupSlug } = use(params);
  const { t } = useLanguage();
  const [data, setData] = useState<PublicGroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRecruitmentForm, setShowRecruitmentForm] = useState(false);

  useEffect(() => {
    async function fetchPublicData() {
      try {
        // Use API route to get public data (bypasses RLS)
        const response = await fetch(`/api/clan-public?slug=${encodeURIComponent(groupSlug)}`);
        
        if (!response.ok) {
          setData(null);
          setLoading(false);
          return;
        }

        const publicData = await response.json();

        // A missing game list must not be read as "legacy group, offer every game".
        if (!Array.isArray(publicData.groupGames)) {
          setData(null);
          setLoading(false);
          return;
        }

        setData({
          group: publicData.clan,
          groupGames: publicData.groupGames,
          memberCount: publicData.memberCount || 0,
          professionCoverage: 75, // Could calculate this
          upcomingEvents: publicData.upcomingEvents || 0,
        });
      } catch (error) {
        console.error('Error fetching public data:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicData();
  }, [groupSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{t('publicPage.clanNotFound')}</h1>
          <p className="text-slate-400 mb-6">{t('publicPage.clanNotFoundDesc')}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Home size={18} />
            {t('publicPage.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  const { group, memberCount, professionCoverage, upcomingEvents } = data;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white font-display">{group.name}</h1>
              <p className="text-slate-400 mt-1">{t('publicPage.ashesOfCreationGuild')}</p>
            </div>
            <Link
              href={`/${groupSlug}`}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
            >
              <ExternalLink size={16} />
              {t('publicPage.memberLogin')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Description */}
        {group.public_description && (
          <section className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">{t('publicPage.aboutUs')}</h2>
            <p className="text-slate-300 whitespace-pre-wrap">{group.public_description}</p>
          </section>
        )}

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4 text-center">
            <Users size={24} className="mx-auto mb-2 text-blue-400" />
            <div className="text-2xl font-bold text-white">{memberCount}</div>
            <div className="text-sm text-slate-400">{t('publicPage.members')}</div>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4 text-center">
            <Briefcase size={24} className="mx-auto mb-2 text-green-400" />
            <div className="text-2xl font-bold text-white">{professionCoverage}%</div>
            <div className="text-sm text-slate-400">{t('publicPage.professionCoverage')}</div>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-4 text-center">
            <Calendar size={24} className="mx-auto mb-2 text-purple-400" />
            <div className="text-2xl font-bold text-white">{upcomingEvents}</div>
            <div className="text-sm text-slate-400">{t('publicPage.upcomingEvents')}</div>
          </div>
        </section>

        {/* Looking for */}
        <section className="bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{t('publicPage.weLookingFor')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'] as const).map(role => (
              <div 
                key={role}
                className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg"
              >
                <span className="text-xl">{PARTY_ROLES[role].icon}</span>
                <span className={`text-sm font-medium ${PARTY_ROLES[role].color}`}>
                  {PARTY_ROLES[role].name}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {Object.entries(ARCHETYPES).slice(0, 4).map(([id, arch]) => (
              <div 
                key={id}
                className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg"
              >
                <span className="text-xl">{arch.icon}</span>
                <span className="text-sm text-slate-300">{arch.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recruitment CTA */}
        {group.recruitment_open && (
          <section className="bg-gradient-to-r from-orange-500/20 to-rose-500/20 rounded-lg border border-orange-500/30 p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{t('publicPage.joinOurGuildTitle')}</h2>
                <p className="text-slate-300 mt-1">
                  {group.recruitment_message || t('publicPage.recruitmentClosed')}
                </p>
              </div>
              <button
                onClick={() => setShowRecruitmentForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {t('publicPage.applyToJoin')}
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <InlineFooter />

      {/* Recruitment Form Modal */}
      {showRecruitmentForm && (
        <RecruitmentForm
          groupId={group.id}
          groupName={group.name}
          groupGames={data.groupGames}
          onClose={() => setShowRecruitmentForm(false)}
          onSuccess={() => {
            setShowRecruitmentForm(false);
            alert('Application submitted! The guild leadership will review it soon.');
          }}
        />
      )}
    </div>
  );
}

