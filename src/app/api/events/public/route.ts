import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select(`
      *,
      event_rsvps(
        *,
        character:members(id, name),
        user:users(id, display_name)
      ),
      guest_event_rsvps(*),
      clan:group_id(id, name, slug)
    `)
    .eq('is_public', true)
    .order('starts_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load public events', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}