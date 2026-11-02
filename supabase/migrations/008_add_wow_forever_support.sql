-- Add WoW Forever game registration and character roster fields.

INSERT INTO game_types (id, name, description, icon) VALUES
  ('wowforever', 'WoW Forever', 'World of Warcraft: Forever character and group planning', '⚔️')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE groups DROP CONSTRAINT IF EXISTS valid_game;
ALTER TABLE groups
  ADD CONSTRAINT valid_game CHECK (game IN ('aoc', 'starcitizen', 'ror', 'wowforever'));

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS wow_race VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wow_class VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wow_main_spec VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wow_secondary_spec VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wow_profession_1 VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wow_profession_2 VARCHAR(50);

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS wowforever_ranks_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wowforever_custom_ranks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wowforever_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS wowforever_events_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS wowforever_announcement_role_id TEXT,
  ADD COLUMN IF NOT EXISTS wowforever_events_role_id TEXT,
  ADD COLUMN IF NOT EXISTS wowforever_recruitment_open BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wowforever_recruitment_message TEXT,
  ADD COLUMN IF NOT EXISTS wowforever_public_description TEXT;

COMMENT ON COLUMN members.wow_race IS 'WoW Forever character race.';
COMMENT ON COLUMN members.wow_class IS 'WoW Forever character class ID.';
COMMENT ON COLUMN members.wow_main_spec IS 'WoW Forever character primary specialization.';
COMMENT ON COLUMN members.wow_secondary_spec IS 'WoW Forever character optional secondary specialization.';
COMMENT ON COLUMN members.wow_profession_1 IS 'WoW Forever character first profession.';
COMMENT ON COLUMN members.wow_profession_2 IS 'WoW Forever character second profession.';
COMMENT ON COLUMN groups.wowforever_ranks_enabled IS 'Whether custom group ranks are enabled for WoW Forever.';
COMMENT ON COLUMN groups.wowforever_custom_ranks IS 'Custom rank definitions for WoW Forever at group level.';

INSERT INTO migration_history (filename)
VALUES ('008_add_wow_forever_support.sql')
ON CONFLICT DO NOTHING;
