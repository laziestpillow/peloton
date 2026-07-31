import { Pool } from "pg";
import { loadConfig } from "./config/env.js";
import { readFixture } from "./application/fixtureData.js";
import { runMigrations } from "./infrastructure/database/migrate.js";
import type { ActivityListResponse, RiderProfile } from "./domain/models.js";

interface RecapFixture {
  riders: readonly RiderProfile[];
}

async function seedDatabase(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const recap = await readFixture<RecapFixture>("recap.json");
  const activities = await readFixture<ActivityListResponse>("activities.json");
  const now = new Date("2026-07-01T10:00:00Z");

  try {
    for (const rider of recap.riders) {
      await pool.query(
        `
          INSERT INTO users (id, created_at, updated_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at
        `,
        [rider.userId, rider.createdAt, rider.updatedAt]
      );

      await pool.query(
        `
          INSERT INTO rider_profiles (
            id, user_id, display_name, jersey_color, accent_color, helmet_color, bike_color, pattern, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            jersey_color = EXCLUDED.jersey_color,
            accent_color = EXCLUDED.accent_color,
            helmet_color = EXCLUDED.helmet_color,
            bike_color = EXCLUDED.bike_color,
            pattern = EXCLUDED.pattern,
            updated_at = EXCLUDED.updated_at
        `,
        [
          rider.id,
          rider.userId,
          rider.displayName,
          rider.appearance.jerseyColor,
          rider.appearance.accentColor,
          rider.appearance.helmetColor,
          rider.appearance.bikeColor,
          rider.appearance.pattern,
          rider.createdAt,
          rider.updatedAt
        ]
      );
    }

    await pool.query(
      `
        INSERT INTO groups (id, name, owner_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          owner_id = EXCLUDED.owner_id,
          updated_at = EXCLUDED.updated_at
      `,
      ["group-001", "Fixture Club", "user-001", now, now]
    );

    for (const rider of recap.riders) {
      await pool.query(
        `
          INSERT INTO group_memberships (group_id, rider_id, role, status, joined_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (group_id, rider_id) DO UPDATE SET
            role = EXCLUDED.role,
            status = EXCLUDED.status
        `,
        ["group-001", rider.id, rider.userId === "user-001" ? "owner" : "member", "active", now]
      );
    }

    for (const activity of activities.data) {
      await pool.query(
        `
          INSERT INTO imported_activities (
            id, rider_id, provider, provider_activity_id, activity_type, started_at, distance_meters,
            elapsed_time_seconds, moving_time_seconds, elevation_gain_meters, route_summary, import_status, processed_stage_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
          ON CONFLICT (provider, provider_activity_id) DO UPDATE SET
            rider_id = EXCLUDED.rider_id,
            activity_type = EXCLUDED.activity_type,
            started_at = EXCLUDED.started_at,
            distance_meters = EXCLUDED.distance_meters,
            elapsed_time_seconds = EXCLUDED.elapsed_time_seconds,
            moving_time_seconds = EXCLUDED.moving_time_seconds,
            elevation_gain_meters = EXCLUDED.elevation_gain_meters,
            route_summary = EXCLUDED.route_summary,
            import_status = EXCLUDED.import_status,
            processed_stage_id = EXCLUDED.processed_stage_id
        `,
        [
          activity.id,
          activity.riderId,
          activity.provider,
          activity.providerActivityId,
          activity.activityType,
          activity.startedAt,
          activity.distanceMeters,
          activity.elapsedTimeSeconds,
          activity.movingTimeSeconds,
          activity.elevationGainMeters,
          JSON.stringify(activity.routeSummary),
          activity.importStatus,
          activity.processedStageId
        ]
      );
    }
  } finally {
    await pool.end();
  }
}

const config = loadConfig();
await runMigrations(config.DATABASE_URL);
await seedDatabase(config.DATABASE_URL);
console.log("Seeded deterministic fixture data into PostgreSQL.");
