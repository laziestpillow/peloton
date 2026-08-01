import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type {
  ActivitySyncStart,
  ApplicationRepository,
  ImportedActivityInput,
  StravaConnection,
  StravaConnectionInput,
  StravaConnectionUpdate,
  StravaOAuthState
} from "../../application/useCases.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  Marker,
  RiderAppearance,
  RiderProfile,
  RouteSummary,
  Stage
} from "../../domain/models.js";
import type { Database } from "../database/client.js";
import {
  activitySyncRequests,
  groupMemberships,
  groups,
  importedActivities,
  riderProfiles,
  seasons,
  stageMarkers,
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
}
