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
    .from('groups')
    .select('id, slug, name, group_icon_url, public_description, recruitment_open')
    .eq('is_public', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'Failed to load public groups', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ groups: data || [] });
}