BEGIN;

ALTER TABLE public.group_admin_discord ADD COLUMN role_mentions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.admin_discord_notifications ADD COLUMN mention_role_id text
  CHECK (mention_role_id ~ '^[0-9]{17,20}$');

CREATE FUNCTION public.capture_admin_discord_mention() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  role_id text;
BEGIN
  IF NEW.destination = 'group' AND NEW.group_id IS NOT NULL THEN
    SELECT role_mentions->>NEW.kind INTO role_id FROM public.group_admin_discord WHERE group_id = NEW.group_id;
    NEW.mention_role_id := role_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_admin_discord_mention() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER admin_discord_mention BEFORE INSERT ON public.admin_discord_notifications
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_mention();

CREATE FUNCTION public.save_group_admin_discord_roles(p_group_id uuid, p_roles jsonb, p_actor_id uuid)
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
      'member_requested','member_request_closed','role_changed','permissions_changed','webhook_changed'
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

INSERT INTO public.migration_history(filename) VALUES ('016_admin_notification_role_mentions.sql') ON CONFLICT DO NOTHING;
COMMIT;
