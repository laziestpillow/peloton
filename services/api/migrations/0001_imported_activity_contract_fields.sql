ALTER TABLE imported_activities
  ADD COLUMN activity_type text NOT NULL DEFAULT 'ride',
  ADD COLUMN moving_time_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN import_status text NOT NULL DEFAULT 'eligible',
  ADD COLUMN processed_stage_id text;
