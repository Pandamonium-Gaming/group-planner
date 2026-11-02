BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS wow_profession_1_rank VARCHAR(20)
    CHECK (wow_profession_1_rank IN ('apprentice', 'journeyman', 'expert', 'artisan')),
  ADD COLUMN IF NOT EXISTS wow_profession_2_rank VARCHAR(20)
    CHECK (wow_profession_2_rank IN ('apprentice', 'journeyman', 'expert', 'artisan'));

COMMENT ON COLUMN public.members.wow_profession_1_rank IS
  'Manually recorded WoW Forever trained rank for profession 1; NULL means not recorded.';
COMMENT ON COLUMN public.members.wow_profession_2_rank IS
  'Manually recorded WoW Forever trained rank for profession 2; NULL means not recorded.';

INSERT INTO public.migration_history (filename)
VALUES ('010_add_wow_forever_profession_ranks.sql')
ON CONFLICT DO NOTHING;

COMMIT;
