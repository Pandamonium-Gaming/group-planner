BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS wow_faction VARCHAR(20)
  CHECK (wow_faction IN ('Alliance', 'Horde'));

COMMENT ON COLUMN public.members.wow_faction IS
  'WoW Forever faction selection; nullable for legacy Skyborne characters with an unknown faction.';

INSERT INTO public.migration_history (filename)
VALUES ('009_add_wow_forever_faction.sql')
ON CONFLICT DO NOTHING;

COMMIT;
