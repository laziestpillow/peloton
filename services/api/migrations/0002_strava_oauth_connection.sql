CREATE TABLE strava_oauth_states (
  state text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  redirect_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE strava_connections (
  user_id text PRIMARY KEY REFERENCES users(id),
  athlete_id text NOT NULL,
  accepted_scopes jsonb NOT NULL,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  status connection_status NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
