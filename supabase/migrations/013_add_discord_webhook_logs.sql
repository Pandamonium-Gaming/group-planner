BEGIN;

CREATE TABLE public.discord_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  game_slug text,
  kind text NOT NULL CHECK (kind IN ('event', 'repost', 'announcement', 'reminder', 'test', 'welcome')),
  subject_id text,
  actor_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  http_status integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discord_webhook_logs_group_created_idx
  ON public.discord_webhook_logs(group_id, created_at DESC);
ALTER TABLE public.discord_webhook_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discord_webhook_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.discord_webhook_logs TO service_role;

INSERT INTO public.migration_history(filename)
VALUES ('013_add_discord_webhook_logs.sql') ON CONFLICT DO NOTHING;

COMMIT;
