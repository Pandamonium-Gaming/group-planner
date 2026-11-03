BEGIN;

-- Keep credentials separate from audit records and from member-readable group data.
CREATE TABLE public.admin_discord_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_admin_discord (
  group_id uuid PRIMARY KEY,
  destination_id uuid REFERENCES public.admin_discord_destinations(id),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- No group/user foreign keys: deletion notifications must survive their subjects.
CREATE TABLE public.admin_discord_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid,
  group_name text,
  actor_id uuid,
  subject_id uuid,
  subject_name text,
  kind text NOT NULL CHECK (kind IN (
    'account_registered', 'group_created', 'group_deleted', 'member_joined',
    'member_left_or_removed', 'member_requested', 'member_request_closed',
    'role_changed', 'permissions_changed', 'webhook_changed'
  )),
  destination text NOT NULL CHECK (destination IN ('site', 'group')),
  destination_id uuid REFERENCES public.admin_discord_destinations(id),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'uncertain', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  http_status integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_discord_pending_idx ON public.admin_discord_notifications(available_at, created_at)
  WHERE status = 'pending';
CREATE INDEX admin_discord_group_idx ON public.admin_discord_notifications(group_id, created_at DESC);
ALTER TABLE public.admin_discord_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_admin_discord ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_discord_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_discord_destinations, public.group_admin_discord, public.admin_discord_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_discord_destinations, public.group_admin_discord, public.admin_discord_notifications TO service_role;

CREATE FUNCTION public.capture_admin_discord_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  row_data jsonb;
  event_kind text;
  gid uuid;
  gname text;
  sid uuid;
  sname text;
  actor uuid := auth.uid();
  diff jsonb := '{}'::jsonb;
  key text;
  dest uuid;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END;
  IF TG_TABLE_NAME = 'users' THEN
    INSERT INTO public.admin_discord_notifications(kind, destination, subject_id, subject_name, actor_id)
    VALUES ('account_registered', 'site', NEW.id, COALESCE(NEW.display_name, NEW.discord_username), actor);
    RETURN NEW;
  END IF;

  gid := CASE WHEN TG_TABLE_NAME = 'groups' THEN (row_data->>'id')::uuid ELSE (row_data->>'group_id')::uuid END;
  IF TG_TABLE_NAME = 'groups' THEN
    gname := row_data->>'name';
  ELSE
    SELECT name INTO gname FROM public.groups WHERE id = gid;
    -- Cascading group deletion has its own single notification.
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  SELECT destination_id INTO dest FROM public.group_admin_discord WHERE group_id = gid;

  IF TG_TABLE_NAME = 'groups' AND TG_OP IN ('INSERT', 'DELETE') THEN
    event_kind := CASE WHEN TG_OP = 'INSERT' THEN 'group_created' ELSE 'group_deleted' END;
    INSERT INTO public.admin_discord_notifications(kind, destination, group_id, group_name, actor_id)
    VALUES (event_kind, 'site', gid, gname, CASE WHEN TG_OP = 'INSERT' THEN NEW.created_by ELSE actor END);
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'group_members' THEN
    sid := (row_data->>'user_id')::uuid;
    SELECT COALESCE(display_name, discord_username) INTO sname FROM public.users WHERE id = sid;
    IF TG_OP = 'UPDATE' THEN
      IF before_row->'role' IS NOT DISTINCT FROM after_row->'role' THEN RETURN NEW; END IF;
      event_kind := CASE WHEN before_row->>'role' = 'pending' AND after_row->>'role' <> 'pending'
        THEN 'member_joined' ELSE 'role_changed' END;
    ELSE
      event_kind := CASE
        WHEN TG_OP = 'INSERT' AND row_data->>'role' = 'pending' THEN 'member_requested'
        WHEN TG_OP = 'DELETE' AND row_data->>'role' = 'pending' THEN 'member_request_closed'
        WHEN TG_OP = 'INSERT' THEN 'member_joined'
        ELSE 'member_left_or_removed' END;
    END IF;
    diff := jsonb_build_object('role', jsonb_build_object('before', before_row->'role', 'after', after_row->'role'));
  ELSIF TG_TABLE_NAME = 'group_permission_overrides' THEN
    event_kind := 'permissions_changed';
    sname := row_data->>'role';
    FOR key IN SELECT jsonb_object_keys(before_row || after_row) LOOP
      IF (jsonb_typeof(before_row->key) = 'boolean' OR jsonb_typeof(after_row->key) = 'boolean')
        AND before_row->key IS DISTINCT FROM after_row->key THEN
        diff := diff || jsonb_build_object(key, jsonb_build_object('before', before_row->key, 'after', after_row->key));
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSIF TG_TABLE_NAME = 'group_admin_discord' THEN
    IF before_row->'destination_id' IS NOT DISTINCT FROM after_row->'destination_id' THEN RETURN NEW; END IF;
    event_kind := 'webhook_changed';
    actor := NEW.updated_by;
    -- Disabling still notifies the old private destination; never put its URL in the audit.
    dest := COALESCE(NEW.destination_id, (before_row->>'destination_id')::uuid);
    diff := jsonb_build_object('admin_webhook', jsonb_build_object(
      'before', before_row->>'destination_id' IS NOT NULL, 'after', NEW.destination_id IS NOT NULL));
  ELSE
    event_kind := 'webhook_changed';
    FOR key IN SELECT jsonb_object_keys(before_row || after_row) LOOP
      IF (key LIKE '%webhook_url' OR key LIKE '%role_id' OR key IN ('notify_on_events', 'notify_on_announcements'))
        AND before_row->key IS DISTINCT FROM after_row->key THEN
        -- Configuration changes are reported by field name only, never URL/token/role content.
        diff := diff || jsonb_build_object(key, 'changed');
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.admin_discord_notifications(
    kind, destination, destination_id, group_id, group_name, actor_id, subject_id, subject_name, changes
  ) VALUES (event_kind, 'group', dest, gid, gname, actor, sid, sname, diff);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_admin_discord_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER admin_discord_new_account AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();
CREATE TRIGGER admin_discord_group_change AFTER INSERT OR UPDATE OR DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();
CREATE TRIGGER admin_discord_membership_change AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();
CREATE TRIGGER admin_discord_permissions_change AFTER INSERT OR UPDATE OR DELETE ON public.group_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();
CREATE TRIGGER admin_discord_configuration_change AFTER INSERT OR UPDATE ON public.group_admin_discord
  FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();

CREATE FUNCTION public.save_group_admin_discord(p_group_id uuid, p_webhook_url text, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  dest uuid;
  previous_url text;
BEGIN
  PERFORM 1 FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  PERFORM 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = p_actor_id AND role = 'admin' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT d.webhook_url, c.destination_id INTO previous_url, dest FROM public.group_admin_discord c
    LEFT JOIN public.admin_discord_destinations d ON d.id = c.destination_id WHERE c.group_id = p_group_id;
  IF previous_url IS NOT DISTINCT FROM p_webhook_url THEN RETURN; END IF;
  IF p_webhook_url IS NULL THEN
    dest := NULL;
  ELSE
    IF p_webhook_url !~ '^https://(discord\.com|discordapp\.com)/api/webhooks/[^/?#]+/[^/?#]+/?(\?[^#]*)?$' THEN
      RAISE EXCEPTION 'Invalid Discord webhook URL';
    END IF;
    INSERT INTO public.admin_discord_destinations(webhook_url) VALUES (p_webhook_url) RETURNING id INTO dest;
  END IF;
  INSERT INTO public.group_admin_discord(group_id, destination_id, updated_by)
    VALUES (p_group_id, dest, p_actor_id)
    ON CONFLICT (group_id) DO UPDATE SET destination_id = EXCLUDED.destination_id,
      updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_group_admin_discord(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_group_admin_discord(uuid, text, uuid) TO service_role;

CREATE FUNCTION public.claim_admin_discord_notifications()
RETURNS SETOF public.admin_discord_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.admin_discord_notifications SET status = 'uncertain',
    error = 'Worker interrupted; delivery may have occurred. Check Discord before retrying.'
    WHERE status = 'processing' AND claimed_at < now() - interval '5 minutes';
  RETURN QUERY
    UPDATE public.admin_discord_notifications n SET status = 'processing', claimed_at = now(), attempts = attempts + 1
    WHERE n.id IN (
      SELECT id FROM public.admin_discord_notifications
      WHERE status = 'pending' AND available_at <= now() ORDER BY created_at, id
      LIMIT 5 FOR UPDATE SKIP LOCKED
    ) RETURNING n.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_admin_discord_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_discord_notifications() TO service_role;

INSERT INTO public.migration_history(filename) VALUES ('015_admin_discord_notifications.sql') ON CONFLICT DO NOTHING;
COMMIT;
