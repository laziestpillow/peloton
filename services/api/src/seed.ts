import { Pool } from "pg";
import { assertSafeDatabaseTask, loadConfig } from "./config/env.js";
import { readFixture } from "./application/fixtureData.js";
import { runMigrations } from "./infrastructure/database/migrate.js";
import type { ActivityListResponse, RiderProfile, SeasonArchetypesResponse, SeasonStandingsResponse, Stage, StageResultsResponse } from "./domain/models.js";

interface RecapFixture {
  riders: readonly RiderProfile[];
}

async function seedDatabase(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const recap = await readFixture<RecapFixture>("recap.json");
  const activities = await readFixture<ActivityListResponse>("activities.json");
  const stages = await readFixture<{ data: readonly Stage[] }>("stages.json");
  const stageResults = await readFixture<StageResultsResponse>("stage-results.json");
  const seasonStandings = await readFixture<SeasonStandingsResponse>("season-standings.json");
  const seasonArchetypes = await readFixture<SeasonArchetypesResponse>("archetypes.json");
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

    await pool.query(
      `
        INSERT INTO seasons (id, group_id, name, starts_at, ends_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          group_id = EXCLUDED.group_id,
          name = EXCLUDED.name,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          updated_at = EXCLUDED.updated_at
      `,
      ["season-001", "group-001", "Fixture Season", new Date("2026-07-01T00:00:00Z"), null, now, now]
    );

    for (const stage of stages.data) {
      await pool.query(
        `
          INSERT INTO stages (id, season_id, name, distance_meters, scheduled_at, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            season_id = EXCLUDED.season_id,
            name = EXCLUDED.name,
            distance_meters = EXCLUDED.distance_meters,
            scheduled_at = EXCLUDED.scheduled_at,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `,
        [stage.id, stage.seasonId, stage.name, stage.route.distanceMeters, stage.scheduledAt, stage.status, now, now]
      );

      for (const [index, routePoint] of stage.route.elevation.entries()) {
        await pool.query(
          `
            INSERT INTO stage_route_points (stage_id, position_meters, altitude_meters, sequence)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (stage_id, sequence) DO UPDATE SET
              position_meters = EXCLUDED.position_meters,
              altitude_meters = EXCLUDED.altitude_meters
          `,
          [stage.id, routePoint.positionMeters, routePoint.altitudeMeters, index]
        );
      }

      for (const [index, marker] of stage.orderedMarkers.entries()) {
        await pool.query(
          `
            INSERT INTO stage_markers (
              id, stage_id, type, position_meters, latitude, longitude, geofence_radius_meters, category, points_schedule, sequence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
            ON CONFLICT (id) DO UPDATE SET
              stage_id = EXCLUDED.stage_id,
              type = EXCLUDED.type,
              position_meters = EXCLUDED.position_meters,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              geofence_radius_meters = EXCLUDED.geofence_radius_meters,
              category = EXCLUDED.category,
              points_schedule = EXCLUDED.points_schedule,
              sequence = EXCLUDED.sequence
          `,
          [
            marker.id,
            stage.id,
            marker.type,
            marker.positionMeters,
            marker.latitude,
            marker.longitude,
            marker.geofenceRadiusMeters,
            marker.category ?? null,
            JSON.stringify(marker.pointsSchedule),
            index
          ]
        );
      }
    }

    for (const activity of activities.data) {
      await pool.query(
        `
          INSERT INTO imported_activities (
            id, rider_id, provider, provider_activity_id, activity_type, started_at, distance_meters,
            elapsed_time_seconds, moving_time_seconds, elevation_gain_meters, route_summary, import_status, processed_stage_id, imported_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
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
            processed_stage_id = EXCLUDED.processed_stage_id,
            imported_at = EXCLUDED.imported_at
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
          activity.processedStageId,
          now
        ]
      );
    }

    const activityByStageAndRider = new Map(
      activities.data
        .filter((activity) => activity.processedStageId)
        .map((activity) => [`${activity.processedStageId}:${activity.riderId}`, activity])
    );

    for (const classification of stageResults.classifications) {
      const matchedActivity = activityByStageAndRider.get(`${classification.stageId}:${classification.riderId}`);
      if (matchedActivity) {
        await pool.query(
          `
            INSERT INTO stage_activity_results (stage_id, activity_id, rider_id, finish_time_seconds, matched_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (stage_id, rider_id) DO UPDATE SET
              activity_id = EXCLUDED.activity_id,
              finish_time_seconds = EXCLUDED.finish_time_seconds,
              matched_at = EXCLUDED.matched_at
          `,
          [classification.stageId, matchedActivity.id, classification.riderId, classification.gcTimeSeconds, now]
        );
      }

      await pool.query(
        `
          INSERT INTO stage_classifications (
            stage_id, rider_id, sprint_points, kom_points, finish_bonus, today_total, gc_time_seconds
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (stage_id, rider_id) DO UPDATE SET
            sprint_points = EXCLUDED.sprint_points,
            kom_points = EXCLUDED.kom_points,
            finish_bonus = EXCLUDED.finish_bonus,
            today_total = EXCLUDED.today_total,
            gc_time_seconds = EXCLUDED.gc_time_seconds
        `,
        [
          classification.stageId,
          classification.riderId,
          classification.sprintPoints,
          classification.komPoints,
          classification.finishBonus,
          classification.todayTotal,
          classification.gcTimeSeconds
        ]
      );
    }

    for (const markerResult of stageResults.markerResults) {
      for (const crossing of markerResult.crossings) {
        const matchedActivity = activityByStageAndRider.get(`${stageResults.stageId}:${crossing.riderId}`);
        if (!matchedActivity) {
          continue;
        }
        await pool.query(
          `
            INSERT INTO stage_marker_crossings (
              stage_id, marker_id, activity_id, rider_id, crossed_at_seconds, rank, points
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (stage_id, marker_id, rider_id) DO UPDATE SET
              activity_id = EXCLUDED.activity_id,
              crossed_at_seconds = EXCLUDED.crossed_at_seconds,
              rank = EXCLUDED.rank,
              points = EXCLUDED.points
          `,
          [stageResults.stageId, markerResult.markerId, matchedActivity.id, crossing.riderId, crossing.crossedAtSeconds, crossing.rank, crossing.points]
        );
      }
    }

    for (const standing of seasonStandings.standings) {
      await pool.query(
        `
          INSERT INTO season_standings (season_id, rider_id, season_total, rank, previous_rank)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (season_id, rider_id) DO UPDATE SET
            season_total = EXCLUDED.season_total,
            rank = EXCLUDED.rank,
            previous_rank = EXCLUDED.previous_rank
        `,
        [standing.seasonId, standing.riderId, standing.seasonTotal, standing.rank, standing.previousRank]
      );
    }

    for (const snapshot of seasonArchetypes.data) {
      await pool.query(
        `
          INSERT INTO archetype_snapshots (
            season_id, rider_id, archetype, confidence, sample_size, sprint_relative_score, climb_relative_score,
            short_effort_score, sustained_effort_score, effective_at, reasons
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
          ON CONFLICT (season_id, rider_id) DO UPDATE SET
            archetype = EXCLUDED.archetype,
            confidence = EXCLUDED.confidence,
            sample_size = EXCLUDED.sample_size,
            sprint_relative_score = EXCLUDED.sprint_relative_score,
            climb_relative_score = EXCLUDED.climb_relative_score,
            short_effort_score = EXCLUDED.short_effort_score,
            sustained_effort_score = EXCLUDED.sustained_effort_score,
            effective_at = EXCLUDED.effective_at,
            reasons = EXCLUDED.reasons
        `,
        [
          snapshot.seasonId,
          snapshot.riderId,
          snapshot.archetype,
          snapshot.confidence,
          snapshot.sampleSize,
          snapshot.sprintRelativeScore,
          snapshot.climbRelativeScore,
          snapshot.shortEffortScore,
          snapshot.sustainedEffortScore,
          snapshot.effectiveAt,
          JSON.stringify(snapshot.reasons)
        ]
      );
    }
  } finally {
    await pool.end();
  }
}

const config = loadConfig();
assertSafeDatabaseTask(config, "seed");
await runMigrations(config.DATABASE_URL);
await seedDatabase(config.DATABASE_URL);
console.log("Seeded deterministic fixture data into PostgreSQL.");
