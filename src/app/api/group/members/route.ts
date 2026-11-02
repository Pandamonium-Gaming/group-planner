import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import type { GroupRole } from '@/lib/permissions';
import { getCurrentMonthKey, getSubscriberShips } from '@/games/starcitizen/config/subscriber-ships';
import { removeSubscriberShips, syncSubscriberShips, updateSubscriberTier, type SubscriberTier } from '@/lib/subscriberShips';
import { getWowForeverFaction, isValidWowForeverSelection, resetChangedWowProfessionRanks } from '@/games/wowforever/config';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

type RequestUserContext = {
  candidateUserIds: string[];
};

type MemberMutationPayload = {
  action: 'update_rank';
  group_id: string;
  membership_id: string;
  rank: string | null;
} | {
  action: 'update_role';
  group_id: string;
  membership_id: string;
  role: GroupRole;
} | {
  action: 'accept_member';
  group_id: string;
  membership_id: string;
} | {
  action: 'reject_member';
  group_id: string;
  membership_id: string;
} | {
  action: 'remove_member';
  group_id: string;
  membership_id: string;
} | {
  action: 'update_user_rank';
  group_id: string;
  target_user_id: string;
  rank: string | null;
} | {
  action: 'update_character_rank';
  group_id: string;
  character_id: string;
  rank: string | null;
} | {
  action: 'create_character';
  group_id: string;
  game_slug?: string;
  character: Record<string, unknown>;
} | {
  action: 'update_character';
  group_id: string;
  character_id: string;
  changes: Record<string, unknown>;
} | {
  action: 'delete_character';
  group_id: string;
  character_id: string;
} | {
  action: 'set_profession_rank';
  group_id: string;
  character_id: string;
  profession_id: string;
  rank: string | null;
  level?: number;
  quality?: number;
} | {
  action: 'sync_subscriber_tier';
  group_id: string;
  character_id: string;
  old_tier?: SubscriberTier;
  new_tier?: SubscriberTier;
  force?: boolean;
};

const MANAGED_USER_ROLES = new Set<GroupRole>(['member', 'trial']);

function isAdminOrOfficer(role: GroupRole) {
  return role === 'admin' || role === 'officer';
}

async function resolveTargetRole(
  supabaseAdmin: SupabaseClient,
  groupId: string,
  userId: string
): Promise<GroupRole | null> {
  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve target role: ${error.message}`);
  }

  return (data?.role || null) as GroupRole | null;
}

function buildMemberPayload(data: Record<string, unknown>, effectiveGame: string) {
  const payload: Record<string, unknown> = {};

  const baseFields = ['name', 'level', 'is_main', 'user_id', 'preferred_role'];
  baseFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = data[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(data, 'rank')) {
    payload.rank = data.rank;
  }

  if (effectiveGame === 'aoc') {
    ['race', 'primary_archetype', 'secondary_archetype'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        payload[field] = data[field] ?? null;
      }
    });
  }

  if (effectiveGame === 'ror') {
    ['ror_faction', 'ror_class'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        payload[field] = data[field] ?? null;
      }
    });
  }

  if (effectiveGame === 'wowforever') {
    ['wow_race', 'wow_faction', 'wow_class', 'wow_main_spec', 'wow_secondary_spec', 'wow_profession_1', 'wow_profession_2', 'wow_profession_1_rank', 'wow_profession_2_rank'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        payload[field] = data[field] ?? null;
      }
    });
  }

  if (effectiveGame === 'starcitizen') {
    ['subscriber_tier', 'subscriber_since', 'subscriber_ships_month'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        payload[field] = data[field] ?? null;
      }
    });
  }

  return payload;
}

async function resolveRequestUserContext(
  request: NextRequest,
  supabaseAdmin: SupabaseClient
): Promise<RequestUserContext> {
  const candidateUserIds = new Set<string>();
  const session = await auth();
  const sessionUserId = session?.user?.id || null;
  const discordId = session?.user?.discordId || null;

  if (sessionUserId) {
    candidateUserIds.add(sessionUserId);
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
  }

  if (candidateUserIds.size === 0) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user }, error: authError } = await userClient.auth.getUser(token);
      if (!authError && user?.id) {
        candidateUserIds.add(user.id);
      }
    }
  }

  return { candidateUserIds: Array.from(candidateUserIds) };
}

async function requireGroupMembership(
  supabaseAdmin: SupabaseClient,
  groupId: string,
  userIds: string[]
): Promise<{ role: GroupRole; user_id: string } | null> {
  if (userIds.length === 0) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('role, user_id')
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

  return data as { role: GroupRole; user_id: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const gameSlug = searchParams.get('game_slug') || 'aoc';
  const view = searchParams.get('view') || 'characters';
  const includePending = searchParams.get('include_pending') === 'true';

  if (!groupId) {
    return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: 'Failed to verify membership', details: membershipError.message }, { status: 500 });
  }

  if (!membership || membership.role === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (includePending && membership.role !== 'admin' && membership.role !== 'officer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (view === 'memberships') {
    if (includePending && membership.role !== 'admin' && membership.role !== 'officer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: membershipRows, error: membershipsError } = await supabaseAdmin
      .from('group_members')
      .select(`
        id,
        user_id,
        role,
        guild_rank,
        is_creator,
        applied_at,
        approved_at,
        users!group_members_user_id_fkey(display_name, discord_username, discord_avatar)
      `)
      .eq('group_id', groupId)
      .order('role');

    if (membershipsError) {
      return NextResponse.json({ error: 'Failed to load memberships', details: membershipsError.message }, { status: 500 });
    }

    const filteredMemberships = includePending
      ? membershipRows
      : (membershipRows || []).filter((row) => row.role !== 'pending');

    return NextResponse.json({ members: filteredMemberships || [] });
  }

  const { data: characters, error: charactersError } = await supabaseAdmin
    .from('members')
    .select(`
      *,
      member_professions (*),
      owner:users!members_user_id_fkey(display_name, discord_username)
    `)
    .eq('group_id', groupId)
    .eq('game_slug', gameSlug)
    .order('is_main', { ascending: false })
    .order('name');

  if (charactersError) {
    return NextResponse.json({ error: 'Failed to load members', details: charactersError.message }, { status: 500 });
  }

  return NextResponse.json({ members: characters || [] });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server missing Supabase service credentials' }, { status: 500 });
  }

  try {
    const payload = (await request.json()) as MemberMutationPayload;

    if (
      payload.action !== 'update_rank' &&
      payload.action !== 'update_user_rank' &&
      payload.action !== 'update_character_rank' &&
      payload.action !== 'update_role' &&
      payload.action !== 'accept_member' &&
      payload.action !== 'reject_member' &&
      payload.action !== 'remove_member' &&
      payload.action !== 'create_character' &&
      payload.action !== 'update_character' &&
      payload.action !== 'delete_character' &&
      payload.action !== 'set_profession_rank' &&
      payload.action !== 'sync_subscriber_tier'
    ) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    if (!payload.group_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (payload.action === 'update_rank' && !payload.membership_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if ((payload.action === 'update_role' || payload.action === 'accept_member' || payload.action === 'reject_member' || payload.action === 'remove_member') && !payload.membership_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (payload.action === 'update_user_rank' && !payload.target_user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (payload.action === 'update_character_rank' && !payload.character_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (payload.action === 'create_character' && !payload.character) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if ((payload.action === 'update_character' || payload.action === 'delete_character' || payload.action === 'set_profession_rank' || payload.action === 'sync_subscriber_tier') && !payload.character_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (payload.action === 'set_profession_rank' && !payload.profession_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userContext = await resolveRequestUserContext(request, supabaseAdmin);
    if (userContext.candidateUserIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorMembership = await requireGroupMembership(
      supabaseAdmin,
      payload.group_id,
      userContext.candidateUserIds
    );

    if (!actorMembership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payload.action === 'create_character') {
      const effectiveGame = payload.game_slug || 'aoc';
      const characterData = payload.character || {};
      if (effectiveGame === 'wowforever' && characterData.wow_race === 'Skyborne' &&
        !getWowForeverFaction('Skyborne', String(characterData.wow_class || ''), String(characterData.wow_faction || ''))) {
        return NextResponse.json({ error: 'A faction is required for Skyborne characters' }, { status: 400 });
      }
      if (
        effectiveGame === 'wowforever' &&
        !isValidWowForeverSelection({
          race: characterData.wow_race as string | null | undefined,
          faction: characterData.wow_faction as string | null | undefined,
          classId: characterData.wow_class as string | null | undefined,
          mainSpec: characterData.wow_main_spec as string | null | undefined,
          secondarySpec: characterData.wow_secondary_spec as string | null | undefined,
          profession1: characterData.wow_profession_1 as string | null | undefined,
          profession2: characterData.wow_profession_2 as string | null | undefined,
          profession1Rank: characterData.wow_profession_1_rank,
          profession2Rank: characterData.wow_profession_2_rank,
        })
      ) {
        return NextResponse.json({ error: 'Invalid WoW Forever character selection' }, { status: 400 });
      }

      const requestedUserId =
        typeof characterData.user_id === 'string' && characterData.user_id.length > 0
          ? characterData.user_id
          : null;
      const targetUserId = requestedUserId || actorMembership.user_id;

      if (targetUserId !== actorMembership.user_id && !isAdminOrOfficer(actorMembership.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (targetUserId !== actorMembership.user_id && actorMembership.role === 'officer') {
        const targetRole = await resolveTargetRole(supabaseAdmin, payload.group_id, targetUserId);
        if (targetRole && !MANAGED_USER_ROLES.has(targetRole)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const insertPayload = {
        ...buildMemberPayload(characterData, effectiveGame),
        group_id: payload.group_id,
        game_slug: effectiveGame,
        user_id: targetUserId,
        name: (characterData.name as string | undefined) || 'Unnamed Character',
        level: (characterData.level as number | undefined) || 1,
        is_main: (characterData.is_main as boolean | undefined) || false,
      };

      if (insertPayload.is_main && targetUserId) {
        await supabaseAdmin
          .from('members')
          .update({ is_main: false })
          .eq('group_id', payload.group_id)
          .eq('user_id', targetUserId)
          .eq('game_slug', effectiveGame)
          .eq('is_main', true);
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('members')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create character', details: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ character: inserted });
    }

    if (payload.action === 'update_character' || payload.action === 'delete_character' || payload.action === 'set_profession_rank' || payload.action === 'sync_subscriber_tier') {
      const { data: targetCharacter, error: targetCharacterError } = await supabaseAdmin
        .from('members')
        .select('id, group_id, user_id, game_slug, wow_race, wow_faction, wow_class, wow_main_spec, wow_secondary_spec, wow_profession_1, wow_profession_2, wow_profession_1_rank, wow_profession_2_rank')
        .eq('id', payload.character_id)
        .eq('group_id', payload.group_id)
        .maybeSingle();

      if (targetCharacterError) {
        return NextResponse.json({ error: 'Failed to resolve character', details: targetCharacterError.message }, { status: 500 });
      }

      if (!targetCharacter) {
        return NextResponse.json({ error: 'Character not found' }, { status: 404 });
      }

      const isOwnCharacter = !!targetCharacter.user_id && userContext.candidateUserIds.includes(targetCharacter.user_id);
      if (!isOwnCharacter && !isAdminOrOfficer(actorMembership.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!isOwnCharacter && actorMembership.role === 'officer' && targetCharacter.user_id) {
        const targetRole = await resolveTargetRole(supabaseAdmin, payload.group_id, targetCharacter.user_id);
        if (targetRole && !MANAGED_USER_ROLES.has(targetRole)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      if (payload.action === 'delete_character') {
        const { error: deleteError } = await supabaseAdmin
          .from('members')
          .delete()
          .eq('id', payload.character_id)
          .eq('group_id', payload.group_id);

        if (deleteError) {
          return NextResponse.json({ error: 'Failed to delete character', details: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (payload.action === 'set_profession_rank') {
        const normalizedRank = payload.rank && payload.rank.trim().length > 0 ? payload.rank.trim() : null;

        if (normalizedRank === null) {
          const { error: deleteProfessionError } = await supabaseAdmin
            .from('member_professions')
            .delete()
            .eq('member_id', payload.character_id)
            .eq('profession', payload.profession_id);

          if (deleteProfessionError) {
            return NextResponse.json({ error: 'Failed to remove profession rank', details: deleteProfessionError.message }, { status: 500 });
          }

          return NextResponse.json({ success: true });
        }

        const { error: upsertError } = await supabaseAdmin
          .from('member_professions')
          .upsert(
            {
              member_id: payload.character_id,
              profession: payload.profession_id,
              rank: normalizedRank,
              artisan_level: payload.level ?? 1,
              quality_score: payload.quality ?? 0,
            },
            { onConflict: 'member_id,profession' }
          );

        if (upsertError) {
          return NextResponse.json({ error: 'Failed to upsert profession rank', details: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      if (payload.action === 'sync_subscriber_tier') {
        const oldTier = payload.old_tier ?? null;
        const newTier = payload.new_tier ?? null;
        const force = payload.force === true;

        if ((targetCharacter.game_slug as string) !== 'starcitizen') {
          return NextResponse.json({ success: true });
        }

        if (force && newTier) {
          const result = await syncSubscriberShips(supabaseAdmin, payload.character_id, newTier);
          if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to sync subscriber ships' }, { status: 500 });
          }

          await supabaseAdmin
            .from('members')
            .update({ subscriber_ships_month: getCurrentMonthKey() })
            .eq('id', payload.character_id)
            .eq('group_id', payload.group_id);

          return NextResponse.json({ success: true });
        }

        if (newTier && newTier !== oldTier) {
          if (oldTier) {
            const result = await updateSubscriberTier(supabaseAdmin, payload.character_id, oldTier, newTier);
            if (!result.success) {
              return NextResponse.json({ error: result.error || 'Failed to sync subscriber ships' }, { status: 500 });
            }
          } else {
            const result = await syncSubscriberShips(supabaseAdmin, payload.character_id, newTier);
            if (!result.success) {
              return NextResponse.json({ error: result.error || 'Failed to sync subscriber ships' }, { status: 500 });
            }
          }

          await supabaseAdmin
            .from('members')
            .update({ subscriber_ships_month: getCurrentMonthKey() })
            .eq('id', payload.character_id)
            .eq('group_id', payload.group_id);

          return NextResponse.json({ success: true });
        }

        if (!newTier && oldTier) {
          const shipsToRemove = getSubscriberShips(oldTier);
          if (shipsToRemove.length > 0) {
            const removeResult = await removeSubscriberShips(supabaseAdmin, payload.character_id, shipsToRemove);
            if (!removeResult.success) {
              return NextResponse.json({ error: removeResult.error || 'Failed to remove subscriber ships' }, { status: 500 });
            }
          }

          await supabaseAdmin
            .from('members')
            .update({ subscriber_ships_month: null })
            .eq('id', payload.character_id)
            .eq('group_id', payload.group_id);

          return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: true });
      }

      const effectiveGame = (targetCharacter.game_slug as string) || 'aoc';
      const changes = effectiveGame === 'wowforever'
        ? resetChangedWowProfessionRanks(payload.changes || {}, targetCharacter)
        : payload.changes || {};
      if (effectiveGame === 'wowforever') {
        const mergedCharacter = { ...targetCharacter, ...changes };
        if (!isValidWowForeverSelection({
          race: mergedCharacter.wow_race as string | null | undefined,
          faction: mergedCharacter.wow_faction as string | null | undefined,
          classId: mergedCharacter.wow_class as string | null | undefined,
          mainSpec: mergedCharacter.wow_main_spec as string | null | undefined,
          secondarySpec: mergedCharacter.wow_secondary_spec as string | null | undefined,
          profession1: mergedCharacter.wow_profession_1 as string | null | undefined,
          profession2: mergedCharacter.wow_profession_2 as string | null | undefined,
          profession1Rank: mergedCharacter.wow_profession_1_rank,
          profession2Rank: mergedCharacter.wow_profession_2_rank,
        })) {
          return NextResponse.json({ error: 'Invalid WoW Forever character selection' }, { status: 400 });
        }
      }
      const updatePayload = buildMemberPayload(changes, effectiveGame);

      if (!targetCharacter.user_id && actorMembership.user_id) {
        updatePayload.user_id = actorMembership.user_id;
      }

      if ((changes.is_main as boolean | undefined) === true) {
        const targetUserId = (updatePayload.user_id as string | undefined) || targetCharacter.user_id;
        if (targetUserId) {
          await supabaseAdmin
            .from('members')
            .update({ is_main: false })
            .eq('group_id', payload.group_id)
            .eq('user_id', targetUserId)
            .eq('game_slug', effectiveGame)
            .eq('is_main', true)
            .neq('id', payload.character_id);
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('members')
        .update(updatePayload)
        .eq('id', payload.character_id)
        .eq('group_id', payload.group_id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update character', details: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (actorMembership.role !== 'admin' && actorMembership.role !== 'officer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payload.action === 'accept_member') {
      const { data: targetMembership, error: targetError } = await supabaseAdmin
        .from('group_members')
        .select('id, user_id, role')
        .eq('id', payload.membership_id)
        .eq('group_id', payload.group_id)
        .maybeSingle();

      if (targetError) {
        return NextResponse.json({ error: 'Failed to resolve target member', details: targetError.message }, { status: 500 });
      }

      if (!targetMembership) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const { data: groupData, error: groupError } = await supabaseAdmin
        .from('groups')
        .select('default_role')
        .eq('id', payload.group_id)
        .maybeSingle();

      if (groupError) {
        return NextResponse.json({ error: 'Failed to load group defaults', details: groupError.message }, { status: 500 });
      }

      const defaultRole = groupData?.default_role || 'trial';

      const { error: updateError } = await supabaseAdmin
        .from('group_members')
        .update({
          role: defaultRole,
          approved_at: new Date().toISOString(),
          approved_by: userContext.candidateUserIds[0],
        })
        .eq('id', targetMembership.id)
        .eq('group_id', payload.group_id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to accept member', details: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'reject_member' || payload.action === 'remove_member') {
      const { data: targetMembership, error: targetError } = await supabaseAdmin
        .from('group_members')
        .select('id, user_id, role')
        .eq('id', payload.membership_id)
        .eq('group_id', payload.group_id)
        .maybeSingle();

      if (targetError) {
        return NextResponse.json({ error: 'Failed to resolve target member', details: targetError.message }, { status: 500 });
      }

      if (!targetMembership) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const { error: deleteError } = await supabaseAdmin
        .from('group_members')
        .delete()
        .eq('id', targetMembership.id)
        .eq('group_id', payload.group_id);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to remove member', details: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'update_role') {
      const { data: targetMembership, error: targetError } = await supabaseAdmin
        .from('group_members')
        .select('id, user_id, role')
        .eq('id', payload.membership_id)
        .eq('group_id', payload.group_id)
        .maybeSingle();

      if (targetError) {
        return NextResponse.json({ error: 'Failed to resolve target member', details: targetError.message }, { status: 500 });
      }

      if (!targetMembership) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const { error: updateError } = await supabaseAdmin
        .from('group_members')
        .update({ role: payload.role })
        .eq('id', targetMembership.id)
        .eq('group_id', payload.group_id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update member role', details: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (payload.action === 'update_character_rank') {
      const { data: targetCharacter, error: characterError } = await supabaseAdmin
        .from('members')
        .select('id, user_id, group_id')
        .eq('id', payload.character_id)
        .eq('group_id', payload.group_id)
        .maybeSingle();

      if (characterError) {
        return NextResponse.json({ error: 'Failed to resolve character', details: characterError.message }, { status: 500 });
      }

      if (!targetCharacter) {
        return NextResponse.json({ error: 'Character not found' }, { status: 404 });
      }

      const isOwnCharacter = !!targetCharacter.user_id && userContext.candidateUserIds.includes(targetCharacter.user_id);
      if (!isOwnCharacter && actorMembership.role !== 'admin' && actorMembership.role !== 'officer') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!isOwnCharacter && actorMembership.role === 'officer' && targetCharacter.user_id) {
        const { data: targetMembership, error: targetMembershipError } = await supabaseAdmin
          .from('group_members')
          .select('role')
          .eq('group_id', payload.group_id)
          .eq('user_id', targetCharacter.user_id)
          .maybeSingle();

        if (targetMembershipError) {
          return NextResponse.json({ error: 'Failed to resolve target member role', details: targetMembershipError.message }, { status: 500 });
        }

        if (targetMembership && targetMembership.role !== 'member' && targetMembership.role !== 'trial') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const normalizedRank = payload.rank && payload.rank.trim().length > 0 ? payload.rank.trim() : null;

      const { error: characterUpdateError } = await supabaseAdmin
        .from('members')
        .update({ rank: normalizedRank })
        .eq('id', payload.character_id)
        .eq('group_id', payload.group_id);

      if (characterUpdateError) {
        return NextResponse.json({ error: 'Failed to update character rank', details: characterUpdateError.message }, { status: 500 });
      }

      if (targetCharacter.user_id) {
        const { error: memberRankError } = await supabaseAdmin
          .from('group_members')
          .update({ guild_rank: normalizedRank })
          .eq('group_id', payload.group_id)
          .eq('user_id', targetCharacter.user_id);

        if (memberRankError) {
          return NextResponse.json({ error: 'Failed to sync member rank', details: memberRankError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    const targetLookup = payload.action === 'update_rank'
      ? supabaseAdmin
          .from('group_members')
          .select('id, role, user_id')
          .eq('id', payload.membership_id)
          .eq('group_id', payload.group_id)
          .maybeSingle()
      : supabaseAdmin
          .from('group_members')
          .select('id, role, user_id')
          .eq('group_id', payload.group_id)
          .eq('user_id', payload.target_user_id)
          .maybeSingle();

    const { data: targetMembership, error: targetError } = await targetLookup;

    if (targetError) {
      return NextResponse.json({ error: 'Failed to resolve target member', details: targetError.message }, { status: 500 });
    }

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (actorMembership.role !== 'admin' && userContext.candidateUserIds.includes(targetMembership.user_id)) {
      return NextResponse.json({ error: 'Cannot modify your own rank' }, { status: 403 });
    }

    if (actorMembership.role === 'officer' && targetMembership.role !== 'member' && targetMembership.role !== 'trial') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedRank = payload.rank && payload.rank.trim().length > 0 ? payload.rank.trim() : null;

    const { error: updateError } = await supabaseAdmin
      .from('group_members')
      .update({ guild_rank: normalizedRank })
      .eq('id', targetMembership.id)
      .eq('group_id', payload.group_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update member rank', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
