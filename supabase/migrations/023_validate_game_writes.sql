BEGIN;

-- Rejects new game-tagged rows (members, events, recruitment applications) for a game the group no longer
-- has enabled, so a stale form or a write racing delete_group_game cannot recreate a deleted game's data.
--
-- Rules:
--   * A NULL game_slug (group-wide recruitment applications) is allowed.
--   * A group with no group_games rows at all is a legacy group treated as having every game enabled
--     (as the app does), so it is allowed.
--   * Otherwise a group_games row for (group_id, game_slug) must exist ('star-citizen' and 'starcitizen'
--     are the same game). Archived games are still writable; only deleted (removed) games are refused.
-- Failure raises SQLSTATE P0001 with the message 'GAME_NOT_ENABLED', which the API maps to a 409.
--
-- Locking: delete_group_game locks groups FOR UPDATE, then group_games FOR UPDATE. This trigger takes
-- FOR KEY SHARE on the same two rows in the same order (the foreign key check on group_id only runs
-- after BEFORE triggers, so taking the groups lock here keeps the order consistent and avoids deadlock).
-- An insert racing a deletion therefore either commits first (and the deletion, which runs its DELETE
-- statements after taking its locks, removes the new row too) or waits for the deletion to commit and is
-- then refused because the group_games row is gone.
--
-- SECURITY DEFINER: the inserting role (anon for public recruitment, authenticated for direct writes) may
-- not see group_games through RLS, and FOR KEY SHARE needs UPDATE rights. Trigger functions are not
-- executed through EXECUTE privileges, so no role needs a grant.
CREATE OR REPLACE FUNCTION public.require_enabled_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_slugs text[];
BEGIN
  IF NEW.game_slug IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.groups WHERE id = NEW.group_id FOR KEY SHARE;

  -- Legacy groups never got group_games rows; the app treats them as having every game enabled.
  PERFORM 1 FROM public.group_games WHERE group_id = NEW.group_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_slugs := CASE WHEN NEW.game_slug IN ('starcitizen', 'star-citizen')
    THEN ARRAY['starcitizen', 'star-citizen'] ELSE ARRAY[NEW.game_slug] END;

  PERFORM 1 FROM public.group_games
    WHERE group_id = NEW.group_id AND game_slug = ANY (v_slugs)
    FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_NOT_ENABLED' USING ERRCODE = 'P0001',
      DETAIL = pg_catalog.format('Game %s is not enabled for this group', NEW.game_slug);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_enabled_game() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS members_require_enabled_game ON public.members;
CREATE TRIGGER members_require_enabled_game
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.require_enabled_game();

DROP TRIGGER IF EXISTS events_require_enabled_game ON public.events;
CREATE TRIGGER events_require_enabled_game
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.require_enabled_game();

DROP TRIGGER IF EXISTS recruitment_applications_require_enabled_game ON public.recruitment_applications;
CREATE TRIGGER recruitment_applications_require_enabled_game
  BEFORE INSERT ON public.recruitment_applications
  FOR EACH ROW WHEN (NEW.game_slug IS NOT NULL) EXECUTE FUNCTION public.require_enabled_game();

INSERT INTO public.migration_history(filename) VALUES ('023_validate_game_writes.sql') ON CONFLICT DO NOTHING;
COMMIT;
