import { randomUUID } from "node:crypto";
import type { ApiFixtureData } from "../../application/fixtureData.js";
import type { ApplicationRepository } from "../../application/useCases.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../../domain/models.js";

export class FixtureRepository implements ApplicationRepository {
  constructor(private readonly fixtureData: ApiFixtureData) {}

  async listActivities(): Promise<ActivityListResponse> {
    return this.fixtureData.activities;
  }

  async getActivity(activityId: string): Promise<ImportedActivity | null> {
    const activities = await this.listActivities();
    return activities.data.find((activity) => activity.id === activityId) ?? null;
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

  async addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership> {
    return {
      groupId: input.groupId,
      riderId: input.riderId,
      role: "member",
      status: "active",
      joinedAt: new Date().toISOString()
    };
  }
}
