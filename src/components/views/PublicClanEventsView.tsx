'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { EventWithRsvps } from '@/lib/events';
import { EventCard } from '@/components/views/EventCard';
import { Calendar, ChevronLeft, Users } from 'lucide-react';

interface PublicClanEventsViewProps {
  groupId: string;
  groupName: string;
  groupSlug: string;
}

export function PublicClanEventsView({ groupId, groupName, groupSlug }: PublicClanEventsViewProps) {
  const { t } = useLanguage();
  const { error: showError } = useToast();
  const [events, setEvents] = useState<EventWithRsvps[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublicEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(
          `
          *,
          event_rsvps(
            *,
            character:members(id, name),
            user:users(id, display_name)
          ),
          guest_event_rsvps(*)
        `
        )
        .eq('group_id', groupId)
        .eq('is_public', true)
        .order('starts_at', { ascending: true });

      if (error) throw error;

      // Compute rsvp_counts and role_counts for each event
      const eventsWithCounts = (data || []).map(event => {
        const rsvps = event.event_rsvps || [];
        const guestRsvps = event.guest_event_rsvps || [];
        return {
          ...event,
          rsvps,
          guest_rsvps: guestRsvps,
          rsvp_counts: {
            attending: rsvps.filter((r: any) => r.status === 'attending').length,
            maybe: rsvps.filter((r: any) => r.status === 'maybe').length,
            declined: rsvps.filter((r: any) => r.status === 'declined').length,
          },
          role_counts: {
            tank: {
              attending: (rsvps.filter((r: any) => r.role === 'tank' && r.status === 'attending').length +
                guestRsvps.filter((g: any) => g.role === 'tank' && g.status === 'attending').length),
              maybe: (rsvps.filter((r: any) => r.role === 'tank' && r.status === 'maybe').length +
                guestRsvps.filter((g: any) => g.role === 'tank' && g.status === 'maybe').length),
            },
            cleric: {
              attending: (rsvps.filter((r: any) => r.role === 'cleric' && r.status === 'attending').length +
                guestRsvps.filter((g: any) => g.role === 'cleric' && g.status === 'attending').length),
              maybe: (rsvps.filter((r: any) => r.role === 'cleric' && r.status === 'maybe').length +
                guestRsvps.filter((g: any) => g.role === 'cleric' && g.status === 'maybe').length),
            },
            bard: {
              attending: (rsvps.filter((r: any) => r.role === 'bard' && r.status === 'attending').length +
                guestRsvps.filter((g: any) => g.role === 'bard' && g.status === 'attending').length),
              maybe: (rsvps.filter((r: any) => r.role === 'bard' && r.status === 'maybe').length +
                guestRsvps.filter((g: any) => g.role === 'bard' && g.status === 'maybe').length),
            },
            ranged_dps: {
              attending: (rsvps.filter((r: any) => r.role === 'ranged_dps' && r.status === 'attending').length +
                guestRsvps.filter((g: any) => g.role === 'ranged_dps' && g.status === 'attending').length),
              maybe: (rsvps.filter((r: any) => r.role === 'ranged_dps' && r.status === 'maybe').length +
                guestRsvps.filter((g: any) => g.role === 'ranged_dps' && g.status === 'maybe').length),
            },
            melee_dps: {
              attending: (rsvps.filter((r: any) => r.role === 'melee_dps' && r.status === 'attending').length +
                guestRsvps.filter((g: any) => g.role === 'melee_dps' && g.status === 'attending').length),
              maybe: (rsvps.filter((r: any) => r.role === 'melee_dps' && r.status === 'maybe').length +
                guestRsvps.filter((g: any) => g.role === 'melee_dps' && g.status === 'maybe').length),
            },
          }
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
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer group"
      >
        <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-sm">All Public Events</span>
      </Link>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{groupName}</h1>
            <p className="text-slate-400 text-sm">Public Events</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-xl">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-slate-300">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Public Events</h2>
          <p className="text-slate-400 text-center max-w-md">There are currently no public events for {groupName}.</p>
          <Link
            href={`/${groupSlug}`}
            className="mt-6 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/25"
          >
            Visit Group
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              timezone="UTC"
              groupId={groupId}
              userId="" // Anonymous user
              characters={[]}
              onRsvp={() => {
                // Public events don't support member RSVP, only guest signup
              }}
              isPublicView={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

