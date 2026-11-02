BEGIN;

ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'dungeon';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'leveling';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'world_pvp';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'battleground_pvp';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'arena_pvp';

INSERT INTO public.migration_history (filename)
VALUES ('012_add_wow_forever_event_types.sql')
ON CONFLICT DO NOTHING;

COMMIT;
