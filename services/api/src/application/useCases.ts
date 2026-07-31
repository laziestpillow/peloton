import { randomBytes } from "node:crypto";
import type { ApiFixtureData } from "./fixtureData.js";
import type {
  ActivityListResponse,
  Group,
  GroupMembership,
  ImportedActivity,
  RiderAppearance,
  RiderProfile
} from "../domain/models.js";
import type { StravaGateway } from "../infrastructure/strava/StravaGateway.js";
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

export interface StravaIntegrationStatus {
  status: "notConnected" | "connected" | "expired" | "error" | "revoked";
  acceptedScopes: readonly string[];
  lastSyncedAt: string | null;
}

export interface ApplicationServices {
  stravaGateway: StravaGateway;
  tokenCipher: TokenCipher;
  stravaClientId: string;
  stravaClientSecret: string;
  stravaCallbackUrl: string;
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
  createStravaOAuthState(input: StravaOAuthState): Promise<void>;
  getStravaOAuthState(state: string): Promise<StravaOAuthState | null>;
  consumeStravaOAuthState(input: { state: string; consumedAt: Date }): Promise<void>;
  upsertStravaConnection(input: StravaConnectionInput): Promise<void>;
  getStravaConnection(userId: string): Promise<StravaConnection | null>;
  updateStravaConnection(input: StravaConnectionInput): Promise<void>;
}

export interface ApplicationUseCases {
  listActivities(): Promise<ActivityListResponse>;
  getActivity(activityId: string): Promise<ImportedActivity | null>;
  getCurrentRider(): Promise<RiderProfile>;
  updateCurrentRiderAppearance(appearance: RiderAppearance): Promise<RiderProfile>;
  createGroup(input: { name?: string }): Promise<Group>;
  getGroup(groupId: string): Promise<Group | null>;
  addGroupMember(input: { groupId: string; riderId: string }): Promise<GroupMembership>;
  startStravaAuthorization(): Promise<{ authorizationUrl: string; stateExpiresAt: string }>;
  completeStravaAuthorization(input: { code?: string; state: string; scope?: string; error?: string }): Promise<{ redirectUrl: string }>;
  getStravaStatus(): Promise<StravaIntegrationStatus>;
  refreshStravaConnection(): Promise<StravaConnection | null>;
  disconnectStrava(): Promise<void>;
  getStageRecap(): Promise<unknown>;
  getStageResults(): Promise<unknown>;
  getSeasonStandings(): Promise<unknown>;
  getSeasonArchetypes(): Promise<unknown>;
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

export function createApplicationUseCases(
  repository: ApplicationRepository,
  currentUserId: string,
  fixtureData: ApiFixtureData,
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
    async refreshStravaConnection() {
      const strava = requireStravaServices();
      const connection = await repository.getStravaConnection(currentUserId);
      if (!connection || connection.status === "revoked") {
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
    },
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
    getStageRecap: async () => fixtureData.recap,
    getStageResults: async () => fixtureData.stageResults,
    getSeasonStandings: async () => fixtureData.seasonStandings,
    async getSeasonArchetypes() {
      return {
        data: [
          {
            seasonId: "season-001",
            riderId: "rider-001",
            archetype: "sprinter",
            confidence: 0.76,
            sampleSize: 5,
            sprintRelativeScore: 0.82,
            climbRelativeScore: 0.61,
            shortEffortScore: 0.7,
            sustainedEffortScore: 0.58,
            effectiveAt: "2026-07-20T10:00:00Z",
            reasons: ["Sprint score is the strongest relative signal."]
          }
        ]
      };
    }
  };
}
