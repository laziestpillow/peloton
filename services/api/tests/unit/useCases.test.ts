import { describe, expect, test } from "vitest";
import { createApplicationUseCases, type ApplicationRepository, type StravaConnectionInput, type StravaOAuthState } from "../../src/application/useCases.js";
import type { ApiFixtureData } from "../../src/application/fixtureData.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../../src/domain/models.js";
import { MockStravaGateway } from "../../src/infrastructure/strava/MockStravaGateway.js";
import { createTokenCipher } from "../../src/infrastructure/strava/TokenCipher.js";

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

const fixtureData: ApiFixtureData = {
  activities: { data: [activity], pagination: { nextCursor: null } },
  recap: { riders: [rider] },
  stageResults: {},
  seasonStandings: {}
};

class InMemoryRepository implements ApplicationRepository {
  private currentRider: RiderProfile | null = rider;
  readonly stravaStates = new Map<string, StravaOAuthState>();
  readonly stravaConnections = new Map<string, StravaConnectionInput>();

  async listActivities(userId: string): Promise<ActivityListResponse> {
    return {
      data: userId === rider.userId ? [activity] : [],
      pagination: { nextCursor: null }
    };
  }

  async getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null> {
    return input.userId === rider.userId && activity.id === input.activityId ? activity : null;
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

  async getGroupMembershipForUser(input: { groupId: string; userId: string }): Promise<GroupMembership | null> {
    if (input.groupId !== "group-001" || input.userId !== "user-002") {
      return null;
    }
    return {
      groupId: input.groupId,
      riderId: "rider-002",
      role: "member",
      status: "active",
      joinedAt: "2026-07-01T10:00:00.000Z"
    };
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

  async createStravaOAuthState(input: StravaOAuthState): Promise<void> {
    this.stravaStates.set(input.state, input);
  }

  async getStravaOAuthState(state: string): Promise<StravaOAuthState | null> {
    return this.stravaStates.get(state) ?? null;
  }

  async consumeStravaOAuthState(input: { state: string; consumedAt: Date }): Promise<void> {
    const state = this.stravaStates.get(input.state);
    if (state) {
      this.stravaStates.set(input.state, { ...state, consumedAt: input.consumedAt });
    }
  }

  async upsertStravaConnection(input: StravaConnectionInput): Promise<void> {
    this.stravaConnections.set(input.userId, input);
  }
}

describe("application use cases", () => {
  test("reads activities through the repository", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-001", fixtureData);

    await expect(useCases.listActivities()).resolves.toEqual({ data: [activity], pagination: { nextCursor: null } });
    await expect(useCases.getActivity("activity-001")).resolves.toEqual(activity);
    await expect(useCases.getActivity("missing")).resolves.toBeNull();
  });

  test("updates rider appearance through the repository", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-001", fixtureData);
    const appearance: RiderAppearance = {
      jerseyColor: "#000000",
      accentColor: "#FFFFFF",
      helmetColor: "#111111",
      bikeColor: "#222222",
      pattern: "solid"
    };

    await expect(useCases.updateCurrentRiderAppearance(appearance)).resolves.toMatchObject({ appearance });
  });

  test("denies group member mutations for non-owners", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-002", fixtureData);

    await expect(useCases.getGroup("group-001")).resolves.toMatchObject({ id: "group-001" });
    await expect(useCases.addGroupMember({ groupId: "group-001", riderId: "rider-001" })).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });
  });

  test("creates and completes Strava OAuth connection through durable state", async () => {
    const repository = new InMemoryRepository();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, {
      stravaGateway: new MockStravaGateway(),
      tokenCipher: createTokenCipher("0000000000000000000000000000000000000000000000000000000000000000"),
      stravaClientId: "12345",
      stravaClientSecret: "secret",
      stravaCallbackUrl: "http://127.0.0.1:8080/v1/auth/strava/callback",
      appDeepLinkUrl: "peloton://strava/callback",
      stravaOAuthScope: "read,activity:read_all",
      stravaOAuthStateTtlSeconds: 600,
      now: () => new Date("2026-07-31T10:00:00.000Z")
    });

    const start = await useCases.startStravaAuthorization();
    const authorizationUrl = new URL(start.authorizationUrl);
    const state = authorizationUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(start.stateExpiresAt).toBe("2026-07-31T10:10:00.000Z");

    const result = await useCases.completeStravaAuthorization({
      code: "auth-code",
      state: state ?? "",
      scope: "read,activity:read_all"
    });

    expect(result.redirectUrl).toBe("peloton://strava/callback?status=connected");
    expect(repository.stravaConnections.get("user-001")).toMatchObject({
      athleteId: "100001",
      acceptedScopes: ["read", "activity:read_all"],
      status: "connected"
    });
    expect(repository.stravaConnections.get("user-001")?.encryptedAccessToken).not.toContain("mock-access");
  });

  test("rejects expired Strava OAuth state", async () => {
    const repository = new InMemoryRepository();
    await repository.createStravaOAuthState({
      state: "expired",
      userId: "user-001",
      redirectUrl: "http://127.0.0.1:8080/v1/auth/strava/callback",
      expiresAt: new Date("2026-07-31T09:59:59.000Z"),
      consumedAt: null,
      createdAt: new Date("2026-07-31T09:50:00.000Z")
    });
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, {
      stravaGateway: new MockStravaGateway(),
      tokenCipher: createTokenCipher("0000000000000000000000000000000000000000000000000000000000000000"),
      stravaClientId: "12345",
      stravaClientSecret: "secret",
      stravaCallbackUrl: "http://127.0.0.1:8080/v1/auth/strava/callback",
      appDeepLinkUrl: "peloton://strava/callback",
      stravaOAuthScope: "read,activity:read_all",
      stravaOAuthStateTtlSeconds: 600,
      now: () => new Date("2026-07-31T10:00:00.000Z")
    });

    await expect(useCases.completeStravaAuthorization({ code: "auth-code", state: "expired" })).rejects.toMatchObject({
      statusCode: 400,
      code: "bad_request"
    });
  });
});
