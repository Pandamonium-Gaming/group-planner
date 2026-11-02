import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthStack } from '@/lib/authStack';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { findOrCreateUserProfileById } from '@/server/users/user-profile-repository';

type AuthContext = {
  userId: string | null;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  displayName: string | null;
};

async function resolveAuthContext(request: NextRequest): Promise<AuthContext> {
  const stack = getServerAuthStack();

  if (stack === 'v2') {
    const session = await auth();
    return {
      userId: session?.user?.id ?? null,
      discordId: session?.user?.discordId ?? null,
      discordUsername: null,
      discordAvatar: null,
      displayName: session?.user?.name ?? null,
    };
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return {
      userId: null,
      discordId: null,
      discordUsername: null,
      discordAvatar: null,
      displayName: null,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      userId: null,
      discordId: null,
      discordUsername: null,
      discordAvatar: null,
      displayName: null,
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return {
      userId: null,
      discordId: null,
      discordUsername: null,
      discordAvatar: null,
      displayName: null,
    };
  }

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const username = typeof metadata.full_name === 'string'
    ? metadata.full_name
    : (typeof metadata.name === 'string' ? metadata.name : null);

  return {
    userId: user.id,
    discordId: typeof metadata.provider_id === 'string' ? metadata.provider_id : null,
    discordUsername: username,
    discordAvatar: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
    displayName: username,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await resolveAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await findOrCreateUserProfileById(authContext.userId, {
      discordId: authContext.discordId,
      discordUsername: authContext.discordUsername,
      discordAvatar: authContext.discordAvatar,
      displayName: authContext.displayName,
      timezone: 'UTC',
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authContext = await resolveAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      timezone?: string;
      display_name?: string | null;
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRole) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRole);
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.timezone === 'string') {
      updatePayload.timezone = body.timezone;
    }

    if (body.display_name !== undefined) {
      updatePayload.display_name = body.display_name?.trim() || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await adminClient
      .from('users')
      .update(updatePayload)
      .eq('id', authContext.userId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile', details: error.message }, { status: 500 });
    }

    const profile = await findOrCreateUserProfileById(authContext.userId, {
      discordId: authContext.discordId,
      discordUsername: authContext.discordUsername,
      discordAvatar: authContext.discordAvatar,
      displayName: body.display_name ?? authContext.displayName,
      timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
