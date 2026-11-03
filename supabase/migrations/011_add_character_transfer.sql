BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_group_characters(
  p_group_id UUID,
  p_game_slug TEXT,
  p_document JSONB,
  p_apply BOOLEAN DEFAULT FALSE,
  p_expected_token TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
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
  PERFORM 1 FROM public.groups WHERE id = p_group_id FOR KEY SHARE;
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

REVOKE ALL ON FUNCTION public.transfer_group_characters(UUID, TEXT, JSONB, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_group_characters(UUID, TEXT, JSONB, BOOLEAN, TEXT) TO service_role;

INSERT INTO public.migration_history (filename) VALUES ('011_add_character_transfer.sql') ON CONFLICT DO NOTHING;

COMMIT;
