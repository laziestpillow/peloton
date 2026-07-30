CREATE TYPE appearance_pattern AS ENUM ('solid', 'stripes', 'polkaDots');
CREATE TYPE connection_status AS ENUM ('connected', 'expired', 'error', 'revoked');

CREATE TABLE users (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE rider_profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  display_name text NOT NULL,
  jersey_color text NOT NULL,
  accent_color text NOT NULL,
  helmet_color text NOT NULL,
  bike_color text NOT NULL,
  pattern appearance_pattern NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE group_memberships (
  group_id text NOT NULL REFERENCES groups(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  role text NOT NULL,
  status text NOT NULL,
  joined_at timestamptz NOT NULL,
  PRIMARY KEY (group_id, rider_id)
);

CREATE TABLE imported_activities (
  id text PRIMARY KEY,
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  provider text NOT NULL,
  provider_activity_id text NOT NULL,
  started_at timestamptz NOT NULL,
  distance_meters numeric NOT NULL,
  elapsed_time_seconds integer NOT NULL,
  elevation_gain_meters numeric NOT NULL,
  route_summary jsonb NOT NULL,
  UNIQUE (provider, provider_activity_id)
);

