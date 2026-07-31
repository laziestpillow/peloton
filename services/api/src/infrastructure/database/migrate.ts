import { Pool } from "pg";
import { loadConfig } from "../../config/env.js";

interface Migration {
  name: string;
  statements: readonly string[];
}

const migrations: readonly Migration[] = [
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
  }
];

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
  await runMigrations(config.DATABASE_URL);
}
