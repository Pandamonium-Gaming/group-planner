// Get clan by ID (for webhook lookup)
export async function getGroupById(id: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, slug, name, group_icon_url, group_webhook_url, group_welcome_webhook_url')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
// Update the guild icon URL for a clan
export async function updateClanIconUrl(groupId: string, url: string) {
  const { error } = await supabase
    .from('groups')
    .update({ group_icon_url: url })
    .eq('id', groupId);
  if (error) throw error;
}
import { supabase } from './supabase';
import { getURL } from './url';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'officer' | 'member' | 'trial' | 'pending' | null;

export interface UserProfile {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  display_name: string | null;
  timezone: string;
}

export interface ClanMembership {
  group_id: string;
  role: UserRole;
  is_creator: boolean;
  approved_at: string | null;
}

/**
 * Sign in with Discord OAuth
 */
export async function signInWithDiscord(redirectTo?: string) {
  const baseUrl = getURL();
  const callbackUrl = `${baseUrl}auth/callback`;
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: callbackUrl,
      scopes: 'identify',
    },
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return { subscription };
}

/**
 * Get current user profile from users table
 * Auto-creates profile if it doesn't exist (for users created before trigger was set up)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  // First try to get existing profile
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) throw error;
  
  if (data) return data;
  
  // Profile doesn't exist - create it from auth.users data
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser || authUser.id !== userId) {
    return null; // Can't create profile without auth data
  }
  
  const metadata = authUser.user_metadata || {};
  const newProfile = {
    id: userId,
    discord_id: metadata.provider_id || null,
    discord_username: metadata.full_name || metadata.name || null,
    discord_avatar: metadata.avatar_url || null,
    display_name: metadata.full_name || metadata.name || 'User',
    timezone: 'UTC',
  };
  
  const { data: created, error: createError } = await supabase
    .from('users')
    .insert(newProfile)
    .select()
    .single();
  
  if (createError) {
    console.error('Error creating user profile:', createError);
    return null;
  }
  
  return created;
}

/**
 * Sync Discord ID from auth metadata to all user's characters
 * Called on login to ensure members.discord_id is populated (Phase 3 - Discord ID Migration)
 */
export async function syncDiscordIdToMembers(userId: string): Promise<number> {
  try {
    // Get Discord ID from auth metadata
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser || authUser.id !== userId) {
      return 0; // Can't sync without auth data
    }
    
    const discordId = authUser.user_metadata?.provider_id || null;
    
    if (!discordId) {
      console.warn(`No Discord ID found in auth metadata for user ${userId}`);
      return 0;
    }
    
    // Sync Discord ID to all NULL discord_id records for this user
    // RLS policy ensures user can only update their own records
    const { data, error } = await supabase
      .from('members')
      .update({ discord_id: discordId })
      .eq('user_id', userId)
      .is('discord_id', null)
      .select();
    
    if (error) {
      console.error('Error syncing Discord ID to members:', error);
      return 0;
    }
    
    const syncedCount = (data || []).length;
    if (syncedCount > 0) {
      console.log(`✅ Synced Discord ID to ${syncedCount} member(s) for user ${userId}`);
    }
    
    return syncedCount;
  } catch (err) {
    console.error('Error in syncDiscordIdToMembers:', err);
    return 0;
  }
}

/**
 * Update user's display name
 */
export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select();
  
  if (error) throw error;
}

/**
 * Get user's membership in a specific clan
 * Phase 4: Now supports Discord ID fallback for DR resilience
 */
export async function getGroupMembership(groupId: string, userId: string): Promise<ClanMembership | null> {
  // Primary lookup: by user_id
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, role, is_creator, approved_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) throw error;
  
  return data;
}

/**
 * Get user's characters in a group by Discord ID (with user_id fallback)
 * Phase 4: Discord ID Migration - provides resilient character lookup
 * Useful for "get my characters" or owner verification after auth change
 */
export async function getUserCharactersByGroupDiscordId(
  discordId: string,
  groupId: string,
  gameSlug: string = 'aoc'
) {
  try {
    // Primary lookup: by Discord ID (DR-resilient)
    const { data: byDiscordId, error: discordError } = await supabase
      .from('members')
      .select('*')
      .eq('discord_id', discordId)
      .eq('group_id', groupId)
      .eq('game_slug', gameSlug);

    if (!discordError && byDiscordId && byDiscordId.length > 0) {
      return byDiscordId;
    }

    // Fallback: if no Discord ID results but we have auth user UUID, try that
    // This handles transition period before all members have discord_id
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser?.id) {
      const { data: byUserId, error: userIdError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('group_id', groupId)
        .eq('game_slug', gameSlug);

      if (!userIdError && byUserId) {
        return byUserId;
      }
    }

    return [];
  } catch (err) {
    console.error('Error in getUserCharactersByGroupDiscordId:', err);
    return [];
  }
}

/**
 * Apply to join a clan (creates pending membership)
 */
export async function applyToGroup(groupId: string, userId: string) {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('approval_required, default_role')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) throw groupError;

  const approvalRequired = group?.approval_required ?? true;
  const defaultRole: string = group?.default_role || 'trial';
  const insertPayload: {
    group_id: string;
    user_id: string;
    role: string;
    approved_at: string | null;
  } = approvalRequired
    ? { group_id: groupId, user_id: userId, role: 'pending', approved_at: null }
    : { group_id: groupId, user_id: userId, role: defaultRole, approved_at: new Date().toISOString() };

  const { error } = await supabase
    .from('group_members')
    .insert(insertPayload)
    .select();

  if (error) throw error;
}

/**
 * Accept a pending member (Admin/Officer only)
 */
export async function acceptMember(membershipId: string, approvedBy: string) {
  const { error } = await supabase
    .from('group_members')
    .update({
      role: 'member',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', membershipId)
    .select();
  
  if (error) throw error;
}

/**
 * Reject/remove a member (Admin only for non-pending)
 */
export async function removeMember(membershipId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', membershipId)
    .select();
  
  if (error) throw error;
}

/**
 * Update member's role (Admin only)
 */
export async function updateMemberRole(membershipId: string, newRole: 'admin' | 'officer' | 'member') {
  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('id', membershipId)
    .select();
  
  if (error) throw error;
}

/**
 * Create a new clan (user becomes admin/creator)
 */
export async function createGroup(slug: string, name: string, userId: string) {
  // Create clan
  const { data: clan, error: clanError } = await supabase
    .from('groups')
    .insert({ slug, name, created_by: userId })
    .select()
    .single();

  if (clanError) throw clanError;
  
  // Add creator as admin
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: clan.id,
      user_id: userId,
      role: 'admin',
      is_creator: true,
      approved_at: new Date().toISOString(),
      approved_by: userId,
    })
    .select();

  if (memberError) throw memberError;
  
  return clan;
}

/**
 * Check if a clan exists by slug
 */
export async function getGroupBySlug(slug: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, slug, name, group_icon_url')
    .eq('slug', slug)
    .maybeSingle();
  
  if (error) throw error;
  
  return data;
}

/**
 * Get all groups a user belongs to (approved members only)
 */
export async function getUserGroups(userId: string): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  role: string;
  isCreator: boolean;
  group_icon_url?: string;
}>> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      is_creator,
      groups(id, slug, name, group_icon_url)
    `)
    .eq('user_id', userId)
    .neq('role', 'pending');
  
  if (error) throw error;
  
  // Transform to flat group list with role info
  return (data || [])
    .filter(m => m.groups !== null)
    .map(m => {
      // Supabase returns single object for one-to-many join
      const groupData = m.groups as unknown as { id: string; slug: string; name: string; group_icon_url?: string } | null;
      if (!groupData) return null;
      return {
        id: groupData.id,
        slug: groupData.slug,
        name: groupData.name,
        role: m.role as string,
        isCreator: m.is_creator as boolean,
        group_icon_url: groupData.group_icon_url,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}


