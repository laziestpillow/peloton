CREATE TABLE activity_sync_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  idempotency_key text,
  status text NOT NULL,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (user_id, idempotency_key)
);
