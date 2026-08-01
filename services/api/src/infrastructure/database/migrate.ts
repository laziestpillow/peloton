import { Pool } from "pg";
import { assertSafeDatabaseTask, loadConfig } from "../../config/env.js";

interface Migration {
  name: string;
  statements: readonly string[];
}

export const migrations: readonly Migration[] = [
  {
    name: "0000_initial.sql",
    statements: [
      "CREATE TYPE appearance_pattern AS ENUM ('solid', 'stripes', 'polkaDots')",
      "CREATE TYPE connection_status AS ENUM ('connected', 'expired', 'error', 'revoked')",
      `
        CREATE TABLE users (
          id text PRIMARY KEY,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `,
      `
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
        )
      `,
      `
        CREATE TABLE groups (
          id text PRIMARY KEY,
          name text NOT NULL,
          owner_id text NOT NULL REFERENCES users(id),
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `,
      `
        CREATE TABLE group_memberships (
          group_id text NOT NULL REFERENCES groups(id),
          rider_id text NOT NULL REFERENCES rider_profiles(id),
          role text NOT NULL,
          status text NOT NULL,
          joined_at timestamptz NOT NULL,
          PRIMARY KEY (group_id, rider_id)
        )
      `,
      `
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
        )
      `
    ]
  },
  {
    name: "0001_imported_activity_contract_fields.sql",
    statements: [
      `
        ALTER TABLE imported_activities
          ADD COLUMN activity_type text NOT NULL DEFAULT 'ride',
          ADD COLUMN moving_time_seconds integer NOT NULL DEFAULT 0,
          ADD COLUMN import_status text NOT NULL DEFAULT 'eligible',
          ADD COLUMN processed_stage_id text
      `
    ]
  },
  {
    name: "0002_strava_oauth_connection.sql",
    statements: [
      `
        CREATE TABLE strava_oauth_states (
          state text PRIMARY KEY,
          user_id text NOT NULL REFERENCES users(id),
          redirect_url text NOT NULL,
          expires_at timestamptz NOT NULL,
          consumed_at timestamptz,
          created_at timestamptz NOT NULL
        )
      `,
      `
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
        )
      `
    ]
  },
  {
    name: "0002_activity_sync_requests.sql",
    statements: [
      `
        CREATE TABLE activity_sync_requests (
          id text PRIMARY KEY,
          user_id text NOT NULL REFERENCES users(id),
          idempotency_key text,
          status text NOT NULL,
          requested_at timestamptz NOT NULL,
          completed_at timestamptz,
          UNIQUE (user_id, idempotency_key)
        )
      `
    ]
  },
  {
    name: "0003_stage_season_foundation.sql",
    statements: [
      "CREATE TYPE marker_type AS ENUM ('sprint', 'climb')",
      "CREATE TYPE stage_status AS ENUM ('scheduled', 'active', 'completed')",
      `
        CREATE TABLE seasons (
          id text PRIMARY KEY,
          group_id text NOT NULL REFERENCES groups(id),
          name text NOT NULL,
          starts_at timestamptz NOT NULL,
          ends_at timestamptz,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `,
      `
        CREATE TABLE stages (
          id text PRIMARY KEY,
          season_id text NOT NULL REFERENCES seasons(id),
          name text NOT NULL,
          distance_meters numeric NOT NULL,
          scheduled_at timestamptz NOT NULL,
          status stage_status NOT NULL,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `,
      `
        CREATE TABLE stage_route_points (
          stage_id text NOT NULL REFERENCES stages(id),
          position_meters numeric NOT NULL,
          altitude_meters numeric NOT NULL,
          sequence integer NOT NULL,
          PRIMARY KEY (stage_id, sequence)
        )
      `,
      `
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
        )
      `
    ]
  },
  {
    name: "0004_activity_stream_samples.sql",
    statements: [
      `
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
        )
      `
    ]
  },
  {
    name: "0005_stage_activity_matching.sql",
    statements: [
      `
        CREATE TABLE stage_activity_results (
          stage_id text NOT NULL REFERENCES stages(id),
          activity_id text NOT NULL REFERENCES imported_activities(id),
          rider_id text NOT NULL REFERENCES rider_profiles(id),
          finish_time_seconds integer NOT NULL,
          matched_at timestamptz NOT NULL,
          PRIMARY KEY (stage_id, rider_id),
          UNIQUE (activity_id)
        )
      `,
      `
        CREATE TABLE stage_marker_crossings (
          stage_id text NOT NULL REFERENCES stages(id),
          marker_id text NOT NULL REFERENCES stage_markers(id),
          activity_id text NOT NULL REFERENCES imported_activities(id),
          rider_id text NOT NULL REFERENCES rider_profiles(id),
          crossed_at_seconds integer NOT NULL,
          rank integer NOT NULL,
          points integer NOT NULL,
          PRIMARY KEY (stage_id, marker_id, rider_id)
        )
      `
    ]
  }
];

export const migrationNames = migrations.map((migration) => migration.name);

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(appliedResult.rows.map((row) => row.name));

    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        continue;
      }

      await pool.query("BEGIN");
      try {
        for (const statement of migration.statements) {
          await pool.query(statement);
        }
        await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
        await pool.query("COMMIT");
        console.log(`Applied migration ${migration.name}.`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  assertSafeDatabaseTask(config, "migration");
  await runMigrations(config.DATABASE_URL);
}
