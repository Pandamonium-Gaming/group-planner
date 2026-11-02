import { NextRequest, NextResponse } from 'next/server';
import { webhookSession } from '@/server/discord';

export async function GET(request: NextRequest) {
  try {
    const { client, userId } = await webhookSession(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const groupId = request.nextUrl.searchParams.get('group_id');
    const page = Number(request.nextUrl.searchParams.get('page') || '0');
    if (!groupId || !Number.isSafeInteger(page) || page < 0 || page > 10000) {
      return NextResponse.json({ error: 'Invalid group or page' }, { status: 400 });
    }
    const { data: member, error: memberError } = await client.from('group_members').select('role')
      .eq('group_id', groupId).eq('user_id', userId).maybeSingle();
    if (memberError) throw memberError;
    if (member?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data, error } = await client.from('discord_webhook_logs')
      .select('id,game_slug,kind,subject_id,actor_id,status,http_status,error,created_at')
      .eq('group_id', groupId).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(page * 50, page * 50 + 50);
    if (error) throw error;
    return NextResponse.json({ logs: data.slice(0, 50), hasMore: data.length > 50 });
  } catch (error) {
    console.error('[discord] Unable to load webhook logs:', error);
    return NextResponse.json({ error: 'Unable to load webhook logs' }, { status: 500 });
  }
}
