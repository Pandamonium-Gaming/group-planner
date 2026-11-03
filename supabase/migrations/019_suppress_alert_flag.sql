BEGIN;

CREATE OR REPLACE FUNCTION public.capture_admin_discord_change() RETURNS trigger
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
    -- Bulk resets (e.g. deleting a game) raise their own alert and set this flag.
    IF current_setting('app.suppress_admin_config_alert', true) = 'on' THEN RETURN NEW; END IF;
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

INSERT INTO public.migration_history(filename) VALUES ('019_suppress_alert_flag.sql') ON CONFLICT DO NOTHING;
COMMIT;
