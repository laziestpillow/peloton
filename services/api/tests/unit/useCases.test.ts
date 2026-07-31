import { describe, expect, test } from "vitest";
import { createApplicationUseCases, type ApplicationRepository } from "../../src/application/useCases.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../../src/domain/models.js";

const rider: RiderProfile = {
  id: "rider-001",
  userId: "user-001",
  displayName: "Marta",
  appearance: {
    jerseyColor: "#2F80ED",
    accentColor: "#F2C94C",
    helmetColor: "#FFFFFF",
    bikeColor: "#111111",
    pattern: "stripes"
  },
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-20T10:00:00.000Z"
};

const activity: ImportedActivity = {
  id: "activity-001",
  riderId: "rider-001",
  provider: "fixture",
  providerActivityId: "fixture-ride-001",
  activityType: "ride",
  startedAt: "2026-07-18T07:30:00.000Z",
  distanceMeters: 42195,
  elapsedTimeSeconds: 6120,
  movingTimeSeconds: 5890,
  elevationGainMeters: 680,
  routeSummary: {
    polyline: "fixture_polyline",
    previewBounds: {
      southWest: { latitude: 41.34, longitude: 2.08 },
      northEast: { latitude: 41.46, longitude: 2.22 }
    }
  },
  importStatus: "processed",
  processedStageId: "stage-001"
};

class InMemoryRepository implements ApplicationRepository {
  private currentRider: RiderProfile | null = rider;

  async listActivities(): Promise<ActivityListResponse> {
    return { data: [activity], pagination: { nextCursor: null } };
  }

  async getActivity(activityId: string): Promise<ImportedActivity | null> {
    return activity.id === activityId ? activity : null;
  }

  async getCurrentRider(userId: string): Promise<RiderProfile | null> {
    return this.currentRider?.userId === userId ? this.currentRider : null;
  }

  async updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null> {
    const current = await this.getCurrentRider(userId);
    this.currentRider = current ? { ...current, appearance } : null;
    return this.currentRider;
  }

  async createGroup(input: { name: string; ownerId: string }): Promise<Group> {
    return {
      id: "group-new",
      name: input.name,
      ownerId: input.ownerId,
      createdAt: "2026-07-31T10:00:00.000Z",
      updatedAt: "2026-07-31T10:00:00.000Z"
    };
  }

  async getGroup(groupId: string): Promise<Group | null> {
    return groupId === "group-001"
      ? {
          id: "group-001",
          name: "Fixture Club",
          ownerId: "user-001",
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-01T10:00:00.000Z"
        }
      : null;
  }

  async addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership> {
    return {
      groupId: input.groupId,
      riderId: input.riderId,
      role: "member",
      status: "active",
      joinedAt: "2026-07-31T10:00:00.000Z"
    };
  }
}

describe("application use cases", () => {
  test("reads activities through the repository", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-001");

    await expect(useCases.listActivities()).resolves.toEqual({ data: [activity], pagination: { nextCursor: null } });
    await expect(useCases.getActivity("activity-001")).resolves.toEqual(activity);
    await expect(useCases.getActivity("missing")).resolves.toBeNull();
  });

  test("updates rider appearance through the repository", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-001");
    const appearance: RiderAppearance = {
      jerseyColor: "#000000",
      accentColor: "#FFFFFF",
      helmetColor: "#111111",
      bikeColor: "#222222",
      pattern: "solid"
    };

    await expect(useCases.updateCurrentRiderAppearance(appearance)).resolves.toMatchObject({ appearance });
  });
});
