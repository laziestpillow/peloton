CREATE TABLE stage_activity_results (
  stage_id text NOT NULL REFERENCES stages(id),
  activity_id text NOT NULL REFERENCES imported_activities(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  finish_time_seconds integer NOT NULL,
  matched_at timestamptz NOT NULL,
  PRIMARY KEY (stage_id, rider_id),
  UNIQUE (activity_id)
);

CREATE TABLE stage_marker_crossings (
  stage_id text NOT NULL REFERENCES stages(id),
  marker_id text NOT NULL REFERENCES stage_markers(id),
  activity_id text NOT NULL REFERENCES imported_activities(id),
  rider_id text NOT NULL REFERENCES rider_profiles(id),
  crossed_at_seconds integer NOT NULL,
  rank integer NOT NULL,
  points integer NOT NULL,
  PRIMARY KEY (stage_id, marker_id, rider_id)
);
