'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getClientAuthStack } from '@/lib/authStack';
import { getSession as getAuthSession } from '@/lib/auth';
import {
  BuildWithDetails,
  BuildComment,
  BuildVisibility,
} from '@/lib/types';

export interface BuildData {
  name: string;
  description?: string;
  primary_archetype: string;
  secondary_archetype?: string;
  skills?: Record<string, unknown>[];
  augments?: Record<string, unknown>[];
  equipment?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  tags?: string[];
  role?: string;
  visibility?: BuildVisibility;
}

interface UseBuildsReturn {
  builds: BuildWithDetails[];
  myBuilds: BuildWithDetails[];
  guildBuilds: BuildWithDetails[];
  publicBuilds: BuildWithDetails[];
  loading: boolean;
  error: string | null;
  createBuild: (data: BuildData) => Promise<string>;
  updateBuild: (id: string, data: Partial<BuildData>) => Promise<void>;
  deleteBuild: (id: string) => Promise<void>;
  copyBuild: (id: string) => Promise<string>;
  likeBuild: (id: string) => Promise<void>;
  unlikeBuild: (id: string) => Promise<void>;
  addComment: (buildId: string, content: string, parentId?: string) => Promise<void>;
  getComments: (buildId: string) => Promise<BuildComment[]>;
  refresh: () => Promise<void>;
}

export function useBuilds(groupId: string | null): UseBuildsReturn {
  const [builds, setBuilds] = useState<BuildWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUseV2Api = getClientAuthStack() === 'v2' && typeof fetch === 'function';

  const callBuildsApi = useCallback(
    async <T>(
      path: string,
      init?: RequestInit,
      defaultError = 'Request failed'
    ): Promise<T> => {
      const response = await fetch(path, {
        credentials: 'include',
        cache: 'no-store',
        ...init,
      });

      if (!response.ok) {
        let message = defaultError;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Ignore parse failures and keep default message
        }

        throw new Error(message);
      }

      return (await response.json()) as T;
    },
    []
  );

  const resolveCurrentUserId = useCallback(async (): Promise<string | null> => {
    if (canUseV2Api) {
      try {
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          user?: { id?: string | null };
        };

        if (payload.authenticated && payload.user?.id) {
          return payload.user.id;
        }
      } catch (err) {
        console.error('Error resolving v2 session for builds:', err);
      }

      return null;
    }

    try {
      const session = await getAuthSession();
      return session?.user?.id ?? null;
    } catch (err) {
      console.error('Error resolving v1 session for builds:', err);
      return null;
    }
  }, [canUseV2Api]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (canUseV2Api) {
        const query = groupId ? `?group_id=${encodeURIComponent(groupId)}` : '';
        const payload = await callBuildsApi<{ builds: BuildWithDetails[] }>(
          `/api/group/builds${query}`,
          { method: 'GET' },
          'Failed to load builds'
        );

        setBuilds(payload.builds || []);
        return;
      }

      const currentUserId = await resolveCurrentUserId();

      // Build query for visible builds
      let query = supabase
        .from('builds')
        .select(`
          *,
          users:created_by (display_name)
        `)
        .order('likes_count', { ascending: false });

      // Filter based on visibility
      if (currentUserId && groupId) {
        query = query.or(`visibility.eq.public,created_by.eq.${currentUserId},and(visibility.eq.guild,group_id.eq.${groupId})`);
      } else if (currentUserId) {
        query = query.or(`visibility.eq.public,created_by.eq.${currentUserId}`);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error: fetchError } = await query.limit(100);

      if (fetchError) throw fetchError;

      // Check likes for current user
      let likedIds: string[] = [];
      if (currentUserId) {
        const { data: likes } = await supabase
          .from('build_likes')
          .select('build_id')
          .eq('user_id', currentUserId);
        likedIds = (likes || []).map((l) => l.build_id);
      }

      const transformed = (data || []).map((b) => ({
        ...b,
        creator: b.users,
        is_liked: likedIds.includes(b.id),
      })) as BuildWithDetails[];

      setBuilds(transformed);
    } catch (err) {
      console.error('Error fetching builds:', err);
      setError(err instanceof Error ? err.message : 'Failed to load builds');
    } finally {
      setLoading(false);
    }
  }, [canUseV2Api, callBuildsApi, groupId, resolveCurrentUserId]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timerId);
  }, [fetchData]);

  const myBuilds = builds.filter((b) => b.visibility === 'private' || b.creator);
  const guildBuilds = builds.filter((b) => b.visibility === 'guild' && b.clan_id === groupId);
  const publicBuilds = builds.filter((b) => b.visibility === 'public');

  const createBuild = async (data: BuildData): Promise<string> => {
    if (canUseV2Api) {
      const payload = await callBuildsApi<{ build?: { id?: string } }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', group_id: groupId, data }),
        },
        'Failed to create build'
      );

      if (!payload.build?.id) {
        throw new Error('Failed to create build');
      }

      await fetchData();
      return payload.build.id;
    }

    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) throw new Error('Not authenticated');

    const { data: newBuild, error: insertError } = await supabase
      .from('builds')
      .insert({
        created_by: currentUserId,
        group_id: groupId,
        ...data,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchData();
    return newBuild.id;
  };

  const updateBuild = async (id: string, data: Partial<BuildData>) => {
    if (canUseV2Api) {
      await callBuildsApi<{ success: boolean }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id, data }),
        },
        'Failed to update build'
      );
      await fetchData();
      return;
    }

    const { error: updateError } = await supabase
      .from('builds')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchData();
  };

  const deleteBuild = async (id: string) => {
    if (canUseV2Api) {
      await callBuildsApi<{ success: boolean }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id }),
        },
        'Failed to delete build'
      );
      await fetchData();
      return;
    }

    const { error: deleteError } = await supabase
      .from('builds')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchData();
  };

  const copyBuild = async (id: string): Promise<string> => {
    if (canUseV2Api) {
      const payload = await callBuildsApi<{ build?: { id?: string } }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'copy', id, group_id: groupId }),
        },
        'Failed to copy build'
      );

      if (!payload.build?.id) {
        throw new Error('Failed to copy build');
      }

      await fetchData();
      return payload.build.id;
    }

    const original = builds.find((b) => b.id === id);
    if (!original) throw new Error('Build not found');

    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) throw new Error('Not authenticated');

    const { data: newBuild, error: insertError } = await supabase
      .from('builds')
      .insert({
        created_by: currentUserId,
        group_id: groupId,
        name: `${original.name} (Copy)`,
        description: original.description,
        primary_archetype: original.primary_archetype,
        secondary_archetype: original.secondary_archetype,
        skills: original.skills,
        augments: original.augments,
        equipment: original.equipment,
        stats: original.stats,
        tags: original.tags,
        role: original.role,
        visibility: 'private',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update original's copy count
    await supabase
      .from('builds')
      .update({ copies_count: original.copies_count + 1 })
      .eq('id', id);

    await fetchData();
    return newBuild.id;
  };

  const likeBuild = async (id: string) => {
    if (canUseV2Api) {
      await callBuildsApi<{ success: boolean }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'like', id }),
        },
        'Failed to like build'
      );

      await fetchData();
      return;
    }

    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) throw new Error('Not authenticated');

    const { error: insertError } = await supabase
      .from('build_likes')
      .insert({ build_id: id, user_id: currentUserId });

    if (insertError) throw insertError;

    // Update likes count
    const build = builds.find((b) => b.id === id);
    if (build) {
      await supabase
        .from('builds')
        .update({ likes_count: build.likes_count + 1 })
        .eq('id', id);
    }

    await fetchData();
  };

  const unlikeBuild = async (id: string) => {
    if (canUseV2Api) {
      await callBuildsApi<{ success: boolean }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlike', id }),
        },
        'Failed to unlike build'
      );

      await fetchData();
      return;
    }

    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) throw new Error('Not authenticated');

    const { error: deleteError } = await supabase
      .from('build_likes')
      .delete()
      .eq('build_id', id)
      .eq('user_id', currentUserId);

    if (deleteError) throw deleteError;

    const build = builds.find((b) => b.id === id);
    if (build && build.likes_count > 0) {
      await supabase
        .from('builds')
        .update({ likes_count: build.likes_count - 1 })
        .eq('id', id);
    }

    await fetchData();
  };

  const addComment = async (buildId: string, content: string, parentId?: string) => {
    if (canUseV2Api) {
      await callBuildsApi<{ success: boolean }>(
        '/api/group/builds',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_comment',
            build_id: buildId,
            content,
            parent_id: parentId,
          }),
        },
        'Failed to add comment'
      );
      return;
    }

    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) throw new Error('Not authenticated');

    const { error: insertError } = await supabase
      .from('build_comments')
      .insert({
        build_id: buildId,
        user_id: currentUserId,
        content,
        parent_id: parentId,
      });

    if (insertError) throw insertError;
  };

  const getComments = async (buildId: string): Promise<BuildComment[]> => {
    if (canUseV2Api) {
      const query = `?comments_for=${encodeURIComponent(buildId)}`;
      const payload = await callBuildsApi<{ comments: BuildComment[] }>(
        `/api/group/builds${query}`,
        { method: 'GET' },
        'Failed to load comments'
      );
      return payload.comments || [];
    }

    const { data, error: fetchError } = await supabase
      .from('build_comments')
      .select(`
        *,
        users:user_id (display_name)
      `)
      .eq('build_id', buildId)
      .order('created_at');

    if (fetchError) throw fetchError;

    return (data || []).map((c) => ({
      ...c,
      user: c.users,
    })) as BuildComment[];
  };

  return {
    builds,
    myBuilds,
    guildBuilds,
    publicBuilds,
    loading,
    error,
    createBuild,
    updateBuild,
    deleteBuild,
    copyBuild,
    likeBuild,
    unlikeBuild,
    addComment,
    getComments,
    refresh: fetchData,
  };
}

