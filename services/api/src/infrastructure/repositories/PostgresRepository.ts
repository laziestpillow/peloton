import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { ApplicationRepository } from "../../application/useCases.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile,
  RouteSummary
} from "../../domain/models.js";
import type { Database } from "../database/client.js";
import { groupMemberships, groups, importedActivities, riderProfiles } from "../database/schema.js";

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
}
