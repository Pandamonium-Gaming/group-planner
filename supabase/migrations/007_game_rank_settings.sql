-- Migration: 007_game_rank_settings
-- Adds per-game rank enablement and custom rank definitions at group scope.

ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_ranks_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sc_ranks_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_ranks_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_custom_ranks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sc_custom_ranks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_custom_ranks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN groups.aoc_ranks_enabled IS 'Whether game-specific member ranks are enabled for Ashes of Creation.';
COMMENT ON COLUMN groups.sc_ranks_enabled IS 'Whether game-specific member ranks are enabled for Star Citizen.';
COMMENT ON COLUMN groups.ror_ranks_enabled IS 'Whether game-specific member ranks are enabled for Return of Reckoning.';

COMMENT ON COLUMN groups.aoc_custom_ranks IS 'Custom rank definitions for Ashes of Creation at group level.';
COMMENT ON COLUMN groups.sc_custom_ranks IS 'Custom rank definitions for Star Citizen at group level.';
COMMENT ON COLUMN groups.ror_custom_ranks IS 'Custom rank definitions for Return of Reckoning at group level.';

INSERT INTO migration_history (filename) VALUES ('007_game_rank_settings.sql') ON CONFLICT DO NOTHING;
