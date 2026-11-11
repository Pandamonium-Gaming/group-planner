'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { Event, EventRsvp, GuestEventRsvp, EventWithRsvps, countEventRoles } from '@/lib/events';
import { EventCard } from '@/components/views/EventCard';
import { Skeleton } from '@/components/ui/Skeleton';

interface EventWithClanInfo extends EventWithRsvps {
  clan?: {
    id: string;
    name: string;
    slug: string;
  };
}

export function PublicEventsView() {
  const { t } = useLanguage();
  const { error: showError } = useToast();
  const [events, setEvents] = useState<EventWithClanInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublicEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events/public', { cache: 'no-store' });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to load public events (${response.status})`);
      }

      const payload = (await response.json()) as {
        events?: Array<Event & {
          event_rsvps?: EventRsvp[];
          guest_event_rsvps?: GuestEventRsvp[];
          clan?: EventWithClanInfo['clan'];
        }>;
      };
      const data = payload.events || [];

      // Compute rsvp_counts and role_counts for each event
      const eventsWithCounts = (data || []).map(event => {
        const rsvps = event.event_rsvps || [];
        const guestRsvps = event.guest_event_rsvps || [];
        return {
          ...event,
          rsvps,
          guest_rsvps: guestRsvps,
          rsvp_counts: {
            attending: rsvps.filter(r => r.status === 'attending').length + guestRsvps.filter(g => g.status === 'attending').length,
            maybe: rsvps.filter(r => r.status === 'maybe').length + guestRsvps.filter(g => g.status === 'maybe').length,
            declined: rsvps.filter(r => r.status === 'declined').length + guestRsvps.filter(g => g.status === 'declined').length,
          },
          role_counts: countEventRoles(rsvps, guestRsvps, event.game_slug),
        };
      });

      setEvents(eventsWithCounts);
    } catch (err) {
      console.error('Error fetching public events:', err);
      showError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchPublicEvents();
    }, 0);

    return () => clearTimeout(timerId);
  }, []);

  // Group events by clan
  const eventsByClans = events.reduce((acc, event) => {
    const groupName = event.clan?.name || 'Unknown Group';
    const groupSlug = event.clan?.slug || '';
    if (!acc[groupName]) {
      acc[groupName] = { slug: groupSlug, events: [] };
    }
    acc[groupName].events.push(event);
    return acc;
  }, {} as Record<string, { slug: string; events: EventWithClanInfo[] }>);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Calendar className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">No Public Events</h2>
        <p className="text-slate-400 text-center max-w-md">There are currently no public events available. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Public Events</h1>
          <p className="text-slate-400 text-sm sm:text-base">Explore upcoming events across all groups</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-xl">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-slate-300">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {Object.entries(eventsByClans).map(([clanName, { slug, events: clanEvents }]) => (
        <div key={clanName} className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl overflow-hidden">
          {/* Group header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/50 bg-slate-900/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{clanName}</h2>
                <p className="text-xs text-slate-400">
                  {clanEvents.length} event{clanEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {slug && (
              <Link
                href={`/${slug}/public-events`}
                className="px-4 py-2 text-sm bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all cursor-pointer"
                title="View all events for this group"
              >
                View All
              </Link>
            )}
          </div>

          {/* Events list */}
          <div className="p-4 space-y-3">
            {clanEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                timezone="UTC"
                groupId={event.group_id}
                userId="" // Anonymous user
                characters={[]}
                onRsvp={() => {
                  // Public events don't support member RSVP, only guest signup
                }}
                isPublicView={true}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
