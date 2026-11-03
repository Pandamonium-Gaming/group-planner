BEGIN;

ALTER TABLE public.group_admin_discord ADD COLUMN categories jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.site_admin_discord (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  webhook_override boolean NOT NULL DEFAULT false,
  destination_id uuid REFERENCES public.admin_discord_destinations(id),
  role_mentions jsonb,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_admin_discord ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_admin_discord FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.site_admin_discord TO service_role;

CREATE FUNCTION public.filter_admin_discord_category() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE enabled boolean;
BEGIN
  IF NEW.destination = 'site' THEN
    SELECT (categories->>NEW.kind)::boolean INTO enabled FROM public.site_admin_discord WHERE id;
  ELSE
    SELECT (categories->>NEW.kind)::boolean INTO enabled FROM public.group_admin_discord WHERE group_id=NEW.group_id;
  END IF;
  IF enabled IS FALSE THEN
    NEW.status := 'skipped';
    NEW.error := 'Notification category disabled';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.filter_admin_discord_category() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER admin_discord_category BEFORE INSERT ON public.admin_discord_notifications
FOR EACH ROW EXECUTE FUNCTION public.filter_admin_discord_category();

CREATE FUNCTION public.save_admin_discord_preferences(p_group_id uuid, p_categories jsonb, p_roles jsonb, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text; v_value jsonb;
BEGIN
  IF p_categories IS NULL OR jsonb_typeof(p_categories)<>'object'
    OR p_roles IS NULL OR jsonb_typeof(p_roles)<>'object' THEN RAISE EXCEPTION 'Invalid preferences'; END IF;
  FOR v_key, v_value IN SELECT * FROM jsonb_each(p_categories || p_roles) LOOP
    IF v_key NOT IN ('account_registered','group_created','group_deleted','member_joined','member_left_or_removed',
      'member_requested','member_request_closed','role_changed','permissions_changed','webhook_changed') THEN
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

CREATE FUNCTION public.save_site_admin_discord_webhook(p_url text, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dest uuid;
BEGIN
  IF p_url IS NOT NULL THEN
    IF p_url !~ '^https://(discord\.com|discordapp\.com)/api/webhooks/[^/?#]+/[^/?#]+/?(\?[^#]*)?$' THEN
      RAISE EXCEPTION 'Invalid Discord webhook URL';
    END IF;
    INSERT INTO public.admin_discord_destinations(webhook_url) VALUES(p_url) RETURNING id INTO dest;
  END IF;
  INSERT INTO public.site_admin_discord(id,webhook_override,destination_id,updated_by)
    VALUES(true,true,dest,p_actor_id)
    ON CONFLICT(id) DO UPDATE SET webhook_override=true,destination_id=EXCLUDED.destination_id,
      updated_by=EXCLUDED.updated_by,updated_at=now();
  INSERT INTO public.admin_discord_notifications(kind,destination,actor_id,changes)
    VALUES('webhook_changed','site',p_actor_id,'{"admin_webhook":"changed"}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.save_site_admin_discord_webhook(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_site_admin_discord_webhook(text,uuid) TO service_role;

INSERT INTO public.migration_history(filename) VALUES('017_admin_notification_categories.sql') ON CONFLICT DO NOTHING;
COMMIT;
