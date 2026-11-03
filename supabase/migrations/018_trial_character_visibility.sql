BEGIN;

-- INSERT ... RETURNING also checks SELECT policies. Trials can create characters
-- under migration 002, so they must be able to read the returned character.
DROP POLICY IF EXISTS "Approved members can view members" ON public.members;

CREATE POLICY "Approved members can view members" ON public.members
  FOR SELECT USING (
    public.user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member', 'trial'])
    OR (
      NULLIF(public.current_user_discord_id(), '') IS NOT NULL
      AND public.user_has_clan_role_by_discord(
        group_id,
        public.current_user_discord_id(),
        ARRAY['admin', 'officer', 'member', 'trial']
      )
    )
  );

COMMENT ON POLICY "Approved members can view members" ON public.members IS
  'Approved group members, including trials, can read characters and receive newly created rows via auth UUID or the existing Discord ID fallback. Pending users and nonmembers remain excluded.';

INSERT INTO public.migration_history (filename)
VALUES ('018_trial_character_visibility.sql') ON CONFLICT DO NOTHING;

COMMIT;
