CREATE TABLE stage_classifications (
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
