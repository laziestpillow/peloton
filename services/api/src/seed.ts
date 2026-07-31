import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadConfig } from "./config/env.js";
import { readFixture } from "./application/fixtureData.js";
import * as schema from "./infrastructure/database/schema.js";

type ActivityFixture = {
  data: Array<{
    id: string;
    riderId: string;
    provider: "strava" | "fixture";
    providerActivityId: string;
    activityType: string;
    startedAt: string;
    distanceMeters: number;
    elapsedTimeSeconds: number;
    movingTimeSeconds: number;
    elevationGainMeters: number;
    routeSummary: unknown;
    importStatus: "eligible" | "processing" | "processed" | "duplicate" | "unsupported" | "failed";
    processedStageId: string | null;
  }>;
};

type RecapFixture = {
  stageId: string;
  durationSeconds: number;
  riders: Array<{
    id: string;
    userId: string;
    displayName: string;
    appearance: {
      jerseyColor: string;
      accentColor: string;
      helmetColor: string;
      bikeColor: string;
      pattern: "solid" | "stripes" | "polkaDots";
    };
    createdAt: string;
    updatedAt: string;
  }>;
  markers: Array<{
    id: string;
    type: "sprint" | "climb";
    positionMeters: number;
    latitude: number;
    longitude: number;
    geofenceRadiusMeters: number;
    category?: number | null;
    pointsSchedule: number[];
  }>;
};

type StageResultsFixture = {
  stageId: string;
  markerResults: Array<{
    markerId: string;
    type: "sprint" | "climb";
    crossings: Array<{
      riderId: string;
      crossedAtSeconds: number;
      rank: number;
      points: number;
    }>;
  }>;
  classifications: Array<{
    stageId: string;
    riderId: string;
    sprintPoints: number;
    komPoints: number;
    finishBonus: number;
    todayTotal: number;
    gcTimeSeconds: number;
  }>;
};

type SeasonStandingsFixture = {
  seasonId: string;
  standings: Array<{
    seasonId: string;
    riderId: string;
    seasonTotal: number;
    rank: number;
    previousRank: number | null;
  }>;
};

type ArchetypeSnapshotDefaults = Omit<
  typeof schema.archetypeSnapshots.$inferInsert,
  "seasonId" | "riderId" | "sampleSize" | "effectiveAt"
>;

export type SeedData = Awaited<ReturnType<typeof buildSeedData>>;

const createdAt = new Date("2026-07-01T10:00:00Z");
const updatedAt = new Date("2026-07-20T10:00:00Z");

function asNumeric(value: number): string {
  return value.toString();
}

export async function buildSeedData() {
  const [activities, recap, stageResults, standings] = await Promise.all([
    readFixture<ActivityFixture>("activities.json"),
    readFixture<RecapFixture>("recap.json"),
    readFixture<StageResultsFixture>("stage-results.json"),
    readFixture<SeasonStandingsFixture>("season-standings.json")
  ]);

  const stageActivity = activities.data.find((activity) => activity.processedStageId === recap.stageId);
  const routeDistanceMeters = stageActivity?.distanceMeters ?? 42195;

  const users: Array<typeof schema.users.$inferInsert> = recap.riders.map((rider) => ({
    id: rider.userId,
    createdAt: new Date(rider.createdAt),
    updatedAt: new Date(rider.updatedAt)
  }));

  const riderProfiles: Array<typeof schema.riderProfiles.$inferInsert> = recap.riders.map((rider) => ({
    id: rider.id,
    userId: rider.userId,
    displayName: rider.displayName,
    jerseyColor: rider.appearance.jerseyColor,
    accentColor: rider.appearance.accentColor,
    helmetColor: rider.appearance.helmetColor,
    bikeColor: rider.appearance.bikeColor,
    pattern: rider.appearance.pattern,
    createdAt: new Date(rider.createdAt),
    updatedAt: new Date(rider.updatedAt)
  }));

  const groups: Array<typeof schema.groups.$inferInsert> = [{
    id: "group-001",
    name: "Barcelona Peloton",
    ownerId: "user-001",
    createdAt,
    updatedAt
  }];

  const groupMemberships: Array<typeof schema.groupMemberships.$inferInsert> = recap.riders.map((rider) => ({
    groupId: "group-001",
    riderId: rider.id,
    role: rider.userId === "user-001" ? "owner" : "member",
    status: "active",
    joinedAt: createdAt
  }));

  const seasons: Array<typeof schema.seasons.$inferInsert> = [{
    id: standings.seasonId,
    groupId: "group-001",
    name: "Barcelona July Series",
    status: "active",
    startsAt: createdAt,
    endsAt: null,
    createdAt,
    updatedAt
  }];

  const stages: Array<typeof schema.stages.$inferInsert> = [{
    id: recap.stageId,
    seasonId: standings.seasonId,
    name: "Barcelona Coast Loop",
    route: {
      distanceMeters: routeDistanceMeters,
      elevation: [
        { positionMeters: 0, altitudeMeters: 12 },
        ...recap.markers.map((marker) => ({
          positionMeters: marker.positionMeters,
          altitudeMeters: marker.type === "climb" ? 240 : 34
        })),
        { positionMeters: routeDistanceMeters, altitudeMeters: 18 }
      ]
    },
    scheduledAt: new Date("2026-07-18T07:30:00Z"),
    status: "completed",
    createdAt,
    updatedAt
  }];

  const importedActivities: Array<typeof schema.importedActivities.$inferInsert> = activities.data.map((activity) => ({
    id: activity.id,
    riderId: activity.riderId,
    provider: activity.provider,
    providerActivityId: activity.providerActivityId,
    activityType: activity.activityType,
    startedAt: new Date(activity.startedAt),
    distanceMeters: asNumeric(activity.distanceMeters),
    elapsedTimeSeconds: activity.elapsedTimeSeconds,
    movingTimeSeconds: activity.movingTimeSeconds,
    elevationGainMeters: asNumeric(activity.elevationGainMeters),
    routeSummary: activity.routeSummary,
    importStatus: activity.importStatus,
    processedStageId: activity.processedStageId
  }));

  const markers: Array<typeof schema.markers.$inferInsert> = recap.markers.map((marker, index) => ({
    id: marker.id,
    stageId: recap.stageId,
    type: marker.type,
    positionMeters: asNumeric(marker.positionMeters),
    latitude: asNumeric(marker.latitude),
    longitude: asNumeric(marker.longitude),
    geofenceRadiusMeters: asNumeric(marker.geofenceRadiusMeters),
    category: marker.category ?? null,
    pointsSchedule: marker.pointsSchedule,
    sortOrder: index + 1
  }));

  const rideResults: Array<typeof schema.rideResults.$inferInsert> = stageResults.classifications.map((result) => {
    const activity = activities.data.find((candidate) =>
      candidate.riderId === result.riderId
      && candidate.processedStageId === result.stageId
      && candidate.importStatus === "processed"
    );
    return {
      id: `ride-result-${result.stageId}-${result.riderId}`,
      stageId: result.stageId,
      riderId: result.riderId,
      importedActivityId: activity?.processedStageId === result.stageId ? activity.id : null,
      finishTimeSeconds: result.gcTimeSeconds,
      distanceMeters: asNumeric(activity?.distanceMeters ?? routeDistanceMeters),
      elapsedTimeSeconds: activity?.elapsedTimeSeconds ?? result.gcTimeSeconds,
      movingTimeSeconds: activity?.movingTimeSeconds ?? result.gcTimeSeconds,
      elevationGainMeters: asNumeric(activity?.elevationGainMeters ?? 680),
      routeSummary: activity?.routeSummary ?? {
        polyline: "fixture_polyline",
        previewBounds: {
          southWest: { latitude: 41.34, longitude: 2.08 },
          northEast: { latitude: 41.46, longitude: 2.22 }
        }
      }
    };
  });

  const markerCrossings: Array<typeof schema.markerCrossings.$inferInsert> = stageResults.markerResults.flatMap((markerResult) =>
    markerResult.crossings.map((crossing) => ({
      markerId: markerResult.markerId,
      riderId: crossing.riderId,
      crossedAtSeconds: crossing.crossedAtSeconds,
      rank: crossing.rank,
      points: crossing.points
    }))
  );

  const stageResultRows: Array<typeof schema.stageResults.$inferInsert> = stageResults.classifications.map((result) => ({
    stageId: result.stageId,
    riderId: result.riderId,
    sprintPoints: result.sprintPoints,
    komPoints: result.komPoints,
    finishBonus: result.finishBonus,
    todayTotal: result.todayTotal,
    gcTimeSeconds: result.gcTimeSeconds
  }));

  const seasonStandings: Array<typeof schema.seasonStandings.$inferInsert> = standings.standings.map((standing) => ({
    seasonId: standing.seasonId,
    riderId: standing.riderId,
    seasonTotal: standing.seasonTotal,
    rank: standing.rank,
    previousRank: standing.previousRank
  }));

  const archetypeSeedByRiderId: Record<string, ArchetypeSnapshotDefaults> = {
    "rider-001": {
      archetype: "sprinter",
      confidence: "0.82",
      sprintRelativeScore: "0.78",
      climbRelativeScore: "0.52",
      shortEffortScore: "0.74",
      sustainedEffortScore: "0.57",
      reasons: ["Strong sprint marker performance across completed fixture efforts."]
    },
    "rider-002": {
      archetype: "climber",
      confidence: "0.76",
      sprintRelativeScore: "0.58",
      climbRelativeScore: "0.74",
      shortEffortScore: "0.56",
      sustainedEffortScore: "0.69",
      reasons: ["Consistent climbing marker advantage across completed fixture efforts."]
    },
    "rider-003": {
      archetype: "allRounder",
      confidence: "0.64",
      sprintRelativeScore: "0.62",
      climbRelativeScore: "0.6",
      shortEffortScore: "0.61",
      sustainedEffortScore: "0.59",
      reasons: ["Balanced fixture marker results without a dominant specialization."]
    },
    "rider-004": {
      archetype: "rookie",
      confidence: "0.4",
      sprintRelativeScore: "0.5",
      climbRelativeScore: "0.48",
      shortEffortScore: "0.47",
      sustainedEffortScore: "0.46",
      reasons: ["Fixture sample remains too small for a confident specialization."]
    }
  };

  const archetypeSnapshots: Array<typeof schema.archetypeSnapshots.$inferInsert> = standings.standings.map((standing) => {
    const defaults = archetypeSeedByRiderId[standing.riderId];
    if (!defaults) {
      throw new Error(`Missing archetype seed defaults for ${standing.riderId}.`);
    }

    return {
      seasonId: standing.seasonId,
      riderId: standing.riderId,
      sampleSize: 5,
      effectiveAt: updatedAt,
      ...defaults
    };
  });

  const oauthStates: Array<typeof schema.oauthStates.$inferInsert> = [{
    state: "oauth-state-001",
    userId: "user-001",
    redirectUri: "peloton://strava/callback",
    scopes: ["read", "activity:read_all"],
    status: "pending",
    expiresAt: new Date("2026-07-20T10:10:00Z"),
    consumedAt: null,
    createdAt: updatedAt
  }];

  const stravaConnections: Array<typeof schema.stravaConnections.$inferInsert> = [{
    userId: "user-001",
    stravaAthleteId: "fixture-athlete-001",
    status: "connected",
    acceptedScopes: ["read", "activity:read_all"],
    accessTokenCiphertext: "fixture-access-ciphertext-placeholder",
    refreshTokenCiphertext: "fixture-refresh-ciphertext-placeholder",
    tokenExpiresAt: new Date("2026-07-20T16:00:00Z"),
    lastSyncedAt: new Date("2026-07-20T10:30:00Z"),
    createdAt,
    updatedAt
  }];

  return {
    users,
    riderProfiles,
    groups,
    groupMemberships,
    seasons,
    stages,
    importedActivities,
    markers,
    rideResults,
    markerCrossings,
    stageResults: stageResultRows,
    seasonStandings,
    archetypeSnapshots,
    oauthStates,
    stravaConnections
  };
}

export async function seedDatabase(databaseUrl = loadConfig().DATABASE_URL): Promise<SeedData> {
  const data = await buildSeedData();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    await db.insert(schema.users).values(data.users).onConflictDoNothing();
    await db.insert(schema.riderProfiles).values(data.riderProfiles).onConflictDoNothing();
    await db.insert(schema.groups).values(data.groups).onConflictDoNothing();
    await db.insert(schema.groupMemberships).values(data.groupMemberships).onConflictDoNothing();
    await db.insert(schema.seasons).values(data.seasons).onConflictDoNothing();
    await db.insert(schema.stages).values(data.stages).onConflictDoNothing();
    await db.insert(schema.importedActivities).values(data.importedActivities).onConflictDoNothing();
    await db.insert(schema.markers).values(data.markers).onConflictDoNothing();
    await db.insert(schema.rideResults).values(data.rideResults).onConflictDoNothing();
    await db.insert(schema.markerCrossings).values(data.markerCrossings).onConflictDoNothing();
    await db.insert(schema.stageResults).values(data.stageResults).onConflictDoNothing();
    await db.insert(schema.seasonStandings).values(data.seasonStandings).onConflictDoNothing();
    await db.insert(schema.archetypeSnapshots).values(data.archetypeSnapshots).onConflictDoNothing();
    await db.insert(schema.oauthStates).values(data.oauthStates).onConflictDoNothing();
    await db.insert(schema.stravaConnections).values(data.stravaConnections).onConflictDoNothing();
  } finally {
    await pool.end();
  }

  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seedDatabase();
  console.log("Seeded deterministic fixture data.");
}
