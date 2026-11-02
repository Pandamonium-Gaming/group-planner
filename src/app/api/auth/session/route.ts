import { NextResponse } from 'next/server';
import { getSessionSnapshot } from '@/server/auth/session-service';

export async function GET() {
  const session = await getSessionSnapshot();

  return NextResponse.json({
    stack: session.stack,
    authenticated: !!session.userId,
    user: session.userId
      ? {
          id: session.userId,
          discordId: session.discordId,
          displayName: session.displayName,
        }
      : null,
  });
}