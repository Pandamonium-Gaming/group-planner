BEGIN;

ALTER TABLE public.guest_event_rsvps
  ALTER COLUMN class_id TYPE text USING class_id::text;

COMMENT ON COLUMN public.guest_event_rsvps.class_id IS
  'Game registry class ID (for example mage or ironbreaker), interpreted using the event game. Legacy UUID values are preserved as unknown classes.';

INSERT INTO public.migration_history(filename)
VALUES ('014_guest_rsvp_class_registry_ids.sql') ON CONFLICT DO NOTHING;

COMMIT;
