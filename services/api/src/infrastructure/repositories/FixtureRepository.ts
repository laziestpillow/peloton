import { randomUUID } from "node:crypto";
import type { ApiFixtureData } from "../../application/fixtureData.js";
import type { ApplicationRepository, StravaConnection, StravaConnectionInput, StravaOAuthState } from "../../application/useCases.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../../domain/models.js";

export class FixtureRepository implements ApplicationRepository {
  private readonly stravaOAuthStates = new Map<string, StravaOAuthState>();
  private readonly stravaConnections = new Map<string, StravaConnection>();

  constructor(private readonly fixtureData: ApiFixtureData) {}

  async listActivities(userId: string): Promise<ActivityListResponse> {
    const riderIds = this.fixtureData.recap.riders.filter((rider) => rider.userId === userId).map((rider) => rider.id);
    return {
      data: this.fixtureData.activities.data.filter((activity) => riderIds.includes(activity.riderId)),
      pagination: { nextCursor: null }
    };
  }

  async getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null> {
    const activities = await this.listActivities(input.userId);
    return activities.data.find((activity) => activity.id === input.activityId) ?? null;
  }

  async getCurrentRider(userId: string): Promise<RiderProfile | null> {
    return this.fixtureData.recap.riders.find((rider) => rider.userId === userId) ?? null;
  }

  async updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null> {
    const rider = await this.getCurrentRider(userId);
    return rider ? { ...rider, appearance } : null;
  }

  async createGroup(input: { name: string; ownerId: string }): Promise<Group> {
    const now = new Date().toISOString();
    return {
      id: `group-${randomUUID()}`,
      name: input.name,
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now
    };
  }

  async getGroup(groupId: string): Promise<Group | null> {
    if (groupId !== "group-001") {
      return null;
    }
    return {
      id: "group-001",
      name: "Fixture Club",
      ownerId: "user-001",
      createdAt: "2026-07-01T10:00:00Z",
      updatedAt: "2026-07-01T10:00:00Z"
    };
  }

  async getGroupMembershipForUser(input: { groupId: string; userId: string }): Promise<GroupMembership | null> {
    const rider = this.fixtureData.recap.riders.find((candidate) => candidate.userId === input.userId);
    if (!rider || input.groupId !== "group-001") {
      return null;
    }
    return {
      groupId: input.groupId,
      riderId: rider.id,
      role: input.userId === "user-001" ? "owner" : "member",
      status: "active",
      joinedAt: "2026-07-01T10:00:00Z"
    };
  }

  async addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership> {
    return {
      groupId: input.groupId,
      riderId: input.riderId,
      role: "member",
      status: "active",
      joinedAt: new Date().toISOString()
    };
  }

  async createStravaOAuthState(input: StravaOAuthState): Promise<void> {
    this.stravaOAuthStates.set(input.state, input);
  }

  async getStravaOAuthState(state: string): Promise<StravaOAuthState | null> {
    return this.stravaOAuthStates.get(state) ?? null;
  }

  async consumeStravaOAuthState(input: { state: string; consumedAt: Date }): Promise<void> {
    const state = this.stravaOAuthStates.get(input.state);
    if (state) {
      this.stravaOAuthStates.set(input.state, { ...state, consumedAt: input.consumedAt });
    }
  }

  async upsertStravaConnection(input: StravaConnectionInput): Promise<void> {
    this.stravaConnections.set(input.userId, { ...input, lastSyncedAt: null });
  }

  async getStravaConnection(userId: string): Promise<StravaConnection | null> {
    return this.stravaConnections.get(userId) ?? null;
  }

  async updateStravaConnection(input: StravaConnectionInput): Promise<void> {
    const existing = this.stravaConnections.get(input.userId);
    this.stravaConnections.set(input.userId, {
      ...input,
      lastSyncedAt: existing?.lastSyncedAt ?? null
    });
  }
}
