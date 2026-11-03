BEGIN;

-- The baseline removed auto-granted loaners in a BEFORE DELETE trigger that deletes sibling rows of
-- character_ships. In any statement deleting several of a character's ships at once (deleting a Star
-- Citizen member with a pledged ship, a group deletion cascade, or the character-transfer import) the
-- trigger deleted a row the statement was about to delete, which aborts with "tuple to be ... was
-- already modified by an operation triggered by the current command". As an AFTER DELETE trigger the
-- statement's own deletions are already done, so it only removes loaners left behind.
-- Migration 021's comment describes this bug; its ordered character_ships deletes still work but are
-- no longer required.
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
  RETURN NULL; -- AFTER trigger: the return value is ignored.
END;
$$;

DROP TRIGGER IF EXISTS trigger_remove_loaner_ships ON public.character_ships;
CREATE TRIGGER trigger_remove_loaner_ships
  AFTER DELETE ON public.character_ships
  FOR EACH ROW
  EXECUTE FUNCTION public.remove_loaner_ships_for_pledge();

-- Same behaviour as the baseline, schema-qualified so it works under any caller search_path.
CREATE OR REPLACE FUNCTION public.add_loaner_ships_for_pledge()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Only process pledged ships (not in-game or existing loaners)
  IF NEW.ownership_type = 'pledged' THEN
    INSERT INTO public.character_ships (character_id, ship_id, ownership_type, notes)
    SELECT
      NEW.character_id,
      loaner_ship,
      'loaner',
      'Auto-granted loaner for ' || public.ship_id_to_display_name(NEW.ship_id) ||
      CASE
        WHEN loaner_type = 'arena_commander' THEN ' (Arena Commander)'
        WHEN loaner_type = 'temporary' THEN ' (Temporary: ' || COALESCE(notes, 'see RSI') || ')'
        ELSE ''
      END
    FROM public.sc_loaner_matrix
    WHERE pledged_ship = NEW.ship_id
    ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING; -- Don't duplicate loaners
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO public.migration_history(filename) VALUES ('022_fix_loaner_trigger.sql') ON CONFLICT DO NOTHING;
COMMIT;
