BEGIN;

DO $$
DECLARE
  g UUID := gen_random_uuid();
  u UUID := gen_random_uuid();
  c UUID := gen_random_uuid();
  other UUID := gen_random_uuid();
  failing UUID := gen_random_uuid();
  d JSONB;
  preview JSONB;
  rejected BOOLEAN;
BEGIN
  INSERT INTO auth.users (id, raw_user_meta_data)
    VALUES (u, jsonb_build_object('provider_id', '9999999999999999999', 'user_name', 'Transfer test'));
  INSERT INTO public.users (id, discord_id, display_name)
    VALUES (u, '9999999999999999999', 'Transfer test')
    ON CONFLICT (id) DO UPDATE SET discord_id = EXCLUDED.discord_id;
  INSERT INTO public.groups (id, slug, name) VALUES (g, 'transfer-test-' || substr(g::TEXT, 1, 8), 'Transfer test');
  INSERT INTO public.group_games (group_id, game_slug) VALUES (g, 'aoc'), (g, 'starcitizen');
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (g, u, 'member');
  INSERT INTO public.members (id, group_id, game_slug, name, level, is_main)
    VALUES (other, g, 'aoc', 'Untouched', 1, FALSE);
  d := jsonb_build_object('format', 'group-planner-characters', 'version', 1, 'game_slug', 'aoc',
    'characters', jsonb_build_array(jsonb_build_object(
      'id', c, 'owner', jsonb_build_object('discord_id', '9999999999999999999', 'label', 'Source owner'),
      'data', jsonb_build_object('name', 'Imported', 'level', 20, 'is_main', TRUE),
      'professions', jsonb_build_array(jsonb_build_object('profession', 'mining', 'rank', 4, 'artisan_level', 50, 'quality_score', 123)),
      'ships', '[]'::JSONB)));
  preview := public.transfer_group_characters(g, 'aoc', d);
  IF preview->>'create_count' <> '1' OR EXISTS (SELECT 1 FROM public.members WHERE id = c) THEN
    RAISE EXCEPTION 'Preview must not write characters';
  END IF;
  PERFORM public.transfer_group_characters(g, 'aoc', d, TRUE, preview->>'token');
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = c AND user_id = u AND discord_id = '9999999999999999999')
    OR NOT EXISTS (SELECT 1 FROM public.member_professions WHERE member_id = c AND rank = 4 AND quality_score = 123)
    OR NOT EXISTS (SELECT 1 FROM public.members WHERE id = other AND name = 'Untouched') THEN
    RAISE EXCEPTION 'Owner matching, professions or untouched character preservation failed';
  END IF;
  preview := public.transfer_group_characters(g, 'aoc', d);
  IF preview->>'update_count' <> '1' THEN RAISE EXCEPTION 'ID matching failed'; END IF;
  UPDATE public.members SET name = 'Changed after preview' WHERE id = c;
  rejected := FALSE;
  BEGIN
    PERFORM public.transfer_group_characters(g, 'aoc', d, TRUE, preview->>'token');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%stale%' THEN RAISE; END IF;
    rejected := TRUE;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Stale import was accepted'; END IF;

  d := jsonb_set(d, '{characters,0,owner,discord_id}', '"8888888888888888888"'::JSONB);
  preview := public.transfer_group_characters(g, 'aoc', d);
  IF jsonb_array_length(preview->'warnings') <> 1 THEN RAISE EXCEPTION 'Unresolved owner warning missing'; END IF;
  PERFORM public.transfer_group_characters(g, 'aoc', d, TRUE, preview->>'token');
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = c AND user_id IS NULL AND discord_id IS NULL) THEN
    RAISE EXCEPTION 'Unresolved owner was not left unclaimed';
  END IF;

  d := jsonb_set(d, '{characters}', (d->'characters') || jsonb_build_array(jsonb_build_object(
    'id', failing, 'owner', jsonb_build_object('discord_id', NULL, 'label', NULL),
    'data', jsonb_build_object('name', 'Must roll back', 'level', 1, 'is_main', FALSE),
    'professions', jsonb_build_array(jsonb_build_object('profession', 'mining', 'rank', 99, 'artisan_level', 0, 'quality_score', 0)),
    'ships', '[]'::JSONB)));
  UPDATE public.members SET name = 'Before failed batch' WHERE id = c;
  preview := public.transfer_group_characters(g, 'aoc', d);
  rejected := FALSE;
  BEGIN
    PERFORM public.transfer_group_characters(g, 'aoc', d, TRUE, preview->>'token');
  EXCEPTION WHEN check_violation THEN rejected := TRUE;
  END;
  IF NOT rejected OR EXISTS (SELECT 1 FROM public.members WHERE id = failing)
    OR NOT EXISTS (SELECT 1 FROM public.members WHERE id = c AND name = 'Before failed batch') THEN
    RAISE EXCEPTION 'Import was not atomic';
  END IF;

  d := jsonb_build_object('format', 'group-planner-characters', 'version', 1, 'game_slug', 'starcitizen',
    'characters', jsonb_build_array(jsonb_build_object(
      'id', failing, 'owner', jsonb_build_object('discord_id', NULL, 'label', NULL),
      'data', jsonb_build_object('name', 'Pilot', 'level', 1, 'is_main', FALSE, 'preferred_role', jsonb_build_array('pilot')),
      'professions', '[]'::JSONB,
      'ships', jsonb_build_array(jsonb_build_object('ship_id', 'test-ship', 'ownership_type', 'in-game', 'notes', 'Test ship')))));
  preview := public.transfer_group_characters(g, 'starcitizen', d);
  PERFORM public.transfer_group_characters(g, 'starcitizen', d, TRUE, preview->>'token');
  IF NOT EXISTS (SELECT 1 FROM public.character_ships WHERE character_id = failing AND ship_id = 'test-ship')
    THEN RAISE EXCEPTION 'Ship ownership import failed'; END IF;
  IF has_function_privilege('authenticated', 'public.transfer_group_characters(uuid,text,jsonb,boolean,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.transfer_group_characters(uuid,text,jsonb,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Import function exposed to non-server callers';
  END IF;
END;
$$;

ROLLBACK;
