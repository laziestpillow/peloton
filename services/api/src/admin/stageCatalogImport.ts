import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { assertSafeDatabaseTask, loadConfig } from "../config/env.js";
import { runMigrations } from "../infrastructure/database/migrate.js";

const isoDateString = z.string().datetime({ offset: true });
const pointSchedule = z.array(z.number().int().nonnegative()).min(1);

export const stageCatalogSchema = z.object({
  seasons: z.array(z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    name: z.string().min(1),
    startsAt: isoDateString,
    endsAt: isoDateString.nullable().optional()
  })).min(1),
  stages: z.array(z.object({
    id: z.string().min(1),
    seasonId: z.string().min(1),
    name: z.string().min(1),
    scheduledAt: isoDateString,
    status: z.enum(["scheduled", "active", "completed"]),
    route: z.object({
      distanceMeters: z.number().positive(),
      elevation: z.array(z.object({
        positionMeters: z.number().nonnegative(),
        altitudeMeters: z.number()
      })).min(2)
    }),
    orderedMarkers: z.array(z.object({
      id: z.string().min(1),
      type: z.enum(["sprint", "climb"]),
      positionMeters: z.number().nonnegative(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      geofenceRadiusMeters: z.number().positive(),
      category: z.number().int().positive().nullable().optional(),
      pointsSchedule: pointSchedule
    }))
  })).min(1)
}).superRefine((catalog, context) => {
  const seasonIds = new Set(catalog.seasons.map((season) => season.id));
  for (const stage of catalog.stages) {
    if (!seasonIds.has(stage.seasonId)) {
      context.addIssue({
        code: "custom",
        path: ["stages", catalog.stages.indexOf(stage), "seasonId"],
        message: "Stage seasonId must reference a season in this catalog."
      });
    }

    const lastPosition = stage.route.elevation.at(-1)?.positionMeters ?? 0;
    if (lastPosition > stage.route.distanceMeters) {
      context.addIssue({
        code: "custom",
        path: ["stages", catalog.stages.indexOf(stage), "route", "elevation"],
        message: "Route elevation positions cannot exceed distanceMeters."
      });
    }

    for (const [index, marker] of stage.orderedMarkers.entries()) {
      if (marker.positionMeters > stage.route.distanceMeters) {
        context.addIssue({
          code: "custom",
          path: ["stages", catalog.stages.indexOf(stage), "orderedMarkers", index, "positionMeters"],
          message: "Marker positionMeters cannot exceed route distanceMeters."
        });
      }
    }
  }
});

export type StageCatalog = z.infer<typeof stageCatalogSchema>;

export function parseStageCatalog(payload: unknown): StageCatalog {
  return stageCatalogSchema.parse(payload);
}

export async function readStageCatalog(path: string): Promise<StageCatalog> {
  return parseStageCatalog(JSON.parse(await readFile(path, "utf8")));
}

export async function importStageCatalog(databaseUrl: string, catalog: StageCatalog, now = new Date()): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertCatalog(client, catalog, now);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function upsertCatalog(client: PoolClient, catalog: StageCatalog, now: Date): Promise<void> {
  for (const season of catalog.seasons) {
    await client.query(
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
      [season.id, season.groupId, season.name, season.startsAt, season.endsAt ?? null, now, now]
    );
  }

  for (const stage of catalog.stages) {
    await client.query(
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

    await client.query("DELETE FROM stage_route_points WHERE stage_id = $1", [stage.id]);
    for (const [index, routePoint] of stage.route.elevation.entries()) {
      await client.query(
        `
          INSERT INTO stage_route_points (stage_id, position_meters, altitude_meters, sequence)
          VALUES ($1, $2, $3, $4)
        `,
        [stage.id, routePoint.positionMeters, routePoint.altitudeMeters, index]
      );
    }

    for (const [index, marker] of stage.orderedMarkers.entries()) {
      await client.query(
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
    await client.query(
      `
        DELETE FROM stage_markers marker
        WHERE marker.stage_id = $1
          AND NOT (marker.id = ANY($2::text[]))
          AND NOT EXISTS (
            SELECT 1 FROM stage_marker_crossings crossing WHERE crossing.marker_id = marker.id
          )
      `,
      [stage.id, stage.orderedMarkers.map((marker) => marker.id)]
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalogPath = process.argv[2];
  if (!catalogPath) {
    throw new Error("Usage: pnpm stage-catalog:import <catalog.json>");
  }
  const config = loadConfig();
  assertSafeDatabaseTask(config, "stage import");
  await runMigrations(config.DATABASE_URL);
  await importStageCatalog(config.DATABASE_URL, await readStageCatalog(catalogPath));
  console.log(`Imported stage catalog from ${catalogPath}.`);
}
