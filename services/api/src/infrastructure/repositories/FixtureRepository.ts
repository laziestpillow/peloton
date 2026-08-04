import { randomUUID } from "node:crypto";
import type { ApiFixtureData } from "../../application/fixtureData.js";
import type {
  ActivitySyncStart,
  ActivityStageMatchInput,
  ApplicationRepository,
  ActivityStreamSamplesInput,
  ImportedActivityInput,
  StravaConnection,
  StravaConnectionInput,
  StravaConnectionUpdate,
  StravaDataRetentionResult,
  StravaWebhookEventInput,
  StravaOAuthState
} from "../../application/useCases.js";
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
  StageRecap,
  StageResultsResponse,
  StageMarkerCrossing
} from "../../domain/models.js";

export class FixtureRepository implements ApplicationRepository {
  private readonly stravaOAuthStates = new Map<string, StravaOAuthState>();
  private readonly stravaConnections = new Map<string, StravaConnection>();
  private readonly stravaActivities = new Map<string, ImportedActivity>();
  private readonly stravaActivityImportedAt = new Map<string, Date>();
  private readonly streamSamples = new Map<string, readonly ActivityStreamSample[]>();
  private readonly stageActivityResults = new Map<string, StageActivityResult>();
  private readonly stageMarkerCrossings = new Map<string, StageMarkerCrossing>();
  private readonly stravaWebhookEvents: StravaWebhookEventInput[] = [];
  private readonly activitySyncRequests = new Map<string, ActivitySyncStart & { userId: string; idempotencyKey: string | null; syncStatus: "running" | "completed" | "failed" }>();

  constructor(private readonly fixtureData: ApiFixtureData) {}

  async listActivities(userId: string): Promise<ActivityListResponse> {
    const riderIds = this.fixtureData.recap.riders.filter((rider) => rider.userId === userId).map((rider) => rider.id);
    return {
      data: [
        ...this.fixtureData.activities.data.filter((activity) => riderIds.includes(activity.riderId)),
        ...Array.from(this.stravaActivities.values()).filter((activity) => riderIds.includes(activity.riderId))
      ],
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

  async listGroupStages(groupId: string): Promise<{ data: readonly Stage[] }> {
    if (groupId !== "group-001") {
      return { data: [] };
    }
    return this.fixtureData.stages;
  }

  async getStage(stageId: string): Promise<Stage | null> {
    return this.fixtureData.stages.data.find((stage) => stage.id === stageId) ?? null;
  }

  async getStageGroupId(stageId: string): Promise<string | null> {
    return this.fixtureData.stages.data.some((stage) => stage.id === stageId) ? "group-001" : null;
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

  async getStravaConnectionByAthleteId(athleteId: string): Promise<StravaConnection | null> {
    return Array.from(this.stravaConnections.values()).find((connection) => connection.athleteId === athleteId) ?? null;
  }

  async updateStravaConnection(input: StravaConnectionUpdate): Promise<void> {
    const existing = this.stravaConnections.get(input.userId);
    this.stravaConnections.set(input.userId, {
      ...input,
      lastSyncedAt: input.lastSyncedAt !== undefined ? input.lastSyncedAt : existing?.lastSyncedAt ?? null
    });
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

    const sync: ActivitySyncStart & { userId: string; idempotencyKey: string | null; syncStatus: "running" | "completed" | "failed" } = {
      syncId: `sync-${randomUUID()}`,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      status: "accepted",
      syncStatus: "running",
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
    const providerKey = `${input.provider}:${input.providerActivityId}`;
    const existing = this.stravaActivities.get(providerKey);
    if (existing) {
      if (options.replaceExisting) {
        const activity: ImportedActivity = {
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
        this.stravaActivities.set(providerKey, activity);
        this.stravaActivityImportedAt.set(providerKey, new Date());
        return { activity, duplicate: false };
      }
      const duplicate = { ...existing, importStatus: "duplicate" as const };
      this.stravaActivities.set(providerKey, duplicate);
      this.stravaActivityImportedAt.set(providerKey, new Date());
      return { activity: duplicate, duplicate: true };
    }

    const activity: ImportedActivity = {
      id: `activity-${randomUUID()}`,
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
    this.stravaActivities.set(providerKey, activity);
    this.stravaActivityImportedAt.set(providerKey, new Date());
    return { activity, duplicate: false };
  }

  async markImportedActivityDeleted(input: { provider: "strava"; providerActivityId: string }): Promise<void> {
    const providerKey = `${input.provider}:${input.providerActivityId}`;
    const existing = this.stravaActivities.get(providerKey);
    if (existing) {
      this.stravaActivities.delete(providerKey);
      this.stravaActivityImportedAt.delete(providerKey);
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
    const riderIds = new Set(this.fixtureData.recap.riders.filter((rider) => rider.userId === input.userId).map((rider) => rider.id));
    for (const [providerKey, activity] of this.stravaActivities) {
      if (activity.provider === "strava" && riderIds.has(activity.riderId)) {
        this.stravaActivities.delete(providerKey);
        this.stravaActivityImportedAt.delete(providerKey);
        this.streamSamples.delete(activity.id);
        for (const [key, result] of this.stageActivityResults) {
          if (result.activityId === activity.id) {
            this.stageActivityResults.delete(key);
          }
        }
        for (const [key, crossing] of this.stageMarkerCrossings) {
          if (crossing.activityId === activity.id) {
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
    for (const [providerKey, activity] of this.stravaActivities) {
      const importedAt = this.stravaActivityImportedAt.get(providerKey);
      if (activity.provider === "strava" && importedAt && importedAt.getTime() < input.cutoff.getTime()) {
        this.stravaActivities.delete(providerKey);
        this.stravaActivityImportedAt.delete(providerKey);
        this.streamSamples.delete(activity.id);
        for (const [key, result] of this.stageActivityResults) {
          if (result.activityId === activity.id) {
            this.stageActivityResults.delete(key);
          }
        }
        for (const [key, crossing] of this.stageMarkerCrossings) {
          if (crossing.activityId === activity.id) {
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
    return this.fixtureData.stages.data;
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

    for (const [key, activity] of this.stravaActivities) {
      if (activity.id === input.activityId) {
        this.stravaActivities.set(key, { ...activity, importStatus: "processing", processedStageId: input.stageId });
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
    return this.fixtureData.stageResults.stageId === stageId ? this.fixtureData.stageResults : null;
  }

  async getStageRecap(stageId: string): Promise<StageRecap | null> {
    return this.fixtureData.recap.stageId === stageId ? this.fixtureData.recap : null;
  }

  async getSeasonStandings(seasonId: string): Promise<SeasonStandingsResponse | null> {
    return this.fixtureData.seasonStandings.seasonId === seasonId ? this.fixtureData.seasonStandings : null;
  }

  async getSeasonArchetypes(seasonId: string): Promise<SeasonArchetypesResponse | null> {
    const data = this.fixtureData.seasonArchetypes.data.filter((snapshot) => snapshot.seasonId === seasonId);
    return data.length > 0 ? { data } : null;
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
