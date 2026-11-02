import { getServerAuthStack } from '@/lib/authStack';
import { auth } from '@/auth';

export interface SessionSnapshot {
  stack: 'v1' | 'v2';
  userId: string | null;
  discordId: string | null;
  displayName: string | null;
}

export async function getSessionSnapshot(): Promise<SessionSnapshot> {
  const stack = getServerAuthStack();

  if (stack === 'v1') {
    return {
      stack,
      userId: null,
      discordId: null,
      displayName: null,
    };
  }

  const session = await auth();

  return {
    stack,
    userId: session?.user?.id ?? null,
    discordId: session?.user?.discordId ?? null,
    displayName: session?.user?.name ?? null,
  };
}
