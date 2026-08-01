CREATE TABLE activity_stream_samples (
  activity_id text NOT NULL REFERENCES imported_activities(id),
  sequence integer NOT NULL,
  time_seconds integer NOT NULL,
  distance_meters numeric NOT NULL,
  latitude numeric,
  longitude numeric,
  altitude_meters numeric,
  velocity_meters_per_second numeric,
  PRIMARY KEY (activity_id, sequence)
);
