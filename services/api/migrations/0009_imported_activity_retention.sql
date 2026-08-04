ALTER TABLE imported_activities ADD COLUMN imported_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE imported_activities ALTER COLUMN imported_at DROP DEFAULT;
