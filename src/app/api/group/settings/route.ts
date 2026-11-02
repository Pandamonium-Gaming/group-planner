import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import { roleHasPermission, type GroupRole } from '@/lib/permissions';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

type RequestUserContext = {
  primaryUserId: string | null;
  discordId: string | null;
  candidateUserIds: string[];
};

async function resolveRequestUserContext(
  request: NextRequest,
  supabaseAdmin: SupabaseClient
): Promise<RequestUserContext> {
  const candidateUserIds = new Set<string>();
  const nextAuthSession = await auth();
  const discordId = nextAuthSession?.user?.discordId || null;

  if (nextAuthSession?.user?.id) {
    candidateUserIds.add(nextAuthSession.user.id);
  }

  if (discordId) {
    const { data: linkedUsers, error: linkedUsersError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId);

    if (!linkedUsersError) {
      ((linkedUsers || []) as Array<{ id: string | null }>).forEach((linkedUser) => {
        if (linkedUser?.id) {
          candidateUserIds.add(linkedUser.id);
        }
      });
    }

    return {
      primaryUserId: nextAuthSession?.user?.id ?? null,
      discordId,
      candidateUserIds: Array.from(candidateUserIds),
    };
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return {
      primaryUserId: null,
      discordId: null,
      candidateUserIds: [],
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      primaryUserId: null,
      discordId: null,
      candidateUserIds: [],
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) {
    return {
      primaryUserId: null,
      discordId: null,
      candidateUserIds: [],
    };
  }

  candidateUserIds.add(user.id);
  return {
    primaryUserId: user.id,
    discordId: null,
    candidateUserIds: Array.from(candidateUserIds),
  };
}

async function requireGroupMembership(
  supabaseAdmin: SupabaseClient,
  groupId: string,
  userIds: string[]
): Promise<{ role: GroupRole } | null> {
  if (userIds.length === 0) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .in('user_id', userIds)
    .neq('role', 'pending')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify membership: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as { role: GroupRole };
}

const ALLOWED_GROUP_FIELDS = new Set([
  'is_public',
  'recruitment_open',
  'recruitment_message',
  'public_description',
  'approval_required',
  'default_role',
  'group_webhook_url',
  'group_welcome_webhook_url',
  'notify_on_events',
  'notify_on_announcements',
  'aoc_webhook_url',
  'aoc_events_webhook_url',
  'sc_webhook_url',
  'sc_events_webhook_url',
  'ror_webhook_url',
  'ror_events_webhook_url',
  'wowforever_webhook_url',
  'wowforever_events_webhook_url',
  'aoc_announcement_role_id',
  'aoc_events_role_id',
  'sc_announcement_role_id',
  'sc_events_role_id',
  'ror_announcement_role_id',
  'ror_events_role_id',
  'wowforever_announcement_role_id',
  'wowforever_events_role_id',
  'aoc_recruitment_open',
  'sc_recruitment_open',
  'ror_recruitment_open',
  'wowforever_recruitment_open',
  'aoc_recruitment_message',
  'sc_recruitment_message',
  'ror_recruitment_message',
  'wowforever_recruitment_message',
  'aoc_public_description',
  'sc_public_description',
  'ror_public_description',
  'wowforever_public_description',
  'aoc_ranks_enabled',
  'sc_ranks_enabled',
  'ror_ranks_enabled',
  'wowforever_ranks_enabled',
  'aoc_custom_ranks',
  'sc_custom_ranks',
  'ror_custom_ranks',
  'wowforever_custom_ranks',
]);

const RECRUITMENT_FIELDS = new Set([
  'recruitment_open',
  'recruitment_message',
  'public_description',
  'approval_required',
  'default_role',
  'aoc_recruitment_open',
  'sc_recruitment_open',
  'ror_recruitment_open',
  'aoc_recruitment_message',
  'sc_recruitment_message',
  'ror_recruitment_message',
  'aoc_public_description',
  'sc_public_description',
  'ror_public_description',
]);

type SettingsMutationPayload =
  | {
      action: 'update_group_fields';
      group_id: string;
      changes: Record<string, unknown>;
    }
  | {
      action: 'update_recruitment_application';
      group_id: string;
      application_id: string;
      status: 'accepted' | 'rejected';
    };

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  const userContext = await resolveRequestUserContext(request, supabaseAdmin);
  if (userContext.candidateUserIds.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const view = searchParams.get('view');

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  try {
    const membership = await requireGroupMembership(supabaseAdmin, groupId, userContext.candidateUserIds);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (view === 'recruitment_overview') {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('groups')
        .select('is_public, recruitment_open, recruitment_message, public_description, approval_required, default_role')
        .eq('id', groupId)
        .maybeSingle();

      if (settingsError) {
        return NextResponse.json({ error: 'Failed to load recruitment settings', details: settingsError.message }, { status: 500 });
      }

      const canManageRecruitment = roleHasPermission(membership.role, 'recruitment_manage');
      let applications: Array<Record<string, unknown>> = [];

      if (canManageRecruitment) {
        const { data: appsData, error: appsError } = await supabaseAdmin
          .from('recruitment_applications')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });

        if (appsError) {
          return NextResponse.json({ error: 'Failed to load recruitment applications', details: appsError.message }, { status: 500 });
        }

        applications = (appsData || []) as Array<Record<string, unknown>>;
      }

      return NextResponse.json({
        settings: settings || null,
        applications,
        can_manage_recruitment: canManageRecruitment,
      });
    }

    if (view === 'group_fields') {
      const fieldsParam = searchParams.get('fields') || '';
      const requestedFields = fieldsParam
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field.length > 0);

      if (requestedFields.length === 0) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }

      const allowedFields = requestedFields.filter((field) => ALLOWED_GROUP_FIELDS.has(field));
      if (allowedFields.length === 0) {
        return NextResponse.json({ error: 'No allowed fields requested' }, { status: 400 });
      }

      const hasRecruitmentFields = allowedFields.some((field) => RECRUITMENT_FIELDS.has(field));
      const hasNonRecruitmentFields = allowedFields.some((field) => !RECRUITMENT_FIELDS.has(field));

      if (hasRecruitmentFields && !roleHasPermission(membership.role, 'recruitment_manage')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (
        hasNonRecruitmentFields &&
        !roleHasPermission(membership.role, 'settings_edit') &&
        !roleHasPermission(membership.role, 'settings_edit_roles')
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('groups')
        .select(allowedFields.join(', '))
        .eq('id', groupId)
        .maybeSingle();

      if (settingsError) {
        return NextResponse.json({ error: 'Failed to load requested group fields', details: settingsError.message }, { status: 500 });
      }

      return NextResponse.json({ fields: settings || {} });
    }

    return NextResponse.json({ error: 'Unsupported view' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  const userContext = await resolveRequestUserContext(request, supabaseAdmin);
  if (userContext.candidateUserIds.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as SettingsMutationPayload;
    const groupId = payload.group_id;
    if (!groupId) {
      return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
    }

    const membership = await requireGroupMembership(supabaseAdmin, groupId, userContext.candidateUserIds);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = membership.role;

    if (payload.action === 'update_group_fields') {
      const changes = payload.changes || {};
      const sanitizedEntries = Object.entries(changes).filter(([key]) => ALLOWED_GROUP_FIELDS.has(key));

      if (sanitizedEntries.length === 0) {
        return NextResponse.json({ error: 'No allowed fields to update' }, { status: 400 });
      }

      const fieldKeys = sanitizedEntries.map(([key]) => key);
      const hasRecruitmentFields = fieldKeys.some((key) => RECRUITMENT_FIELDS.has(key));
      const hasNonRecruitmentFields = fieldKeys.some((key) => !RECRUITMENT_FIELDS.has(key));

      if (hasRecruitmentFields && !roleHasPermission(role, 'recruitment_manage')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (
        hasNonRecruitmentFields &&
        !roleHasPermission(role, 'settings_edit') &&
        !roleHasPermission(role, 'settings_edit_roles')
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const updateData = Object.fromEntries(sanitizedEntries);
      const { error } = await supabaseAdmin
        .from('groups')
        .update(updateData)
        .eq('id', groupId);

      if (error) {
        return NextResponse.json({ error: 'Failed to update group settings', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'update_recruitment_application') {
      if (!roleHasPermission(role, 'recruitment_manage')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { application_id: applicationId, status } = payload;
      if (!applicationId || !status) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('recruitment_applications')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('group_id', groupId);

      if (error) {
        return NextResponse.json({ error: 'Failed to update recruitment application', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
