import { NextRequest, NextResponse } from 'next/server';
import migrationFiles from '@/migration_files.json';
import { createClient } from '@supabase/supabase-js';

// Use env vars for Supabase connection
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key' // Needs service role for RLS bypass
);

export async function GET(_req: NextRequest) {
  // Get applied migrations from DB
  const { data, error } = await supabase
    .from('migration_history')
    .select('filename');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const applied = new Set((data || []).map((row: { filename: string }) => row.filename));
  const unapplied = (migrationFiles as string[]).filter(f => !applied.has(f));

  return NextResponse.json({ unapplied });
}

