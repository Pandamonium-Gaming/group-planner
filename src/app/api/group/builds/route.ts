import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

async function resolveSessionUserId() {
  const session = await auth();
  return session?.user?.id || null;
}

type BuildMutationPayload =
  | {
      action: 'create';
      group_id: string | null;
      data: Record<string, unknown>;
    }
  | {
      action: 'update';
      id: string;
      data: Record<string, unknown>;
    }
  | {
      action: 'delete';
      id: string;
    }
  | {
      action: 'copy';
      id: string;
      group_id: string | null;
    }
  | {
      action: 'like';
      id: string;
    }
  | {
      action: 'unlike';
      id: string;
    }
  | {
      action: 'add_comment';
      build_id: string;
      content: string;
      parent_id?: string;
    };

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const commentsBuildId = searchParams.get('comments_for');
  const currentUserId = await resolveSessionUserId();

  if (commentsBuildId) {
    const { data, error } = await supabaseAdmin
      .from('build_comments')
      .select(`
        *,
        users:user_id (display_name)
      `)
      .eq('build_id', commentsBuildId)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: 'Failed to load build comments', details: error.message }, { status: 500 });
    }

    const comments = (data || []).map((comment) => ({
      ...comment,
      user: comment.users,
    }));

    return NextResponse.json({ comments });
  }

  let query = supabaseAdmin
    .from('builds')
    .select(`
      *,
      users:created_by (display_name)
    `)
    .order('likes_count', { ascending: false });

  if (currentUserId && groupId) {
    query = query.or(`visibility.eq.public,created_by.eq.${currentUserId},and(visibility.eq.guild,group_id.eq.${groupId})`);
  } else if (currentUserId) {
    query = query.or(`visibility.eq.public,created_by.eq.${currentUserId}`);
  } else {
    query = query.eq('visibility', 'public');
  }

  const { data, error } = await query.limit(100);
  if (error) {
    return NextResponse.json({ error: 'Failed to load builds', details: error.message }, { status: 500 });
  }

  let likedIds: string[] = [];
  if (currentUserId) {
    const { data: likes, error: likesError } = await supabaseAdmin
      .from('build_likes')
      .select('build_id')
      .eq('user_id', currentUserId);

    if (likesError) {
      return NextResponse.json({ error: 'Failed to load build likes', details: likesError.message }, { status: 500 });
    }

    likedIds = (likes || []).map((like) => like.build_id);
  }

  const builds = (data || []).map((build) => ({
    ...build,
    creator: build.users,
    is_liked: likedIds.includes(build.id),
  }));

  return NextResponse.json({ builds });
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const currentUserId = await resolveSessionUserId();
  if (!currentUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as BuildMutationPayload;

  if (payload.action === 'create') {
    const { data, error } = await supabaseAdmin
      .from('builds')
      .insert({
        created_by: currentUserId,
        group_id: payload.group_id,
        ...payload.data,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create build', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ build: data });
  }

  if (payload.action === 'update') {
    const { error } = await supabaseAdmin
      .from('builds')
      .update({ ...payload.data, updated_at: new Date().toISOString() })
      .eq('id', payload.id)
      .eq('created_by', currentUserId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update build', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (payload.action === 'delete') {
    const { error } = await supabaseAdmin
      .from('builds')
      .delete()
      .eq('id', payload.id)
      .eq('created_by', currentUserId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete build', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (payload.action === 'copy') {
    const { data: original, error: originalError } = await supabaseAdmin
      .from('builds')
      .select('*')
      .eq('id', payload.id)
      .maybeSingle();

    if (originalError) {
      return NextResponse.json({ error: 'Failed to load source build', details: originalError.message }, { status: 500 });
    }

    if (!original) {
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }

    const { data: copied, error: copyError } = await supabaseAdmin
      .from('builds')
      .insert({
        created_by: currentUserId,
        group_id: payload.group_id,
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

    if (copyError) {
      return NextResponse.json({ error: 'Failed to copy build', details: copyError.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('builds')
      .update({ copies_count: (original.copies_count || 0) + 1 })
      .eq('id', payload.id);

    return NextResponse.json({ build: copied });
  }

  if (payload.action === 'like') {
    const { error: likeError } = await supabaseAdmin
      .from('build_likes')
      .insert({ build_id: payload.id, user_id: currentUserId });

    if (likeError && likeError.code !== '23505') {
      return NextResponse.json({ error: 'Failed to like build', details: likeError.message }, { status: 500 });
    }

    const { data: build } = await supabaseAdmin
      .from('builds')
      .select('likes_count')
      .eq('id', payload.id)
      .maybeSingle();

    if (build) {
      await supabaseAdmin
        .from('builds')
        .update({ likes_count: (build.likes_count || 0) + 1 })
        .eq('id', payload.id);
    }

    return NextResponse.json({ success: true });
  }

  if (payload.action === 'unlike') {
    const { error: unlikeError } = await supabaseAdmin
      .from('build_likes')
      .delete()
      .eq('build_id', payload.id)
      .eq('user_id', currentUserId);

    if (unlikeError) {
      return NextResponse.json({ error: 'Failed to unlike build', details: unlikeError.message }, { status: 500 });
    }

    const { data: build } = await supabaseAdmin
      .from('builds')
      .select('likes_count')
      .eq('id', payload.id)
      .maybeSingle();

    if (build && (build.likes_count || 0) > 0) {
      await supabaseAdmin
        .from('builds')
        .update({ likes_count: (build.likes_count || 0) - 1 })
        .eq('id', payload.id);
    }

    return NextResponse.json({ success: true });
  }

  if (payload.action === 'add_comment') {
    const { error } = await supabaseAdmin
      .from('build_comments')
      .insert({
        build_id: payload.build_id,
        user_id: currentUserId,
        content: payload.content,
        parent_id: payload.parent_id,
      });

    if (error) {
      return NextResponse.json({ error: 'Failed to add comment', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}