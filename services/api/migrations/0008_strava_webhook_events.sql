CREATE TABLE strava_webhook_events (
  id text PRIMARY KEY,
  object_type text NOT NULL,
  object_id text NOT NULL,
  aspect_type text NOT NULL,
  owner_id text NOT NULL,
  subscription_id integer NOT NULL,
  event_time timestamptz NOT NULL,
  updates jsonb NOT NULL,
  action text NOT NULL,
  received_at timestamptz NOT NULL,
  UNIQUE (subscription_id, object_type, object_id, aspect_type, event_time)
);
