BEGIN;

-- The baseline loaner trigger used unqualified names, so it failed whenever it ran under a caller
-- with search_path = '' (such as delete_group_game). Same behaviour, schema-qualified.
CREATE OR REPLACE FUNCTION public.remove_loaner_ships_for_pledge()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Only process pledged ships; keep loaners still granted by another pledge.
  IF OLD.ownership_type = 'pledged' THEN
    DELETE FROM public.character_ships cs
    WHERE cs.character_id = OLD.character_id
      AND cs.ownership_type = 'loaner'
      AND cs.ship_id IN (SELECT loaner_ship FROM public.sc_loaner_matrix WHERE pledged_ship = OLD.ship_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.character_ships other_pledges
        JOIN public.sc_loaner_matrix lm ON lm.pledged_ship = other_pledges.ship_id
        WHERE other_pledges.character_id = OLD.character_id
          AND other_pledges.ownership_type = 'pledged'
          AND other_pledges.id <> OLD.id
          AND lm.loaner_ship = cs.ship_id
      );
  END IF;
  RETURN OLD;
END;
$$;

-- Permanently erases one game's data for one group. p_expected_name comes from the server's game
-- registry, never from the client. New games must add a branch to the per-game groups reset below.
CREATE FUNCTION public.delete_group_game(
  p_group_id uuid,
  p_game_slug text,
  p_confirm_name text,
  p_expected_name text,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_archived boolean;
  v_slugs text[];
  v_previous_flag text;
  v_group_name text;
  v_destination uuid;
BEGIN
  PERFORM 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_actor_id AND role = 'admin' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  SELECT archived INTO v_archived FROM public.group_games
    WHERE group_id = p_group_id AND game_slug = p_game_slug FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GAME_NOT_FOUND'; END IF;
  IF v_archived IS NOT TRUE THEN RAISE EXCEPTION 'GAME_NOT_ARCHIVED'; END IF;

  IF p_expected_name IS NULL OR p_expected_name = ''
    OR p_confirm_name COLLATE "C" IS DISTINCT FROM p_expected_name COLLATE "C" THEN
    RAISE EXCEPTION 'CONFIRMATION_MISMATCH';
  END IF;

  -- Baseline migration 060 renamed 'star-citizen' to 'starcitizen', but rows written outside that
  -- migration (e.g. the baseline's game_ship_permissions seed) can still carry the legacy tag.
  v_slugs := CASE WHEN p_game_slug = 'starcitizen' THEN ARRAY['starcitizen', 'star-citizen'] ELSE ARRAY[p_game_slug] END;

  -- A group with no group_games rows is read as "every game enabled" (legacy groups were never
  -- backfilled), so deleting the last row would resurrect all games. Refuse instead.
  PERFORM 1 FROM public.group_games
    WHERE group_id = p_group_id AND game_slug <> ALL (v_slugs);
  IF NOT FOUND THEN RAISE EXCEPTION 'LAST_GAME'; END IF;


  -- remove_loaner_ships_for_pledge is a BEFORE DELETE trigger that deletes sibling loaner rows; within
  -- one cascading delete that aborts with "tuple already modified". Remove loaners first, then pledges.
  DELETE FROM public.character_ships cs USING public.members m
    WHERE cs.character_id = m.id AND m.group_id = p_group_id AND m.game_slug = ANY (v_slugs)
      AND cs.ownership_type IS DISTINCT FROM 'pledged';
  DELETE FROM public.character_ships cs USING public.members m
    WHERE cs.character_id = m.id AND m.group_id = p_group_id AND m.game_slug = ANY (v_slugs);

  -- Foreign keys cascade member_professions, party_roster, node_citizenships, siege_roster, dkp_points,
  -- caravan_escorts (members) and event_rsvps, guest_event_rsvps (events); other references are SET NULL.
  DELETE FROM public.members WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);
  DELETE FROM public.events WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);
  DELETE FROM public.recruitment_applications WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);
  DELETE FROM public.game_ship_permissions WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);
  DELETE FROM public.discord_webhook_logs WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);
  DELETE FROM public.group_games WHERE group_id = p_group_id AND game_slug = ANY (v_slugs);

  -- This deletion raises its own alert below, so silence the per-column webhook_changed alert.
  v_previous_flag := pg_catalog.current_setting('app.suppress_admin_config_alert', true);
  PERFORM pg_catalog.set_config('app.suppress_admin_config_alert', 'on', true);
  CASE p_game_slug
    WHEN 'aoc' THEN UPDATE public.groups SET
      aoc_recruitment_open = DEFAULT, aoc_recruitment_message = DEFAULT, aoc_public_description = DEFAULT,
      aoc_ranks_enabled = DEFAULT, aoc_custom_ranks = DEFAULT,
      aoc_webhook_url = DEFAULT, aoc_events_webhook_url = DEFAULT,
      aoc_announcement_role_id = DEFAULT, aoc_events_role_id = DEFAULT,
      aoc_welcome_enabled = DEFAULT
      WHERE id = p_group_id;
    WHEN 'starcitizen' THEN UPDATE public.groups SET
      sc_recruitment_open = DEFAULT, sc_recruitment_message = DEFAULT, sc_public_description = DEFAULT,
      sc_ranks_enabled = DEFAULT, sc_custom_ranks = DEFAULT,
      sc_webhook_url = DEFAULT, sc_events_webhook_url = DEFAULT,
      sc_announcement_role_id = DEFAULT, sc_events_role_id = DEFAULT,
      sc_welcome_enabled = DEFAULT
      WHERE id = p_group_id;
    WHEN 'ror' THEN UPDATE public.groups SET
      ror_recruitment_open = DEFAULT, ror_recruitment_message = DEFAULT, ror_public_description = DEFAULT,
      ror_ranks_enabled = DEFAULT, ror_custom_ranks = DEFAULT,
      ror_webhook_url = DEFAULT, ror_events_webhook_url = DEFAULT,
      ror_announcement_role_id = DEFAULT, ror_events_role_id = DEFAULT
      WHERE id = p_group_id;
    WHEN 'wowforever' THEN UPDATE public.groups SET
      wowforever_recruitment_open = DEFAULT, wowforever_recruitment_message = DEFAULT, wowforever_public_description = DEFAULT,
      wowforever_ranks_enabled = DEFAULT, wowforever_custom_ranks = DEFAULT,
      wowforever_webhook_url = DEFAULT, wowforever_events_webhook_url = DEFAULT,
      wowforever_announcement_role_id = DEFAULT, wowforever_events_role_id = DEFAULT
      WHERE id = p_group_id;
    ELSE
      NULL; -- Unknown games have no per-game columns to reset.
  END CASE;
  PERFORM pg_catalog.set_config('app.suppress_admin_config_alert', COALESCE(v_previous_flag, ''), true);

  -- Queued last; carries names only, never a webhook URL, token or role ID.
  SELECT name INTO v_group_name FROM public.groups WHERE id = p_group_id;
  SELECT destination_id INTO v_destination FROM public.group_admin_discord WHERE group_id = p_group_id;
  INSERT INTO public.admin_discord_notifications(
    kind, destination, destination_id, group_id, group_name, actor_id, subject_name, changes
  ) VALUES (
    'game_deleted', 'group', v_destination, p_group_id, v_group_name, p_actor_id, p_expected_name,
    pg_catalog.jsonb_build_object('game', p_expected_name)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.delete_group_game(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group_game(uuid, text, text, text, uuid) TO service_role;

INSERT INTO public.migration_history(filename) VALUES ('020_delete_group_game.sql') ON CONFLICT DO NOTHING;
COMMIT;
