-- Generated from verified development public schema; no application data.
-- Local compatibility functions for imported audit triggers and RLS policies.
-- No Supabase auth users, sessions, tokens or credentials are imported.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
  AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

-- These names preserve imported policy bindings without granting login access.
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
  END LOOP;
END;
$$;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.10 (Debian 17.10-1.pgdg13+1)
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: achievement_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.achievement_category AS ENUM (
    'guild',
    'pvp',
    'economy',
    'community',
    'milestone'
);


--
-- Name: activity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_type AS ENUM (
    'login',
    'event_signup',
    'event_attend',
    'siege_participate',
    'caravan_escort',
    'bank_deposit',
    'loot_received',
    'dkp_earned',
    'character_update',
    'profession_update'
);


--
-- Name: alliance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alliance_status AS ENUM (
    'pending',
    'active',
    'suspended',
    'dissolved'
);


--
-- Name: archetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.archetype AS ENUM (
    'tank',
    'cleric',
    'mage',
    'fighter',
    'ranger',
    'bard',
    'rogue',
    'summoner'
);


--
-- Name: bank_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bank_transaction_type AS ENUM (
    'deposit',
    'withdrawal',
    'transfer',
    'craft_input',
    'craft_output',
    'loot',
    'purchase',
    'sale',
    'adjustment'
);


--
-- Name: build_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.build_visibility AS ENUM (
    'private',
    'guild',
    'public'
);


--
-- Name: caravan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.caravan_status AS ENUM (
    'planning',
    'recruiting',
    'ready',
    'in_transit',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: caravan_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.caravan_type AS ENUM (
    'personal',
    'guild',
    'trade_route',
    'escort'
);


--
-- Name: event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_type AS ENUM (
    'raid',
    'siege',
    'gathering',
    'social',
    'other',
    'farming_glint',
    'farming_materials',
    'farming_gear',
    'farming_other',
    'missions',
    'salvaging',
    'pirating',
    'bounty_hunting',
    'dungeon',
    'leveling',
    'world_pvp',
    'battleground_pvp',
    'arena_pvp'
);


--
-- Name: TYPE event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.event_type IS 'Event types: raid, siege, gathering, social, farming_glint, farming_materials, farming_gear, farming_other, missions, salvaging, pirating, bounty_hunting, other';


--
-- Name: freehold_building_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.freehold_building_type AS ENUM (
    'smelter',
    'lumbermill',
    'tannery',
    'loom',
    'farm',
    'stable',
    'forge',
    'workshop',
    'clothier',
    'jeweler',
    'alchemist_lab',
    'kitchen',
    'warehouse',
    'tavern',
    'inn',
    'house'
);


--
-- Name: freehold_size; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.freehold_size AS ENUM (
    'small',
    'medium',
    'large'
);


--
-- Name: item_rarity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.item_rarity AS ENUM (
    'common',
    'uncommon',
    'rare',
    'heroic',
    'epic',
    'legendary'
);


--
-- Name: loot_system_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loot_system_type AS ENUM (
    'dkp',
    'epgp',
    'loot_council',
    'roll',
    'round_robin'
);


--
-- Name: node_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.node_type AS ENUM (
    'divine',
    'economic',
    'military',
    'scientific'
);


--
-- Name: race; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.race AS ENUM (
    'kaelar',
    'vaelune',
    'dunir',
    'nikua',
    'empyrean',
    'pyrai',
    'renkai',
    'vek',
    'tulnar'
);


--
-- Name: resource_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resource_category AS ENUM (
    'raw_material',
    'processed',
    'consumable',
    'equipment',
    'currency',
    'blueprint',
    'other'
);


--
-- Name: roster_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roster_status AS ENUM (
    'signed_up',
    'confirmed',
    'checked_in',
    'no_show'
);


--
-- Name: rsvp_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rsvp_status AS ENUM (
    'attending',
    'maybe',
    'declined'
);


--
-- Name: siege_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.siege_role AS ENUM (
    'frontline',
    'ranged',
    'healer',
    'siege_operator',
    'scout',
    'reserve'
);


--
-- Name: siege_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.siege_type AS ENUM (
    'castle_attack',
    'castle_defense',
    'node_attack',
    'node_defense'
);


--
-- Name: add_loaner_ships_for_pledge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_loaner_ships_for_pledge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  -- Only process pledged ships (not in-game or existing loaners)

  IF NEW.ownership_type = 'pledged' THEN

    -- Add all loaners for this pledged ship

    INSERT INTO character_ships (character_id, ship_id, ownership_type, notes)

    SELECT

      NEW.character_id,

      loaner_ship,

      'loaner',

      'Auto-granted loaner for ' || ship_id_to_display_name(NEW.ship_id) ||

      CASE

        WHEN loaner_type = 'arena_commander' THEN ' (Arena Commander)'

        WHEN loaner_type = 'temporary' THEN ' (Temporary: ' || COALESCE(notes, 'see RSI') || ')'

        ELSE ''

      END

    FROM sc_loaner_matrix

    WHERE pledged_ship = NEW.ship_id

    ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING; -- Don't duplicate loaners

  END IF;



  RETURN NEW;

END;

$$;


--
-- Name: capture_admin_discord_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_admin_discord_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: capture_admin_discord_mention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_admin_discord_mention() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: check_groups_allied(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_groups_allied(group_a uuid, group_b uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  RETURN EXISTS (

    SELECT 1 FROM alliance_members am1

    INNER JOIN alliance_members am2 ON am1.alliance_id = am2.alliance_id

    WHERE am1.group_id = group_a

    AND am2.group_id = group_b

    AND am1.status = 'active'

    AND am2.status = 'active'

  );

END;

$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_discord_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_discord_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    group_name text,
    actor_id uuid,
    subject_id uuid,
    subject_name text,
    kind text NOT NULL,
    destination text NOT NULL,
    destination_id uuid,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone,
    http_status integer,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mention_role_id text,
    CONSTRAINT admin_discord_notifications_destination_check CHECK ((destination = ANY (ARRAY['site'::text, 'group'::text]))),
    CONSTRAINT admin_discord_notifications_kind_check CHECK ((kind = ANY (ARRAY['account_registered'::text, 'group_created'::text, 'group_deleted'::text, 'member_joined'::text, 'member_left_or_removed'::text, 'member_requested'::text, 'member_request_closed'::text, 'role_changed'::text, 'permissions_changed'::text, 'webhook_changed'::text]))),
    CONSTRAINT admin_discord_notifications_mention_role_id_check CHECK ((mention_role_id ~ '^[0-9]{17,20}$'::text)),
    CONSTRAINT admin_discord_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'uncertain'::text, 'skipped'::text])))
);


--
-- Name: claim_admin_discord_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_admin_discord_notifications() RETURNS SETOF public.admin_discord_notifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: current_user_discord_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_discord_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Try to extract Discord ID from auth.users.raw_app_meta_data
  RETURN (auth.jwt() -> 'user_metadata' ->> 'discord_id');
END;
$$;


--
-- Name: FUNCTION current_user_discord_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_user_discord_id() IS 'Retrieves current authenticated user''s Discord ID from JWT metadata. Returns NULL if not available.';


--
-- Name: filter_admin_discord_category(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.filter_admin_discord_category() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  INSERT INTO public.users (id, discord_id, discord_username, discord_avatar, display_name)

  VALUES (

    NEW.id,

    NEW.raw_user_meta_data->>'provider_id',

    NEW.raw_user_meta_data->>'full_name',

    NEW.raw_user_meta_data->>'avatar_url',

    NEW.raw_user_meta_data->>'full_name'

  );

  RETURN NEW;

END;

$$;


--
-- Name: remove_loaner_ships_for_pledge(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_loaner_ships_for_pledge() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  -- Only process pledged ships

  IF OLD.ownership_type = 'pledged' THEN

    -- Check if this was the last/only pledge granting these loaners

    -- Don't remove loaners that are still granted by other pledges

    DELETE FROM character_ships cs

    WHERE cs.character_id = OLD.character_id

    AND cs.ownership_type = 'loaner'

    AND cs.ship_id IN (

      SELECT loaner_ship

      FROM sc_loaner_matrix

      WHERE pledged_ship = OLD.ship_id

    )

    -- Only delete if no other pledges grant this loaner

    AND NOT EXISTS (

      SELECT 1

      FROM character_ships other_pledges

      JOIN sc_loaner_matrix lm ON lm.pledged_ship = other_pledges.ship_id

      WHERE other_pledges.character_id = OLD.character_id

      AND other_pledges.ownership_type = 'pledged'

      AND other_pledges.id != OLD.id

      AND lm.loaner_ship = cs.ship_id

    );

  END IF;



  RETURN OLD;

END;

$$;


--
-- Name: save_admin_discord_preferences(uuid, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_admin_discord_preferences(p_group_id uuid, p_categories jsonb, p_roles jsonb, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: save_group_admin_discord(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_group_admin_discord(p_group_id uuid, p_webhook_url text, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: save_group_admin_discord_roles(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_group_admin_discord_roles(p_group_id uuid, p_roles jsonb, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: save_site_admin_discord_webhook(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_site_admin_discord_webhook(p_url text, p_actor_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: ship_id_to_display_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ship_id_to_display_name(ship_id text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$

DECLARE

  parts TEXT[];

  result TEXT;

  part TEXT;

BEGIN

  -- Split on dashes and title-case each part

  parts := string_to_array(ship_id, '-');

  result := '';



  FOREACH part IN ARRAY parts

  LOOP

    IF result != '' THEN

      result := result || ' ';

    END IF;

    result := result || initcap(part);

  END LOOP;



  RETURN result;

END;

$$;


--
-- Name: transfer_group_characters(uuid, text, jsonb, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_group_characters(p_group_id uuid, p_game_slug text, p_document jsonb, p_apply boolean DEFAULT false, p_expected_token text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_character JSONB;
  v_row public.members;
  v_owner UUID;
  v_owners JSONB := '{}'::JSONB;
  v_warnings JSONB := '[]'::JSONB;
  v_snapshot JSONB;
  v_token TEXT;
  v_create INTEGER := 0;
  v_update INTEGER := 0;
  v_discord TEXT;
  v_candidates UUID[];
BEGIN
  IF p_document->>'format' <> 'group-planner-characters' OR p_document->>'version' <> '1'
    OR p_document->>'game_slug' <> p_game_slug OR jsonb_typeof(p_document->'characters') <> 'array'
    OR jsonb_array_length(p_document->'characters') > 1000 THEN
    RAISE EXCEPTION 'Invalid character transfer document';
  END IF;
  PERFORM 1 FROM public.group_games
    WHERE group_id = p_group_id AND game_slug = p_game_slug AND NOT archived FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination game is missing or archived'; END IF;
  PERFORM 1 FROM public.members WHERE group_id = p_group_id AND game_slug = p_game_slug FOR UPDATE;

  FOR v_character IN SELECT value FROM jsonb_array_elements(p_document->'characters') LOOP
    IF EXISTS (SELECT 1 FROM public.members WHERE id = (v_character->>'id')::UUID
      AND (group_id IS DISTINCT FROM p_group_id OR game_slug IS DISTINCT FROM p_game_slug)) THEN
      RAISE EXCEPTION 'An imported character ID belongs to another group or game';
    END IF;
    IF EXISTS (SELECT 1 FROM public.members WHERE id = (v_character->>'id')::UUID) THEN
      v_update := v_update + 1;
    ELSE
      v_create := v_create + 1;
    END IF;
    v_discord := v_character->'owner'->>'discord_id';
    SELECT array_agg(u.id ORDER BY u.id) INTO v_candidates
      FROM public.users u JOIN public.group_members gm ON gm.user_id = u.id
      WHERE u.discord_id = v_discord AND gm.group_id = p_group_id AND gm.role <> 'pending';
    IF cardinality(v_candidates) > 1 THEN RAISE EXCEPTION 'Ambiguous destination Discord owner'; END IF;
    v_owner := v_candidates[1];
    v_owners := v_owners || jsonb_build_object(v_character->>'id', v_owner);
    IF v_owner IS NULL AND (v_discord IS NOT NULL OR v_character->'owner'->>'label' IS NOT NULL) THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'name', v_character->'data'->>'name', 'owner', v_character->'owner'->>'label'));
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_document->'characters') c
    WHERE (c->'data'->>'is_main')::BOOLEAN AND v_owners->> (c->>'id') IS NOT NULL
    GROUP BY v_owners->> (c->>'id') HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_document->'characters') c
    JOIN public.members m ON m.user_id = (v_owners->> (c->>'id'))::UUID
      AND m.group_id = p_group_id AND m.game_slug = p_game_slug AND m.is_main
    WHERE (c->'data'->>'is_main')::BOOLEAN AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_document->'characters') imported WHERE imported->>'id' = m.id::TEXT)
  ) THEN RAISE EXCEPTION 'Import conflicts with another main character for this owner'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'character', to_jsonb(m),
    'professions', (SELECT COALESCE(jsonb_agg(to_jsonb(mp) ORDER BY mp.id), '[]'::JSONB)
      FROM public.member_professions mp WHERE mp.member_id = m.id),
    'ships', (SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs.id), '[]'::JSONB)
      FROM public.character_ships cs WHERE cs.character_id = m.id)
  ) ORDER BY m.id), '[]'::JSONB) INTO v_snapshot
  FROM public.members m WHERE m.group_id = p_group_id AND m.game_slug = p_game_slug;
  v_token := md5(p_document::TEXT || v_snapshot::TEXT || v_owners::TEXT);
  IF p_apply AND (p_expected_token IS NULL OR p_expected_token <> v_token) THEN
    RAISE EXCEPTION 'Import preview is stale; preview again before confirming';
  END IF;
  IF p_apply THEN
    FOR v_character IN SELECT value FROM jsonb_array_elements(p_document->'characters') LOOP
      v_owner := (v_owners->> (v_character->>'id'))::UUID;
      SELECT * INTO v_row FROM jsonb_populate_record(NULL::public.members, v_character->'data');
      INSERT INTO public.members (
        id, group_id, game_slug, user_id, discord_id, name, level, is_main, rank, preferred_role,
        race, primary_archetype, secondary_archetype, ror_faction, ror_class,
        wow_race, wow_faction, wow_class, wow_main_spec, wow_secondary_spec,
        wow_profession_1, wow_profession_2, wow_profession_1_rank, wow_profession_2_rank,
        subscriber_tier, subscriber_since, subscriber_ships_month
      ) VALUES (
        (v_character->>'id')::UUID, p_group_id, p_game_slug, v_owner,
        CASE WHEN v_owner IS NOT NULL THEN v_character->'owner'->>'discord_id' ELSE NULL END,
        v_row.name, v_row.level, v_row.is_main, v_row.rank, v_row.preferred_role,
        v_row.race, v_row.primary_archetype, v_row.secondary_archetype, v_row.ror_faction, v_row.ror_class,
        v_row.wow_race, v_row.wow_faction, v_row.wow_class, v_row.wow_main_spec, v_row.wow_secondary_spec,
        v_row.wow_profession_1, v_row.wow_profession_2, v_row.wow_profession_1_rank, v_row.wow_profession_2_rank,
        v_row.subscriber_tier, v_row.subscriber_since, v_row.subscriber_ships_month
      ) ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id, discord_id = EXCLUDED.discord_id,
        name = EXCLUDED.name, level = EXCLUDED.level, is_main = EXCLUDED.is_main,
        rank = EXCLUDED.rank, preferred_role = EXCLUDED.preferred_role,
        race = EXCLUDED.race, primary_archetype = EXCLUDED.primary_archetype,
        secondary_archetype = EXCLUDED.secondary_archetype, ror_faction = EXCLUDED.ror_faction,
        ror_class = EXCLUDED.ror_class, wow_race = EXCLUDED.wow_race, wow_faction = EXCLUDED.wow_faction,
        wow_class = EXCLUDED.wow_class, wow_main_spec = EXCLUDED.wow_main_spec,
        wow_secondary_spec = EXCLUDED.wow_secondary_spec, wow_profession_1 = EXCLUDED.wow_profession_1,
        wow_profession_2 = EXCLUDED.wow_profession_2, wow_profession_1_rank = EXCLUDED.wow_profession_1_rank,
        wow_profession_2_rank = EXCLUDED.wow_profession_2_rank, subscriber_tier = EXCLUDED.subscriber_tier,
        subscriber_since = EXCLUDED.subscriber_since, subscriber_ships_month = EXCLUDED.subscriber_ships_month
      WHERE members.group_id = p_group_id AND members.game_slug = p_game_slug;
      IF NOT FOUND THEN RAISE EXCEPTION 'Character destination changed during import'; END IF;

      DELETE FROM public.member_professions WHERE member_id = (v_character->>'id')::UUID;
      INSERT INTO public.member_professions (member_id, profession, rank, artisan_level, quality_score)
        SELECT (v_character->>'id')::UUID, p.profession, p.rank, p.artisan_level, p.quality_score
        FROM jsonb_to_recordset(v_character->'professions')
          AS p(profession TEXT, rank INTEGER, artisan_level INTEGER, quality_score INTEGER);
      DELETE FROM public.character_ships WHERE character_id = (v_character->>'id')::UUID;
      INSERT INTO public.character_ships (character_id, ship_id, ownership_type, notes)
        SELECT (v_character->>'id')::UUID, s.ship_id, s.ownership_type, s.notes
        FROM jsonb_to_recordset(v_character->'ships') AS s(ship_id TEXT, ownership_type TEXT, notes TEXT)
        ORDER BY CASE WHEN s.ownership_type = 'pledged' THEN 0 ELSE 1 END
        ON CONFLICT (character_id, ship_id, ownership_type) DO UPDATE SET notes = EXCLUDED.notes;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('token', v_token, 'create_count', v_create,
    'update_count', v_update, 'warnings', v_warnings);
END;
$$;


--
-- Name: update_character_ships_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_character_ships_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$$;


--
-- Name: update_game_ship_permissions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_game_ship_permissions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  NEW.updated_at = NOW();

  RETURN NEW;

END;

$$;


--
-- Name: user_has_clan_role(uuid, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_clan_role(check_group_id uuid, check_user_id uuid, allowed_roles text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  RETURN EXISTS (

    SELECT 1 FROM group_members

    WHERE group_id = check_group_id

    AND user_id = check_user_id

    AND role = ANY(allowed_roles)

  );

END;

$$;


--
-- Name: user_has_clan_role_by_discord(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_clan_role_by_discord(check_group_id uuid, check_discord_id text, allowed_roles text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Look up member by Discord ID, then check if their user has the role
  RETURN EXISTS (
    SELECT 1 FROM members m
    INNER JOIN group_members gm ON m.user_id = gm.user_id
    WHERE m.group_id = check_group_id
    AND m.discord_id = check_discord_id
    AND gm.group_id = check_group_id
    AND gm.role = ANY(allowed_roles)
  );
END;
$$;


--
-- Name: FUNCTION user_has_clan_role_by_discord(check_group_id uuid, check_discord_id text, allowed_roles text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.user_has_clan_role_by_discord(check_group_id uuid, check_discord_id text, allowed_roles text[]) IS 'Checks if a Discord user (via discord_id) has an approved role in a group. Used as fallback when auth UUID is unavailable or changed.';


--
-- Name: user_in_alliance(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_in_alliance(p_alliance_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  RETURN EXISTS (

    SELECT 1 FROM alliance_members am

    JOIN group_members cm ON cm.group_id = am.group_id

    WHERE am.alliance_id = p_alliance_id

    AND am.status = 'active'

    AND cm.user_id = p_user_id

  );

END;

$$;


--
-- Name: user_in_group_or_allied_group(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_in_group_or_allied_group(check_group_id uuid, check_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  RETURN EXISTS (

    -- User is in the event's clan

    SELECT 1 FROM group_members

    WHERE group_id = check_group_id

    AND user_id = check_user_id

  ) OR EXISTS (

    -- User is in a clan allied with the event's clan

    SELECT 1 FROM group_members cm

    INNER JOIN alliance_members am ON cm.group_id = am.group_id

    INNER JOIN alliance_members am2 ON am.alliance_id = am2.alliance_id

    WHERE am2.group_id = check_group_id

    AND cm.user_id = check_user_id

    AND am.status = 'active'

    AND am2.status = 'active'

  );

END;

$$;


--
-- Name: achievement_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text NOT NULL,
    category public.achievement_category NOT NULL,
    icon character varying(50),
    requirement_type character varying(50) NOT NULL,
    requirement_value integer NOT NULL,
    is_hidden boolean DEFAULT false,
    points integer DEFAULT 10,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE achievement_definitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.achievement_definitions IS 'Achievement templates and requirements';


--
-- Name: achievement_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    is_sent boolean DEFAULT false,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE achievement_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.achievement_notifications IS 'Queue for achievement unlock notifications';


--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid,
    character_id uuid,
    activity_type public.activity_type NOT NULL,
    description text,
    related_event_id uuid,
    related_siege_id uuid,
    related_caravan_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE activity_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.activity_log IS 'Raw activity tracking for members';


--
-- Name: admin_discord_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_discord_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alliance_event_participation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alliance_event_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    group_id uuid NOT NULL,
    confirmed_count integer DEFAULT 0,
    notes text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE alliance_event_participation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alliance_event_participation IS 'Per-guild commitment to alliance events';


--
-- Name: alliance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alliance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alliance_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    event_type character varying(50) NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 120,
    created_by_group uuid,
    created_by_user uuid,
    is_cancelled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE alliance_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alliance_events IS 'Shared events across allied guilds';


--
-- Name: alliance_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alliance_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alliance_id uuid NOT NULL,
    group_id uuid NOT NULL,
    status public.alliance_status DEFAULT 'pending'::public.alliance_status,
    is_founder boolean DEFAULT false,
    can_invite boolean DEFAULT false,
    can_create_events boolean DEFAULT false,
    invited_by uuid,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE alliance_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alliance_members IS 'Guild memberships in alliances';


--
-- Name: alliances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alliances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    leader_group_id uuid NOT NULL,
    is_public boolean DEFAULT false,
    max_guilds integer DEFAULT 10,
    formed_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE alliances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alliances IS 'Cross-guild alliances for coordination';


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    created_by uuid,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE announcements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.announcements IS 'Announcements with RLS ensuring group membership. Permissions (announcements_create, announcements_edit, announcements_delete) enforced by application layer.';


--
-- Name: augment_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.augment_definitions (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    archetype_source character varying(50) NOT NULL,
    icon character varying(100),
    sort_order integer DEFAULT 0
);


--
-- Name: TABLE augment_definitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.augment_definitions IS 'Reference data for skill augments';


--
-- Name: bank_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0,
    last_updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bank_inventory_quantity_check CHECK ((quantity >= 0)),
    CONSTRAINT bank_inventory_reserved_quantity_check CHECK ((reserved_quantity >= 0))
);


--
-- Name: TABLE bank_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bank_inventory IS 'Bank inventory with RLS ensuring group membership. Permissions (guild_bank_deposit, guild_bank_withdraw) enforced by application layer.';


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_id uuid NOT NULL,
    resource_id uuid,
    transaction_type public.bank_transaction_type NOT NULL,
    quantity integer NOT NULL,
    gold_amount bigint DEFAULT 0,
    user_id uuid,
    character_id uuid,
    notes text,
    related_siege_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE bank_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bank_transactions IS 'Bank transactions with RLS ensuring group membership. All members can create deposits, withdrawals enforced by application layer via guild_bank_withdraw permission.';


--
-- Name: build_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    build_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE build_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_comments IS 'Comments and discussions on builds';


--
-- Name: build_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    build_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE build_likes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_likes IS 'User likes for build rating';


--
-- Name: builds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.builds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    group_id uuid,
    name character varying(100) NOT NULL,
    description text,
    primary_archetype character varying(50) NOT NULL,
    secondary_archetype character varying(50),
    skills jsonb DEFAULT '[]'::jsonb,
    augments jsonb DEFAULT '[]'::jsonb,
    equipment jsonb DEFAULT '{}'::jsonb,
    stats jsonb DEFAULT '{}'::jsonb,
    tags text[] DEFAULT '{}'::text[],
    role character varying(50),
    visibility public.build_visibility DEFAULT 'private'::public.build_visibility,
    views_count integer DEFAULT 0,
    likes_count integer DEFAULT 0,
    copies_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE builds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.builds IS 'Character build configurations with skills and augments';


--
-- Name: caravan_escorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caravan_escorts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caravan_id uuid NOT NULL,
    character_id uuid NOT NULL,
    user_id uuid,
    role character varying(50) DEFAULT 'escort'::character varying,
    confirmed boolean DEFAULT false,
    checked_in boolean DEFAULT false,
    notes text,
    signed_up_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE caravan_escorts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.caravan_escorts IS 'Player signups for caravan escort duty';


--
-- Name: caravan_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caravan_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    created_by uuid,
    owner_character_id uuid,
    title character varying(200) NOT NULL,
    description text,
    caravan_type public.caravan_type DEFAULT 'guild'::public.caravan_type NOT NULL,
    origin_node character varying(100) NOT NULL,
    destination_node character varying(100) NOT NULL,
    estimated_distance integer,
    departure_at timestamp with time zone NOT NULL,
    estimated_arrival_at timestamp with time zone,
    cargo_description text,
    cargo_value integer DEFAULT 0,
    min_escorts integer DEFAULT 5,
    max_escorts integer DEFAULT 20,
    status public.caravan_status DEFAULT 'planning'::public.caravan_status,
    completed_at timestamp with time zone,
    was_attacked boolean DEFAULT false,
    escort_reward_gold integer DEFAULT 0,
    escort_reward_dkp integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE caravan_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.caravan_events IS 'Guild caravan coordination and planning';


--
-- Name: caravan_waypoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caravan_waypoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caravan_id uuid NOT NULL,
    order_index integer NOT NULL,
    location_name character varying(100) NOT NULL,
    notes text,
    is_danger_zone boolean DEFAULT false,
    estimated_time_minutes integer,
    reached_at timestamp with time zone
);


--
-- Name: TABLE caravan_waypoints; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.caravan_waypoints IS 'Route waypoints for caravan runs';


--
-- Name: character_ships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.character_ships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    ship_id text NOT NULL,
    ownership_type text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT character_ships_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['pledged'::text, 'in-game'::text, 'loaner'::text, 'subscriber'::text])))
);


--
-- Name: discord_webhook_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discord_webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    game_slug text,
    kind text NOT NULL,
    subject_id text,
    actor_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    http_status integer,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discord_webhook_logs_kind_check CHECK ((kind = ANY (ARRAY['event'::text, 'repost'::text, 'announcement'::text, 'reminder'::text, 'test'::text, 'welcome'::text]))),
    CONSTRAINT discord_webhook_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: dkp_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dkp_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loot_system_id uuid NOT NULL,
    character_id uuid NOT NULL,
    current_points integer DEFAULT 0,
    earned_total integer DEFAULT 0,
    spent_total integer DEFAULT 0,
    priority_ratio numeric(5,2) DEFAULT 1.0,
    last_earned_at timestamp with time zone,
    last_spent_at timestamp with time zone,
    last_decay_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE dkp_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dkp_points IS 'Character DKP point balances';


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    user_id uuid,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    race public.race,
    primary_archetype public.archetype,
    secondary_archetype public.archetype,
    level integer DEFAULT 1,
    is_main boolean DEFAULT false,
    game_slug text DEFAULT 'aoc'::text NOT NULL,
    preferred_role text[],
    subscriber_tier character varying(50),
    subscriber_since timestamp with time zone,
    subscriber_ships_month character varying(7),
    rank text,
    ror_faction character varying(50),
    ror_class character varying(50),
    discord_id text,
    wow_race character varying(50),
    wow_class character varying(50),
    wow_main_spec character varying(50),
    wow_secondary_spec character varying(50),
    wow_profession_1 character varying(50),
    wow_profession_2 character varying(50),
    wow_faction character varying(20),
    wow_profession_1_rank character varying(20),
    wow_profession_2_rank character varying(20),
    CONSTRAINT members_level_check CHECK (((level >= 1) AND (level <= 50))),
    CONSTRAINT members_wow_faction_check CHECK (((wow_faction)::text = ANY (ARRAY[('Alliance'::character varying)::text, ('Horde'::character varying)::text]))),
    CONSTRAINT members_wow_profession_1_rank_check CHECK (((wow_profession_1_rank)::text = ANY (ARRAY[('apprentice'::character varying)::text, ('journeyman'::character varying)::text, ('expert'::character varying)::text, ('artisan'::character varying)::text]))),
    CONSTRAINT members_wow_profession_2_rank_check CHECK (((wow_profession_2_rank)::text = ANY (ARRAY[('apprentice'::character varying)::text, ('journeyman'::character varying)::text, ('expert'::character varying)::text, ('artisan'::character varying)::text])))
);


--
-- Name: TABLE members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.members IS 'Characters with RLS ensuring group membership. Permissions (characters_create, characters_edit_own, characters_edit_any, characters_delete_own, characters_delete_any) enforced by application layer.';


--
-- Name: COLUMN members.race; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.race IS 'Character race (kaelar, vaelune, dunir, etc.)';


--
-- Name: COLUMN members.primary_archetype; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.primary_archetype IS 'Primary archetype chosen at character creation';


--
-- Name: COLUMN members.secondary_archetype; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.secondary_archetype IS 'Secondary archetype chosen at level 25';


--
-- Name: COLUMN members.level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.level IS 'Character level (1-50)';


--
-- Name: COLUMN members.is_main; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.is_main IS 'Whether this is the users main character. Only one main per user_id is allowed.';


--
-- Name: COLUMN members.subscriber_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.subscriber_tier IS 'Subscriber tier: centurion or imperator. NULL if not a subscriber.';


--
-- Name: COLUMN members.subscriber_since; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.subscriber_since IS 'When the subscriber tier was first set.';


--
-- Name: COLUMN members.subscriber_ships_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.subscriber_ships_month IS 'Which month (YYYY-MM) of subscriber ships have been added.';


--
-- Name: COLUMN members.rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.rank IS 'Guild rank assigned to this member/character. Values defined per-game in config.';


--
-- Name: COLUMN members.ror_faction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.ror_faction IS 'Return of Reckoning faction: order or destruction.';


--
-- Name: COLUMN members.ror_class; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.ror_class IS 'Return of Reckoning class ID.';


--
-- Name: COLUMN members.discord_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.discord_id IS 'Discord user ID (snowflake) - immutable across database restores for DR resilience';


--
-- Name: COLUMN members.wow_race; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_race IS 'WoW Forever character race.';


--
-- Name: COLUMN members.wow_class; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_class IS 'WoW Forever character class ID.';


--
-- Name: COLUMN members.wow_main_spec; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_main_spec IS 'WoW Forever character primary specialization.';


--
-- Name: COLUMN members.wow_secondary_spec; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_secondary_spec IS 'WoW Forever character optional secondary specialization.';


--
-- Name: COLUMN members.wow_profession_1; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_profession_1 IS 'WoW Forever character first profession.';


--
-- Name: COLUMN members.wow_profession_2; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_profession_2 IS 'WoW Forever character second profession.';


--
-- Name: COLUMN members.wow_faction; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_faction IS 'WoW Forever faction selection; nullable for legacy Skyborne characters with an unknown faction.';


--
-- Name: COLUMN members.wow_profession_1_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_profession_1_rank IS 'Manually recorded WoW Forever trained rank for profession 1; NULL means not recorded.';


--
-- Name: COLUMN members.wow_profession_2_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.members.wow_profession_2_rank IS 'Manually recorded WoW Forever trained rank for profession 2; NULL means not recorded.';


--
-- Name: dkp_leaderboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dkp_leaderboard AS
 SELECT dp.loot_system_id,
    dp.character_id,
    m.name AS character_name,
    m.group_id,
    dp.current_points,
    dp.earned_total,
    dp.spent_total,
    dp.priority_ratio,
    dp.last_earned_at,
    rank() OVER (PARTITION BY dp.loot_system_id ORDER BY dp.current_points DESC) AS rank
   FROM (public.dkp_points dp
     JOIN public.members m ON ((m.id = dp.character_id)));


--
-- Name: VIEW dkp_leaderboard; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.dkp_leaderboard IS 'Ranked DKP standings per loot system';


--
-- Name: dkp_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dkp_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dkp_points_id uuid NOT NULL,
    amount integer NOT NULL,
    reason character varying(200) NOT NULL,
    loot_id uuid,
    event_id uuid,
    siege_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE dkp_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dkp_transactions IS 'Audit log of all DKP point changes';


--
-- Name: event_rsvps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_rsvps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    character_id uuid,
    status public.rsvp_status DEFAULT 'attending'::public.rsvp_status,
    note text,
    responded_at timestamp with time zone DEFAULT now(),
    role text,
    CONSTRAINT event_rsvps_role_check CHECK (((role IS NULL) OR (role = ANY (ARRAY['tank'::text, 'cleric'::text, 'bard'::text, 'ranged_dps'::text, 'melee_dps'::text]))))
);


--
-- Name: TABLE event_rsvps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.event_rsvps IS 'Event RSVPs with RLS ensuring group membership only. Application enforces RSVP permissions (own vs on behalf of others).';


--
-- Name: COLUMN event_rsvps.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_rsvps.role IS 'Role: tank, cleric, bard, ranged_dps, melee_dps';


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    created_by uuid,
    title character varying(100) NOT NULL,
    description text,
    event_type public.event_type DEFAULT 'other'::public.event_type,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    location character varying(100),
    max_attendees integer,
    is_cancelled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tanks_min integer DEFAULT 0,
    clerics_min integer DEFAULT 0,
    ranged_dps_min integer DEFAULT 0,
    bards_min integer DEFAULT 0,
    melee_dps_min integer DEFAULT 0,
    tanks_max integer,
    clerics_max integer,
    bards_max integer,
    ranged_dps_max integer,
    melee_dps_max integer,
    allow_combined_dps boolean DEFAULT false,
    combined_dps_max integer,
    is_public boolean DEFAULT false,
    allow_allied_signups boolean DEFAULT true,
    game_slug text DEFAULT 'aoc'::text NOT NULL,
    ror_tanks_min integer DEFAULT 0,
    ror_tanks_max integer,
    ror_healers_min integer DEFAULT 0,
    ror_healers_max integer,
    ror_dps_min integer DEFAULT 0,
    ror_dps_max integer
);


--
-- Name: TABLE events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.events IS 'Events table with RLS ensuring group membership. Fine-grained permissions (events_create, events_edit, events_delete) are enforced by the application layer via the permissions system.';


--
-- Name: COLUMN events.tanks_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.tanks_min IS 'Minimum number of tanks required (not a cap)';


--
-- Name: COLUMN events.clerics_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.clerics_min IS 'Minimum number of clerics required (not a cap)';


--
-- Name: COLUMN events.ranged_dps_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ranged_dps_min IS 'Minimum number of ranged DPS required (not a cap)';


--
-- Name: COLUMN events.bards_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.bards_min IS 'Minimum number of bards required (not a cap)';


--
-- Name: COLUMN events.melee_dps_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.melee_dps_min IS 'Minimum number of melee DPS required (not a cap)';


--
-- Name: COLUMN events.tanks_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.tanks_max IS 'Maximum number of tanks allowed (NULL = unlimited)';


--
-- Name: COLUMN events.clerics_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.clerics_max IS 'Maximum number of clerics allowed (NULL = unlimited)';


--
-- Name: COLUMN events.bards_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.bards_max IS 'Maximum number of bards allowed (NULL = unlimited)';


--
-- Name: COLUMN events.ranged_dps_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ranged_dps_max IS 'Maximum number of ranged DPS allowed (NULL = unlimited)';


--
-- Name: COLUMN events.melee_dps_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.melee_dps_max IS 'Maximum number of melee DPS allowed (NULL = unlimited)';


--
-- Name: COLUMN events.ror_tanks_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_tanks_min IS 'Minimum number of tanks required for RoR events';


--
-- Name: COLUMN events.ror_tanks_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_tanks_max IS 'Maximum number of tanks allowed for RoR events (NULL = unlimited)';


--
-- Name: COLUMN events.ror_healers_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_healers_min IS 'Minimum number of healers required for RoR events';


--
-- Name: COLUMN events.ror_healers_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_healers_max IS 'Maximum number of healers allowed for RoR events (NULL = unlimited)';


--
-- Name: COLUMN events.ror_dps_min; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_dps_min IS 'Minimum number of DPS required for RoR events (includes melee, skirmish, and ranged)';


--
-- Name: COLUMN events.ror_dps_max; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.ror_dps_max IS 'Maximum number of DPS allowed for RoR events (NULL = unlimited)';


--
-- Name: freehold_buildings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freehold_buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    freehold_id uuid NOT NULL,
    building_type public.freehold_building_type NOT NULL,
    building_name character varying(100),
    tier integer DEFAULT 1,
    profession_id character varying(50),
    is_guild_accessible boolean DEFAULT false,
    usage_fee integer DEFAULT 0,
    built_at timestamp with time zone DEFAULT now(),
    upgraded_at timestamp with time zone,
    CONSTRAINT freehold_buildings_tier_check CHECK (((tier >= 1) AND (tier <= 3)))
);


--
-- Name: TABLE freehold_buildings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.freehold_buildings IS 'Buildings on member freeholds';


--
-- Name: freehold_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freehold_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    freehold_id uuid NOT NULL,
    building_id uuid,
    day_of_week integer,
    start_time time without time zone,
    end_time time without time zone,
    notes text,
    CONSTRAINT freehold_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: TABLE freehold_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.freehold_schedules IS 'When freehold buildings are available for guild use';


--
-- Name: freeholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freeholds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    owner_character_id uuid,
    name character varying(100) NOT NULL,
    node_name character varying(100),
    region character varying(100),
    coordinates character varying(50),
    size public.freehold_size DEFAULT 'medium'::public.freehold_size NOT NULL,
    is_public boolean DEFAULT false,
    description text,
    established_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE freeholds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.freeholds IS 'Guild member freeholds registry';


--
-- Name: game_ship_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_ship_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    game_slug text NOT NULL,
    min_role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: game_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_types (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(5),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: group_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    current_value integer DEFAULT 0,
    is_unlocked boolean DEFAULT false,
    unlocked_at timestamp with time zone,
    first_contributor_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE group_achievements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.group_achievements IS 'Clan progress and unlocks for achievements';


--
-- Name: group_admin_discord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_admin_discord (
    group_id uuid NOT NULL,
    destination_id uuid,
    updated_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role_mentions jsonb DEFAULT '{}'::jsonb NOT NULL,
    categories jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: group_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    game_slug text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    archived boolean DEFAULT false
);


--
-- Name: COLUMN group_games.archived; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_games.archived IS 'Whether this game is archived for the group. Archived games are hidden from the UI and prevent updates but preserve all data.';


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    user_id uuid,
    role character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    is_creator boolean DEFAULT false,
    applied_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by uuid,
    guild_rank text,
    CONSTRAINT group_members_role_check CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('officer'::character varying)::text, ('member'::character varying)::text, ('trial'::character varying)::text, ('pending'::character varying)::text])))
);


--
-- Name: group_permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_permission_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    role text NOT NULL,
    characters_create boolean DEFAULT true,
    characters_read_all boolean DEFAULT true,
    characters_edit_own boolean DEFAULT true,
    characters_edit_any boolean DEFAULT false,
    characters_delete_own boolean DEFAULT true,
    characters_delete_any boolean DEFAULT false,
    guild_bank_withdraw boolean DEFAULT false,
    guild_bank_deposit boolean DEFAULT true,
    guild_bank_view_history boolean DEFAULT false,
    events_create boolean DEFAULT false,
    events_read boolean DEFAULT true,
    events_edit_own boolean DEFAULT false,
    events_edit_any boolean DEFAULT false,
    events_delete_own boolean DEFAULT false,
    events_delete_any boolean DEFAULT false,
    events_rsvp boolean DEFAULT true,
    parties_create boolean DEFAULT false,
    parties_read boolean DEFAULT true,
    parties_edit_own boolean DEFAULT false,
    parties_edit_any boolean DEFAULT false,
    parties_delete_own boolean DEFAULT false,
    parties_delete_any boolean DEFAULT false,
    siege_view_rosters boolean DEFAULT true,
    siege_edit_rosters boolean DEFAULT false,
    siege_create_event boolean DEFAULT false,
    announcements_create boolean DEFAULT false,
    announcements_edit boolean DEFAULT false,
    announcements_delete boolean DEFAULT false,
    recruitment_manage boolean DEFAULT false,
    settings_edit boolean DEFAULT false,
    settings_edit_roles boolean DEFAULT false,
    settings_view_permissions boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ships_create boolean DEFAULT true,
    ships_edit_own boolean DEFAULT true,
    ships_edit_any boolean DEFAULT false,
    ships_delete_own boolean DEFAULT true,
    ships_delete_any boolean DEFAULT false,
    CONSTRAINT group_permission_overrides_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text, 'pending'::text])))
);


--
-- Name: COLUMN group_permission_overrides.ships_create; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_permission_overrides.ships_create IS 'Permission to add ships to characters';


--
-- Name: COLUMN group_permission_overrides.ships_edit_own; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_permission_overrides.ships_edit_own IS 'Permission to edit ships on own characters';


--
-- Name: COLUMN group_permission_overrides.ships_edit_any; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_permission_overrides.ships_edit_any IS 'Permission to edit ships on any character';


--
-- Name: COLUMN group_permission_overrides.ships_delete_own; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_permission_overrides.ships_delete_own IS 'Permission to delete ships from own characters';


--
-- Name: COLUMN group_permission_overrides.ships_delete_any; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.group_permission_overrides.ships_delete_any IS 'Permission to delete ships from any character';


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    group_webhook_url text,
    notify_on_events boolean DEFAULT true,
    notify_on_announcements boolean DEFAULT true,
    is_public boolean DEFAULT false,
    recruitment_open boolean DEFAULT false,
    recruitment_message text,
    public_description text,
    banner_url text,
    group_icon_url text,
    discord_announcement_role_id text,
    group_welcome_webhook_url text,
    game character varying(50) DEFAULT 'aoc'::character varying NOT NULL,
    sc_announcement_role_id text,
    sc_events_role_id text,
    aoc_webhook_url text,
    aoc_events_webhook_url text,
    sc_webhook_url text,
    sc_events_webhook_url text,
    aoc_welcome_enabled boolean DEFAULT true,
    sc_welcome_enabled boolean DEFAULT true,
    ror_webhook_url text,
    ror_events_webhook_url text,
    aoc_announcement_role_id text,
    aoc_events_role_id text,
    ror_announcement_role_id text,
    ror_events_role_id text,
    approval_required boolean DEFAULT true NOT NULL,
    default_role character varying(20) DEFAULT 'trial'::character varying NOT NULL,
    aoc_recruitment_open boolean DEFAULT false,
    sc_recruitment_open boolean DEFAULT false,
    ror_recruitment_open boolean DEFAULT false,
    aoc_recruitment_message text,
    sc_recruitment_message text,
    ror_recruitment_message text,
    aoc_public_description text,
    sc_public_description text,
    ror_public_description text,
    aoc_ranks_enabled boolean DEFAULT false,
    sc_ranks_enabled boolean DEFAULT true,
    ror_ranks_enabled boolean DEFAULT false,
    aoc_custom_ranks jsonb DEFAULT '[]'::jsonb,
    sc_custom_ranks jsonb DEFAULT '[]'::jsonb,
    ror_custom_ranks jsonb DEFAULT '[]'::jsonb,
    wowforever_ranks_enabled boolean DEFAULT false,
    wowforever_custom_ranks jsonb DEFAULT '[]'::jsonb,
    wowforever_webhook_url text,
    wowforever_events_webhook_url text,
    wowforever_announcement_role_id text,
    wowforever_events_role_id text,
    wowforever_recruitment_open boolean DEFAULT false,
    wowforever_recruitment_message text,
    wowforever_public_description text,
    CONSTRAINT groups_default_role_check CHECK (((default_role)::text = ANY (ARRAY[('trial'::character varying)::text, ('member'::character varying)::text]))),
    CONSTRAINT valid_game CHECK (((game)::text = ANY (ARRAY[('aoc'::character varying)::text, ('starcitizen'::character varying)::text, ('ror'::character varying)::text, ('wowforever'::character varying)::text])))
);


--
-- Name: COLUMN groups.group_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.group_webhook_url IS 'Discord webhook URL for clan notifications';


--
-- Name: COLUMN groups.notify_on_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.notify_on_events IS 'Whether to send Discord notifications for new events';


--
-- Name: COLUMN groups.notify_on_announcements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.notify_on_announcements IS 'Whether to send Discord notifications for announcements';


--
-- Name: COLUMN groups.discord_announcement_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.discord_announcement_role_id IS 'Discord role ID to ping when posting announcements (numeric ID only)';


--
-- Name: COLUMN groups.group_welcome_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.group_welcome_webhook_url IS 'Discord webhook URL for welcome messages (optional, falls back to main webhook if not set)';


--
-- Name: COLUMN groups.sc_announcement_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_announcement_role_id IS 'Discord role ID to ping for Star Citizen announcements';


--
-- Name: COLUMN groups.sc_events_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_events_role_id IS 'Discord role ID to ping for Star Citizen event notifications';


--
-- Name: COLUMN groups.aoc_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_webhook_url IS 'Discord webhook URL for AoC announcements and general notifications';


--
-- Name: COLUMN groups.aoc_events_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_events_webhook_url IS 'Discord webhook URL for AoC event notifications';


--
-- Name: COLUMN groups.sc_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_webhook_url IS 'Discord webhook URL for Star Citizen announcements and general notifications';


--
-- Name: COLUMN groups.sc_events_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_events_webhook_url IS 'Discord webhook URL for Star Citizen event notifications';


--
-- Name: COLUMN groups.aoc_welcome_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_welcome_enabled IS 'Enable welcome messages for AoC members';


--
-- Name: COLUMN groups.sc_welcome_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_welcome_enabled IS 'Enable welcome messages for Star Citizen members';


--
-- Name: COLUMN groups.ror_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_webhook_url IS 'Discord webhook URL for RoR announcements and general notifications';


--
-- Name: COLUMN groups.ror_events_webhook_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_events_webhook_url IS 'Discord webhook URL for RoR event notifications';


--
-- Name: COLUMN groups.aoc_announcement_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_announcement_role_id IS 'Discord role ID to ping for AoC announcements';


--
-- Name: COLUMN groups.aoc_events_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_events_role_id IS 'Discord role ID to ping for AoC event notifications';


--
-- Name: COLUMN groups.ror_announcement_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_announcement_role_id IS 'Discord role ID to ping for RoR announcements';


--
-- Name: COLUMN groups.ror_events_role_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_events_role_id IS 'Discord role ID to ping for RoR event notifications';


--
-- Name: COLUMN groups.aoc_recruitment_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_recruitment_open IS 'Whether Ashes of Creation recruitment is open for this guild';


--
-- Name: COLUMN groups.sc_recruitment_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_recruitment_open IS 'Whether Star Citizen recruitment is open for this guild';


--
-- Name: COLUMN groups.ror_recruitment_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_recruitment_open IS 'Whether Return of Reckoning recruitment is open for this guild';


--
-- Name: COLUMN groups.aoc_recruitment_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_recruitment_message IS 'Recruitment message specific to Ashes of Creation';


--
-- Name: COLUMN groups.sc_recruitment_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_recruitment_message IS 'Recruitment message specific to Star Citizen';


--
-- Name: COLUMN groups.ror_recruitment_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_recruitment_message IS 'Recruitment message specific to Return of Reckoning';


--
-- Name: COLUMN groups.aoc_public_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_public_description IS 'Public description for Ashes of Creation guild page';


--
-- Name: COLUMN groups.sc_public_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_public_description IS 'Public description for Star Citizen organization page';


--
-- Name: COLUMN groups.ror_public_description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_public_description IS 'Public description for Return of Reckoning warband page';


--
-- Name: COLUMN groups.aoc_ranks_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_ranks_enabled IS 'Whether game-specific member ranks are enabled for Ashes of Creation.';


--
-- Name: COLUMN groups.sc_ranks_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_ranks_enabled IS 'Whether game-specific member ranks are enabled for Star Citizen.';


--
-- Name: COLUMN groups.ror_ranks_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_ranks_enabled IS 'Whether game-specific member ranks are enabled for Return of Reckoning.';


--
-- Name: COLUMN groups.aoc_custom_ranks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.aoc_custom_ranks IS 'Custom rank definitions for Ashes of Creation at group level.';


--
-- Name: COLUMN groups.sc_custom_ranks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.sc_custom_ranks IS 'Custom rank definitions for Star Citizen at group level.';


--
-- Name: COLUMN groups.ror_custom_ranks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.ror_custom_ranks IS 'Custom rank definitions for Return of Reckoning at group level.';


--
-- Name: COLUMN groups.wowforever_ranks_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.wowforever_ranks_enabled IS 'Whether custom group ranks are enabled for WoW Forever.';


--
-- Name: COLUMN groups.wowforever_custom_ranks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.wowforever_custom_ranks IS 'Custom rank definitions for WoW Forever at group level.';


--
-- Name: guest_event_rsvps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_event_rsvps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    allied_group_id uuid,
    guest_name character varying(255) NOT NULL,
    class_id text,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    guest_email character varying(255),
    status character varying(20) DEFAULT 'attending'::character varying,
    CONSTRAINT guest_event_rsvps_status_check CHECK (((status)::text = ANY (ARRAY[('attending'::character varying)::text, ('maybe'::character varying)::text, ('declined'::character varying)::text])))
);


--
-- Name: COLUMN guest_event_rsvps.class_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.guest_event_rsvps.class_id IS 'Game registry class ID (for example mage or ironbreaker), interpreted using the event game. Legacy UUID values are preserved as unknown classes.';


--
-- Name: guild_banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guild_banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name character varying(100) DEFAULT 'Guild Bank'::character varying,
    description text,
    deposit_min_role character varying(20) DEFAULT 'member'::character varying,
    withdraw_min_role character varying(20) DEFAULT 'officer'::character varying,
    gold_balance bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE guild_banks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.guild_banks IS 'Guild banks with RLS ensuring group membership. Permissions (guild_bank_manage) enforced by application layer.';


--
-- Name: inactivity_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inactivity_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    days_inactive integer NOT NULL,
    alert_level character varying(20) DEFAULT 'warning'::character varying,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE inactivity_alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inactivity_alerts IS 'Alerts for inactive guild members';


--
-- Name: loot_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loot_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loot_system_id uuid NOT NULL,
    item_name character varying(200) NOT NULL,
    item_rarity public.item_rarity DEFAULT 'rare'::public.item_rarity,
    item_slot character varying(50),
    item_description text,
    source_type character varying(50),
    source_name character varying(100),
    event_id uuid,
    siege_id uuid,
    awarded_to uuid,
    awarded_by uuid,
    dkp_cost integer DEFAULT 0,
    votes_for integer DEFAULT 0,
    votes_against integer DEFAULT 0,
    dropped_at timestamp with time zone DEFAULT now(),
    distributed_at timestamp with time zone,
    notes text
);


--
-- Name: TABLE loot_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.loot_history IS 'Historical record of all loot drops and distribution';


--
-- Name: loot_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loot_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    system_type public.loot_system_type DEFAULT 'dkp'::public.loot_system_type,
    name character varying(100) DEFAULT 'Default'::character varying NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    starting_points integer DEFAULT 0,
    decay_enabled boolean DEFAULT false,
    decay_rate numeric(5,2) DEFAULT 0,
    decay_minimum integer DEFAULT 0,
    raid_attendance_points integer DEFAULT 10,
    siege_attendance_points integer DEFAULT 15,
    boss_kill_points integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE loot_systems; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.loot_systems IS 'Clan loot distribution system configuration';


--
-- Name: member_activity_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_activity_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_login_at timestamp with time zone,
    last_activity_at timestamp with time zone,
    events_attended_30d integer DEFAULT 0,
    sieges_attended_30d integer DEFAULT 0,
    caravans_escorted_30d integer DEFAULT 0,
    bank_deposits_30d integer DEFAULT 0,
    total_activities_30d integer DEFAULT 0,
    current_streak_days integer DEFAULT 0,
    longest_streak_days integer DEFAULT 0,
    is_inactive boolean DEFAULT false,
    inactive_since timestamp with time zone,
    last_calculated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE member_activity_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.member_activity_summary IS 'Aggregated activity metrics per member';


--
-- Name: member_professions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_professions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    member_id uuid,
    profession character varying(50) NOT NULL,
    rank integer NOT NULL,
    artisan_level integer DEFAULT 0,
    quality_score integer DEFAULT 0,
    CONSTRAINT member_professions_artisan_level_check CHECK (((artisan_level >= 0) AND (artisan_level <= 50))),
    CONSTRAINT member_professions_quality_score_check CHECK ((quality_score >= 0)),
    CONSTRAINT member_professions_rank_check CHECK (((rank >= 1) AND (rank <= 4)))
);


--
-- Name: COLUMN member_professions.artisan_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_professions.artisan_level IS 'Artisan skill level (0-50). Level ranges: 0-9=Novice, 10-19=Apprentice, 20-29=Journeyman, 30-39=Master, 40-50=Grandmaster. Note: Promotion to next rank requires manual certification.';


--
-- Name: COLUMN member_professions.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.member_professions.quality_score IS 'Quality/proficiency score with all buffs (food, clothes, town buffs, etc.) - no upper limit, can be in thousands';


--
-- Name: migration_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_history (
    id integer NOT NULL,
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: migration_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migration_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_history_id_seq OWNED BY public.migration_history.id;


--
-- Name: node_citizenships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_citizenships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    character_id uuid NOT NULL,
    node_name character varying(100) NOT NULL,
    node_type public.node_type NOT NULL,
    node_stage integer DEFAULT 3 NOT NULL,
    region character varying(100),
    is_mayor boolean DEFAULT false,
    is_council_member boolean DEFAULT false,
    became_citizen_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT node_citizenships_node_stage_check CHECK (((node_stage >= 0) AND (node_stage <= 6)))
);


--
-- Name: TABLE node_citizenships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.node_citizenships IS 'Tracks which node each character is a citizen of';


--
-- Name: COLUMN node_citizenships.node_stage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.node_citizenships.node_stage IS '0=Wilderness, 1=Expedition, 2=Encampment, 3=Village, 4=Town, 5=City, 6=Metropolis';


--
-- Name: node_distribution; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.node_distribution AS
 SELECT m.group_id,
    nc.node_name,
    nc.node_type,
    nc.node_stage,
    count(*) AS citizen_count,
    count(*) FILTER (WHERE nc.is_mayor) AS has_mayor,
    array_agg(m.name ORDER BY m.name) AS citizen_names
   FROM (public.node_citizenships nc
     JOIN public.members m ON ((m.id = nc.character_id)))
  GROUP BY m.group_id, nc.node_name, nc.node_type, nc.node_stage;


--
-- Name: VIEW node_distribution; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.node_distribution IS 'Aggregated view of citizen distribution per node per clan';


--
-- Name: parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    tanks_needed integer DEFAULT 0,
    clerics_needed integer DEFAULT 0,
    ranged_dps_needed integer DEFAULT 0,
    bards_needed integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    melee_dps_needed integer DEFAULT 0
);


--
-- Name: TABLE parties; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.parties IS 'Parties with RLS ensuring group membership. Permissions (parties_create, parties_edit_own, parties_edit_any, parties_delete_own, parties_delete_any) enforced by application layer.';


--
-- Name: COLUMN parties.tanks_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parties.tanks_needed IS 'Number of tanks needed';


--
-- Name: COLUMN parties.clerics_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parties.clerics_needed IS 'Number of clerics needed';


--
-- Name: COLUMN parties.ranged_dps_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parties.ranged_dps_needed IS 'Number of ranged DPS needed';


--
-- Name: COLUMN parties.bards_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parties.bards_needed IS 'Number of bards needed';


--
-- Name: COLUMN parties.melee_dps_needed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parties.melee_dps_needed IS 'Number of melee DPS needed';


--
-- Name: party_roster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_roster (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    character_id uuid NOT NULL,
    role text NOT NULL,
    is_confirmed boolean DEFAULT false,
    assigned_at timestamp with time zone DEFAULT now(),
    CONSTRAINT party_roster_role_check CHECK ((role = ANY (ARRAY['tank'::text, 'cleric'::text, 'bard'::text, 'ranged_dps'::text, 'melee_dps'::text])))
);


--
-- Name: TABLE party_roster; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.party_roster IS 'Character assignments to parties';


--
-- Name: COLUMN party_roster.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.party_roster.role IS 'Role: tank, cleric, bard, ranged_dps, melee_dps';


--
-- Name: recruitment_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid,
    discord_username text NOT NULL,
    character_name text,
    primary_class text,
    experience text,
    availability text,
    message text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_notes text,
    game_slug text,
    CONSTRAINT recruitment_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: TABLE recruitment_applications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recruitment_applications IS 'Recruitment applications with RLS ensuring group membership or own application. Permission (recruitment_manage) enforced by application layer.';


--
-- Name: COLUMN recruitment_applications.game_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recruitment_applications.game_slug IS 'Which game this application is for (aoc, sc, ror, etc.)';


--
-- Name: resource_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    category public.resource_category NOT NULL,
    subcategory character varying(100),
    rarity public.item_rarity DEFAULT 'common'::public.item_rarity,
    base_value integer DEFAULT 0,
    is_craftable boolean DEFAULT false,
    profession_required character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE resource_catalog; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resource_catalog IS 'Global catalog of all trackable resources';


--
-- Name: resource_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    character_id uuid,
    quantity integer NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    fulfilled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT resource_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT resource_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('denied'::character varying)::text, ('fulfilled'::character varying)::text])))
);


--
-- Name: TABLE resource_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resource_requests IS 'Member requests for resource withdrawals';


--
-- Name: sc_loaner_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sc_loaner_matrix (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pledged_ship text NOT NULL,
    loaner_ship text NOT NULL,
    loaner_type text DEFAULT 'primary'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sc_loaner_matrix_loaner_type_check CHECK ((loaner_type = ANY (ARRAY['primary'::text, 'arena_commander'::text, 'temporary'::text])))
);


--
-- Name: siege_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.siege_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    description text,
    siege_type public.siege_type NOT NULL,
    target_name character varying(100) NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    declaration_ends_at timestamp with time zone,
    max_participants integer DEFAULT 250,
    frontline_needed integer DEFAULT 80,
    ranged_needed integer DEFAULT 60,
    healer_needed integer DEFAULT 40,
    siege_operator_needed integer DEFAULT 20,
    scout_needed integer DEFAULT 10,
    reserve_needed integer DEFAULT 40,
    is_cancelled boolean DEFAULT false,
    result character varying(20),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT siege_events_result_check CHECK (((result)::text = ANY (ARRAY[('victory'::character varying)::text, ('defeat'::character varying)::text, ('draw'::character varying)::text, (NULL::character varying)::text])))
);


--
-- Name: TABLE siege_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.siege_events IS 'Siege events with RLS ensuring group membership. Permissions (siege_create_event, siege_edit_rosters) enforced by application layer.';


--
-- Name: siege_roster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.siege_roster (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    siege_id uuid NOT NULL,
    character_id uuid NOT NULL,
    user_id uuid,
    role public.siege_role NOT NULL,
    is_leader boolean DEFAULT false,
    priority integer DEFAULT 0,
    status public.roster_status DEFAULT 'signed_up'::public.roster_status,
    signed_up_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    note text
);


--
-- Name: TABLE siege_roster; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.siege_roster IS 'Player signups for siege events';


--
-- Name: siege_roster_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.siege_roster_counts AS
 SELECT siege_id,
    role,
    count(*) AS total_count,
    count(*) FILTER (WHERE (status = 'confirmed'::public.roster_status)) AS confirmed_count,
    count(*) FILTER (WHERE (status = 'checked_in'::public.roster_status)) AS checked_in_count
   FROM public.siege_roster sr
  GROUP BY siege_id, role;


--
-- Name: VIEW siege_roster_counts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.siege_roster_counts IS 'Aggregated roster counts by role per siege';


--
-- Name: site_admin_discord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_admin_discord (
    id boolean DEFAULT true NOT NULL,
    webhook_override boolean DEFAULT false NOT NULL,
    destination_id uuid,
    role_mentions jsonb,
    categories jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_admin_discord_id_check CHECK (id)
);


--
-- Name: skill_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_definitions (
    id character varying(50) NOT NULL,
    archetype character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    skill_type character varying(50),
    icon character varying(100),
    sort_order integer DEFAULT 0
);


--
-- Name: TABLE skill_definitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.skill_definitions IS 'Reference data for class skills';


--
-- Name: user_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    game character varying(50),
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    discord_id character varying(50),
    discord_username character varying(100),
    discord_avatar character varying(255),
    display_name character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    timezone character varying(50) DEFAULT 'UTC'::character varying
);


--
-- Name: COLUMN users.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.timezone IS 'User timezone for displaying event times (IANA format)';


--
-- Name: migration_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history ALTER COLUMN id SET DEFAULT nextval('public.migration_history_id_seq'::regclass);


--
-- Name: achievement_definitions achievement_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_pkey PRIMARY KEY (id);


--
-- Name: achievement_notifications achievement_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_notifications
    ADD CONSTRAINT achievement_notifications_pkey PRIMARY KEY (id);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: admin_discord_destinations admin_discord_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_discord_destinations
    ADD CONSTRAINT admin_discord_destinations_pkey PRIMARY KEY (id);


--
-- Name: admin_discord_notifications admin_discord_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_discord_notifications
    ADD CONSTRAINT admin_discord_notifications_pkey PRIMARY KEY (id);


--
-- Name: alliance_event_participation alliance_event_participation_event_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_event_participation
    ADD CONSTRAINT alliance_event_participation_event_id_group_id_key UNIQUE (event_id, group_id);


--
-- Name: alliance_event_participation alliance_event_participation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_event_participation
    ADD CONSTRAINT alliance_event_participation_pkey PRIMARY KEY (id);


--
-- Name: alliance_events alliance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_events
    ADD CONSTRAINT alliance_events_pkey PRIMARY KEY (id);


--
-- Name: alliance_members alliance_members_alliance_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_members
    ADD CONSTRAINT alliance_members_alliance_id_group_id_key UNIQUE (alliance_id, group_id);


--
-- Name: alliance_members alliance_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_members
    ADD CONSTRAINT alliance_members_pkey PRIMARY KEY (id);


--
-- Name: alliances alliances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliances
    ADD CONSTRAINT alliances_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: augment_definitions augment_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.augment_definitions
    ADD CONSTRAINT augment_definitions_pkey PRIMARY KEY (id);


--
-- Name: bank_inventory bank_inventory_bank_id_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_inventory
    ADD CONSTRAINT bank_inventory_bank_id_resource_id_key UNIQUE (bank_id, resource_id);


--
-- Name: bank_inventory bank_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_inventory
    ADD CONSTRAINT bank_inventory_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: build_comments build_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_comments
    ADD CONSTRAINT build_comments_pkey PRIMARY KEY (id);


--
-- Name: build_likes build_likes_build_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_likes
    ADD CONSTRAINT build_likes_build_id_user_id_key UNIQUE (build_id, user_id);


--
-- Name: build_likes build_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_likes
    ADD CONSTRAINT build_likes_pkey PRIMARY KEY (id);


--
-- Name: builds builds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.builds
    ADD CONSTRAINT builds_pkey PRIMARY KEY (id);


--
-- Name: caravan_escorts caravan_escorts_caravan_id_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_escorts
    ADD CONSTRAINT caravan_escorts_caravan_id_character_id_key UNIQUE (caravan_id, character_id);


--
-- Name: caravan_escorts caravan_escorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_escorts
    ADD CONSTRAINT caravan_escorts_pkey PRIMARY KEY (id);


--
-- Name: caravan_events caravan_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_events
    ADD CONSTRAINT caravan_events_pkey PRIMARY KEY (id);


--
-- Name: caravan_waypoints caravan_waypoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_waypoints
    ADD CONSTRAINT caravan_waypoints_pkey PRIMARY KEY (id);


--
-- Name: character_ships character_ships_character_id_ship_id_ownership_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_ships
    ADD CONSTRAINT character_ships_character_id_ship_id_ownership_type_key UNIQUE (character_id, ship_id, ownership_type);


--
-- Name: character_ships character_ships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_ships
    ADD CONSTRAINT character_ships_pkey PRIMARY KEY (id);


--
-- Name: discord_webhook_logs discord_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_webhook_logs
    ADD CONSTRAINT discord_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: dkp_points dkp_points_loot_system_id_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_points
    ADD CONSTRAINT dkp_points_loot_system_id_character_id_key UNIQUE (loot_system_id, character_id);


--
-- Name: dkp_points dkp_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_points
    ADD CONSTRAINT dkp_points_pkey PRIMARY KEY (id);


--
-- Name: dkp_transactions dkp_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_transactions
    ADD CONSTRAINT dkp_transactions_pkey PRIMARY KEY (id);


--
-- Name: event_rsvps event_rsvps_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: event_rsvps event_rsvps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: freehold_buildings freehold_buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freehold_buildings
    ADD CONSTRAINT freehold_buildings_pkey PRIMARY KEY (id);


--
-- Name: freehold_schedules freehold_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freehold_schedules
    ADD CONSTRAINT freehold_schedules_pkey PRIMARY KEY (id);


--
-- Name: freeholds freeholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freeholds
    ADD CONSTRAINT freeholds_pkey PRIMARY KEY (id);


--
-- Name: game_ship_permissions game_ship_permissions_group_id_game_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_ship_permissions
    ADD CONSTRAINT game_ship_permissions_group_id_game_slug_key UNIQUE (group_id, game_slug);


--
-- Name: game_ship_permissions game_ship_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_ship_permissions
    ADD CONSTRAINT game_ship_permissions_pkey PRIMARY KEY (id);


--
-- Name: game_types game_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_types
    ADD CONSTRAINT game_types_pkey PRIMARY KEY (id);


--
-- Name: group_achievements group_achievements_group_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_group_id_achievement_id_key UNIQUE (group_id, achievement_id);


--
-- Name: group_achievements group_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_pkey PRIMARY KEY (id);


--
-- Name: group_admin_discord group_admin_discord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_admin_discord
    ADD CONSTRAINT group_admin_discord_pkey PRIMARY KEY (group_id);


--
-- Name: group_games group_games_group_id_game_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_games
    ADD CONSTRAINT group_games_group_id_game_slug_key UNIQUE (group_id, game_slug);


--
-- Name: group_games group_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_games
    ADD CONSTRAINT group_games_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: group_permission_overrides group_permission_overrides_group_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permission_overrides
    ADD CONSTRAINT group_permission_overrides_group_id_role_key UNIQUE (group_id, role);


--
-- Name: group_permission_overrides group_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permission_overrides
    ADD CONSTRAINT group_permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: groups groups_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_slug_key UNIQUE (slug);


--
-- Name: guest_event_rsvps guest_event_rsvps_event_id_allied_group_id_guest_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_event_rsvps
    ADD CONSTRAINT guest_event_rsvps_event_id_allied_group_id_guest_name_key UNIQUE (event_id, allied_group_id, guest_name);


--
-- Name: guest_event_rsvps guest_event_rsvps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_event_rsvps
    ADD CONSTRAINT guest_event_rsvps_pkey PRIMARY KEY (id);


--
-- Name: guest_event_rsvps guest_rsvp_unique_anonymous; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_event_rsvps
    ADD CONSTRAINT guest_rsvp_unique_anonymous UNIQUE NULLS NOT DISTINCT (event_id, guest_email, allied_group_id);


--
-- Name: guild_banks guild_banks_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guild_banks
    ADD CONSTRAINT guild_banks_group_id_key UNIQUE (group_id);


--
-- Name: guild_banks guild_banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guild_banks
    ADD CONSTRAINT guild_banks_pkey PRIMARY KEY (id);


--
-- Name: inactivity_alerts inactivity_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inactivity_alerts
    ADD CONSTRAINT inactivity_alerts_pkey PRIMARY KEY (id);


--
-- Name: loot_history loot_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_history
    ADD CONSTRAINT loot_history_pkey PRIMARY KEY (id);


--
-- Name: loot_systems loot_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_systems
    ADD CONSTRAINT loot_systems_pkey PRIMARY KEY (id);


--
-- Name: member_activity_summary member_activity_summary_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_activity_summary
    ADD CONSTRAINT member_activity_summary_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: member_activity_summary member_activity_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_activity_summary
    ADD CONSTRAINT member_activity_summary_pkey PRIMARY KEY (id);


--
-- Name: member_professions member_professions_member_id_profession_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_professions
    ADD CONSTRAINT member_professions_member_id_profession_key UNIQUE (member_id, profession);


--
-- Name: member_professions member_professions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_professions
    ADD CONSTRAINT member_professions_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: migration_history migration_history_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history
    ADD CONSTRAINT migration_history_filename_key UNIQUE (filename);


--
-- Name: migration_history migration_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_history
    ADD CONSTRAINT migration_history_pkey PRIMARY KEY (id);


--
-- Name: node_citizenships node_citizenships_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_citizenships
    ADD CONSTRAINT node_citizenships_character_id_key UNIQUE (character_id);


--
-- Name: node_citizenships node_citizenships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_citizenships
    ADD CONSTRAINT node_citizenships_pkey PRIMARY KEY (id);


--
-- Name: parties parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_pkey PRIMARY KEY (id);


--
-- Name: party_roster party_roster_party_id_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_roster
    ADD CONSTRAINT party_roster_party_id_character_id_key UNIQUE (party_id, character_id);


--
-- Name: party_roster party_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_roster
    ADD CONSTRAINT party_roster_pkey PRIMARY KEY (id);


--
-- Name: recruitment_applications recruitment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_pkey PRIMARY KEY (id);


--
-- Name: resource_catalog resource_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_catalog
    ADD CONSTRAINT resource_catalog_name_key UNIQUE (name);


--
-- Name: resource_catalog resource_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_catalog
    ADD CONSTRAINT resource_catalog_pkey PRIMARY KEY (id);


--
-- Name: resource_requests resource_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_pkey PRIMARY KEY (id);


--
-- Name: sc_loaner_matrix sc_loaner_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sc_loaner_matrix
    ADD CONSTRAINT sc_loaner_matrix_pkey PRIMARY KEY (id);


--
-- Name: sc_loaner_matrix sc_loaner_matrix_pledged_ship_loaner_ship_loaner_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sc_loaner_matrix
    ADD CONSTRAINT sc_loaner_matrix_pledged_ship_loaner_ship_loaner_type_key UNIQUE (pledged_ship, loaner_ship, loaner_type);


--
-- Name: siege_events siege_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_events
    ADD CONSTRAINT siege_events_pkey PRIMARY KEY (id);


--
-- Name: siege_roster siege_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_roster
    ADD CONSTRAINT siege_roster_pkey PRIMARY KEY (id);


--
-- Name: siege_roster siege_roster_siege_id_character_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_roster
    ADD CONSTRAINT siege_roster_siege_id_character_id_key UNIQUE (siege_id, character_id);


--
-- Name: site_admin_discord site_admin_discord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_admin_discord
    ADD CONSTRAINT site_admin_discord_pkey PRIMARY KEY (id);


--
-- Name: skill_definitions skill_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_definitions
    ADD CONSTRAINT skill_definitions_pkey PRIMARY KEY (id);


--
-- Name: user_games user_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_games
    ADD CONSTRAINT user_games_pkey PRIMARY KEY (id);


--
-- Name: user_games user_games_user_id_game_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_games
    ADD CONSTRAINT user_games_user_id_game_key UNIQUE (user_id, game);


--
-- Name: users users_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_discord_id_key UNIQUE (discord_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: admin_discord_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_discord_group_idx ON public.admin_discord_notifications USING btree (group_id, created_at DESC);


--
-- Name: admin_discord_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_discord_pending_idx ON public.admin_discord_notifications USING btree (available_at, created_at) WHERE (status = 'pending'::text);


--
-- Name: discord_webhook_logs_group_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discord_webhook_logs_group_created_idx ON public.discord_webhook_logs USING btree (group_id, created_at DESC);


--
-- Name: idx_achievement_definitions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievement_definitions_category ON public.achievement_definitions USING btree (category);


--
-- Name: idx_achievement_notifications_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievement_notifications_group ON public.achievement_notifications USING btree (group_id);


--
-- Name: idx_achievement_notifications_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievement_notifications_sent ON public.achievement_notifications USING btree (is_sent);


--
-- Name: idx_activity_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_created ON public.activity_log USING btree (created_at);


--
-- Name: idx_activity_log_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_group ON public.activity_log USING btree (group_id);


--
-- Name: idx_activity_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_type ON public.activity_log USING btree (activity_type);


--
-- Name: idx_activity_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id);


--
-- Name: idx_alliance_events_alliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliance_events_alliance ON public.alliance_events USING btree (alliance_id);


--
-- Name: idx_alliance_events_starts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliance_events_starts ON public.alliance_events USING btree (starts_at);


--
-- Name: idx_alliance_members_alliance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliance_members_alliance ON public.alliance_members USING btree (alliance_id);


--
-- Name: idx_alliance_members_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliance_members_group ON public.alliance_members USING btree (group_id);


--
-- Name: idx_alliance_members_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliance_members_status ON public.alliance_members USING btree (status);


--
-- Name: idx_alliances_leader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alliances_leader ON public.alliances USING btree (leader_group_id);


--
-- Name: idx_announcements_clan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_clan_id ON public.announcements USING btree (group_id);


--
-- Name: idx_announcements_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_pinned ON public.announcements USING btree (group_id, is_pinned) WHERE (is_pinned = true);


--
-- Name: idx_applications_game_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_game_slug ON public.recruitment_applications USING btree (game_slug);


--
-- Name: idx_applications_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_group ON public.recruitment_applications USING btree (group_id);


--
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_status ON public.recruitment_applications USING btree (status);


--
-- Name: idx_bank_inventory_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_inventory_bank ON public.bank_inventory USING btree (bank_id);


--
-- Name: idx_bank_inventory_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_inventory_resource ON public.bank_inventory USING btree (resource_id);


--
-- Name: idx_bank_transactions_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_bank ON public.bank_transactions USING btree (bank_id);


--
-- Name: idx_bank_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_created ON public.bank_transactions USING btree (created_at);


--
-- Name: idx_build_comments_build; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_comments_build ON public.build_comments USING btree (build_id);


--
-- Name: idx_build_likes_build; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_likes_build ON public.build_likes USING btree (build_id);


--
-- Name: idx_builds_archetype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_archetype ON public.builds USING btree (primary_archetype);


--
-- Name: idx_builds_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_creator ON public.builds USING btree (created_by);


--
-- Name: idx_builds_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_group ON public.builds USING btree (group_id);


--
-- Name: idx_builds_likes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_likes ON public.builds USING btree (likes_count DESC);


--
-- Name: idx_builds_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_tags ON public.builds USING gin (tags);


--
-- Name: idx_builds_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_builds_visibility ON public.builds USING btree (visibility);


--
-- Name: idx_caravan_escorts_caravan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_escorts_caravan ON public.caravan_escorts USING btree (caravan_id);


--
-- Name: idx_caravan_escorts_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_escorts_character ON public.caravan_escorts USING btree (character_id);


--
-- Name: idx_caravan_events_departure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_events_departure ON public.caravan_events USING btree (departure_at);


--
-- Name: idx_caravan_events_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_events_group ON public.caravan_events USING btree (group_id);


--
-- Name: idx_caravan_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_events_status ON public.caravan_events USING btree (status);


--
-- Name: idx_caravan_waypoints_caravan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caravan_waypoints_caravan ON public.caravan_waypoints USING btree (caravan_id);


--
-- Name: idx_character_ships_character_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_ships_character_id ON public.character_ships USING btree (character_id);


--
-- Name: idx_character_ships_ownership_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_character_ships_ownership_type ON public.character_ships USING btree (ownership_type);


--
-- Name: idx_clan_achievements_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_achievements_group ON public.group_achievements USING btree (group_id);


--
-- Name: idx_clan_achievements_unlocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_achievements_unlocked ON public.group_achievements USING btree (is_unlocked);


--
-- Name: idx_clan_members_clan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_members_clan_id ON public.group_members USING btree (group_id);


--
-- Name: idx_clan_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_members_user_id ON public.group_members USING btree (user_id);


--
-- Name: idx_clan_permission_overrides_clan_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clan_permission_overrides_clan_role ON public.group_permission_overrides USING btree (group_id, role);


--
-- Name: idx_dkp_points_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dkp_points_character ON public.dkp_points USING btree (character_id);


--
-- Name: idx_dkp_points_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dkp_points_system ON public.dkp_points USING btree (loot_system_id);


--
-- Name: idx_dkp_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dkp_transactions_created ON public.dkp_transactions USING btree (created_at);


--
-- Name: idx_dkp_transactions_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dkp_transactions_points ON public.dkp_transactions USING btree (dkp_points_id);


--
-- Name: idx_event_rsvps_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps USING btree (event_id);


--
-- Name: idx_event_rsvps_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_rsvps_user_id ON public.event_rsvps USING btree (user_id);


--
-- Name: idx_events_clan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_clan_id ON public.events USING btree (group_id);


--
-- Name: idx_events_game_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_game_slug ON public.events USING btree (game_slug);


--
-- Name: idx_events_group_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_group_game ON public.events USING btree (group_id, game_slug);


--
-- Name: idx_events_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_starts_at ON public.events USING btree (starts_at);


--
-- Name: idx_freehold_buildings_freehold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freehold_buildings_freehold ON public.freehold_buildings USING btree (freehold_id);


--
-- Name: idx_freehold_buildings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freehold_buildings_type ON public.freehold_buildings USING btree (building_type);


--
-- Name: idx_freehold_schedules_freehold; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freehold_schedules_freehold ON public.freehold_schedules USING btree (freehold_id);


--
-- Name: idx_freeholds_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freeholds_group ON public.freeholds USING btree (group_id);


--
-- Name: idx_freeholds_node; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freeholds_node ON public.freeholds USING btree (node_name);


--
-- Name: idx_freeholds_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freeholds_owner ON public.freeholds USING btree (owner_id);


--
-- Name: idx_game_ship_permissions_group_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_ship_permissions_group_game ON public.game_ship_permissions USING btree (group_id, game_slug);


--
-- Name: idx_group_games_game_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_games_game_slug ON public.group_games USING btree (game_slug);


--
-- Name: idx_group_games_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_games_group_id ON public.group_games USING btree (group_id);


--
-- Name: idx_groups_aoc_recruitment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_aoc_recruitment ON public.groups USING btree (aoc_recruitment_open) WHERE (aoc_recruitment_open = true);


--
-- Name: idx_groups_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_game ON public.groups USING btree (game);


--
-- Name: idx_groups_ror_recruitment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_ror_recruitment ON public.groups USING btree (ror_recruitment_open) WHERE (ror_recruitment_open = true);


--
-- Name: idx_groups_sc_recruitment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_sc_recruitment ON public.groups USING btree (sc_recruitment_open) WHERE (sc_recruitment_open = true);


--
-- Name: idx_groups_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_slug ON public.groups USING btree (slug);


--
-- Name: idx_guest_event_rsvps_allied_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_event_rsvps_allied_group ON public.guest_event_rsvps USING btree (allied_group_id);


--
-- Name: idx_guest_event_rsvps_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guest_event_rsvps_event ON public.guest_event_rsvps USING btree (event_id);


--
-- Name: idx_guild_banks_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_guild_banks_group ON public.guild_banks USING btree (group_id);


--
-- Name: idx_inactivity_alerts_ack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inactivity_alerts_ack ON public.inactivity_alerts USING btree (is_acknowledged);


--
-- Name: idx_inactivity_alerts_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inactivity_alerts_group ON public.inactivity_alerts USING btree (group_id);


--
-- Name: idx_loot_history_awarded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loot_history_awarded ON public.loot_history USING btree (awarded_to);


--
-- Name: idx_loot_history_dropped; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loot_history_dropped ON public.loot_history USING btree (dropped_at);


--
-- Name: idx_loot_history_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loot_history_system ON public.loot_history USING btree (loot_system_id);


--
-- Name: idx_loot_systems_active_per_group; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_loot_systems_active_per_group ON public.loot_systems USING btree (group_id) WHERE (is_active = true);


--
-- Name: idx_loot_systems_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loot_systems_group ON public.loot_systems USING btree (group_id);


--
-- Name: idx_member_activity_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_activity_group ON public.member_activity_summary USING btree (group_id);


--
-- Name: idx_member_activity_inactive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_activity_inactive ON public.member_activity_summary USING btree (is_inactive);


--
-- Name: idx_member_professions_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_member_professions_member_id ON public.member_professions USING btree (member_id);


--
-- Name: idx_members_clan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_clan_id ON public.members USING btree (group_id);


--
-- Name: idx_members_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_discord_id ON public.members USING btree (discord_id);


--
-- Name: idx_members_game_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_game_slug ON public.members USING btree (game_slug);


--
-- Name: idx_members_group_discord_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_group_discord_id ON public.members USING btree (group_id, discord_id);


--
-- Name: idx_members_group_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_group_game ON public.members USING btree (group_id, game_slug);


--
-- Name: idx_members_one_main_per_user_game; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_members_one_main_per_user_game ON public.members USING btree (group_id, user_id, game_slug) WHERE ((is_main = true) AND (user_id IS NOT NULL));


--
-- Name: idx_members_subscriber_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_subscriber_tier ON public.members USING btree (subscriber_tier) WHERE (subscriber_tier IS NOT NULL);


--
-- Name: idx_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_members_user_id ON public.members USING btree (user_id);


--
-- Name: idx_node_citizenships_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_citizenships_character ON public.node_citizenships USING btree (character_id);


--
-- Name: idx_node_citizenships_node_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_citizenships_node_name ON public.node_citizenships USING btree (node_name);


--
-- Name: idx_node_citizenships_node_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_node_citizenships_node_type ON public.node_citizenships USING btree (node_type);


--
-- Name: idx_parties_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parties_group ON public.parties USING btree (group_id);


--
-- Name: idx_party_roster_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_roster_character ON public.party_roster USING btree (character_id);


--
-- Name: idx_party_roster_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_roster_party ON public.party_roster USING btree (party_id);


--
-- Name: idx_resource_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_catalog_category ON public.resource_catalog USING btree (category);


--
-- Name: idx_resource_requests_bank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_requests_bank ON public.resource_requests USING btree (bank_id);


--
-- Name: idx_resource_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_requests_status ON public.resource_requests USING btree (status);


--
-- Name: idx_sc_loaner_matrix_loaner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sc_loaner_matrix_loaner ON public.sc_loaner_matrix USING btree (loaner_ship);


--
-- Name: idx_sc_loaner_matrix_pledged; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sc_loaner_matrix_pledged ON public.sc_loaner_matrix USING btree (pledged_ship);


--
-- Name: idx_siege_events_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_events_group ON public.siege_events USING btree (group_id);


--
-- Name: idx_siege_events_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_events_starts_at ON public.siege_events USING btree (starts_at);


--
-- Name: idx_siege_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_events_type ON public.siege_events USING btree (siege_type);


--
-- Name: idx_siege_roster_character; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_roster_character ON public.siege_roster USING btree (character_id);


--
-- Name: idx_siege_roster_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_roster_role ON public.siege_roster USING btree (role);


--
-- Name: idx_siege_roster_siege; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_siege_roster_siege ON public.siege_roster USING btree (siege_id);


--
-- Name: idx_user_games_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_games_game ON public.user_games USING btree (game);


--
-- Name: idx_user_games_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_games_user_id ON public.user_games USING btree (user_id);


--
-- Name: admin_discord_notifications admin_discord_category; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_category BEFORE INSERT ON public.admin_discord_notifications FOR EACH ROW EXECUTE FUNCTION public.filter_admin_discord_category();


--
-- Name: group_admin_discord admin_discord_configuration_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_configuration_change AFTER INSERT OR UPDATE ON public.group_admin_discord FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();


--
-- Name: groups admin_discord_group_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_group_change AFTER INSERT OR DELETE OR UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();


--
-- Name: group_members admin_discord_membership_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_membership_change AFTER INSERT OR DELETE OR UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();


--
-- Name: admin_discord_notifications admin_discord_mention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_mention BEFORE INSERT ON public.admin_discord_notifications FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_mention();


--
-- Name: users admin_discord_new_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_new_account AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();


--
-- Name: group_permission_overrides admin_discord_permissions_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_discord_permissions_change AFTER INSERT OR DELETE OR UPDATE ON public.group_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.capture_admin_discord_change();


--
-- Name: character_ships trigger_add_loaner_ships; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_add_loaner_ships AFTER INSERT ON public.character_ships FOR EACH ROW EXECUTE FUNCTION public.add_loaner_ships_for_pledge();


--
-- Name: character_ships trigger_remove_loaner_ships; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_remove_loaner_ships BEFORE DELETE ON public.character_ships FOR EACH ROW EXECUTE FUNCTION public.remove_loaner_ships_for_pledge();


--
-- Name: character_ships update_character_ships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_character_ships_updated_at BEFORE UPDATE ON public.character_ships FOR EACH ROW EXECUTE FUNCTION public.update_character_ships_updated_at();


--
-- Name: game_ship_permissions update_game_ship_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_game_ship_permissions_updated_at BEFORE UPDATE ON public.game_ship_permissions FOR EACH ROW EXECUTE FUNCTION public.update_game_ship_permissions_updated_at();


--
-- Name: achievement_notifications achievement_notifications_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_notifications
    ADD CONSTRAINT achievement_notifications_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE CASCADE;


--
-- Name: achievement_notifications achievement_notifications_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_notifications
    ADD CONSTRAINT achievement_notifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_related_caravan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_related_caravan_id_fkey FOREIGN KEY (related_caravan_id) REFERENCES public.caravan_events(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_related_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_related_siege_id_fkey FOREIGN KEY (related_siege_id) REFERENCES public.siege_events(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_discord_notifications admin_discord_notifications_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_discord_notifications
    ADD CONSTRAINT admin_discord_notifications_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.admin_discord_destinations(id);


--
-- Name: alliance_event_participation alliance_event_participation_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_event_participation
    ADD CONSTRAINT alliance_event_participation_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.alliance_events(id) ON DELETE CASCADE;


--
-- Name: alliance_event_participation alliance_event_participation_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_event_participation
    ADD CONSTRAINT alliance_event_participation_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: alliance_events alliance_events_alliance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_events
    ADD CONSTRAINT alliance_events_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES public.alliances(id) ON DELETE CASCADE;


--
-- Name: alliance_events alliance_events_created_by_group_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_events
    ADD CONSTRAINT alliance_events_created_by_group_fkey FOREIGN KEY (created_by_group) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: alliance_events alliance_events_created_by_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_events
    ADD CONSTRAINT alliance_events_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: alliance_members alliance_members_alliance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_members
    ADD CONSTRAINT alliance_members_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES public.alliances(id) ON DELETE CASCADE;


--
-- Name: alliance_members alliance_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_members
    ADD CONSTRAINT alliance_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: alliance_members alliance_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliance_members
    ADD CONSTRAINT alliance_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.groups(id);


--
-- Name: alliances alliances_leader_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alliances
    ADD CONSTRAINT alliances_leader_group_id_fkey FOREIGN KEY (leader_group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: bank_inventory bank_inventory_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_inventory
    ADD CONSTRAINT bank_inventory_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.guild_banks(id) ON DELETE CASCADE;


--
-- Name: bank_inventory bank_inventory_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_inventory
    ADD CONSTRAINT bank_inventory_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_catalog(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.guild_banks(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_related_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_related_siege_id_fkey FOREIGN KEY (related_siege_id) REFERENCES public.siege_events(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_catalog(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: build_comments build_comments_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_comments
    ADD CONSTRAINT build_comments_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.builds(id) ON DELETE CASCADE;


--
-- Name: build_comments build_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_comments
    ADD CONSTRAINT build_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.build_comments(id) ON DELETE CASCADE;


--
-- Name: build_comments build_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_comments
    ADD CONSTRAINT build_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: build_likes build_likes_build_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_likes
    ADD CONSTRAINT build_likes_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.builds(id) ON DELETE CASCADE;


--
-- Name: build_likes build_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_likes
    ADD CONSTRAINT build_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: builds builds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.builds
    ADD CONSTRAINT builds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: builds builds_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.builds
    ADD CONSTRAINT builds_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: caravan_escorts caravan_escorts_caravan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_escorts
    ADD CONSTRAINT caravan_escorts_caravan_id_fkey FOREIGN KEY (caravan_id) REFERENCES public.caravan_events(id) ON DELETE CASCADE;


--
-- Name: caravan_escorts caravan_escorts_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_escorts
    ADD CONSTRAINT caravan_escorts_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: caravan_escorts caravan_escorts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_escorts
    ADD CONSTRAINT caravan_escorts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: caravan_events caravan_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_events
    ADD CONSTRAINT caravan_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: caravan_events caravan_events_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_events
    ADD CONSTRAINT caravan_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: caravan_events caravan_events_owner_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_events
    ADD CONSTRAINT caravan_events_owner_character_id_fkey FOREIGN KEY (owner_character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: caravan_waypoints caravan_waypoints_caravan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caravan_waypoints
    ADD CONSTRAINT caravan_waypoints_caravan_id_fkey FOREIGN KEY (caravan_id) REFERENCES public.caravan_events(id) ON DELETE CASCADE;


--
-- Name: character_ships character_ships_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.character_ships
    ADD CONSTRAINT character_ships_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: discord_webhook_logs discord_webhook_logs_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discord_webhook_logs
    ADD CONSTRAINT discord_webhook_logs_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: dkp_points dkp_points_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_points
    ADD CONSTRAINT dkp_points_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: dkp_points dkp_points_loot_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_points
    ADD CONSTRAINT dkp_points_loot_system_id_fkey FOREIGN KEY (loot_system_id) REFERENCES public.loot_systems(id) ON DELETE CASCADE;


--
-- Name: dkp_transactions dkp_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_transactions
    ADD CONSTRAINT dkp_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dkp_transactions dkp_transactions_dkp_points_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_transactions
    ADD CONSTRAINT dkp_transactions_dkp_points_id_fkey FOREIGN KEY (dkp_points_id) REFERENCES public.dkp_points(id) ON DELETE CASCADE;


--
-- Name: dkp_transactions dkp_transactions_loot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_transactions
    ADD CONSTRAINT dkp_transactions_loot_id_fkey FOREIGN KEY (loot_id) REFERENCES public.loot_history(id) ON DELETE SET NULL;


--
-- Name: dkp_transactions dkp_transactions_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dkp_transactions
    ADD CONSTRAINT dkp_transactions_siege_id_fkey FOREIGN KEY (siege_id) REFERENCES public.siege_events(id) ON DELETE SET NULL;


--
-- Name: event_rsvps event_rsvps_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: event_rsvps event_rsvps_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_rsvps event_rsvps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: events events_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: groups fk_groups_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: freehold_buildings freehold_buildings_freehold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freehold_buildings
    ADD CONSTRAINT freehold_buildings_freehold_id_fkey FOREIGN KEY (freehold_id) REFERENCES public.freeholds(id) ON DELETE CASCADE;


--
-- Name: freehold_schedules freehold_schedules_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freehold_schedules
    ADD CONSTRAINT freehold_schedules_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.freehold_buildings(id) ON DELETE CASCADE;


--
-- Name: freehold_schedules freehold_schedules_freehold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freehold_schedules
    ADD CONSTRAINT freehold_schedules_freehold_id_fkey FOREIGN KEY (freehold_id) REFERENCES public.freeholds(id) ON DELETE CASCADE;


--
-- Name: freeholds freeholds_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freeholds
    ADD CONSTRAINT freeholds_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: freeholds freeholds_owner_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freeholds
    ADD CONSTRAINT freeholds_owner_character_id_fkey FOREIGN KEY (owner_character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: freeholds freeholds_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freeholds
    ADD CONSTRAINT freeholds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: game_ship_permissions game_ship_permissions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_ship_permissions
    ADD CONSTRAINT game_ship_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_achievements group_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievement_definitions(id) ON DELETE CASCADE;


--
-- Name: group_achievements group_achievements_first_contributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_first_contributor_id_fkey FOREIGN KEY (first_contributor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: group_achievements group_achievements_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_admin_discord group_admin_discord_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_admin_discord
    ADD CONSTRAINT group_admin_discord_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.admin_discord_destinations(id);


--
-- Name: group_games group_games_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_games
    ADD CONSTRAINT group_games_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: group_permission_overrides group_permission_overrides_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permission_overrides
    ADD CONSTRAINT group_permission_overrides_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: guest_event_rsvps guest_event_rsvps_allied_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_event_rsvps
    ADD CONSTRAINT guest_event_rsvps_allied_group_id_fkey FOREIGN KEY (allied_group_id) REFERENCES public.groups(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: guest_event_rsvps guest_event_rsvps_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_event_rsvps
    ADD CONSTRAINT guest_event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: guild_banks guild_banks_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guild_banks
    ADD CONSTRAINT guild_banks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: inactivity_alerts inactivity_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inactivity_alerts
    ADD CONSTRAINT inactivity_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- Name: inactivity_alerts inactivity_alerts_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inactivity_alerts
    ADD CONSTRAINT inactivity_alerts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: inactivity_alerts inactivity_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inactivity_alerts
    ADD CONSTRAINT inactivity_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: loot_history loot_history_awarded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_history
    ADD CONSTRAINT loot_history_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loot_history loot_history_awarded_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_history
    ADD CONSTRAINT loot_history_awarded_to_fkey FOREIGN KEY (awarded_to) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: loot_history loot_history_loot_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_history
    ADD CONSTRAINT loot_history_loot_system_id_fkey FOREIGN KEY (loot_system_id) REFERENCES public.loot_systems(id) ON DELETE CASCADE;


--
-- Name: loot_history loot_history_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_history
    ADD CONSTRAINT loot_history_siege_id_fkey FOREIGN KEY (siege_id) REFERENCES public.siege_events(id) ON DELETE SET NULL;


--
-- Name: loot_systems loot_systems_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loot_systems
    ADD CONSTRAINT loot_systems_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: member_activity_summary member_activity_summary_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_activity_summary
    ADD CONSTRAINT member_activity_summary_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: member_activity_summary member_activity_summary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_activity_summary
    ADD CONSTRAINT member_activity_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: member_professions member_professions_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_professions
    ADD CONSTRAINT member_professions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: members members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: node_citizenships node_citizenships_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_citizenships
    ADD CONSTRAINT node_citizenships_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: parties parties_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: parties parties_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parties
    ADD CONSTRAINT parties_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: party_roster party_roster_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_roster
    ADD CONSTRAINT party_roster_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: party_roster party_roster_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_roster
    ADD CONSTRAINT party_roster_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE CASCADE;


--
-- Name: recruitment_applications recruitment_applications_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: recruitment_applications recruitment_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: recruitment_applications recruitment_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: resource_requests resource_requests_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.guild_banks(id) ON DELETE CASCADE;


--
-- Name: resource_requests resource_requests_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: resource_requests resource_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: resource_requests resource_requests_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource_catalog(id) ON DELETE CASCADE;


--
-- Name: resource_requests resource_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_requests
    ADD CONSTRAINT resource_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: siege_events siege_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_events
    ADD CONSTRAINT siege_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: siege_events siege_events_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_events
    ADD CONSTRAINT siege_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: siege_roster siege_roster_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_roster
    ADD CONSTRAINT siege_roster_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: siege_roster siege_roster_siege_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_roster
    ADD CONSTRAINT siege_roster_siege_id_fkey FOREIGN KEY (siege_id) REFERENCES public.siege_events(id) ON DELETE CASCADE;


--
-- Name: siege_roster siege_roster_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.siege_roster
    ADD CONSTRAINT siege_roster_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: site_admin_discord site_admin_discord_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_admin_discord
    ADD CONSTRAINT site_admin_discord_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.admin_discord_destinations(id);


--
-- Name: user_games user_games_game_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_games
    ADD CONSTRAINT user_games_game_fkey FOREIGN KEY (game) REFERENCES public.game_types(id) ON DELETE CASCADE;


--
-- Name: user_games user_games_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_games
    ADD CONSTRAINT user_games_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: guest_event_rsvps API can create guest RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "API can create guest RSVPs" ON public.guest_event_rsvps FOR INSERT WITH CHECK (true);


--
-- Name: groups Admin can delete group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can delete group" ON public.groups FOR DELETE USING (public.user_has_clan_role(id, auth.uid(), ARRAY['admin'::text]));


--
-- Name: POLICY "Admin can delete group" ON groups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Admin can delete group" ON public.groups IS 'Only group admins can delete their groups';


--
-- Name: groups Admin can update clan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can update clan" ON public.groups FOR UPDATE USING (public.user_has_clan_role(id, auth.uid(), ARRAY['admin'::text]));


--
-- Name: character_ships Admins and officers can manage character ships in their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and officers can manage character ships in their groups" ON public.character_ships USING ((EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.group_members gm ON ((gm.user_id = auth.uid())))
  WHERE ((m.id = character_ships.character_id) AND (gm.group_id = m.group_id) AND ((gm.role)::text = ANY (ARRAY[('admin'::character varying)::text, ('officer'::character varying)::text]))))));


--
-- Name: guest_event_rsvps Admins can delete guest RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete guest RSVPs" ON public.guest_event_rsvps FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = guest_event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: group_games Admins can manage group games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage group games" ON public.group_games USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text])) WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text]));


--
-- Name: guest_event_rsvps Admins can manage guest RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage guest RSVPs" ON public.guest_event_rsvps FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = guest_event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: game_ship_permissions Admins can manage ship permissions in their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ship permissions in their groups" ON public.game_ship_permissions USING ((EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = game_ship_permissions.group_id) AND (group_members.user_id = auth.uid()) AND ((group_members.role)::text = 'admin'::text)))));


--
-- Name: alliances Alliance members can view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alliance members can view" ON public.alliances FOR SELECT USING ((is_public OR public.user_in_alliance(id, auth.uid())));


--
-- Name: alliance_events Alliance members can view events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alliance members can view events" ON public.alliance_events FOR SELECT USING (public.user_in_alliance(alliance_id, auth.uid()));


--
-- Name: alliance_event_participation Alliance members can view participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alliance members can view participation" ON public.alliance_event_participation FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.alliance_events ae
  WHERE ((ae.id = alliance_event_participation.event_id) AND public.user_in_alliance(ae.alliance_id, auth.uid())))));


--
-- Name: event_rsvps Allied group members can RSVP to events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allied group members can RSVP to events" ON public.event_rsvps FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND (e.allow_allied_signups = true) AND public.user_in_group_or_allied_group(e.group_id, auth.uid())))));


--
-- Name: guest_event_rsvps Allied members can view guest RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allied members can view guest RSVPs" ON public.guest_event_rsvps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = guest_event_rsvps.event_id) AND public.user_in_group_or_allied_group(e.group_id, auth.uid())))));


--
-- Name: guest_event_rsvps Anyone can RSVP to public events as guest; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can RSVP to public events as guest" ON public.guest_event_rsvps FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = guest_event_rsvps.event_id) AND (e.is_public = true)))));


--
-- Name: group_members Anyone can apply to clan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can apply to clan" ON public.group_members FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND ((role)::text = 'pending'::text)));


--
-- Name: groups Anyone can create clan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create clan" ON public.groups FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: recruitment_applications Anyone can submit applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit applications" ON public.recruitment_applications FOR INSERT WITH CHECK (true);


--
-- Name: event_rsvps Anyone can view RSVPs for public events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view RSVPs for public events" ON public.event_rsvps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND (e.is_public = true)))));


--
-- Name: groups Anyone can view groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view groups" ON public.groups FOR SELECT USING (true);


--
-- Name: members Approved members can add characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members can add characters" ON public.members FOR INSERT WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: members Approved members can view members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members can view members" ON public.members FOR SELECT USING ((public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]) OR ((NULLIF(public.current_user_discord_id(), ''::text) IS NOT NULL) AND public.user_has_clan_role_by_discord(group_id, public.current_user_discord_id(), ARRAY['admin'::text, 'officer'::text, 'member'::text]))));


--
-- Name: POLICY "Approved members can view members" ON members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Approved members can view members" ON public.members IS 'Members can view other members in their group via auth UUID (primary) or Discord ID (fallback for restored auth).';


--
-- Name: users Auth can insert user on signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth can insert user on signup" ON public.users FOR INSERT WITH CHECK ((id = auth.uid()));


--
-- Name: alliance_events Authorized members can manage events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized members can manage events" ON public.alliance_events USING ((EXISTS ( SELECT 1
   FROM (public.alliance_members am
     JOIN public.group_members cm ON ((cm.group_id = am.group_id)))
  WHERE ((am.alliance_id = alliance_events.alliance_id) AND (am.can_create_events = true) AND (cm.user_id = auth.uid())))));


--
-- Name: activity_log Can log own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can log own activity" ON public.activity_log FOR INSERT WITH CHECK (((user_id = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])));


--
-- Name: alliance_event_participation Clan officers can update participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clan officers can update participation" ON public.alliance_event_participation USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: build_comments Comments visible with build; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comments visible with build" ON public.build_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.builds b
  WHERE ((b.id = build_comments.build_id) AND ((b.visibility = 'public'::public.build_visibility) OR (b.created_by = auth.uid()) OR ((b.visibility = 'guild'::public.build_visibility) AND (b.group_id IS NOT NULL) AND public.user_has_clan_role(b.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))))));


--
-- Name: caravan_events Creators and officers can delete caravans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and officers can delete caravans" ON public.caravan_events FOR DELETE USING (((created_by = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])));


--
-- Name: caravan_events Creators and officers can update caravans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators and officers can update caravans" ON public.caravan_events FOR UPDATE USING (((created_by = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])));


--
-- Name: caravan_waypoints Creators can manage waypoints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage waypoints" ON public.caravan_waypoints USING ((EXISTS ( SELECT 1
   FROM public.caravan_events ce
  WHERE ((ce.id = caravan_waypoints.caravan_id) AND ((ce.created_by = auth.uid()) OR public.user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]))))));


--
-- Name: achievement_definitions Everyone can view achievement definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view achievement definitions" ON public.achievement_definitions FOR SELECT USING (true);


--
-- Name: augment_definitions Everyone can view augments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view augments" ON public.augment_definitions FOR SELECT USING (true);


--
-- Name: sc_loaner_matrix Everyone can view loaner matrix; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view loaner matrix" ON public.sc_loaner_matrix FOR SELECT TO authenticated USING (true);


--
-- Name: resource_catalog Everyone can view resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view resources" ON public.resource_catalog FOR SELECT USING (true);


--
-- Name: skill_definitions Everyone can view skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view skills" ON public.skill_definitions FOR SELECT USING (true);


--
-- Name: freehold_buildings Freehold owners can manage buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Freehold owners can manage buildings" ON public.freehold_buildings USING ((EXISTS ( SELECT 1
   FROM public.freeholds f
  WHERE ((f.id = freehold_buildings.freehold_id) AND (f.owner_id = auth.uid())))));


--
-- Name: freehold_schedules Freehold owners can manage schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Freehold owners can manage schedules" ON public.freehold_schedules USING ((EXISTS ( SELECT 1
   FROM public.freeholds f
  WHERE ((f.id = freehold_schedules.freehold_id) AND (f.owner_id = auth.uid())))));


--
-- Name: events Group members and public can view events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members and public can view events" ON public.events FOR SELECT USING (((is_public = true) OR public.user_in_group_or_allied_group(group_id, auth.uid())));


--
-- Name: event_rsvps Group members can create RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can create RSVPs" ON public.event_rsvps FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: announcements Group members can create announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can create announcements" ON public.announcements FOR INSERT WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: members Group members can create characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can create characters" ON public.members FOR INSERT WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: events Group members can create events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can create events" ON public.events FOR INSERT WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: announcements Group members can delete announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can delete announcements" ON public.announcements FOR DELETE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: members Group members can delete characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can delete characters" ON public.members FOR DELETE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: events Group members can delete events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can delete events" ON public.events FOR DELETE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: guild_banks Group members can manage bank; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can manage bank" ON public.guild_banks USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: bank_inventory Group members can manage inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can manage inventory" ON public.bank_inventory USING ((EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = bank_inventory.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: parties Group members can manage parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can manage parties" ON public.parties USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: party_roster Group members can manage roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can manage roster" ON public.party_roster USING (public.user_has_clan_role(( SELECT parties.group_id
   FROM public.parties
  WHERE (parties.id = party_roster.party_id)), auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: siege_events Group members can manage sieges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can manage sieges" ON public.siege_events USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: member_professions Group members can modify professions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can modify professions" ON public.member_professions USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = member_professions.member_id) AND public.user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: resource_requests Group members can review requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can review requests" ON public.resource_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = resource_requests.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: event_rsvps Group members can update RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can update RSVPs" ON public.event_rsvps FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: announcements Group members can update announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can update announcements" ON public.announcements FOR UPDATE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: recruitment_applications Group members can update applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can update applications" ON public.recruitment_applications FOR UPDATE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: members Group members can update characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can update characters" ON public.members FOR UPDATE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: events Group members can update events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can update events" ON public.events FOR UPDATE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: dkp_points Group members can view DKP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view DKP" ON public.dkp_points FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.loot_systems ls
  WHERE ((ls.id = dkp_points.loot_system_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: event_rsvps Group members can view RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view RSVPs" ON public.event_rsvps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND public.user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])))));


--
-- Name: group_achievements Group members can view achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view achievements" ON public.group_achievements FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: announcements Group members can view announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view announcements" ON public.announcements FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: recruitment_applications Group members can view applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view applications" ON public.recruitment_applications FOR SELECT USING (((user_id = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text])));


--
-- Name: guild_banks Group members can view bank; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view bank" ON public.guild_banks FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: freehold_buildings Group members can view buildings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view buildings" ON public.freehold_buildings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.freeholds f
  WHERE ((f.id = freehold_buildings.freehold_id) AND public.user_has_clan_role(f.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: caravan_events Group members can view caravans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view caravans" ON public.caravan_events FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: node_citizenships Group members can view citizenships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view citizenships" ON public.node_citizenships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = node_citizenships.character_id) AND public.user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: caravan_escorts Group members can view escorts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view escorts" ON public.caravan_escorts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.caravan_events ce
  WHERE ((ce.id = caravan_escorts.caravan_id) AND public.user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: events Group members can view events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view events" ON public.events FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text, 'trial'::text]));


--
-- Name: freeholds Group members can view freeholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view freeholds" ON public.freeholds FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: bank_inventory Group members can view inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view inventory" ON public.bank_inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = bank_inventory.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: loot_history Group members can view loot history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view loot history" ON public.loot_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.loot_systems ls
  WHERE ((ls.id = loot_history.loot_system_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: loot_systems Group members can view loot systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view loot systems" ON public.loot_systems FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: parties Group members can view parties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view parties" ON public.parties FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: party_roster Group members can view roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view roster" ON public.party_roster FOR SELECT USING (public.user_has_clan_role(( SELECT parties.group_id
   FROM public.parties
  WHERE (parties.id = party_roster.party_id)), auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: freehold_schedules Group members can view schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view schedules" ON public.freehold_schedules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.freeholds f
  WHERE ((f.id = freehold_schedules.freehold_id) AND public.user_has_clan_role(f.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: siege_events Group members can view sieges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view sieges" ON public.siege_events FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: dkp_transactions Group members can view transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view transactions" ON public.dkp_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.dkp_points dp
     JOIN public.loot_systems ls ON ((ls.id = dp.loot_system_id)))
  WHERE ((dp.id = dkp_transactions.dkp_points_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: caravan_waypoints Group members can view waypoints; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view waypoints" ON public.caravan_waypoints FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.caravan_events ce
  WHERE ((ce.id = caravan_waypoints.caravan_id) AND public.user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: alliances Leader can manage alliance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leader can manage alliance" ON public.alliances USING (public.user_has_clan_role(leader_group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: alliance_members Leader can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leader can manage memberships" ON public.alliance_members USING ((EXISTS ( SELECT 1
   FROM public.alliances a
  WHERE ((a.id = alliance_members.alliance_id) AND public.user_has_clan_role(a.leader_group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: caravan_events Members can create caravans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can create caravans" ON public.caravan_events FOR INSERT WITH CHECK (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]));


--
-- Name: resource_requests Members can create requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can create requests" ON public.resource_requests FOR INSERT WITH CHECK (((requested_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = resource_requests.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]))))));


--
-- Name: bank_transactions Members can create transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can create transactions" ON public.bank_transactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = bank_transactions.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text])))));


--
-- Name: members Members can delete own characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can delete own characters" ON public.members FOR DELETE USING (((user_id = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])));


--
-- Name: member_professions Members can modify own character professions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can modify own character professions" ON public.member_professions USING (((member_id IN ( SELECT m.id
   FROM public.members m
  WHERE (m.user_id = auth.uid()))) OR ((NULLIF(public.current_user_discord_id(), ''::text) IS NOT NULL) AND (member_id IN ( SELECT m.id
   FROM public.members m
  WHERE (m.discord_id = public.current_user_discord_id())))) OR (member_id IN ( SELECT m.id
   FROM public.members m
  WHERE public.user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: POLICY "Members can modify own character professions" ON member_professions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Members can modify own character professions" ON public.member_professions IS 'Members can manage professions for their own characters (via user_id or Discord ID) or admins can manage all.';


--
-- Name: caravan_escorts Members can sign up for escort; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can sign up for escort" ON public.caravan_escorts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.caravan_events ce ON ((ce.group_id = m.group_id)))
  WHERE ((m.id = caravan_escorts.character_id) AND (ce.id = caravan_escorts.caravan_id) AND (m.user_id = auth.uid())))));


--
-- Name: siege_roster Members can sign up own characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can sign up own characters" ON public.siege_roster FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.siege_events se ON ((se.group_id = m.group_id)))
  WHERE ((m.id = siege_roster.character_id) AND (se.id = siege_roster.siege_id) AND (m.user_id = auth.uid())))));


--
-- Name: members Members can update own characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own characters" ON public.members FOR UPDATE USING (((user_id = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])));


--
-- Name: caravan_escorts Members can update own escort signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own escort signup" ON public.caravan_escorts FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: siege_roster Members can update own signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update own signup" ON public.siege_roster FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: alliance_members Members can view alliance memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view alliance memberships" ON public.alliance_members FOR SELECT USING (public.user_in_alliance(alliance_id, auth.uid()));


--
-- Name: guest_event_rsvps Members can view guest RSVPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view guest RSVPs" ON public.guest_event_rsvps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = guest_event_rsvps.event_id) AND public.user_in_group_or_allied_group(e.group_id, auth.uid())))));


--
-- Name: member_activity_summary Members can view own summary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own summary" ON public.member_activity_summary FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: caravan_escorts Members can withdraw from escort; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can withdraw from escort" ON public.caravan_escorts FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.caravan_events ce
  WHERE ((ce.id = caravan_escorts.caravan_id) AND public.user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]))))));


--
-- Name: siege_roster Members can withdraw or officers manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can withdraw or officers manage" ON public.siege_roster FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.siege_events se
  WHERE ((se.id = siege_roster.siege_id) AND public.user_has_clan_role(se.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]))))));


--
-- Name: dkp_points Officers can manage DKP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage DKP" ON public.dkp_points USING ((EXISTS ( SELECT 1
   FROM public.loot_systems ls
  WHERE ((ls.id = dkp_points.loot_system_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: inactivity_alerts Officers can manage alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage alerts" ON public.inactivity_alerts USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: freeholds Officers can manage all freeholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage all freeholds" ON public.freeholds USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: node_citizenships Officers can manage clan citizenships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage clan citizenships" ON public.node_citizenships USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = node_citizenships.character_id) AND public.user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: loot_history Officers can manage loot history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage loot history" ON public.loot_history USING ((EXISTS ( SELECT 1
   FROM public.loot_systems ls
  WHERE ((ls.id = loot_history.loot_system_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: loot_systems Officers can manage loot systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage loot systems" ON public.loot_systems USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: achievement_notifications Officers can manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage notifications" ON public.achievement_notifications USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: dkp_transactions Officers can manage transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can manage transactions" ON public.dkp_transactions USING ((EXISTS ( SELECT 1
   FROM (public.dkp_points dp
     JOIN public.loot_systems ls ON ((ls.id = dp.loot_system_id)))
  WHERE ((dp.id = dkp_transactions.dkp_points_id) AND public.user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text])))));


--
-- Name: activity_log Officers can view activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can view activity log" ON public.activity_log FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: member_activity_summary Officers can view activity summary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can view activity summary" ON public.member_activity_summary FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: inactivity_alerts Officers can view alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can view alerts" ON public.inactivity_alerts FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: achievement_notifications Officers can view notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Officers can view notifications" ON public.achievement_notifications FOR SELECT USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: sc_loaner_matrix Only service role can update loaner matrix; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can update loaner matrix" ON public.sc_loaner_matrix USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: builds Owners can manage builds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage builds" ON public.builds USING ((created_by = auth.uid()));


--
-- Name: freeholds Owners can manage own freeholds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage own freeholds" ON public.freeholds USING ((owner_id = auth.uid()));


--
-- Name: groups Public groups are viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public groups are viewable" ON public.groups FOR SELECT USING (((is_public = true) OR (EXISTS ( SELECT 1
   FROM public.group_members cm
  WHERE ((cm.group_id = groups.id) AND (cm.user_id = auth.uid()))))));


--
-- Name: resource_catalog System can manage catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage catalog" ON public.resource_catalog USING (false);


--
-- Name: group_achievements System manages achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System manages achievements" ON public.group_achievements USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: member_activity_summary System manages summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System manages summaries" ON public.member_activity_summary USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: event_rsvps Users can delete own RSVP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own RSVP" ON public.event_rsvps FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: build_likes Users can like builds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can like builds" ON public.build_likes FOR SELECT USING (true);


--
-- Name: node_citizenships Users can manage own character citizenship; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own character citizenship" ON public.node_citizenships USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = node_citizenships.character_id) AND (m.user_id = auth.uid())))));


--
-- Name: build_comments Users can manage own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own comments" ON public.build_comments USING ((user_id = auth.uid()));


--
-- Name: build_likes Users can manage own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own likes" ON public.build_likes USING ((user_id = auth.uid()));


--
-- Name: character_ships Users can manage their own character ships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own character ships" ON public.character_ships USING ((EXISTS ( SELECT 1
   FROM public.members m
  WHERE ((m.id = character_ships.character_id) AND (m.user_id = auth.uid())))));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((id = auth.uid()));


--
-- Name: users Users can view all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);


--
-- Name: character_ships Users can view character ships in their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view character ships in their groups" ON public.character_ships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.members m
     JOIN public.group_members gm ON ((gm.user_id = m.user_id)))
  WHERE ((m.id = character_ships.character_id) AND (gm.group_id = m.group_id)))));


--
-- Name: group_games Users can view games for their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view games for their groups" ON public.group_games FOR SELECT USING ((group_id IN ( SELECT groups.id
   FROM public.groups
  WHERE (groups.id IN ( SELECT group_members.group_id
           FROM public.group_members
          WHERE (group_members.user_id = auth.uid()))))));


--
-- Name: resource_requests Users can view own requests or officers all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own requests or officers all" ON public.resource_requests FOR SELECT USING (((requested_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.guild_banks gb
  WHERE ((gb.id = resource_requests.bank_id) AND public.user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]))))));


--
-- Name: game_ship_permissions Users can view ship permissions in their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ship permissions in their groups" ON public.game_ship_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = game_ship_permissions.group_id) AND (group_members.user_id = auth.uid())))));


--
-- Name: builds View builds based on visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View builds based on visibility" ON public.builds FOR SELECT USING (((visibility = 'public'::public.build_visibility) OR (created_by = auth.uid()) OR ((visibility = 'guild'::public.build_visibility) AND (group_id IS NOT NULL) AND public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]))));


--
-- Name: member_professions View professions if can view member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View professions if can view member" ON public.member_professions FOR SELECT USING ((member_id IN ( SELECT members.id
   FROM public.members
  WHERE public.user_has_clan_role(members.group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text, 'member'::text]))));


--
-- Name: achievement_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: achievement_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievement_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_discord_destinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_discord_destinations ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_discord_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_discord_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: alliance_event_participation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alliance_event_participation ENABLE ROW LEVEL SECURITY;

--
-- Name: alliance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alliance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: alliance_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alliance_members ENABLE ROW LEVEL SECURITY;

--
-- Name: alliances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: augment_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.augment_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: build_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: build_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: builds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

--
-- Name: caravan_escorts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caravan_escorts ENABLE ROW LEVEL SECURITY;

--
-- Name: caravan_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caravan_events ENABLE ROW LEVEL SECURITY;

--
-- Name: caravan_waypoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caravan_waypoints ENABLE ROW LEVEL SECURITY;

--
-- Name: character_ships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.character_ships ENABLE ROW LEVEL SECURITY;

--
-- Name: group_permission_overrides clan_admins_can_manage_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_admins_can_manage_permissions ON public.group_permission_overrides USING ((auth.uid() IN ( SELECT group_members.user_id
   FROM public.group_members
  WHERE ((group_members.group_id = group_permission_overrides.group_id) AND ((group_members.role)::text = 'admin'::text))))) WITH CHECK ((auth.uid() IN ( SELECT group_members.user_id
   FROM public.group_members
  WHERE ((group_members.group_id = group_permission_overrides.group_id) AND ((group_members.role)::text = 'admin'::text)))));


--
-- Name: group_permission_overrides clan_members_can_view_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_can_view_permissions ON public.group_permission_overrides FOR SELECT USING ((auth.uid() IN ( SELECT group_members.user_id
   FROM public.group_members
  WHERE (group_members.group_id = group_permission_overrides.group_id))));


--
-- Name: group_members clan_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_delete ON public.group_members FOR DELETE USING (((user_id = auth.uid()) OR public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text])));


--
-- Name: group_members clan_members_insert_auto_approved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_insert_auto_approved ON public.group_members FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND ((role)::text = ANY (ARRAY[('trial'::character varying)::text, ('member'::character varying)::text])) AND (EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_members.group_id) AND (g.approval_required = false) AND ((g.default_role)::text = (group_members.role)::text))))));


--
-- Name: group_members clan_members_insert_creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_insert_creator ON public.group_members FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND ((role)::text = 'admin'::text) AND (is_creator = true)));


--
-- Name: group_members clan_members_insert_pending; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_insert_pending ON public.group_members FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND ((role)::text = 'pending'::text)));


--
-- Name: group_members clan_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_select ON public.group_members FOR SELECT USING (true);


--
-- Name: group_members clan_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clan_members_update ON public.group_members FOR UPDATE USING (public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin'::text, 'officer'::text]));


--
-- Name: discord_webhook_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discord_webhook_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dkp_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dkp_points ENABLE ROW LEVEL SECURITY;

--
-- Name: dkp_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dkp_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: event_rsvps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: freehold_buildings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freehold_buildings ENABLE ROW LEVEL SECURITY;

--
-- Name: freehold_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freehold_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: freeholds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freeholds ENABLE ROW LEVEL SECURITY;

--
-- Name: game_ship_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_ship_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: group_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: group_admin_discord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_admin_discord ENABLE ROW LEVEL SECURITY;

--
-- Name: group_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_games ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: group_permission_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_permission_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: guild_banks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guild_banks ENABLE ROW LEVEL SECURITY;

--
-- Name: inactivity_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inactivity_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: loot_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loot_history ENABLE ROW LEVEL SECURITY;

--
-- Name: loot_systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loot_systems ENABLE ROW LEVEL SECURITY;

--
-- Name: member_activity_summary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_activity_summary ENABLE ROW LEVEL SECURITY;

--
-- Name: member_professions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_professions ENABLE ROW LEVEL SECURITY;

--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: node_citizenships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.node_citizenships ENABLE ROW LEVEL SECURITY;

--
-- Name: parties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

--
-- Name: party_roster; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_roster ENABLE ROW LEVEL SECURITY;

--
-- Name: recruitment_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recruitment_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: resource_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resource_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: resource_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resource_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: sc_loaner_matrix; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sc_loaner_matrix ENABLE ROW LEVEL SECURITY;

--
-- Name: siege_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.siege_events ENABLE ROW LEVEL SECURITY;

--
-- Name: siege_roster; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.siege_roster ENABLE ROW LEVEL SECURITY;

--
-- Name: site_admin_discord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_admin_discord ENABLE ROW LEVEL SECURITY;

--
-- Name: skill_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
SET search_path = public;
