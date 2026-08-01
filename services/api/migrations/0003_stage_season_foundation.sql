CREATE TYPE marker_type AS ENUM ('sprint', 'climb');
CREATE TYPE stage_status AS ENUM ('scheduled', 'active', 'completed');

CREATE TABLE seasons (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES groups(id),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE stages (
  id text PRIMARY KEY,
  season_id text NOT NULL REFERENCES seasons(id),
  name text NOT NULL,
  distance_meters numeric NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status stage_status NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE stage_route_points (
  stage_id text NOT NULL REFERENCES stages(id),
  position_meters numeric NOT NULL,
  altitude_meters numeric NOT NULL,
  sequence integer NOT NULL,
  PRIMARY KEY (stage_id, sequence)
);

CREATE TABLE stage_markers (
  id text PRIMARY KEY,
  stage_id text NOT NULL REFERENCES stages(id),
  type marker_type NOT NULL,
  position_meters numeric NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  geofence_radius_meters numeric NOT NULL,
  category integer,
  points_schedule jsonb NOT NULL,
  sequence integer NOT NULL
);
