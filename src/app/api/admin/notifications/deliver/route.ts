import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processAdminNotifications } from '@/server/admin-discord';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[admin-discord] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Notification worker is not configured' }, { status: 503 });
  }
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Server missing database credentials' }, { status: 503 });
  try {
    const result = await processAdminNotifications(createClient(url, key));
    return NextResponse.json(result);
  } catch {
    console.error('[admin-discord] Worker failed; inspect queue for uncertain deliveries');
    return NextResponse.json({ error: 'Unable to process admin notifications' }, { status: 500 });
  }
}
