import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";

const root = resolve(process.cwd(), "../..");

const activitiesSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    riderId: z.string(),
    provider: z.enum(["strava", "fixture"]),
    providerActivityId: z.string(),
    activityType: z.literal("ride"),
    startedAt: z.string().datetime(),
    distanceMeters: z.number(),
    elapsedTimeSeconds: z.number().int(),
    movingTimeSeconds: z.number().int(),
    elevationGainMeters: z.number(),
    importStatus: z.enum(["eligible", "processing", "processed", "duplicate", "unsupported", "failed"]),
    processedStageId: z.string().nullable()
  })),
  pagination: z.object({ nextCursor: z.string().nullable() })
});

const recapSchema = z.object({
  stageId: z.string(),
  durationSeconds: z.number().int(),
  riders: z.array(z.object({ id: z.string(), displayName: z.string() }).passthrough()),
  markers: z.array(z.object({ id: z.string(), type: z.enum(["sprint", "climb"]) }).passthrough()),
  timeline: z.array(z.object({ timeSeconds: z.number().int(), positions: z.array(z.object({ riderId: z.string() }).passthrough()) }))
});

const markerSchema = z.object({
  id: z.string(),
  type: z.enum(["sprint", "climb"]),
  positionMeters: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  geofenceRadiusMeters: z.number(),
  category: z.number().int().min(1).max(4).nullable().optional(),
  pointsSchedule: z.array(z.number().int())
});

const stagesSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    seasonId: z.string(),
    name: z.string(),
    route: z.object({
      distanceMeters: z.number(),
      elevation: z.array(z.object({
        positionMeters: z.number(),
        altitudeMeters: z.number()
      }))
    }),
    orderedMarkers: z.array(markerSchema),
    scheduledAt: z.string().datetime(),
    status: z.enum(["scheduled", "active", "completed"])
  }))
});

const stageResultsSchema = z.object({
  stageId: z.string(),
  markerResults: z.array(z.object({ markerId: z.string(), crossings: z.array(z.object({ riderId: z.string(), rank: z.number().int(), points: z.number().int() })) })),
  classifications: z.array(z.object({ riderId: z.string(), todayTotal: z.number().int() })),
  jerseyLeaders: z.object({ green: z.string(), polkaDot: z.string(), yellow: z.string() })
});

const standingsSchema = z.object({
  seasonId: z.string(),
  standings: z.array(z.object({ riderId: z.string(), seasonTotal: z.number().int(), rank: z.number().int() }))
});

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

export async function checkContract(): Promise<void> {
  YAML.parse(await readFile(resolve(root, "contracts/openapi.yaml"), "utf8"));
  activitiesSchema.parse(await readJson("contracts/fixtures/activities.json"));
  stagesSchema.parse(await readJson("contracts/fixtures/stages.json"));
  recapSchema.parse(await readJson("contracts/fixtures/recap.json"));
  stageResultsSchema.parse(await readJson("contracts/fixtures/stage-results.json"));
  standingsSchema.parse(await readJson("contracts/fixtures/season-standings.json"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await checkContract();
  console.log("OpenAPI syntax and fixture payloads are valid.");
}
