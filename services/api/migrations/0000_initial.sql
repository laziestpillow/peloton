CREATE TYPE activity_provider AS ENUM ('strava', 'fixture');
CREATE TYPE appearance_pattern AS ENUM ('solid', 'stripes', 'polkaDots');
CREATE TYPE archetype AS ENUM ('rookie', 'climber', 'sprinter', 'allRounder', 'puncheur', 'rouleur');
CREATE TYPE connection_status AS ENUM ('connected', 'expired', 'error', 'revoked');
CREATE TYPE import_status AS ENUM ('eligible', 'processing', 'processed', 'duplicate', 'unsupported', 'failed');
CREATE TYPE marker_type AS ENUM ('sprint', 'climb');
CREATE TYPE oauth_state_status AS ENUM ('pending', 'consumed', 'expired');
CREATE TYPE stage_status AS ENUM ('scheduled', 'active', 'completed');

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

CREATE TABLE seasons (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES groups(id),
  name text NOT NULL,
  status stage_status NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE stages (
  id text PRIMARY KEY,
  season_id text NOT NULL REFERENCES seasons(id),
  name text NOT NULL,
  route jsonb NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status stage_status NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE imported_activities (
  id text PRIMARY KEY,
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  provider activity_provider NOT NULL,
  provider_activity_id text NOT NULL,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL,
  distance_meters numeric NOT NULL,
  elapsed_time_seconds integer NOT NULL,
  moving_time_seconds integer NOT NULL,
  elevation_gain_meters numeric NOT NULL,
  route_summary jsonb NOT NULL,
  import_status import_status NOT NULL,
  processed_stage_id text REFERENCES stages(id)
);

CREATE UNIQUE INDEX imported_activities_provider_activity_uidx
  ON imported_activities(provider, provider_activity_id);

CREATE TABLE markers (
  id text PRIMARY KEY,
  stage_id text NOT NULL REFERENCES stages(id),
  type marker_type NOT NULL,
  position_meters numeric NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geofence_radius_meters numeric NOT NULL,
  category integer,
  points_schedule jsonb NOT NULL,
  sort_order integer NOT NULL
);

CREATE UNIQUE INDEX markers_stage_sort_order_uidx
  ON markers(stage_id, sort_order);

CREATE TABLE ride_results (
  id text PRIMARY KEY,
  stage_id text NOT NULL REFERENCES stages(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  imported_activity_id text REFERENCES imported_activities(id),
  finish_time_seconds integer NOT NULL,
  distance_meters numeric NOT NULL,
  elapsed_time_seconds integer NOT NULL,
  moving_time_seconds integer NOT NULL,
  elevation_gain_meters numeric NOT NULL,
  route_summary jsonb NOT NULL
);

CREATE UNIQUE INDEX ride_results_stage_rider_uidx
  ON ride_results(stage_id, rider_id);

CREATE TABLE marker_crossings (
  marker_id text NOT NULL REFERENCES markers(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  crossed_at_seconds integer NOT NULL,
  rank integer NOT NULL,
  points integer NOT NULL,
  PRIMARY KEY (marker_id, rider_id)
);

CREATE TABLE stage_results (
  stage_id text NOT NULL REFERENCES stages(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  sprint_points integer NOT NULL,
  kom_points integer NOT NULL,
  finish_bonus integer NOT NULL,
  today_total integer NOT NULL,
  gc_time_seconds integer NOT NULL,
  PRIMARY KEY (stage_id, rider_id)
);

CREATE TABLE season_standings (
  season_id text NOT NULL REFERENCES seasons(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  season_total integer NOT NULL,
  rank integer NOT NULL,
  previous_rank integer,
  PRIMARY KEY (season_id, rider_id)
);

CREATE TABLE archetype_snapshots (
  season_id text NOT NULL REFERENCES seasons(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  archetype archetype NOT NULL,
  confidence numeric NOT NULL,
  sample_size integer NOT NULL,
  sprint_relative_score numeric NOT NULL,
  climb_relative_score numeric NOT NULL,
  short_effort_score numeric NOT NULL,
  sustained_effort_score numeric NOT NULL,
  effective_at timestamptz NOT NULL,
  reasons jsonb NOT NULL,
  PRIMARY KEY (season_id, rider_id, effective_at)
);

CREATE TABLE oauth_states (
  state text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  redirect_uri text NOT NULL,
  scopes jsonb NOT NULL,
  status oauth_state_status NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE strava_connections (
  user_id text PRIMARY KEY REFERENCES users(id),
  strava_athlete_id text NOT NULL,
  status connection_status NOT NULL,
  accepted_scopes jsonb NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX strava_connections_athlete_uidx
  ON strava_connections(strava_athlete_id);
