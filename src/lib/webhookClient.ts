import { getClientAuthStack } from './authStack';
import { supabase } from './supabase';

export async function webhookHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (getClientAuthStack() !== 'v2') {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Sign in before sending a Discord notification');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

export async function postEventNotification(eventId: string, repost = false) {
  return postNotification({ event_id: eventId, repost });
}

export async function postAnnouncementNotification(announcementId: string, gameSlug: string) {
  return postNotification({ announcement_id: announcementId, game_slug: gameSlug });
}

async function postNotification(body: { event_id: string; repost: boolean } | { announcement_id: string; game_slug: string }) {
  const response = await fetch('/api/group/events/notify', {
    method: 'POST', credentials: 'include', headers: await webhookHeaders(),
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Discord notification failed (${response.status})`);
  return result as { success?: boolean; skipped?: boolean };
}
