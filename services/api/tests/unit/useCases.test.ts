import { describe, expect, test } from "vitest";
import {
  createApplicationUseCases,
  type ActivityStageMatchInput,
  type ActivitySyncStart,
  type ApplicationRepository,
  type ActivityStreamSamplesInput,
  type ImportedActivityInput,
  type StravaConnection,
  type StravaConnectionInput,
  type StravaConnectionUpdate,
  type StravaDataRetentionResult,
  type StravaWebhookEventInput,
  type StravaOAuthState
} from "../../src/application/useCases.js";
import type { ApiFixtureData } from "../../src/application/fixtureData.js";
import type {
  ActivityListResponse,
  ActivityStreamSample,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile,
  SeasonArchetypesResponse,
  SeasonStandingsResponse,
  Stage,
  StageActivityResult,
  StageResultsResponse,
  StageMarkerCrossing
} from "../../src/domain/models.js";
import { MockStravaGateway } from "../../src/infrastructure/strava/MockStravaGateway.js";
import type { StravaActivityStreams, StravaGateway, StravaTokenExchange } from "../../src/infrastructure/strava/StravaGateway.js";
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

const stage: Stage = {
  id: "stage-001",
  seasonId: "season-001",
  name: "Barcelona Hills",
  route: {
    distanceMeters: 42195,
    elevation: [
      { positionMeters: 0, altitudeMeters: 35 },
      { positionMeters: 42195, altitudeMeters: 88 }
    ]
  },
  orderedMarkers: [
    {
      id: "marker-sprint-001",
      type: "sprint",
      positionMeters: 12000,
      latitude: 41.39,
      longitude: 2.16,
      geofenceRadiusMeters: 25,
      category: null,
      pointsSchedule: [20, 17, 15, 13, 11]
    }
  ],
  scheduledAt: "2026-07-18T07:30:00.000Z",
  status: "completed"
};

const stageResults: StageResultsResponse = {
  stageId: "stage-001",
  markerResults: [],
  classifications: [],
  jerseyLeaders: { green: "", polkaDot: "", yellow: "" }
};

const seasonStandings: SeasonStandingsResponse = {
  seasonId: "season-001",
  standings: []
};

const seasonArchetypes: SeasonArchetypesResponse = {
  data: []
};

const fixtureData: ApiFixtureData = {
  activities: { data: [activity], pagination: { nextCursor: null } },
  stages: { data: [stage] },
  recap: {
    stageId: "stage-001",
    durationSeconds: 0,
    riders: [rider],
    markers: stage.orderedMarkers,
    timeline: []
  },
  stageResults,
  seasonStandings,
  seasonArchetypes
};

class InMemoryRepository implements ApplicationRepository {
  private currentRider: RiderProfile | null = rider;
  readonly activities = new Map<string, ImportedActivity>([[activity.providerActivityId, activity]]);
  readonly activityImportedAt = new Map<string, Date>([[activity.providerActivityId, new Date("2026-07-31T10:00:00.000Z")]]);
  readonly stravaStates = new Map<string, StravaOAuthState>();
  readonly stravaConnections = new Map<string, StravaConnection>();
  readonly activitySyncRequests = new Map<string, ActivitySyncStart & { userId: string; idempotencyKey: string | null; syncStatus: "running" | "completed" | "failed" }>();
  readonly streamSamples = new Map<string, readonly ActivityStreamSample[]>();
  readonly stageActivityResults = new Map<string, StageActivityResult>();
  readonly stageMarkerCrossings = new Map<string, StageMarkerCrossing>();
  readonly stravaWebhookEvents: StravaWebhookEventInput[] = [];

  async listActivities(userId: string): Promise<ActivityListResponse> {
    return {
      data: userId === rider.userId ? Array.from(this.activities.values()) : [],
      pagination: { nextCursor: null }
    };
  }

  async getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null> {
    return input.userId === rider.userId ? Array.from(this.activities.values()).find((candidate) => candidate.id === input.activityId) ?? null : null;
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

  async listGroupStages(groupId: string): Promise<{ data: readonly Stage[] }> {
    return groupId === "group-001" ? { data: [stage] } : { data: [] };
  }

  async getStage(stageId: string): Promise<Stage | null> {
    return stageId === stage.id ? stage : null;
  }

  async getStageGroupId(stageId: string): Promise<string | null> {
    return stageId === stage.id ? "group-001" : null;
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
    this.stravaConnections.set(input.userId, { ...input, lastSyncedAt: null });
  }

  async getStravaConnection(userId: string): Promise<StravaConnection | null> {
    return this.stravaConnections.get(userId) ?? null;
  }

  async getStravaConnectionByAthleteId(athleteId: string): Promise<StravaConnection | null> {
    return Array.from(this.stravaConnections.values()).find((connection) => connection.athleteId === athleteId) ?? null;
  }

  async updateStravaConnection(input: StravaConnectionUpdate): Promise<void> {
    const existing = this.stravaConnections.get(input.userId);
    this.stravaConnections.set(input.userId, { ...input, lastSyncedAt: input.lastSyncedAt !== undefined ? input.lastSyncedAt : existing?.lastSyncedAt ?? null });
  }

  async beginActivitySync(input: { userId: string; idempotencyKey: string | null; requestedAt: Date }): Promise<ActivitySyncStart> {
    const existing = Array.from(this.activitySyncRequests.values()).find((sync) =>
      sync.userId === input.userId && input.idempotencyKey !== null && sync.idempotencyKey === input.idempotencyKey
    );
    if (existing) {
      return { syncId: existing.syncId, status: "alreadyRunning", requestedAt: existing.requestedAt };
    }

    const running = Array.from(this.activitySyncRequests.values()).find((sync) => sync.userId === input.userId && sync.syncStatus === "running");
    if (running) {
      return { syncId: running.syncId, status: "alreadyRunning", requestedAt: running.requestedAt };
    }

    const sync = {
      syncId: `sync-${this.activitySyncRequests.size + 1}`,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      status: "accepted" as const,
      syncStatus: "running" as const,
      requestedAt: input.requestedAt
    };
    this.activitySyncRequests.set(sync.syncId, sync);
    return { syncId: sync.syncId, status: sync.status, requestedAt: sync.requestedAt };
  }

  async completeActivitySync(input: { syncId: string; userId: string; status: "completed" | "failed"; completedAt: Date }): Promise<void> {
    const sync = this.activitySyncRequests.get(input.syncId);
    if (sync && sync.userId === input.userId) {
      this.activitySyncRequests.set(input.syncId, { ...sync, syncStatus: input.status });
    }
  }

  async upsertImportedActivity(input: ImportedActivityInput, options: { replaceExisting?: boolean } = {}): Promise<{ activity: ImportedActivity; duplicate: boolean }> {
    const existing = this.activities.get(input.providerActivityId);
    if (existing) {
      if (options.replaceExisting) {
        const updated = {
          ...existing,
          riderId: input.riderId,
          activityType: input.activityType,
          startedAt: input.startedAt.toISOString(),
          distanceMeters: input.distanceMeters,
          elapsedTimeSeconds: input.elapsedTimeSeconds,
          movingTimeSeconds: input.movingTimeSeconds,
          elevationGainMeters: input.elevationGainMeters,
          routeSummary: input.routeSummary,
          importStatus: input.importStatus,
          processedStageId: input.processedStageId
        };
        this.activities.set(input.providerActivityId, updated);
        this.activityImportedAt.set(input.providerActivityId, new Date("2026-07-31T10:00:00.000Z"));
        return { activity: updated, duplicate: false };
      }
      const duplicate = { ...existing, importStatus: "duplicate" as const };
      this.activities.set(input.providerActivityId, duplicate);
      this.activityImportedAt.set(input.providerActivityId, new Date("2026-07-31T10:00:00.000Z"));
      return { activity: duplicate, duplicate: true };
    }
    const imported: ImportedActivity = {
      id: `activity-${this.activities.size + 1}`,
      riderId: input.riderId,
      provider: input.provider,
      providerActivityId: input.providerActivityId,
      activityType: input.activityType,
      startedAt: input.startedAt.toISOString(),
      distanceMeters: input.distanceMeters,
      elapsedTimeSeconds: input.elapsedTimeSeconds,
      movingTimeSeconds: input.movingTimeSeconds,
      elevationGainMeters: input.elevationGainMeters,
      routeSummary: input.routeSummary,
      importStatus: input.importStatus,
      processedStageId: input.processedStageId
    };
    this.activities.set(input.providerActivityId, imported);
    this.activityImportedAt.set(input.providerActivityId, new Date("2026-07-31T10:00:00.000Z"));
    return { activity: imported, duplicate: false };
  }

  async markImportedActivityDeleted(input: { provider: "strava"; providerActivityId: string }): Promise<void> {
    const existing = this.activities.get(input.providerActivityId);
    if (existing && existing.provider === input.provider) {
      this.activities.delete(input.providerActivityId);
      this.activityImportedAt.delete(input.providerActivityId);
      this.streamSamples.delete(existing.id);
      for (const [key, result] of this.stageActivityResults) {
        if (result.activityId === existing.id) {
          this.stageActivityResults.delete(key);
        }
      }
      for (const [key, crossing] of this.stageMarkerCrossings) {
        if (crossing.activityId === existing.id) {
          this.stageMarkerCrossings.delete(key);
        }
      }
    }
  }

  async deleteStravaDataForUser(input: { userId: string; athleteId: string | null }): Promise<void> {
    const current = await this.getCurrentRider(input.userId);
    if (!current) {
      return;
    }
    for (const [providerActivityId, imported] of this.activities) {
      if (imported.provider === "strava" && imported.riderId === current.id) {
        this.activities.delete(providerActivityId);
        this.activityImportedAt.delete(providerActivityId);
        this.streamSamples.delete(imported.id);
        for (const [key, result] of this.stageActivityResults) {
          if (result.activityId === imported.id) {
            this.stageActivityResults.delete(key);
          }
        }
        for (const [key, crossing] of this.stageMarkerCrossings) {
          if (crossing.activityId === imported.id) {
            this.stageMarkerCrossings.delete(key);
          }
        }
      }
    }
    if (!input.athleteId) {
      return;
    }
    for (let index = this.stravaWebhookEvents.length - 1; index >= 0; index -= 1) {
      if (this.stravaWebhookEvents[index]?.event.ownerId === input.athleteId) {
        this.stravaWebhookEvents.splice(index, 1);
      }
    }
  }

  async deleteExpiredStravaData(input: { cutoff: Date; effectiveAt: Date }): Promise<StravaDataRetentionResult> {
    let deletedActivities = 0;
    for (const [providerActivityId, imported] of this.activities) {
      const importedAt = this.activityImportedAt.get(providerActivityId);
      if (imported.provider === "strava" && importedAt && importedAt.getTime() < input.cutoff.getTime()) {
        this.activities.delete(providerActivityId);
        this.activityImportedAt.delete(providerActivityId);
        this.streamSamples.delete(imported.id);
        for (const [key, result] of this.stageActivityResults) {
          if (result.activityId === imported.id) {
            this.stageActivityResults.delete(key);
          }
        }
        for (const [key, crossing] of this.stageMarkerCrossings) {
          if (crossing.activityId === imported.id) {
            this.stageMarkerCrossings.delete(key);
          }
        }
        deletedActivities += 1;
      }
    }

    let deletedWebhookEvents = 0;
    for (let index = this.stravaWebhookEvents.length - 1; index >= 0; index -= 1) {
      const webhookEvent = this.stravaWebhookEvents[index];
      if (webhookEvent && webhookEvent.receivedAt.getTime() < input.cutoff.getTime()) {
        this.stravaWebhookEvents.splice(index, 1);
        deletedWebhookEvents += 1;
      }
    }
    return { deletedActivities, deletedWebhookEvents };
  }

  async replaceActivityStreamSamples(input: ActivityStreamSamplesInput): Promise<void> {
    this.streamSamples.set(input.activityId, input.samples);
  }

  async listMatchableStages(): Promise<readonly Stage[]> {
    return [stage];
  }

  async listStageMarkerCrossings(stageId: string): Promise<readonly StageMarkerCrossing[]> {
    return Array.from(this.stageMarkerCrossings.values()).filter((crossing) => crossing.stageId === stageId);
  }

  async saveActivityStageMatch(input: ActivityStageMatchInput): Promise<void> {
    this.stageActivityResults.set(`${input.stageId}:${input.riderId}`, {
      stageId: input.stageId,
      activityId: input.activityId,
      riderId: input.riderId,
      finishTimeSeconds: input.finishTimeSeconds,
      matchedAt: input.matchedAt.toISOString()
    });
    for (const [providerActivityId, imported] of this.activities) {
      if (imported.id === input.activityId) {
        this.activities.set(providerActivityId, { ...imported, importStatus: "processing", processedStageId: input.stageId });
      }
    }
    const markerIds = new Set(input.markerCrossings.map((crossing) => crossing.markerId));
    for (const [key, crossing] of this.stageMarkerCrossings) {
      if (crossing.stageId === input.stageId && markerIds.has(crossing.markerId)) {
        this.stageMarkerCrossings.delete(key);
      }
    }
    for (const crossing of input.markerCrossings) {
      this.stageMarkerCrossings.set(`${crossing.stageId}:${crossing.markerId}:${crossing.riderId}`, crossing);
    }
  }

  async getStageResults(stageId: string): Promise<StageResultsResponse | null> {
    return stageId === stageResults.stageId ? stageResults : null;
  }

  async getStageRecap(stageId: string) {
    return stageId === fixtureData.recap.stageId ? fixtureData.recap : null;
  }

  async getSeasonStandings(seasonId: string): Promise<SeasonStandingsResponse | null> {
    return seasonId === seasonStandings.seasonId ? seasonStandings : null;
  }

  async getSeasonArchetypes(seasonId: string): Promise<SeasonArchetypesResponse | null> {
    return seasonId === "season-001" ? seasonArchetypes : null;
  }

  async recordStravaWebhookEvent(input: StravaWebhookEventInput): Promise<{ inserted: boolean }> {
    const duplicate = this.stravaWebhookEvents.some((event) =>
      event.event.subscriptionId === input.event.subscriptionId &&
      event.event.objectType === input.event.objectType &&
      event.event.objectId === input.event.objectId &&
      event.event.aspectType === input.event.aspectType &&
      event.event.eventTime.getTime() === input.event.eventTime.getTime()
    );
    if (!duplicate) {
      this.stravaWebhookEvents.push(input);
    }
    return { inserted: !duplicate };
  }
}

class FailingRefreshGateway extends MockStravaGateway {
  override async refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    throw new Error("refresh failed");
  }
}

class RecordingGateway implements StravaGateway {
  revokedToken: string | null = null;
  createdWebhook: { callbackUrl: string; verifyToken: string } | null = null;
  deletedWebhookSubscriptionId: number | null = null;

  async exchangeAuthorizationCode(): Promise<StravaTokenExchange> {
    throw new Error("not used");
  }

  async listRecentActivities(): Promise<readonly []> {
    return [];
  }

  async getActivity(): Promise<null> {
    return null;
  }

  async getActivityStreams(): Promise<StravaActivityStreams> {
    return {
      time: [0],
      distance: [0]
    };
  }

  async refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    return {
      accessToken: "fresh-access",
      refreshToken: "fresh-refresh",
      expiresAt: new Date("2026-07-31T20:00:00.000Z")
    };
  }

  async revokeToken(input: { token: string }): Promise<void> {
    this.revokedToken = input.token;
  }

  async createWebhookSubscription(input: { callbackUrl: string; verifyToken: string }): Promise<{ id: number }> {
    this.createdWebhook = input;
    return { id: 1 };
  }

  async listWebhookSubscriptions(): Promise<readonly [{
    id: number;
    applicationId: number;
    callbackUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }]> {
    return [{
      id: 1,
      applicationId: 12345,
      callbackUrl: "http://127.0.0.1:8080/v1/webhooks/strava",
      createdAt: new Date("2026-07-31T10:00:00.000Z"),
      updatedAt: new Date("2026-07-31T10:00:00.000Z")
    }];
  }

  async deleteWebhookSubscription(input: { subscriptionId: number }): Promise<void> {
    this.deletedWebhookSubscriptionId = input.subscriptionId;
    return;
  }
}

const tokenCipher = createTokenCipher("0000000000000000000000000000000000000000000000000000000000000000");

function createStravaServices(stravaGateway: StravaGateway = new MockStravaGateway()) {
  return {
    stravaGateway,
    tokenCipher,
    stravaClientId: "12345",
    stravaClientSecret: "secret",
    stravaCallbackUrl: "http://127.0.0.1:8080/v1/auth/strava/callback",
    stravaWebhookCallbackUrl: "http://127.0.0.1:8080/v1/webhooks/strava",
    stravaWebhookVerifyToken: "dev-strava-webhook-token",
    appDeepLinkUrl: "peloton://strava/callback",
    stravaOAuthScope: "read,activity:read_all",
    stravaOAuthStateTtlSeconds: 600,
    now: () => new Date("2026-07-31T10:00:00.000Z")
  };
}

function connectedStravaConnection(input: Partial<StravaConnectionInput> = {}): StravaConnectionInput {
  return {
    userId: "user-001",
    athleteId: "100001",
    acceptedScopes: ["read", "activity:read_all"],
    encryptedAccessToken: tokenCipher.encrypt("old-access"),
    encryptedRefreshToken: tokenCipher.encrypt("old-refresh"),
    accessTokenExpiresAt: new Date("2026-07-31T20:00:00.000Z"),
    status: "connected",
    ...input
  };
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

  test("reads stages after checking group access", async () => {
    const ownerUseCases = createApplicationUseCases(new InMemoryRepository(), "user-001", fixtureData);
    const memberUseCases = createApplicationUseCases(new InMemoryRepository(), "user-002", fixtureData);
    const outsiderUseCases = createApplicationUseCases(new InMemoryRepository(), "user-003", fixtureData);

    await expect(ownerUseCases.listGroupStages("group-001")).resolves.toEqual({ data: [stage] });
    await expect(memberUseCases.getStage("stage-001")).resolves.toEqual(stage);
    await expect(memberUseCases.getStageRecap("stage-001")).resolves.toEqual(fixtureData.recap);
    await expect(ownerUseCases.getStage("missing")).resolves.toBeNull();
    await expect(ownerUseCases.getStageRecap("missing")).resolves.toBeNull();
    await expect(outsiderUseCases.listGroupStages("group-001")).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });
    await expect(outsiderUseCases.getStageRecap("stage-001")).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });
  });

  test("shared stage responses expose Peloton race state without raw Strava fields", async () => {
    const useCases = createApplicationUseCases(new InMemoryRepository(), "user-001", fixtureData);

    const [recap, results] = await Promise.all([
      useCases.getStageRecap("stage-001"),
      useCases.getStageResults("stage-001")
    ]);
    const sharedPayload = JSON.stringify({ recap, results });

    expect(sharedPayload).not.toContain("providerActivityId");
    expect(sharedPayload).not.toContain("provider");
    expect(sharedPayload).not.toContain("routeSummary");
    expect(sharedPayload).not.toContain("polyline");
  });

  test("creates and completes Strava OAuth connection through durable state", async () => {
    const repository = new InMemoryRepository();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, {
      ...createStravaServices()
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
      ...createStravaServices()
    });

    await expect(useCases.completeStravaAuthorization({ code: "auth-code", state: "expired" })).rejects.toMatchObject({
      statusCode: 400,
      code: "bad_request"
    });
  });

  test("reports Strava connection statuses from durable state", async () => {
    const repository = new InMemoryRepository();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices());

    await expect(useCases.getStravaStatus()).resolves.toEqual({
      status: "notConnected",
      acceptedScopes: [],
      lastSyncedAt: null
    });

    await repository.upsertStravaConnection(connectedStravaConnection());
    await expect(useCases.getStravaStatus()).resolves.toMatchObject({ status: "connected", acceptedScopes: ["read", "activity:read_all"] });

    await repository.updateStravaConnection(connectedStravaConnection({ accessTokenExpiresAt: new Date("2026-07-31T09:59:00.000Z") }));
    await expect(useCases.getStravaStatus()).resolves.toMatchObject({ status: "expired" });

    await repository.updateStravaConnection(connectedStravaConnection({ status: "error" }));
    await expect(useCases.getStravaStatus()).resolves.toMatchObject({ status: "error" });

    await repository.updateStravaConnection(connectedStravaConnection({ status: "revoked" }));
    await expect(useCases.getStravaStatus()).resolves.toMatchObject({ status: "revoked" });
  });

  test("refreshes expiring Strava tokens and persists rotated token values", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection({ accessTokenExpiresAt: new Date("2026-07-31T10:30:00.000Z") }));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(new RecordingGateway()));

    await useCases.refreshStravaConnection();

    const connection = repository.stravaConnections.get("user-001");
    expect(connection).toMatchObject({ status: "connected", accessTokenExpiresAt: new Date("2026-07-31T20:00:00.000Z") });
    expect(tokenCipher.decrypt(connection?.encryptedAccessToken ?? "")).toBe("fresh-access");
    expect(tokenCipher.decrypt(connection?.encryptedRefreshToken ?? "")).toBe("fresh-refresh");
  });

  test("marks Strava connection error when token refresh fails", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection({ accessTokenExpiresAt: new Date("2026-07-31T10:30:00.000Z") }));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(new FailingRefreshGateway()));

    await useCases.refreshStravaConnection();

    expect(repository.stravaConnections.get("user-001")).toMatchObject({ status: "error" });
  });

  test("syncs recent Strava activities and updates last synced time", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const gateway = new MockStravaGateway([
      {
        providerActivityId: "strava-ride-001",
        sportType: "Ride",
        startedAt: "2026-07-30T06:15:00Z",
        distanceMeters: 25000,
        elapsedTimeSeconds: 3600,
        movingTimeSeconds: 3400,
        elevationGainMeters: 420,
        polyline: "strava_polyline"
      },
      {
        providerActivityId: "strava-run-001",
        sportType: "Run",
        startedAt: "2026-07-29T06:15:00Z",
        distanceMeters: 8000,
        elapsedTimeSeconds: 2100,
        movingTimeSeconds: 2050,
        elevationGainMeters: 75
      }
    ], new Map([
      ["strava-ride-001", {
        time: [0, 90, 180],
        distance: [0, 700, 1510],
        latlng: [
          [41.38, 2.15],
          [41.39, 2.16],
          [41.4, 2.17]
        ],
        altitude: [32, 36, 39],
        velocitySmooth: [0, 7.8, 8.1]
      }]
    ]));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await expect(useCases.syncActivities({ idempotencyKey: "sync-key-001" })).resolves.toEqual({
      status: "accepted",
      requestedAt: "2026-07-31T10:00:00.000Z"
    });

    expect(repository.activities.get("strava-ride-001")).toMatchObject({
      provider: "strava",
      importStatus: "eligible",
      movingTimeSeconds: 3400,
      routeSummary: {
        polyline: "strava_polyline",
        previewBounds: {
          southWest: { latitude: 41.38, longitude: 2.15 },
          northEast: { latitude: 41.4, longitude: 2.17 }
        }
      }
    });
    const importedRide = repository.activities.get("strava-ride-001");
    expect(importedRide ? repository.streamSamples.get(importedRide.id) : undefined).toEqual([
      { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: 32, velocityMetersPerSecond: 0 },
      { sequence: 1, timeSeconds: 90, distanceMeters: 700, latitude: 41.39, longitude: 2.16, altitudeMeters: 36, velocityMetersPerSecond: 7.8 },
      { sequence: 2, timeSeconds: 180, distanceMeters: 1510, latitude: 41.4, longitude: 2.17, altitudeMeters: 39, velocityMetersPerSecond: 8.1 }
    ]);
    expect(repository.activities.get("strava-run-001")).toMatchObject({ importStatus: "unsupported" });
    expect(repository.stravaConnections.get("user-001")?.lastSyncedAt).toEqual(new Date("2026-07-31T10:00:00.000Z"));
  });

  test("marks a supported Strava activity failed when stream fetch fails", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const gateway = new MockStravaGateway([
      {
        providerActivityId: "strava-stream-failure-001",
        sportType: "Ride",
        startedAt: "2026-07-30T06:15:00Z",
        distanceMeters: 25000,
        elapsedTimeSeconds: 3600,
        movingTimeSeconds: 3400,
        elevationGainMeters: 420
      }
    ], new Map([
      ["strava-stream-failure-001", { time: [], distance: [] }]
    ]));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await expect(useCases.syncActivities({ idempotencyKey: "stream-failure" })).resolves.toMatchObject({ status: "accepted" });

    expect(repository.activities.get("strava-stream-failure-001")).toMatchObject({ importStatus: "failed" });
    expect(repository.stravaConnections.get("user-001")?.status).toBe("connected");
  });

  test("matches imported Strava rides to stages and persists ranked marker crossings", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const gateway = new MockStravaGateway([
      {
        providerActivityId: "strava-stage-match-001",
        sportType: "Ride",
        startedAt: "2026-07-18T07:30:00Z",
        distanceMeters: 42195,
        elapsedTimeSeconds: 3600,
        movingTimeSeconds: 3400,
        elevationGainMeters: 420
      }
    ], new Map([
      ["strava-stage-match-001", {
        time: [0, 120, 1000],
        distance: [0, 12000, 42195],
        latlng: [
          [41.38, 2.15],
          [41.39, 2.16],
          [41.46, 2.22]
        ],
        altitude: [32, 36, 90],
        velocitySmooth: [0, 8.2, 9.1]
      }]
    ]));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await useCases.syncActivities({ idempotencyKey: "stage-match" });

    const imported = repository.activities.get("strava-stage-match-001");
    expect(imported).toMatchObject({ importStatus: "processing", processedStageId: "stage-001" });
    expect(repository.stageActivityResults.get("stage-001:rider-001")).toMatchObject({
      stageId: "stage-001",
      activityId: imported?.id,
      riderId: "rider-001",
      finishTimeSeconds: 1000
    });
    expect([...repository.stageMarkerCrossings.values()]).toEqual([
      {
        stageId: "stage-001",
        markerId: "marker-sprint-001",
        activityId: imported?.id,
        riderId: "rider-001",
        crossedAtSeconds: 120,
        rank: 1,
        points: 20
      }
    ]);
  });

  test("prevents duplicate activity syncs by idempotency key", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices());

    await expect(useCases.syncActivities({ idempotencyKey: "same-sync" })).resolves.toMatchObject({ status: "accepted" });
    await expect(useCases.syncActivities({ idempotencyKey: "same-sync" })).resolves.toEqual({
      status: "alreadyRunning",
      requestedAt: "2026-07-31T10:00:00.000Z"
    });
  });

  test("marks repeated provider activities as duplicates", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const gateway = new MockStravaGateway([
      {
        providerActivityId: "strava-duplicate-001",
        sportType: "Ride",
        startedAt: "2026-07-30T06:15:00Z",
        distanceMeters: 25000,
        elapsedTimeSeconds: 3600,
        movingTimeSeconds: 3400,
        elevationGainMeters: 420
      }
    ]);
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await useCases.syncActivities({ idempotencyKey: "first-sync" });
    await useCases.syncActivities({ idempotencyKey: "second-sync" });

    expect(repository.activities.get("strava-duplicate-001")).toMatchObject({ importStatus: "duplicate" });
  });

  test("disconnects Strava by revoking refresh token and marking connection revoked", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection());
    const gateway = new RecordingGateway();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await useCases.disconnectStrava();
    await useCases.disconnectStrava();

    expect(gateway.revokedToken).toBe("old-refresh");
    expect(repository.stravaConnections.get("user-001")).toMatchObject({ status: "revoked" });
    expect(tokenCipher.decrypt(repository.stravaConnections.get("user-001")?.encryptedRefreshToken ?? "")).toBe("revoked");
  });

  test("handles Strava webhook verification, event intake, and subscription lifecycle", async () => {
    const repository = new InMemoryRepository();
    const gateway = new RecordingGateway();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await expect(useCases.verifyStravaWebhook({
      mode: "subscribe",
      challenge: "challenge-123",
      verifyToken: "dev-strava-webhook-token"
    })).resolves.toEqual({ "hub.challenge": "challenge-123" });
    await expect(useCases.verifyStravaWebhook({
      mode: "subscribe",
      challenge: "challenge-123",
      verifyToken: "wrong"
    })).rejects.toMatchObject({ statusCode: 403 });

    await expect(useCases.receiveStravaWebhook({
      object_type: "activity",
      object_id: 1360128428,
      aspect_type: "create",
      owner_id: 134815,
      subscription_id: 120475,
      event_time: 1516126040
    })).resolves.toEqual({ status: "accepted" });
    expect(repository.stravaWebhookEvents[0]).toMatchObject({ action: "sync_requested" });

    await expect(useCases.listStravaWebhookSubscriptions()).resolves.toMatchObject({
      data: [{ id: 1, applicationId: 12345 }]
    });
    await expect(useCases.createStravaWebhookSubscription()).resolves.toEqual({ id: 1 });
    expect(gateway.createdWebhook).toMatchObject({
      callbackUrl: "http://127.0.0.1:8080/v1/webhooks/strava",
      verifyToken: "dev-strava-webhook-token"
    });
    await useCases.deleteStravaWebhookSubscription(1);
    expect(gateway.deletedWebhookSubscriptionId).toBe(1);
  });

  test("processes activity webhook create and update events with targeted imports", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection({ athleteId: "134815" }));
    const gateway = new MockStravaGateway([
      {
        providerActivityId: "1360128428",
        sportType: "Ride",
        startedAt: "2026-07-18T07:30:00Z",
        distanceMeters: 42195,
        elapsedTimeSeconds: 3700,
        movingTimeSeconds: 3500,
        elevationGainMeters: 500,
        polyline: "webhook_polyline"
      }
    ], new Map([
      ["1360128428", {
        time: [0, 120, 1000],
        distance: [0, 12000, 42195],
        latlng: [
          [41.38, 2.15],
          [41.39, 2.16],
          [41.46, 2.22]
        ],
        altitude: [32, 36, 90],
        velocitySmooth: [0, 8.2, 9.1]
      }]
    ]));
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    const payload = {
      object_type: "activity",
      object_id: 1360128428,
      aspect_type: "create",
      owner_id: 134815,
      subscription_id: 120475,
      event_time: 1516126040
    };
    await expect(useCases.receiveStravaWebhook(payload)).resolves.toEqual({ status: "accepted" });
    await expect(useCases.receiveStravaWebhook(payload)).resolves.toEqual({ status: "accepted" });

    expect(repository.stravaWebhookEvents).toHaveLength(1);
    expect(repository.activities.get("1360128428")).toMatchObject({
      provider: "strava",
      importStatus: "processing",
      movingTimeSeconds: 3500,
      processedStageId: "stage-001"
    });
    expect(repository.stravaConnections.get("user-001")?.lastSyncedAt).toEqual(new Date("2026-07-31T10:00:00.000Z"));
  });

  test("processes activity delete and athlete deauthorization webhook events", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection({ athleteId: "134815" }));
    await repository.upsertImportedActivity({
      riderId: "rider-001",
      provider: "strava",
      providerActivityId: "1360128428",
      activityType: "ride",
      startedAt: new Date("2026-07-18T07:30:00.000Z"),
      distanceMeters: 42195,
      elapsedTimeSeconds: 3700,
      movingTimeSeconds: 3500,
      elevationGainMeters: 500,
      routeSummary: activity.routeSummary,
      importStatus: "processed",
      processedStageId: "stage-001"
    });
    const imported = repository.activities.get("1360128428");
    if (!imported) {
      throw new Error("Expected imported Strava activity.");
    }
    await repository.replaceActivityStreamSamples({
      activityId: imported.id,
      samples: [
        { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: 32, velocityMetersPerSecond: 0 }
      ]
    });
    await repository.saveActivityStageMatch({
      activityId: imported.id,
      riderId: imported.riderId,
      stageId: "stage-001",
      finishTimeSeconds: 1000,
      matchedAt: new Date("2026-07-31T10:00:00.000Z"),
      markerCrossings: [{
        stageId: "stage-001",
        markerId: "marker-sprint-001",
        activityId: imported.id,
        riderId: imported.riderId,
        crossedAtSeconds: 120,
        rank: 1,
        points: 20
      }]
    });
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices());

    await useCases.receiveStravaWebhook({
      object_type: "activity",
      object_id: 1360128428,
      aspect_type: "delete",
      owner_id: 134815,
      subscription_id: 120475,
      event_time: 1516126040
    });
    expect(repository.activities.has("1360128428")).toBe(false);
    expect(repository.streamSamples.has(imported.id)).toBe(false);
    expect(repository.stageActivityResults.has("stage-001:rider-001")).toBe(false);
    expect([...repository.stageMarkerCrossings.values()].some((crossing) => crossing.activityId === imported.id)).toBe(false);

    await useCases.receiveStravaWebhook({
      object_type: "athlete",
      object_id: 134815,
      aspect_type: "update",
      owner_id: 134815,
      subscription_id: 120475,
      event_time: 1516126041,
      updates: { authorized: "false" }
    });
    const connection = repository.stravaConnections.get("user-001");
    expect(connection).toMatchObject({ status: "revoked" });
    expect(tokenCipher.decrypt(connection?.encryptedAccessToken ?? "")).toBe("revoked");
    expect(tokenCipher.decrypt(connection?.encryptedRefreshToken ?? "")).toBe("revoked");
    expect(repository.stravaWebhookEvents).toHaveLength(0);
  });

  test("exposes Strava consent and deletes stored Strava data on request", async () => {
    const repository = new InMemoryRepository();
    await repository.upsertStravaConnection(connectedStravaConnection({ athleteId: "134815" }));
    const imported = await repository.upsertImportedActivity({
      riderId: "rider-001",
      provider: "strava",
      providerActivityId: "delete-me",
      activityType: "ride",
      startedAt: new Date("2026-07-18T07:30:00.000Z"),
      distanceMeters: 42195,
      elapsedTimeSeconds: 3700,
      movingTimeSeconds: 3500,
      elevationGainMeters: 500,
      routeSummary: activity.routeSummary,
      importStatus: "processed",
      processedStageId: "stage-001"
    });
    await repository.replaceActivityStreamSamples({
      activityId: imported.activity.id,
      samples: [
        { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: 32, velocityMetersPerSecond: 0 }
      ]
    });
    await repository.recordStravaWebhookEvent({
      event: {
        objectType: "activity",
        objectId: "delete-me",
        aspectType: "update",
        ownerId: "134815",
        subscriptionId: 120475,
        eventTime: new Date("2026-07-31T10:00:00.000Z"),
        updates: {}
      },
      action: "sync_requested",
      receivedAt: new Date("2026-07-31T10:00:00.000Z")
    });
    const gateway = new RecordingGateway();
    const useCases = createApplicationUseCases(repository, "user-001", fixtureData, createStravaServices(gateway));

    await expect(useCases.getStravaConsentInfo()).resolves.toMatchObject({
      title: "Connect Strava",
      supportEmail: "support@example.com",
      attribution: {
        strava: expect.stringContaining("Strava"),
        garmin: expect.stringContaining("Garmin")
      }
    });
    await useCases.deleteStravaData();

    const connection = repository.stravaConnections.get("user-001");
    expect(gateway.revokedToken).toBe("old-refresh");
    expect(connection).toMatchObject({ status: "revoked" });
    expect(tokenCipher.decrypt(connection?.encryptedAccessToken ?? "")).toBe("revoked");
    expect(repository.activities.has("delete-me")).toBe(false);
    expect(repository.activities.has("fixture-ride-001")).toBe(true);
    expect(repository.streamSamples.has(imported.activity.id)).toBe(false);
    expect(repository.stravaWebhookEvents).toHaveLength(0);
  });

  test("expires cached Strava activity and webhook data after retention cutoff", async () => {
    const repository = new InMemoryRepository();
    const oldResult = await repository.upsertImportedActivity({
      riderId: "rider-001",
      provider: "strava",
      providerActivityId: "old-strava-activity",
      activityType: "ride",
      startedAt: new Date("2026-07-01T07:30:00.000Z"),
      distanceMeters: 10000,
      elapsedTimeSeconds: 1800,
      movingTimeSeconds: 1700,
      elevationGainMeters: 100,
      routeSummary: activity.routeSummary,
      importStatus: "processed",
      processedStageId: "stage-001"
    });
    await repository.upsertImportedActivity({
      riderId: "rider-001",
      provider: "strava",
      providerActivityId: "recent-strava-activity",
      activityType: "ride",
      startedAt: new Date("2026-07-01T07:30:00.000Z"),
      distanceMeters: 12000,
      elapsedTimeSeconds: 1900,
      movingTimeSeconds: 1800,
      elevationGainMeters: 120,
      routeSummary: activity.routeSummary,
      importStatus: "processed",
      processedStageId: "stage-001"
    });
    repository.activityImportedAt.set("old-strava-activity", new Date("2026-07-23T09:59:59.000Z"));
    repository.activityImportedAt.set("recent-strava-activity", new Date("2026-07-24T10:00:00.000Z"));
    await repository.replaceActivityStreamSamples({
      activityId: oldResult.activity.id,
      samples: [
        { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: 32, velocityMetersPerSecond: 0 }
      ]
    });
    await repository.saveActivityStageMatch({
      activityId: oldResult.activity.id,
      riderId: oldResult.activity.riderId,
      stageId: "stage-001",
      finishTimeSeconds: 1000,
      matchedAt: new Date("2026-07-31T10:00:00.000Z"),
      markerCrossings: [{
        stageId: "stage-001",
        markerId: "marker-sprint-001",
        activityId: oldResult.activity.id,
        riderId: oldResult.activity.riderId,
        crossedAtSeconds: 120,
        rank: 1,
        points: 20
      }]
    });
    await repository.recordStravaWebhookEvent({
      event: {
        objectType: "activity",
        objectId: "old-strava-activity",
        aspectType: "update",
        ownerId: "134815",
        subscriptionId: 120475,
        eventTime: new Date("2026-07-23T09:59:59.000Z"),
        updates: {}
      },
      action: "sync_requested",
      receivedAt: new Date("2026-07-23T09:59:59.000Z")
    });
    await repository.recordStravaWebhookEvent({
      event: {
        objectType: "activity",
        objectId: "recent-strava-activity",
        aspectType: "update",
        ownerId: "134815",
        subscriptionId: 120475,
        eventTime: new Date("2026-07-24T10:00:00.000Z"),
        updates: {}
      },
      action: "sync_requested",
      receivedAt: new Date("2026-07-24T10:00:00.000Z")
    });

    await expect(repository.deleteExpiredStravaData({
      cutoff: new Date("2026-07-24T10:00:00.000Z"),
      effectiveAt: new Date("2026-07-31T10:00:00.000Z")
    })).resolves.toEqual({ deletedActivities: 1, deletedWebhookEvents: 1 });

    expect(repository.activities.has("old-strava-activity")).toBe(false);
    expect(repository.activities.has("recent-strava-activity")).toBe(true);
    expect(repository.activities.has("fixture-ride-001")).toBe(true);
    expect(repository.streamSamples.has(oldResult.activity.id)).toBe(false);
    expect(repository.stageActivityResults.has("stage-001:rider-001")).toBe(false);
    expect([...repository.stageMarkerCrossings.values()].some((crossing) => crossing.activityId === oldResult.activity.id)).toBe(false);
    expect(repository.stravaWebhookEvents).toHaveLength(1);
    expect(repository.stravaWebhookEvents[0]?.event.objectId).toBe("recent-strava-activity");
  });
});
