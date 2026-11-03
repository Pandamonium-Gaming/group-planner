BEGIN;

ALTER TABLE public.admin_discord_notifications DROP CONSTRAINT IF EXISTS admin_discord_notifications_kind_check;
ALTER TABLE public.admin_discord_notifications ADD CONSTRAINT admin_discord_notifications_kind_check CHECK (kind IN (
  'account_registered', 'group_created', 'group_deleted', 'member_joined',
  'member_left_or_removed', 'member_requested', 'member_request_closed',
  'role_changed', 'permissions_changed', 'webhook_changed', 'game_deleted'
));

CREATE OR REPLACE FUNCTION public.save_group_admin_discord_roles(p_group_id uuid, p_roles jsonb, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  old_roles jsonb;
  dest uuid;
  gname text;
BEGIN
  SELECT name INTO gname FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  PERFORM 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_actor_id AND role = 'admin' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF p_roles IS NULL OR jsonb_typeof(p_roles) <> 'object' THEN RAISE EXCEPTION 'Invalid role configuration'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_roles) AS entry
    WHERE entry.key NOT IN (
      'account_registered','group_created','group_deleted','member_joined','member_left_or_removed',
      'member_requested','member_request_closed','role_changed','permissions_changed','webhook_changed','game_deleted'
    ) OR jsonb_typeof(entry.value) <> 'string' OR (entry.value #>> '{}') !~ '^[0-9]{17,20}$'
  ) THEN RAISE EXCEPTION 'Invalid role configuration'; END IF;
  SELECT role_mentions, destination_id INTO old_roles, dest FROM public.group_admin_discord WHERE group_id = p_group_id;
  IF COALESCE(old_roles, '{}'::jsonb) = p_roles THEN RETURN; END IF;
  INSERT INTO public.group_admin_discord(group_id, updated_by, role_mentions)
    VALUES (p_group_id, p_actor_id, p_roles)
    ON CONFLICT (group_id) DO UPDATE SET role_mentions = EXCLUDED.role_mentions,
      updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.admin_discord_notifications(kind,destination,destination_id,group_id,group_name,actor_id,changes)
    VALUES ('webhook_changed','group',dest,p_group_id,gname,p_actor_id,jsonb_build_object('notification_role_mentions','changed'));
END;
$$;
REVOKE ALL ON FUNCTION public.save_group_admin_discord_roles(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_group_admin_discord_roles(uuid,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_admin_discord_preferences(p_group_id uuid, p_categories jsonb, p_roles jsonb, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text; v_value jsonb;
BEGIN
  IF p_categories IS NULL OR jsonb_typeof(p_categories)<>'object'
    OR p_roles IS NULL OR jsonb_typeof(p_roles)<>'object' THEN RAISE EXCEPTION 'Invalid preferences'; END IF;
  FOR v_key, v_value IN SELECT * FROM jsonb_each(p_categories || p_roles) LOOP
    IF v_key NOT IN ('account_registered','group_created','group_deleted','member_joined','member_left_or_removed',
      'member_requested','member_request_closed','role_changed','permissions_changed','webhook_changed','game_deleted') THEN
      RAISE EXCEPTION 'Unknown notification category';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_categories) e WHERE jsonb_typeof(e.value)<>'boolean')
    OR EXISTS(SELECT 1 FROM jsonb_each(p_roles) e WHERE jsonb_typeof(e.value)<>'string' OR (e.value #>> '{}') !~ '^[0-9]{17,20}$') THEN
    RAISE EXCEPTION 'Invalid preferences';
  END IF;
  IF p_group_id IS NULL THEN
    INSERT INTO public.site_admin_discord(id,categories,role_mentions,updated_by)
    VALUES(true,p_categories,p_roles,p_actor_id)
    ON CONFLICT(id) DO UPDATE SET categories=EXCLUDED.categories,role_mentions=EXCLUDED.role_mentions,
      updated_by=EXCLUDED.updated_by,updated_at=now();
  ELSE
    PERFORM 1 FROM public.groups WHERE id=p_group_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
    PERFORM 1 FROM public.group_members WHERE group_id=p_group_id AND user_id=p_actor_id AND role='admin' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required'; END IF;
    INSERT INTO public.group_admin_discord(group_id,categories,role_mentions,updated_by)
    VALUES(p_group_id,p_categories,p_roles,p_actor_id)
    ON CONFLICT(group_id) DO UPDATE SET categories=EXCLUDED.categories,role_mentions=EXCLUDED.role_mentions,
      updated_by=EXCLUDED.updated_by,updated_at=now();
  END IF;
  UPDATE public.admin_discord_notifications SET status='skipped',error='Notification category disabled'
  WHERE status='pending' AND ((p_group_id IS NULL AND destination='site')
    OR (p_group_id IS NOT NULL AND destination='group' AND group_id=p_group_id))
    AND (p_categories->>kind)::boolean IS FALSE;
  INSERT INTO public.admin_discord_notifications(kind,destination,group_id,actor_id,destination_id,group_name,changes)
    SELECT 'webhook_changed',CASE WHEN p_group_id IS NULL THEN 'site' ELSE 'group' END,p_group_id,p_actor_id,
      (SELECT destination_id FROM public.group_admin_discord WHERE group_id=p_group_id),
      (SELECT name FROM public.groups WHERE id=p_group_id),
      '{"notification_preferences":"changed"}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.save_admin_discord_preferences(uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_discord_preferences(uuid,jsonb,jsonb,uuid) TO service_role;

INSERT INTO public.migration_history(filename) VALUES ('019_admin_notification_game_deleted.sql') ON CONFLICT DO NOTHING;
COMMIT;
