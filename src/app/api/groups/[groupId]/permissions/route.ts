import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { getGroupPermissionsSnapshot } from '@/server/permissions/group-permissions-service';

type RequestUserContext = {
  candidateUserIds: string[];
};

async function resolveRequestUserContext(request: NextRequest): Promise<RequestUserContext> {
  const candidateUserIds = new Set<string>();
  const session = await auth();
  const sessionUserId = session?.user?.id || null;
  const discordId = session?.user?.discordId || null;

  if (sessionUserId) {
    candidateUserIds.add(sessionUserId);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (discordId && supabaseUrl && supabaseServiceRoleKey) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: linkedUsers, error: linkedUsersError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId);

    if (!linkedUsersError) {
      (linkedUsers || []).forEach((linkedUser) => {
        if (linkedUser?.id) {
          candidateUserIds.add(linkedUser.id);
        }
      });
    }
  }

  if (candidateUserIds.size === 0) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (token && supabaseUrl && supabaseAnonKey) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey);
      const {
        data: { user },
        error,
      } = await userClient.auth.getUser(token);

      if (!error && user?.id) {
        candidateUserIds.add(user.id);
      }
    }
  }

  return { candidateUserIds: Array.from(candidateUserIds) };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await context.params;
    if (!groupId) {
      return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
    }

    const userContext = await resolveRequestUserContext(request);
    if (userContext.candidateUserIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await getGroupPermissionsSnapshot(groupId, userContext.candidateUserIds);
    if (!snapshot) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      groupId: snapshot.groupId,
      userId: snapshot.userId,
      role: snapshot.role,
      permissions: snapshot.permissions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
