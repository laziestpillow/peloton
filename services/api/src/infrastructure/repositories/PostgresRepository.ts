import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type {
  ActivitySyncStart,
  ActivityStageMatchInput,
  ApplicationRepository,
  ActivityStreamSamplesInput,
  ImportedActivityInput,
  StravaConnection,
  StravaConnectionInput,
  StravaConnectionUpdate,
  StravaOAuthState
} from "../../application/useCases.js";
import type {
  ActivityListResponse,
  ActivityStreamSample,
  Group,
  GroupMembership,
  ImportedActivity,
  Marker,
  RiderAppearance,
  RiderProfile,
  RouteSummary,
  SeasonStanding,
  SeasonStandingsResponse,
  Stage,
  StageResultsResponse,
  StageScore,
  StageMarkerCrossing
} from "../../domain/models.js";
import { materializeSeasonStandings, materializeStageResults } from "../../domain/resultMaterialization.js";
import type { Database } from "../database/client.js";
import {
  activityStreamSamples,
  activitySyncRequests,
  groupMemberships,
  groups,
  importedActivities,
  riderProfiles,
  seasons,
  seasonStandings,
  stageActivityResults,
  stageClassifications,
  stageMarkers,
  stageMarkerCrossings,
  stageRoutePoints,
  stages,
  stravaConnections,
  stravaOAuthStates
} from "../database/schema.js";

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toRiderProfile(row: typeof riderProfiles.$inferSelect): RiderProfile {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    appearance: {
      jerseyColor: row.jerseyColor,
      accentColor: row.accentColor,
      helmetColor: row.helmetColor,
      bikeColor: row.bikeColor,
      pattern: row.pattern
    },
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  };
}

function toImportedActivity(row: typeof importedActivities.$inferSelect): ImportedActivity {
  return {
    id: row.id,
    riderId: row.riderId,
    provider: row.provider === "strava" ? "strava" : "fixture",
    providerActivityId: row.providerActivityId,
    activityType: toActivityType(row.activityType),
    startedAt: toIsoString(row.startedAt),
    distanceMeters: row.distanceMeters,
    elapsedTimeSeconds: row.elapsedTimeSeconds,
    movingTimeSeconds: row.movingTimeSeconds,
    elevationGainMeters: row.elevationGainMeters,
    routeSummary: row.routeSummary as RouteSummary,
    importStatus: toImportStatus(row.importStatus),
    processedStageId: row.processedStageId
  };
}

function toActivityType(value: string): ImportedActivity["activityType"] {
  return value === "ride" ? "ride" : "ride";
}

function toImportStatus(value: string): ImportedActivity["importStatus"] {
  switch (value) {
    case "eligible":
    case "processing":
    case "processed":
    case "duplicate":
    case "unsupported":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

function toGroup(row: typeof groups.$inferSelect): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  };
}

function toGroupMembership(row: typeof groupMemberships.$inferSelect): GroupMembership {
  return {
    groupId: row.groupId,
    riderId: row.riderId,
    role: row.role === "owner" ? "owner" : "member",
    status: toMembershipStatus(row.status),
    joinedAt: toIsoString(row.joinedAt)
  };
}

function toPointsSchedule(value: unknown): readonly number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
}

function toMarker(row: typeof stageMarkers.$inferSelect): Marker {
  return {
    id: row.id,
    type: row.type,
    positionMeters: row.positionMeters,
    latitude: row.latitude,
    longitude: row.longitude,
    geofenceRadiusMeters: row.geofenceRadiusMeters,
    category: row.category,
    pointsSchedule: toPointsSchedule(row.pointsSchedule)
  };
}

function toStage(
  row: typeof stages.$inferSelect,
  routeRows: readonly (typeof stageRoutePoints.$inferSelect)[],
  markerRows: readonly (typeof stageMarkers.$inferSelect)[]
): Stage {
  return {
    id: row.id,
    seasonId: row.seasonId,
    name: row.name,
    route: {
      distanceMeters: row.distanceMeters,
      elevation: routeRows.map((routePoint) => ({
        positionMeters: routePoint.positionMeters,
        altitudeMeters: routePoint.altitudeMeters
      }))
    },
    orderedMarkers: markerRows.map(toMarker),
    scheduledAt: toIsoString(row.scheduledAt),
    status: row.status
  };
}

function toStageMarkerCrossing(row: typeof stageMarkerCrossings.$inferSelect): StageMarkerCrossing {
  return {
    stageId: row.stageId,
    markerId: row.markerId,
    activityId: row.activityId,
    riderId: row.riderId,
    crossedAtSeconds: row.crossedAtSeconds,
    rank: row.rank,
    points: row.points
  };
}

function toStageScore(row: typeof stageClassifications.$inferSelect): StageScore {
  return {
    stageId: row.stageId,
    riderId: row.riderId,
    sprintPoints: row.sprintPoints,
    komPoints: row.komPoints,
    finishBonus: row.finishBonus,
    todayTotal: row.todayTotal,
    gcTimeSeconds: row.gcTimeSeconds
  };
}

function toSeasonStanding(row: typeof seasonStandings.$inferSelect): SeasonStanding {
  return {
    seasonId: row.seasonId,
    riderId: row.riderId,
    seasonTotal: row.seasonTotal,
    rank: row.rank,
    previousRank: row.previousRank
  };
}

function toMembershipStatus(value: string): GroupMembership["status"] {
  switch (value) {
    case "active":
    case "invited":
    case "removed":
      return value;
    default:
      return "removed";
  }
}

function toStravaOAuthState(row: typeof stravaOAuthStates.$inferSelect): StravaOAuthState {
  return {
    state: row.state,
    userId: row.userId,
    redirectUrl: row.redirectUrl,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    createdAt: row.createdAt
  };
}

function toStravaConnection(row: typeof stravaConnections.$inferSelect): StravaConnection {
  return {
    userId: row.userId,
    athleteId: row.athleteId,
    acceptedScopes: Array.isArray(row.acceptedScopes) ? row.acceptedScopes.map(String) : [],
    encryptedAccessToken: row.encryptedAccessToken,
    encryptedRefreshToken: row.encryptedRefreshToken,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt
  };
}

export class PostgresRepository implements ApplicationRepository {
  constructor(private readonly db: Database) {}

  async listActivities(userId: string): Promise<ActivityListResponse> {
    const rows = await this.db
      .select({ activity: importedActivities })
      .from(importedActivities)
      .innerJoin(riderProfiles, eq(importedActivities.riderId, riderProfiles.id))
      .where(eq(riderProfiles.userId, userId))
      .orderBy(asc(importedActivities.startedAt));
    return {
      data: rows.map((row) => toImportedActivity(row.activity)),
      pagination: { nextCursor: null }
    };
  }

  async getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null> {
    const [row] = await this.db
      .select({ activity: importedActivities })
      .from(importedActivities)
      .innerJoin(riderProfiles, eq(importedActivities.riderId, riderProfiles.id))
      .where(and(eq(importedActivities.id, input.activityId), eq(riderProfiles.userId, input.userId)))
      .limit(1);
    return row ? toImportedActivity(row.activity) : null;
  }

  async getCurrentRider(userId: string): Promise<RiderProfile | null> {
    const [row] = await this.db.select().from(riderProfiles).where(eq(riderProfiles.userId, userId)).limit(1);
    return row ? toRiderProfile(row) : null;
  }

  async updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null> {
    const now = new Date();
    const [row] = await this.db
      .update(riderProfiles)
      .set({
        jerseyColor: appearance.jerseyColor,
        accentColor: appearance.accentColor,
        helmetColor: appearance.helmetColor,
        bikeColor: appearance.bikeColor,
        pattern: appearance.pattern,
        updatedAt: now
      })
      .where(eq(riderProfiles.userId, userId))
      .returning();
    return row ? toRiderProfile(row) : null;
  }

  async createGroup(input: { name: string; ownerId: string }): Promise<Group> {
    const now = new Date();
    const [row] = await this.db
      .insert(groups)
      .values({
        id: `group-${randomUUID()}`,
        name: input.name,
        ownerId: input.ownerId,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    if (!row) {
      throw new Error("Group insert did not return a row.");
    }
    return toGroup(row);
  }

  async getGroup(groupId: string): Promise<Group | null> {
    const [row] = await this.db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    return row ? toGroup(row) : null;
  }

  async getGroupMembershipForUser(input: { groupId: string; userId: string }): Promise<GroupMembership | null> {
    const [row] = await this.db
      .select({ membership: groupMemberships })
      .from(groupMemberships)
      .innerJoin(riderProfiles, eq(groupMemberships.riderId, riderProfiles.id))
      .where(and(eq(groupMemberships.groupId, input.groupId), eq(riderProfiles.userId, input.userId)))
      .limit(1);
    return row ? toGroupMembership(row.membership) : null;
  }

  async addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership> {
    const [row] = await this.db
      .insert(groupMemberships)
      .values({
        groupId: input.groupId,
        riderId: input.riderId,
        role: "member",
        status: "active",
        joinedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [groupMemberships.groupId, groupMemberships.riderId],
        set: { role: "member", status: "active" }
      })
      .returning();
    if (!row) {
      throw new Error("Group membership insert did not return a row.");
    }
    return toGroupMembership(row);
  }

  async listGroupStages(groupId: string): Promise<{ data: readonly Stage[] }> {
    const rows = await this.db
      .select({ stage: stages })
      .from(stages)
      .innerJoin(seasons, eq(stages.seasonId, seasons.id))
      .where(eq(seasons.groupId, groupId))
      .orderBy(asc(stages.scheduledAt));
    const data = await Promise.all(rows.map((row) => this.getStage(row.stage.id)));
    return { data: data.filter((stage): stage is Stage => stage !== null) };
  }

  async getStage(stageId: string): Promise<Stage | null> {
    const [stage] = await this.db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
    if (!stage) {
      return null;
    }

    const [routeRows, markerRows] = await Promise.all([
      this.db
        .select()
        .from(stageRoutePoints)
        .where(eq(stageRoutePoints.stageId, stageId))
        .orderBy(asc(stageRoutePoints.sequence)),
      this.db.select().from(stageMarkers).where(eq(stageMarkers.stageId, stageId)).orderBy(asc(stageMarkers.sequence))
    ]);
    return toStage(stage, routeRows, markerRows);
  }

  async getStageGroupId(stageId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ groupId: seasons.groupId })
      .from(stages)
      .innerJoin(seasons, eq(stages.seasonId, seasons.id))
      .where(eq(stages.id, stageId))
      .limit(1);
    return row?.groupId ?? null;
  }

  async createStravaOAuthState(input: StravaOAuthState): Promise<void> {
    await this.db.insert(stravaOAuthStates).values({
      state: input.state,
      userId: input.userId,
      redirectUrl: input.redirectUrl,
      expiresAt: input.expiresAt,
      consumedAt: input.consumedAt,
      createdAt: input.createdAt
    });
  }

  async getStravaOAuthState(state: string): Promise<StravaOAuthState | null> {
    const [row] = await this.db.select().from(stravaOAuthStates).where(eq(stravaOAuthStates.state, state)).limit(1);
    return row ? toStravaOAuthState(row) : null;
  }

  async consumeStravaOAuthState(input: { state: string; consumedAt: Date }): Promise<void> {
    await this.db
      .update(stravaOAuthStates)
      .set({ consumedAt: input.consumedAt })
      .where(eq(stravaOAuthStates.state, input.state));
  }

  async upsertStravaConnection(input: StravaConnectionInput): Promise<void> {
    const now = new Date();
    await this.db
      .insert(stravaConnections)
      .values({
        userId: input.userId,
        athleteId: input.athleteId,
        acceptedScopes: input.acceptedScopes,
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        status: input.status,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: stravaConnections.userId,
        set: {
          athleteId: input.athleteId,
          acceptedScopes: input.acceptedScopes,
          encryptedAccessToken: input.encryptedAccessToken,
          encryptedRefreshToken: input.encryptedRefreshToken,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          status: input.status,
          updatedAt: now
        }
      });
  }

  async getStravaConnection(userId: string): Promise<StravaConnection | null> {
    const [row] = await this.db.select().from(stravaConnections).where(eq(stravaConnections.userId, userId)).limit(1);
    return row ? toStravaConnection(row) : null;
  }

  async updateStravaConnection(input: StravaConnectionUpdate): Promise<void> {
    await this.db
      .update(stravaConnections)
      .set({
        athleteId: input.athleteId,
        acceptedScopes: input.acceptedScopes,
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        status: input.status,
        ...(input.lastSyncedAt !== undefined ? { lastSyncedAt: input.lastSyncedAt } : {}),
        updatedAt: new Date()
      })
      .where(eq(stravaConnections.userId, input.userId));
  }

  async beginActivitySync(input: { userId: string; idempotencyKey: string | null; requestedAt: Date }): Promise<ActivitySyncStart> {
    if (input.idempotencyKey) {
      const [existing] = await this.db
        .select()
        .from(activitySyncRequests)
        .where(and(eq(activitySyncRequests.userId, input.userId), eq(activitySyncRequests.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing) {
        return { syncId: existing.id, status: "alreadyRunning", requestedAt: existing.requestedAt };
      }
    }

    const [running] = await this.db
      .select()
      .from(activitySyncRequests)
      .where(and(eq(activitySyncRequests.userId, input.userId), eq(activitySyncRequests.status, "running")))
      .limit(1);
    if (running) {
      return { syncId: running.id, status: "alreadyRunning", requestedAt: running.requestedAt };
    }

    const syncId = `sync-${randomUUID()}`;
    await this.db.insert(activitySyncRequests).values({
      id: syncId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      status: "running",
      requestedAt: input.requestedAt,
      completedAt: null
    });
    return { syncId, status: "accepted", requestedAt: input.requestedAt };
  }

  async completeActivitySync(input: { syncId: string; userId: string; status: "completed" | "failed"; completedAt: Date }): Promise<void> {
    await this.db
      .update(activitySyncRequests)
      .set({ status: input.status, completedAt: input.completedAt })
      .where(and(eq(activitySyncRequests.id, input.syncId), eq(activitySyncRequests.userId, input.userId)));
  }

  async upsertImportedActivity(input: ImportedActivityInput): Promise<{ activity: ImportedActivity; duplicate: boolean }> {
    const [existing] = await this.db
      .select()
      .from(importedActivities)
      .where(and(eq(importedActivities.provider, input.provider), eq(importedActivities.providerActivityId, input.providerActivityId)))
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(importedActivities)
        .set({ importStatus: "duplicate" })
        .where(eq(importedActivities.id, existing.id))
        .returning();
      if (!row) {
        throw new Error("Imported activity duplicate update did not return a row.");
      }
      return { activity: toImportedActivity(row), duplicate: true };
    }

    const [row] = await this.db
      .insert(importedActivities)
      .values({
        id: `activity-${randomUUID()}`,
        riderId: input.riderId,
        provider: input.provider,
        providerActivityId: input.providerActivityId,
        activityType: input.activityType,
        startedAt: input.startedAt,
        distanceMeters: input.distanceMeters,
        elapsedTimeSeconds: input.elapsedTimeSeconds,
        movingTimeSeconds: input.movingTimeSeconds,
        elevationGainMeters: input.elevationGainMeters,
        routeSummary: input.routeSummary,
        importStatus: input.importStatus,
        processedStageId: input.processedStageId
      })
      .returning();
    if (!row) {
      throw new Error("Imported activity insert did not return a row.");
    }
    return { activity: toImportedActivity(row), duplicate: false };
  }

  async replaceActivityStreamSamples(input: ActivityStreamSamplesInput): Promise<void> {
    await this.db.delete(activityStreamSamples).where(eq(activityStreamSamples.activityId, input.activityId));
    if (input.samples.length === 0) {
      return;
    }

    await this.db.insert(activityStreamSamples).values(input.samples.map((sample: ActivityStreamSample) => ({
      activityId: input.activityId,
      sequence: sample.sequence,
      timeSeconds: sample.timeSeconds,
      distanceMeters: sample.distanceMeters,
      latitude: sample.latitude,
      longitude: sample.longitude,
      altitudeMeters: sample.altitudeMeters,
      velocityMetersPerSecond: sample.velocityMetersPerSecond
    })));
  }

  async listMatchableStages(): Promise<readonly Stage[]> {
    const rows = await this.db.select({ id: stages.id }).from(stages).orderBy(asc(stages.scheduledAt));
    const data = await Promise.all(rows.map((row) => this.getStage(row.id)));
    return data.filter((stage): stage is Stage => stage !== null);
  }

  async listStageMarkerCrossings(stageId: string): Promise<readonly StageMarkerCrossing[]> {
    const rows = await this.db
      .select()
      .from(stageMarkerCrossings)
      .where(eq(stageMarkerCrossings.stageId, stageId))
      .orderBy(asc(stageMarkerCrossings.markerId), asc(stageMarkerCrossings.rank));
    return rows.map(toStageMarkerCrossing);
  }

  async saveActivityStageMatch(input: ActivityStageMatchInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(stageActivityResults)
        .values({
          stageId: input.stageId,
          activityId: input.activityId,
          riderId: input.riderId,
          finishTimeSeconds: input.finishTimeSeconds,
          matchedAt: input.matchedAt
        })
        .onConflictDoUpdate({
          target: [stageActivityResults.stageId, stageActivityResults.riderId],
          set: {
            activityId: input.activityId,
            finishTimeSeconds: input.finishTimeSeconds,
            matchedAt: input.matchedAt
          }
        });

      await tx
        .update(importedActivities)
        .set({ importStatus: "processing", processedStageId: input.stageId })
        .where(eq(importedActivities.id, input.activityId));

      if (input.markerCrossings.length === 0) {
        await tx
          .delete(stageMarkerCrossings)
          .where(and(eq(stageMarkerCrossings.stageId, input.stageId), eq(stageMarkerCrossings.riderId, input.riderId)));
      } else {
        const markerIds = [...new Set(input.markerCrossings.map((crossing) => crossing.markerId))];
        for (const markerId of markerIds) {
          await tx
            .delete(stageMarkerCrossings)
            .where(and(eq(stageMarkerCrossings.stageId, input.stageId), eq(stageMarkerCrossings.markerId, markerId)));
        }

        await tx.insert(stageMarkerCrossings).values(input.markerCrossings.map((crossing) => ({
          stageId: crossing.stageId,
          markerId: crossing.markerId,
          activityId: crossing.activityId,
          riderId: crossing.riderId,
          crossedAtSeconds: crossing.crossedAtSeconds,
          rank: crossing.rank,
          points: crossing.points
        })));
      }

      const [stageRow] = await tx.select().from(stages).where(eq(stages.id, input.stageId)).limit(1);
      if (!stageRow) {
        return;
      }

      const markerRows = await tx.select().from(stageMarkers).where(eq(stageMarkers.stageId, input.stageId)).orderBy(asc(stageMarkers.sequence));
      const resultRows = await tx.select().from(stageActivityResults).where(eq(stageActivityResults.stageId, input.stageId));
      const crossingRows = await tx.select().from(stageMarkerCrossings).where(eq(stageMarkerCrossings.stageId, input.stageId));
      const stageResults = materializeStageResults(
        toStage(stageRow, [], markerRows),
        resultRows.map((result) => ({
          riderId: result.riderId,
          finishTimeSeconds: result.finishTimeSeconds
        })),
        crossingRows.map(toStageMarkerCrossing)
      );

      await tx.delete(stageClassifications).where(eq(stageClassifications.stageId, input.stageId));
      if (stageResults.classifications.length > 0) {
        await tx.insert(stageClassifications).values(stageResults.classifications.map((score) => ({
          stageId: score.stageId,
          riderId: score.riderId,
          sprintPoints: score.sprintPoints,
          komPoints: score.komPoints,
          finishBonus: score.finishBonus,
          todayTotal: score.todayTotal,
          gcTimeSeconds: score.gcTimeSeconds
        })));
      }

      const previousRows = await tx.select().from(seasonStandings).where(eq(seasonStandings.seasonId, stageRow.seasonId));
      const previousRanks = new Map(previousRows.map((standing) => [standing.riderId, standing.rank]));
      const seasonScoreRows = await tx
        .select({ classification: stageClassifications })
        .from(stageClassifications)
        .innerJoin(stages, eq(stageClassifications.stageId, stages.id))
        .where(eq(stages.seasonId, stageRow.seasonId));
      const standings = materializeSeasonStandings(
        stageRow.seasonId,
        seasonScoreRows.map((row) => toStageScore(row.classification)),
        [...previousRanks.entries()].map(([riderId, rank]) => ({ riderId, rank }))
      ).standings;

      await tx.delete(seasonStandings).where(eq(seasonStandings.seasonId, stageRow.seasonId));
      if (standings.length > 0) {
        await tx.insert(seasonStandings).values(standings.map((standing) => ({
          seasonId: standing.seasonId,
          riderId: standing.riderId,
          seasonTotal: standing.seasonTotal,
          rank: standing.rank,
          previousRank: standing.previousRank
        })));
      }
    });
  }

  async getStageResults(stageId: string): Promise<StageResultsResponse | null> {
    const stage = await this.getStage(stageId);
    if (!stage) {
      return null;
    }

    const [classificationRows, crossingRows] = await Promise.all([
      this.db.select().from(stageClassifications).where(eq(stageClassifications.stageId, stageId)).orderBy(asc(stageClassifications.gcTimeSeconds)),
      this.db.select().from(stageMarkerCrossings).where(eq(stageMarkerCrossings.stageId, stageId)).orderBy(asc(stageMarkerCrossings.rank))
    ]);
    const classifications = classificationRows.map(toStageScore).toSorted((left, right) => {
      const pointsDifference = right.todayTotal - left.todayTotal;
      return pointsDifference === 0 ? left.gcTimeSeconds - right.gcTimeSeconds : pointsDifference;
    });

    const leaderBy = (score: (classification: StageScore) => number, direction: "asc" | "desc"): string => {
      const [leader] = classifications.toSorted((left, right) => {
        const scoreDifference = direction === "asc" ? score(left) - score(right) : score(right) - score(left);
        return scoreDifference === 0 ? left.riderId.localeCompare(right.riderId) : scoreDifference;
      });
      return leader?.riderId ?? "";
    };

    return {
      stageId,
      markerResults: stage.orderedMarkers.map((marker) => ({
        markerId: marker.id,
        type: marker.type,
        crossings: crossingRows
          .filter((crossing) => crossing.markerId === marker.id)
          .map((crossing) => ({
            riderId: crossing.riderId,
            crossedAtSeconds: crossing.crossedAtSeconds,
            rank: crossing.rank,
            points: crossing.points
          }))
      })),
      classifications,
      jerseyLeaders: {
        green: leaderBy((classification) => classification.sprintPoints, "desc"),
        polkaDot: leaderBy((classification) => classification.komPoints, "desc"),
        yellow: leaderBy((classification) => classification.gcTimeSeconds, "asc")
      }
    };
  }

  async getSeasonStandings(seasonId: string): Promise<SeasonStandingsResponse | null> {
    const [season] = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
    if (!season) {
      return null;
    }

    const rows = await this.db.select().from(seasonStandings).where(eq(seasonStandings.seasonId, seasonId)).orderBy(asc(seasonStandings.rank));
    return {
      seasonId,
      standings: rows.map(toSeasonStanding)
    };
  }
}
