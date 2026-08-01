CREATE TABLE archetype_snapshots (
  season_id text NOT NULL REFERENCES seasons(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  archetype text NOT NULL,
  confidence numeric NOT NULL,
  sample_size integer NOT NULL,
  sprint_relative_score numeric NOT NULL,
  climb_relative_score numeric NOT NULL,
  short_effort_score numeric NOT NULL,
  sustained_effort_score numeric NOT NULL,
  effective_at timestamptz NOT NULL,
  reasons jsonb NOT NULL,
  PRIMARY KEY (season_id, rider_id)
);
