'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole, applyToGroup, getGroupMembership } from '@/lib/auth';
import { GroupRole } from '@/lib/permissions';
import { getClientAuthStack } from '@/lib/authStack';
import { sendDiscordWebhook } from '@/lib/discord';

interface ClanMember {
  id: string;
  user_id: string;
  role: UserRole;
  guild_rank: string | null;
  is_creator: boolean;
  applied_at: string;
  approved_at: string | null;
  user: {
    display_name: string | null;
    discord_username: string | null;
    discord_avatar: string | null;
  } | null;
}

interface UseClanMembershipReturn {
  membership: {
    role: UserRole;
    isCreator: boolean;
    isApproved: boolean;
  } | null;
  members: ClanMember[];
  pendingMembers: ClanMember[];
  loading: boolean;
  error: string | null;
  apply: () => Promise<void>;
  acceptMember: (membershipId: string) => Promise<void>;
  rejectMember: (membershipId: string) => Promise<void>;
  updateRole: (membershipId: string, role: GroupRole) => Promise<void>;
  updateRank: (membershipId: string, rank: string | null) => Promise<void>;
  removeMember: (membershipId: string) => Promise<void>;
  refresh: () => Promise<void>;
  // Permission helpers
  canView: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canManageRoles: boolean;
}

export function useGroupMembership(groupId: string | null, userId: string | null, gameSlug: string = 'aoc'): UseClanMembershipReturn {
  const [membership, setMembership] = useState<UseClanMembershipReturn['membership']>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when groupId or userId changes (prevent stale data on route transition)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setMembership(null);
      setMembers([]);
      setPendingMembers([]);
      setLoading(true);
    }, 0);

    return () => clearTimeout(timerId);
  }, [groupId, userId]);

  const transformMembers = useCallback((rows: Array<Record<string, unknown>>) => {
    return rows.map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      role: row.role as UserRole,
      guild_rank: typeof row.guild_rank === 'string' ? row.guild_rank : null,
      is_creator: Boolean(row.is_creator),
      applied_at: String(row.applied_at || ''),
      approved_at: typeof row.approved_at === 'string' ? row.approved_at : null,
      user: (() => {
        const users = row.users as Array<Record<string, unknown>> | Record<string, unknown> | null | undefined;
        const user = Array.isArray(users) ? users[0] : users;
        if (!user) return null;

        return {
          display_name: typeof user.display_name === 'string' ? user.display_name : null,
          discord_username: typeof user.discord_username === 'string' ? user.discord_username : null,
          discord_avatar: typeof user.discord_avatar === 'string' ? user.discord_avatar : null,
        };
      })(),
    })) as ClanMember[];
  }, []);

  const fetchMembersViaApi = useCallback(async (includePending: boolean) => {
    if (!groupId || !userId) {
      return null;
    }

    const response = await fetch(
      `/api/group/members?group_id=${encodeURIComponent(groupId)}&game_slug=${encodeURIComponent(gameSlug)}&view=memberships&include_pending=${includePending ? 'true' : 'false'}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
      throw new Error(payload.details || payload.error || `Failed to fetch members (${response.status})`);
    }

    const payload = (await response.json()) as { members?: Array<Record<string, unknown>> };
    return transformMembers(payload.members || []);
  }, [gameSlug, groupId, transformMembers, userId]);

  const applyMemberLists = useCallback((allMembers: ClanMember[]) => {
    const approved = allMembers.filter((member) => member.role !== 'pending');
    const pending = allMembers.filter((member) => member.role === 'pending');

    setMembers(approved);
    setPendingMembers(pending);

    if (!userId) {
      setMembership(null);
      return;
    }

    const current = allMembers.find((member) => member.user_id === userId) || null;
    setMembership(current ? {
      role: current.role,
      isCreator: current.is_creator,
      isApproved: current.role !== 'pending',
    } : null);
  }, [userId]);

  const fetchMembership = useCallback(async () => {
    if (!groupId || !userId) {
      setMembership(null);
      setLoading(false);
      return;
    }

    if (getClientAuthStack() === 'v2') {
      return;
    }

    try {
      const data = await getGroupMembership(groupId, userId);
      if (data) {
        setMembership({
          role: data.role as UserRole,
          isCreator: data.is_creator,
          isApproved: data.role !== 'pending',
        });
      } else {
        setMembership(null);
      }
    } catch (err) {
      console.error('Error fetching membership:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch membership');
    }
  }, [groupId, userId]);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;

    if (getClientAuthStack() === 'v2') {
      return;
    }

    try {
      const { data, error: fetchError } = await (await import('@/lib/supabase')).supabase
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

      if (fetchError) throw fetchError;

      // Transform data - Supabase returns users as array or object depending on relationship
      const transformed = (data || []).map(m => ({
        ...m,
        user: Array.isArray(m.users) ? m.users[0] || null : m.users,
      })) as ClanMember[];

      const approved = transformed.filter(m => m.role !== 'pending');
      const pending = transformed.filter(m => m.role === 'pending');

      setMembers(approved);
      setPendingMembers(pending);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, [groupId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (getClientAuthStack() === 'v2') {
        const apiMembers = await fetchMembersViaApi(true).catch(async (error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('403')) {
            return await fetchMembersViaApi(false);
          }
          throw error;
        });

        if (!apiMembers) {
          setMembership(null);
          setMembers([]);
          setPendingMembers([]);
          return;
        }

        applyMemberLists(apiMembers);
        return;
      }

      await Promise.all([fetchMembership(), fetchMembers()]);
    } catch (e) {
      console.error('Error refreshing clan membership:', e);
      setError(e instanceof Error ? e.message : 'Failed to refresh membership');
    } finally {
      setLoading(false);
    }
  }, [applyMemberLists, fetchMembership, fetchMembers, fetchMembersViaApi]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void refresh();
    }, 0);

    return () => clearTimeout(timerId);
  }, [refresh]);

  const apply = async () => {
    if (!groupId || !userId) throw new Error('Not authenticated');
    await applyToGroup(groupId, userId);
    await refresh();
  };

  const getWelcomeEmbed = (discordUsername: string) => {
    if (gameSlug === 'starcitizen') {
      const checklist = [
        '✅ Register your main character in the planner',
        '✅ Set your preferred role (Pilot, Engineer, Medic, etc.)',
        '✅ Connect your org tags and callsign',
        '✅ Review flight safety protocols and guidelines',
        '✅ Introduce yourself and your experience in Discord',
      ];
      return {
        title: '🚀 Welcome to the Squadron!',
        description: `Welcome <@${discordUsername}>! We're thrilled to have you join our squadron. Here's how to get started:`,
        color: 0xff6600, // Star Citizen orange
        fields: [
          {
            name: 'Getting Started',
            value: checklist.join('\n'),
            inline: false,
          },
          {
            name: 'Need Help?',
            value: 'Ask in this channel or contact a squad lead for assistance.',
            inline: false,
          },
        ],
        footer: { text: 'Star Citizen Squadron Planner' },
        timestamp: new Date().toISOString(),
      };
    } else {
      // Ashes of Creation (default)
      const checklist = [
        '✅ Set your main character in the planner',
        '✅ Fill out your professions and skills',
        '✅ Join upcoming events and RSVP',
        '✅ Read the group rules and code of conduct',
        '✅ Introduce yourself in Discord',
      ];
      return {
        title: '🎉 Welcome to the Group!',
        description: `Welcome <@${discordUsername}>! We're excited to have you join us. Here's how to get started:`,
        color: 0x22c55e, // green
        fields: [
          {
            name: 'Onboarding Checklist',
            value: checklist.join('\n'),
            inline: false,
          },
          {
            name: 'Need Help?',
            value: 'Ask in this channel or contact an officer for assistance.',
            inline: false,
          },
        ],
        footer: { text: 'Group Planner' },
        timestamp: new Date().toISOString(),
      };
    }
  };

  const acceptMember = async (membershipId: string) => {
    if (!userId) throw new Error('Not authenticated');

    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_member',
          group_id: groupId,
          membership_id: membershipId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to accept member (${response.status})`);
      }

      await refresh();
      return;
    }

    const { supabase } = await import('@/lib/supabase');

    // Get the member info (to get user_id, discord_username, and discord_id for mentions)
    const { data: memberData, error: memberFetchError } = await (await import('@/lib/supabase')).supabase
      .from('group_members')
      .select('user_id, group_id, users!group_members_user_id_fkey(discord_username, discord_id)')
      .eq('id', membershipId)
      .maybeSingle();
    if (memberFetchError || !memberData) throw memberFetchError || new Error('Member not found');

    type UserWithDiscord = { discord_username?: string; discord_id?: string };
    const users = memberData.users as UserWithDiscord[] | UserWithDiscord | undefined;
    const discordUsername = Array.isArray(users)
      ? users[0]?.discord_username
      : users?.discord_username;
    const discordId = Array.isArray(users)
      ? users[0]?.discord_id
      : users?.discord_id;
    const groupIdForWebhook = memberData.group_id;

    // Get the group's default role setting
    const { data: groupData } = await supabase
      .from('groups')
      .select('default_role')
      .eq('id', groupIdForWebhook)
      .maybeSingle();
    const defaultRole = groupData?.default_role || 'trial';

    // Update the member's role
    const { error } = await supabase
      .from('group_members')
      .update({
        role: defaultRole,
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', membershipId)
      .select();
    if (error) throw error;

    // Fetch the group's webhook URLs, welcome settings, and name
    let webhookUrl = null;
    let welcomeEnabled = true;
    let groupName = 'the group';
    try {
      const group = await (await import('@/lib/supabase')).supabase
        .from('groups')
        .select('name, group_welcome_webhook_url, group_webhook_url, aoc_welcome_enabled, sc_welcome_enabled')
        .eq('id', groupIdForWebhook)
        .maybeSingle();
      webhookUrl = group.data?.group_welcome_webhook_url || group.data?.group_webhook_url;
      welcomeEnabled = gameSlug === 'starcitizen' 
        ? group.data?.sc_welcome_enabled ?? true
        : group.data?.aoc_welcome_enabled ?? true;
      groupName = group.data?.name || 'the group';
    } catch (e) {
      // ignore, just don't send if not found
    }

    // Enhanced onboarding message with game-specific checklist embed
    if (webhookUrl && discordId && welcomeEnabled) {
      const embed = getWelcomeEmbed(discordUsername || 'member');
      
      let welcomeMessage = `🎉 <@${discordId}> Your request to join **${groupName}** has been approved!`;
      if (gameSlug === 'starcitizen') {
        welcomeMessage = `🚀 <@${discordId}> Your request to join **${groupName}** squadron has been approved!`;
      } else if (gameSlug === 'ror') {
        welcomeMessage = `⚔️ <@${discordId}> Your request to join **${groupName}** warband has been approved!`;
      }
      
      const result = await sendDiscordWebhook(webhookUrl, {
        content: welcomeMessage, embeds: [embed],
      }, { groupId: groupIdForWebhook, gameSlug, kind: 'welcome', subjectId: membershipId });
      if (!result.success) console.error('Member approved, but Discord welcome failed:', result.error);
    }

    await refresh();
  };

  const rejectMember = async (membershipId: string) => {
    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_member',
          group_id: groupId,
          membership_id: membershipId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to reject member (${response.status})`);
      }
    } else {
      const { error } = await (await import('@/lib/supabase')).supabase
        .from('group_members')
        .delete()
        .eq('id', membershipId)
        .select();

      if (error) throw error;
    }

    await refresh();
  };

  const updateRole = async (membershipId: string, role: GroupRole) => {
    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_role',
          group_id: groupId,
          membership_id: membershipId,
          role,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to update role (${response.status})`);
      }
    } else {
      const { error } = await (await import('@/lib/supabase')).supabase
        .from('group_members')
        .update({ role })
        .eq('id', membershipId)
        .select();

      if (error) throw error;
    }

    await refresh();
  };

  const updateRank = async (membershipId: string, rank: string | null) => {
    if (!groupId) {
      throw new Error('Group not found');
    }

    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_rank',
          group_id: groupId,
          membership_id: membershipId,
          rank,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to update rank (${response.status})`);
      }
    } else {
      const { error } = await (await import('@/lib/supabase')).supabase
        .from('group_members')
        .update({ guild_rank: rank })
        .eq('id', membershipId)
        .select();

      if (error) throw error;
    }

    await refresh();
  };

  const removeMember = async (membershipId: string) => {
    if (getClientAuthStack() === 'v2') {
      const response = await fetch('/api/group/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          group_id: groupId,
          membership_id: membershipId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(payload.details || payload.error || `Failed to remove member (${response.status})`);
      }

      await refresh();
      return;
    }

    await rejectMember(membershipId);
  };

  // Permission helpers
  const canView = membership?.role !== 'pending' && membership?.role !== null;
  const canEdit = membership?.role === 'admin' || membership?.role === 'officer';
  const canManageMembers = membership?.role === 'admin' || membership?.role === 'officer';
  const canManageRoles = membership?.role === 'admin';

  return {
    membership,
    members,
    pendingMembers,
    loading,
    error,
    apply,
    acceptMember,
    rejectMember,
    updateRole,
    updateRank,
    removeMember,
    refresh,
    canView,
    canEdit,
    canManageMembers,
    canManageRoles,
  };
}
