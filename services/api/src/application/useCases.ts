import { randomBytes } from "node:crypto";
import type { ApiFixtureData } from "./fixtureData.js";
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
  StageRecap,
  StageResultsResponse,
  StravaWebhookAction,
  StravaWebhookEvent,
  StravaWebhookSubscription,
  StageMarkerCrossing
} from "../domain/models.js";
import { matchActivityToStages } from "../domain/routeMatching.js";
import { rankMarkerCrossings } from "../domain/scoring.js";
import { actionForStravaWebhookEvent, parseStravaWebhookEvent } from "../domain/stravaWebhook.js";
import { normalizeActivityStreams } from "../domain/streamNormalization.js";
import type { StravaActivitySummary, StravaGateway } from "../infrastructure/strava/StravaGateway.js";
import type { TokenCipher } from "../infrastructure/strava/TokenCipher.js";

export interface StravaOAuthState {
  state: string;
  userId: string;
  redirectUrl: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface StravaConnectionInput {
  userId: string;
  athleteId: string;
  acceptedScopes: readonly string[];
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  status: "connected" | "expired" | "error" | "revoked";
}

export interface StravaConnection extends StravaConnectionInput {
  lastSyncedAt: Date | null;
}

export interface StravaConnectionUpdate extends StravaConnectionInput {
  lastSyncedAt?: Date | null;
}

export interface StravaIntegrationStatus {
  status: "notConnected" | "connected" | "expired" | "error" | "revoked";
  acceptedScopes: readonly string[];
  lastSyncedAt: string | null;
}

export interface StravaConsentInfo {
  title: string;
  summary: string;
  dataCollected: readonly string[];
  dataUse: readonly string[];
  sharedOutputs: string;
  disconnect: string;
  deletion: string;
  supportEmail: string;
  attribution: {
    strava: string;
    garmin: string;
  };
}

export interface ActivitySyncStart {
  syncId: string;
  status: "accepted" | "alreadyRunning";
  requestedAt: Date;
}

export interface ImportedActivityInput {
  riderId: string;
  provider: "strava";
  providerActivityId: string;
  activityType: "ride";
  startedAt: Date;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  routeSummary: ImportedActivity["routeSummary"];
  importStatus: ImportedActivity["importStatus"];
  processedStageId: string | null;
}

export interface ActivityStreamSamplesInput {
  activityId: string;
  samples: readonly ActivityStreamSample[];
}

export interface ActivityStageMatchInput {
  activityId: string;
  riderId: string;
  stageId: string;
  finishTimeSeconds: number;
  matchedAt: Date;
  markerCrossings: readonly StageMarkerCrossing[];
}

export interface StravaWebhookEventInput {
  event: StravaWebhookEvent;
  action: StravaWebhookAction;
  receivedAt: Date;
}

export interface StravaDataRetentionResult {
  deletedActivities: number;
  deletedWebhookEvents: number;
}

export interface ApplicationServices {
  stravaGateway: StravaGateway;
  tokenCipher: TokenCipher;
  stravaClientId: string;
  stravaClientSecret: string;
  stravaCallbackUrl: string;
  stravaWebhookCallbackUrl: string;
  stravaWebhookVerifyToken: string;
  appDeepLinkUrl: string;
  stravaOAuthScope: string;
  stravaOAuthStateTtlSeconds: number;
  now?: () => Date;
}

export interface ApplicationRepository {
  listActivities(userId: string): Promise<ActivityListResponse>;
  getActivity(input: { activityId: string; userId: string }): Promise<ImportedActivity | null>;
  getCurrentRider(userId: string): Promise<RiderProfile | null>;
  updateCurrentRiderAppearance(userId: string, appearance: RiderAppearance): Promise<RiderProfile | null>;
  createGroup(input: { name: string; ownerId: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
  getGroupMembershipForUser(input: { groupId: string; userId: string }): Promise<GroupMembership | null>;
  addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership>;
  listGroupStages(groupId: string): Promise<{ data: readonly Stage[] }>;
  getStage(stageId: string): Promise<Stage | null>;
  getStageGroupId(stageId: string): Promise<string | null>;
  createStravaOAuthState(input: StravaOAuthState): Promise<void>;
  getStravaOAuthState(state: string): Promise<StravaOAuthState | null>;
  consumeStravaOAuthState(input: { state: string; consumedAt: Date }): Promise<void>;
  upsertStravaConnection(input: StravaConnectionInput): Promise<void>;
  getStravaConnection(userId: string): Promise<StravaConnection | null>;
  getStravaConnectionByAthleteId(athleteId: string): Promise<StravaConnection | null>;
  updateStravaConnection(input: StravaConnectionUpdate): Promise<void>;
  beginActivitySync(input: { userId: string; idempotencyKey: string | null; requestedAt: Date }): Promise<ActivitySyncStart>;
  completeActivitySync(input: { syncId: string; userId: string; status: "completed" | "failed"; completedAt: Date }): Promise<void>;
  upsertImportedActivity(input: ImportedActivityInput, options?: { replaceExisting?: boolean }): Promise<{ activity: ImportedActivity; duplicate: boolean }>;
  markImportedActivityDeleted(input: { provider: "strava"; providerActivityId: string }): Promise<void>;
  deleteStravaDataForUser(input: { userId: string; athleteId: string | null }): Promise<void>;
  deleteExpiredStravaData(input: { cutoff: Date; effectiveAt: Date }): Promise<StravaDataRetentionResult>;
  replaceActivityStreamSamples(input: ActivityStreamSamplesInput): Promise<void>;
  listMatchableStages(): Promise<readonly Stage[]>;
  listStageMarkerCrossings(stageId: string): Promise<readonly StageMarkerCrossing[]>;
  saveActivityStageMatch(input: ActivityStageMatchInput): Promise<void>;
  getStageResults(stageId: string): Promise<StageResultsResponse | null>;
  getStageRecap(stageId: string): Promise<StageRecap | null>;
  getSeasonStandings(seasonId: string): Promise<SeasonStandingsResponse | null>;
  getSeasonArchetypes(seasonId: string): Promise<SeasonArchetypesResponse | null>;
  recordStravaWebhookEvent(input: StravaWebhookEventInput): Promise<{ inserted: boolean }>;
}

export interface ApplicationUseCases {
  listActivities(): Promise<ActivityListResponse>;
  getActivity(activityId: string): Promise<ImportedActivity | null>;
  getCurrentRider(): Promise<RiderProfile>;
  updateCurrentRiderAppearance(appearance: RiderAppearance): Promise<RiderProfile>;
  createGroup(input: { name?: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
  addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership>;
  listGroupStages(groupId: string): Promise<{ data: readonly Stage[] }>;
  getStage(stageId: string): Promise<Stage | null>;
  startStravaAuthorization(): Promise<{ authorizationUrl: string; stateExpiresAt: string }>;
  completeStravaAuthorization(input: { code?: string; state: string; scope?: string; error?: string }): Promise<{ redirectUrl: string }>;
  getStravaConsentInfo(): Promise<StravaConsentInfo>;
  getStravaStatus(): Promise<StravaIntegrationStatus>;
  refreshStravaConnection(): Promise<StravaConnection | null>;
  disconnectStrava(): Promise<void>;
  deleteStravaData(): Promise<void>;
  syncActivities(input?: { idempotencyKey?: string }): Promise<{ status: "accepted" | "alreadyRunning"; requestedAt: string }>;
  getStageRecap(stageId: string): Promise<StageRecap | null>;
  getStageResults(stageId: string): Promise<StageResultsResponse | null>;
  getSeasonStandings(seasonId: string): Promise<SeasonStandingsResponse | null>;
  getSeasonArchetypes(seasonId: string): Promise<SeasonArchetypesResponse | null>;
  verifyStravaWebhook(input: { mode?: string; challenge?: string; verifyToken?: string }): Promise<{ "hub.challenge": string }>;
  receiveStravaWebhook(payload: unknown): Promise<{ status: "accepted" }>;
  listStravaWebhookSubscriptions(): Promise<{ data: readonly StravaWebhookSubscription[] }>;
  createStravaWebhookSubscription(): Promise<{ id: number }>;
  deleteStravaWebhookSubscription(subscriptionId: number): Promise<void>;
}

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: 400 | 401 | 403 | 404,
    readonly code: "bad_request" | "unauthorized" | "forbidden" | "not_found",
    message: string
  ) {
    super(message);
  }
}

const stravaConsentInfo: StravaConsentInfo = {
  title: "Connect Strava",
  summary: "Peloton uses Strava only to import your cycling activities and turn them into private activity history plus Peloton race results.",
  dataCollected: [
    "Activity summaries such as ride time, distance, elevation, activity type, and start time.",
    "Route preview data and activity streams such as distance, time, location, altitude, and speed when Strava provides them.",
    "Your Strava athlete identifier, accepted scopes, token expiry, and encrypted tokens needed to keep the connection working."
  ],
  dataUse: [
    "Match your rides to Peloton stages and markers.",
    "Calculate Peloton-native classifications, standings, jersey leaders, recap timelines, and rider archetypes.",
    "Keep your Strava connection current, process Strava webhook updates, and remove activities that Strava reports as deleted or inaccessible."
  ],
  sharedOutputs: "Group views show Peloton-native race outputs such as rankings, points, jersey leaders, archetypes, and recap positions. They do not show another rider's raw Strava activity metadata, provider activity IDs, route maps, polylines, streams, or segment data.",
  disconnect: "Disconnect revokes Peloton's Strava access and stops future syncs. It does not delete previously imported Strava data unless you also choose deletion.",
  deletion: "Delete Strava data revokes the connection and removes stored Strava imports, streams, webhook event records, and dependent race rows tied to those imports.",
  supportEmail: "support@example.com",
  attribution: {
    strava: "Activity data provided by Strava.",
    garmin: "Some activity data may originate from Garmin devices through Strava and should be attributed to Garmin when displayed."
  }
};

export function createApplicationUseCases(
  repository: ApplicationRepository,
  currentUserId: string,
  _fixtureData: ApiFixtureData,
  services?: ApplicationServices
): ApplicationUseCases {
  const now = () => services?.now?.() ?? new Date();
  const refreshThresholdMs = 60 * 60 * 1000;

  function appendDeepLinkResult(status: "connected" | "error", reason?: string): string {
    const url = new URL(services?.appDeepLinkUrl ?? "peloton://strava/callback");
    url.searchParams.set("status", status);
    if (reason) {
      url.searchParams.set("reason", reason);
    }
    return url.toString();
  }

  function requireStravaServices(): ApplicationServices {
    if (!services) {
      throw new ApplicationError(400, "bad_request", "Strava integration is not configured.");
    }
    if (!services.stravaClientId || !services.stravaClientSecret) {
      throw new ApplicationError(400, "bad_request", "Strava client credentials are not configured.");
    }
    if (!services.stravaWebhookVerifyToken) {
      throw new ApplicationError(400, "bad_request", "Strava webhook verification token is not configured.");
    }
    return services;
  }

  function toIntegrationStatus(connection: StravaConnection | null): StravaIntegrationStatus {
    if (!connection) {
      return { status: "notConnected", acceptedScopes: [], lastSyncedAt: null };
    }
    if (connection.status === "connected" && connection.accessTokenExpiresAt.getTime() <= now().getTime()) {
      return {
        status: "expired",
        acceptedScopes: connection.acceptedScopes,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null
      };
    }
    return {
      status: connection.status,
      acceptedScopes: connection.acceptedScopes,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null
    };
  }

  async function getCurrentRiderOrThrow(): Promise<RiderProfile> {
    const rider = await repository.getCurrentRider(currentUserId);
    if (!rider) {
      throw new ApplicationError(404, "not_found", "Current rider was not found.");
    }
    return rider;
  }

  async function requireGroupAccess(groupId: string): Promise<Group> {
    const group = await repository.getGroup(groupId);
    if (!group) {
      throw new ApplicationError(404, "not_found", "Group not found.");
    }
    if (group.ownerId === currentUserId) {
      return group;
    }
    const membership = await repository.getGroupMembershipForUser({ groupId, userId: currentUserId });
    if (!membership || membership.status !== "active") {
      throw new ApplicationError(403, "forbidden", "You do not have access to this group.");
    }
    return group;
  }

  function isSupportedRide(sportType: string | undefined): boolean {
    return sportType === undefined || ["Ride", "VirtualRide", "EBikeRide"].includes(sportType);
  }

  function emptyRouteSummary(polyline?: string): ImportedActivity["routeSummary"] {
    return {
      polyline: polyline ?? "",
      previewBounds: {
        southWest: { latitude: 0, longitude: 0 },
        northEast: { latitude: 0, longitude: 0 }
      }
    };
  }

  async function matchAndPersistActivity(activity: ImportedActivity, samples: readonly ActivityStreamSample[]): Promise<void> {
    const stages = await repository.listMatchableStages();
    const match = matchActivityToStages(activity, samples, stages);
    if (!match) {
      return;
    }

    const existingCrossings = await repository.listStageMarkerCrossings(match.stage.id);
    const rankedCrossings = match.stage.orderedMarkers.flatMap((marker) => {
      const markerCrossings = [
        ...existingCrossings
          .filter((crossing) => crossing.markerId === marker.id && crossing.riderId !== activity.riderId)
          .map((crossing) => ({
            markerId: crossing.markerId,
            riderId: crossing.riderId,
            crossedAtSeconds: crossing.crossedAtSeconds
          })),
        ...match.markerCrossings.filter((crossing) => crossing.markerId === marker.id)
      ];

      return rankMarkerCrossings(marker, markerCrossings).map((crossing) => ({
        stageId: match.stage.id,
        markerId: marker.id,
        activityId: crossing.riderId === activity.riderId
          ? activity.id
          : existingCrossings.find((existing) => existing.markerId === marker.id && existing.riderId === crossing.riderId)?.activityId ?? activity.id,
        riderId: crossing.riderId,
        crossedAtSeconds: crossing.crossedAtSeconds,
        rank: crossing.rank,
        points: crossing.points
      }));
    });

    await repository.saveActivityStageMatch({
      activityId: activity.id,
      riderId: activity.riderId,
      stageId: match.stage.id,
      finishTimeSeconds: match.finishTimeSeconds,
      matchedAt: now(),
      markerCrossings: rankedCrossings
    });
  }

  async function refreshConnection(connection: StravaConnection): Promise<StravaConnection | null> {
    const strava = requireStravaServices();
    if (connection.status === "revoked") {
      return null;
    }
    if (connection.accessTokenExpiresAt.getTime() - now().getTime() > refreshThresholdMs) {
      return connection;
    }

    try {
      const refresh = await strava.stravaGateway.refreshAccessToken({
        clientId: strava.stravaClientId,
        clientSecret: strava.stravaClientSecret,
        refreshToken: strava.tokenCipher.decrypt(connection.encryptedRefreshToken)
      });
      const refreshedConnection: StravaConnection = {
        ...connection,
        encryptedAccessToken: strava.tokenCipher.encrypt(refresh.accessToken),
        encryptedRefreshToken: strava.tokenCipher.encrypt(refresh.refreshToken),
        accessTokenExpiresAt: refresh.expiresAt,
        status: "connected"
      };
      await repository.updateStravaConnection(refreshedConnection);
      return refreshedConnection;
    } catch {
      const erroredConnection: StravaConnection = { ...connection, status: "error" };
      await repository.updateStravaConnection(erroredConnection);
      return erroredConnection;
    }
  }

  async function refreshStravaConnection(): Promise<StravaConnection | null> {
    const connection = await repository.getStravaConnection(currentUserId);
    return connection ? refreshConnection(connection) : null;
  }

  async function importStravaActivityForUser(input: {
    userId: string;
    connection: StravaConnection;
    activity: StravaActivitySummary;
    replaceExisting?: boolean;
  }): Promise<void> {
    const strava = requireStravaServices();
    const rider = await repository.getCurrentRider(input.userId);
    if (!rider) {
      throw new ApplicationError(404, "not_found", "Current rider was not found.");
    }

    const supported = isSupportedRide(input.activity.sportType);
    let routeSummary = emptyRouteSummary(input.activity.polyline);
    let importStatus: ImportedActivity["importStatus"] = supported ? "eligible" : "unsupported";
    let samples: readonly ActivityStreamSample[] = [];

    if (supported) {
      try {
        const streams = await strava.stravaGateway.getActivityStreams({
          accessToken: strava.tokenCipher.decrypt(input.connection.encryptedAccessToken),
          providerActivityId: input.activity.providerActivityId
        });
        const normalized = normalizeActivityStreams(streams, input.activity.polyline);
        routeSummary = normalized.routeSummary;
        samples = normalized.samples;
      } catch {
        importStatus = "failed";
      }
    }

    const imported = await repository.upsertImportedActivity({
      riderId: rider.id,
      provider: "strava",
      providerActivityId: input.activity.providerActivityId,
      activityType: "ride",
      startedAt: new Date(input.activity.startedAt),
      distanceMeters: input.activity.distanceMeters,
      elapsedTimeSeconds: input.activity.elapsedTimeSeconds,
      movingTimeSeconds: input.activity.movingTimeSeconds,
      elevationGainMeters: input.activity.elevationGainMeters,
      routeSummary,
      importStatus,
      processedStageId: null
    }, input.replaceExisting ? { replaceExisting: true } : undefined);

    if ((!imported.duplicate || input.replaceExisting) && samples.length > 0) {
      await repository.replaceActivityStreamSamples({ activityId: imported.activity.id, samples });
      if (imported.activity.importStatus === "eligible") {
        await matchAndPersistActivity(imported.activity, samples);
      }
    }
  }

  return {
    listActivities: () => repository.listActivities(currentUserId),
    getActivity: (activityId) => repository.getActivity({ activityId, userId: currentUserId }),
    getCurrentRider: getCurrentRiderOrThrow,
    async updateCurrentRiderAppearance(appearance) {
      const rider = await repository.updateCurrentRiderAppearance(currentUserId, appearance);
      if (!rider) {
        throw new ApplicationError(404, "not_found", "Current rider was not found.");
      }
      return rider;
    },
    createGroup: (input) => repository.createGroup({ name: input.name ?? "Fixture Club", ownerId: currentUserId }),
    getGroup: requireGroupAccess,
    async addGroupMember(input) {
      const group = await repository.getGroup(input.groupId);
      if (!group) {
        throw new ApplicationError(404, "not_found", "Group not found.");
      }
      if (group.ownerId !== currentUserId) {
        throw new ApplicationError(403, "forbidden", "Only the group owner can add members.");
      }
      return repository.addGroupMember(input);
    },
    async listGroupStages(groupId) {
      await requireGroupAccess(groupId);
      return repository.listGroupStages(groupId);
    },
    async getStage(stageId) {
      const groupId = await repository.getStageGroupId(stageId);
      if (!groupId) {
        return null;
      }
      await requireGroupAccess(groupId);
      return repository.getStage(stageId);
    },
    async startStravaAuthorization() {
      const strava = requireStravaServices();
      await getCurrentRiderOrThrow();
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + strava.stravaOAuthStateTtlSeconds * 1000);
      const state = randomBytes(32).toString("base64url");
      await repository.createStravaOAuthState({
        state,
        userId: currentUserId,
        redirectUrl: strava.stravaCallbackUrl,
        expiresAt,
        consumedAt: null,
        createdAt
      });

      const authorizationUrl = new URL("https://www.strava.com/oauth/authorize");
      authorizationUrl.searchParams.set("client_id", strava.stravaClientId);
      authorizationUrl.searchParams.set("redirect_uri", strava.stravaCallbackUrl);
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set("approval_prompt", "auto");
      authorizationUrl.searchParams.set("scope", strava.stravaOAuthScope);
      authorizationUrl.searchParams.set("state", state);

      return { authorizationUrl: authorizationUrl.toString(), stateExpiresAt: expiresAt.toISOString() };
    },
    async completeStravaAuthorization(input) {
      const strava = requireStravaServices();
      const state = await repository.getStravaOAuthState(input.state);
      if (!state) {
        throw new ApplicationError(400, "bad_request", "Invalid Strava authorization state.");
      }
      if (state.consumedAt) {
        throw new ApplicationError(400, "bad_request", "Strava authorization state was already used.");
      }
      if (state.expiresAt.getTime() <= now().getTime()) {
        throw new ApplicationError(400, "bad_request", "Strava authorization state has expired.");
      }

      const consumedAt = now();
      await repository.consumeStravaOAuthState({ state: input.state, consumedAt });

      if (input.error) {
        return { redirectUrl: appendDeepLinkResult("error", input.error) };
      }
      if (!input.code) {
        throw new ApplicationError(400, "bad_request", "Missing Strava authorization code.");
      }

      let tokenExchange;
      try {
        tokenExchange = await strava.stravaGateway.exchangeAuthorizationCode({
          clientId: strava.stravaClientId,
          clientSecret: strava.stravaClientSecret,
          code: input.code,
          ...(input.scope ? { acceptedScope: input.scope } : {})
        });
      } catch {
        return { redirectUrl: appendDeepLinkResult("error", "token_exchange_failed") };
      }

      await repository.upsertStravaConnection({
        userId: state.userId,
        athleteId: tokenExchange.athleteId,
        acceptedScopes: tokenExchange.acceptedScopes,
        encryptedAccessToken: strava.tokenCipher.encrypt(tokenExchange.accessToken),
        encryptedRefreshToken: strava.tokenCipher.encrypt(tokenExchange.refreshToken),
        accessTokenExpiresAt: tokenExchange.expiresAt,
        status: "connected"
      });

      return { redirectUrl: appendDeepLinkResult("connected") };
    },
    async getStravaStatus() {
      return toIntegrationStatus(await repository.getStravaConnection(currentUserId));
    },
    async getStravaConsentInfo() {
      return stravaConsentInfo;
    },
    refreshStravaConnection,
    async disconnectStrava() {
      const strava = requireStravaServices();
      const connection = await repository.getStravaConnection(currentUserId);
      if (!connection || connection.status === "revoked") {
        return;
      }

      const refreshToken = strava.tokenCipher.decrypt(connection.encryptedRefreshToken);
      try {
        await strava.stravaGateway.revokeToken({
          clientId: strava.stravaClientId,
          clientSecret: strava.stravaClientSecret,
          token: refreshToken,
          tokenTypeHint: "refresh_token"
        });
      } catch {
        // Local state still becomes revoked so the user can disconnect safely.
      }
      await repository.updateStravaConnection({
        ...connection,
        encryptedAccessToken: strava.tokenCipher.encrypt("revoked"),
        encryptedRefreshToken: strava.tokenCipher.encrypt("revoked"),
        accessTokenExpiresAt: now(),
        status: "revoked"
      });
    },
    async deleteStravaData() {
      const connection = await repository.getStravaConnection(currentUserId);
      if (connection && connection.status !== "revoked") {
        const strava = requireStravaServices();
        const refreshToken = strava.tokenCipher.decrypt(connection.encryptedRefreshToken);
        try {
          await strava.stravaGateway.revokeToken({
            clientId: strava.stravaClientId,
            clientSecret: strava.stravaClientSecret,
            token: refreshToken,
            tokenTypeHint: "refresh_token"
          });
        } catch {
          // Deletion must still remove local Strava data if Strava revocation fails.
        }
        await repository.updateStravaConnection({
          ...connection,
          encryptedAccessToken: strava.tokenCipher.encrypt("revoked"),
          encryptedRefreshToken: strava.tokenCipher.encrypt("revoked"),
          accessTokenExpiresAt: now(),
          status: "revoked"
        });
      }
      await repository.deleteStravaDataForUser({ userId: currentUserId, athleteId: connection?.athleteId ?? null });
    },
    async syncActivities(input) {
      const strava = requireStravaServices();
      await getCurrentRiderOrThrow();
      const requestedAt = now();
      const sync = await repository.beginActivitySync({
        userId: currentUserId,
        idempotencyKey: input?.idempotencyKey ?? null,
        requestedAt
      });
      if (sync.status === "alreadyRunning") {
        return { status: sync.status, requestedAt: sync.requestedAt.toISOString() };
      }

      try {
        const connection = await refreshStravaConnection();
        if (!connection || connection.status !== "connected") {
          throw new ApplicationError(400, "bad_request", "Strava is not connected.");
        }

        const activities = await strava.stravaGateway.listRecentActivities({
          accessToken: strava.tokenCipher.decrypt(connection.encryptedAccessToken)
        });
        for (const activity of activities) {
          await importStravaActivityForUser({ userId: currentUserId, connection, activity });
        }

        const completedAt = now();
        await repository.updateStravaConnection({ ...connection, lastSyncedAt: completedAt, status: "connected" });
        await repository.completeActivitySync({ syncId: sync.syncId, userId: currentUserId, status: "completed", completedAt });
      } catch (error) {
        await repository.completeActivitySync({ syncId: sync.syncId, userId: currentUserId, status: "failed", completedAt: now() });
        const connection = await repository.getStravaConnection(currentUserId);
        if (connection && connection.status !== "revoked") {
          await repository.updateStravaConnection({ ...connection, status: "error" });
        }
        throw error;
      }

      return { status: sync.status, requestedAt: sync.requestedAt.toISOString() };
    },
    async getStageRecap(stageId) {
      const groupId = await repository.getStageGroupId(stageId);
      if (!groupId) {
        return null;
      }
      await requireGroupAccess(groupId);
      return repository.getStageRecap(stageId);
    },
    async getStageResults(stageId) {
      return repository.getStageResults(stageId);
    },
    async getSeasonStandings(seasonId) {
      return repository.getSeasonStandings(seasonId);
    },
    async getSeasonArchetypes(seasonId) {
      return repository.getSeasonArchetypes(seasonId);
    },
    async verifyStravaWebhook(input) {
      const strava = requireStravaServices();
      if (input.mode !== "subscribe" || !input.challenge || input.verifyToken !== strava.stravaWebhookVerifyToken) {
        throw new ApplicationError(403, "forbidden", "Invalid Strava webhook verification request.");
      }
      return { "hub.challenge": input.challenge };
    },
    async receiveStravaWebhook(payload) {
      let event: StravaWebhookEvent;
      try {
        event = parseStravaWebhookEvent(payload);
      } catch {
        throw new ApplicationError(400, "bad_request", "Invalid Strava webhook event payload.");
      }
      const recorded = await repository.recordStravaWebhookEvent({
        event,
        action: actionForStravaWebhookEvent(event),
        receivedAt: now()
      });
      if (!recorded.inserted) {
        return { status: "accepted" };
      }

      if (event.objectType === "activity" && (event.aspectType === "create" || event.aspectType === "update")) {
        const strava = requireStravaServices();
        const existingConnection = await repository.getStravaConnectionByAthleteId(event.ownerId);
        const connection = existingConnection ? await refreshConnection(existingConnection) : null;
        if (!connection || connection.status !== "connected") {
          return { status: "accepted" };
        }
        const activity = await strava.stravaGateway.getActivity({
          accessToken: strava.tokenCipher.decrypt(connection.encryptedAccessToken),
          providerActivityId: event.objectId
        });
        if (activity) {
          await importStravaActivityForUser({
            userId: connection.userId,
            connection,
            activity,
            replaceExisting: true
          });
          await repository.updateStravaConnection({ ...connection, lastSyncedAt: now(), status: "connected" });
        } else {
          await repository.markImportedActivityDeleted({ provider: "strava", providerActivityId: event.objectId });
        }
      } else if (event.objectType === "activity" && event.aspectType === "delete") {
        await repository.markImportedActivityDeleted({ provider: "strava", providerActivityId: event.objectId });
      } else if (event.objectType === "athlete" && event.updates.authorized === "false") {
        const strava = requireStravaServices();
        const connection = await repository.getStravaConnectionByAthleteId(event.ownerId);
        if (connection && connection.status !== "revoked") {
          await repository.updateStravaConnection({
            ...connection,
            encryptedAccessToken: strava.tokenCipher.encrypt("revoked"),
            encryptedRefreshToken: strava.tokenCipher.encrypt("revoked"),
            accessTokenExpiresAt: now(),
            status: "revoked"
          });
          await repository.deleteStravaDataForUser({ userId: connection.userId, athleteId: event.ownerId });
        }
      }
      return { status: "accepted" };
    },
    async listStravaWebhookSubscriptions() {
      const strava = requireStravaServices();
      const subscriptions = await strava.stravaGateway.listWebhookSubscriptions({
        clientId: strava.stravaClientId,
        clientSecret: strava.stravaClientSecret
      });
      return {
        data: subscriptions.map((subscription) => ({
          id: subscription.id,
          applicationId: subscription.applicationId,
          callbackUrl: subscription.callbackUrl,
          createdAt: subscription.createdAt.toISOString(),
          updatedAt: subscription.updatedAt.toISOString()
        }))
      };
    },
    async createStravaWebhookSubscription() {
      const strava = requireStravaServices();
      return strava.stravaGateway.createWebhookSubscription({
        clientId: strava.stravaClientId,
        clientSecret: strava.stravaClientSecret,
        callbackUrl: strava.stravaWebhookCallbackUrl,
        verifyToken: strava.stravaWebhookVerifyToken
      });
    },
    async deleteStravaWebhookSubscription(subscriptionId) {
      const strava = requireStravaServices();
      await strava.stravaGateway.deleteWebhookSubscription({
        clientId: strava.stravaClientId,
        clientSecret: strava.stravaClientSecret,
        subscriptionId
      });
    }
  };
}
