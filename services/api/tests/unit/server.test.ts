import { describe, expect, test } from "vitest";
import { buildServer } from "../../src/http/server.js";
import type { AppConfig } from "../../src/config/env.js";
import { loadApiFixtureData } from "../../src/application/fixtureData.js";
import { FixtureRepository } from "../../src/infrastructure/repositories/FixtureRepository.js";
import { MockStravaGateway } from "../../src/infrastructure/strava/MockStravaGateway.js";
import { sensitiveLogRedactionPaths } from "../../src/http/server.js";

const config: AppConfig = {
  NODE_ENV: "test",
  DATA_SOURCE: "fixture",
  AUTH_MODE: "fixture",
  FIXTURE_AUTH_TOKENS: "user-001:dev-token-user-001,user-002:dev-token-user-002,user-003:dev-token-user-003",
  AUTH_RATE_LIMIT_MAX: 60,
  AUTH_RATE_LIMIT_WINDOW_SECONDS: 60,
  CURRENT_USER_ID: "user-001",
  API_HOST: "127.0.0.1",
  API_PORT: 8080,
  DATABASE_URL: "postgres://peloton:peloton@127.0.0.1:5432/peloton",
  LOG_LEVEL: "silent",
  STRAVA_CLIENT_ID: "12345",
  STRAVA_CLIENT_SECRET: "test-secret",
  STRAVA_CALLBACK_URL: "http://127.0.0.1:8080/v1/auth/strava/callback",
  STRAVA_OAUTH_SCOPE: "read,activity:read_all",
  STRAVA_OAUTH_STATE_TTL_SECONDS: 600,
  STRAVA_TOKEN_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000",
  APP_DEEP_LINK_URL: "peloton://strava/callback",
  ALLOW_LIVE_DATABASE_TASKS: false
};

const userOneAuth = { authorization: "Bearer dev-token-user-001" };
const userTwoAuth = { authorization: "Bearer dev-token-user-002" };
const userThreeAuth = { authorization: "Bearer dev-token-user-003" };

function expectErrorResponse(response: { json(): unknown }, code: string, message: string, requestId?: string) {
  expect(response.json()).toEqual({
    error: {
      code,
      message,
      requestId: requestId ?? expect.any(String)
    }
  });
}

describe("server repository-backed routes", () => {
  test("serves current rider and activities through injected repository", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const riderResponse = await app.inject({ method: "GET", url: "/v1/riders/me", headers: userOneAuth });
      expect(riderResponse.statusCode).toBe(200);
      expect(riderResponse.json()).toMatchObject({ id: "rider-001", userId: "user-001" });

      const activityResponse = await app.inject({ method: "GET", url: "/v1/activities/activity-001", headers: userOneAuth });
      expect(activityResponse.statusCode).toBe(200);
      expect(activityResponse.json()).toMatchObject({ id: "activity-001", processedStageId: "stage-001" });
    } finally {
      await app.close();
    }
  });

  test("rejects missing, malformed, and invalid bearer tokens on protected routes", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const missing = await app.inject({ method: "GET", url: "/v1/riders/me" });
      expect(missing.statusCode).toBe(401);
      expectErrorResponse(missing, "unauthorized", "Missing bearer token.");

      const malformed = await app.inject({ method: "GET", url: "/v1/riders/me", headers: { authorization: "Basic no" } });
      expect(malformed.statusCode).toBe(401);
      expectErrorResponse(malformed, "unauthorized", "Malformed bearer token.");

      const invalid = await app.inject({ method: "GET", url: "/v1/riders/me", headers: { authorization: "Bearer nope" } });
      expect(invalid.statusCode).toBe(401);
      expectErrorResponse(invalid, "unauthorized", "Invalid bearer token.");
    } finally {
      await app.close();
    }
  });

  test("rate limits repeated authentication attempts", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer({ ...config, AUTH_RATE_LIMIT_MAX: 1, AUTH_RATE_LIMIT_WINDOW_SECONDS: 60 }, { repository });

    try {
      const first = await app.inject({ method: "GET", url: "/v1/riders/me" });
      expect(first.statusCode).toBe(401);

      const second = await app.inject({ method: "GET", url: "/v1/riders/me" });
      expect(second.statusCode).toBe(429);
      expectErrorResponse(second, "rate_limited", "Too many authentication attempts.");
    } finally {
      await app.close();
    }
  });

  test("leaves health and Strava callback public", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository, stravaGateway: new MockStravaGateway() });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);

      const callback = await app.inject({ method: "GET", url: "/v1/auth/strava/callback" });
      expect(callback.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  test("creates Strava authorization state and completes callback without exposing tokens", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository, stravaGateway: new MockStravaGateway() });

    try {
      const start = await app.inject({ method: "POST", url: "/v1/auth/strava/start", headers: userOneAuth });
      expect(start.statusCode).toBe(200);
      const startBody = start.json();
      const authorizationUrl = new URL(startBody.authorizationUrl);
      expect(authorizationUrl.origin).toBe("https://www.strava.com");
      expect(authorizationUrl.searchParams.get("client_id")).toBe("12345");
      expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(config.STRAVA_CALLBACK_URL);
      expect(authorizationUrl.searchParams.get("scope")).toBe(config.STRAVA_OAUTH_SCOPE);
      expect(startBody).not.toHaveProperty("accessToken");
      expect(startBody).not.toHaveProperty("refreshToken");

      const callback = await app.inject({
        method: "GET",
        url: `/v1/auth/strava/callback?code=accepted-code&scope=read,activity:read_all&state=${authorizationUrl.searchParams.get("state")}`
      });
      expect(callback.statusCode).toBe(302);
      expect(callback.headers.location).toBe("peloton://strava/callback?status=connected");
      expect(callback.body).not.toContain("mock-access");
      expect(callback.body).not.toContain("mock-refresh");

      const connectedStatus = await app.inject({ method: "GET", url: "/v1/integrations/strava/status", headers: userOneAuth });
      expect(connectedStatus.statusCode).toBe(200);
      expect(connectedStatus.json()).toMatchObject({
        status: "expired",
        acceptedScopes: ["read", "activity:read_all"],
        lastSyncedAt: null
      });

      const sync = await app.inject({
        method: "POST",
        url: "/v1/activities/sync",
        headers: { ...userOneAuth, "idempotency-key": "server-sync-001" }
      });
      expect(sync.statusCode).toBe(202);
      expect(sync.json()).toMatchObject({ status: "accepted" });

      const repeatedSync = await app.inject({
        method: "POST",
        url: "/v1/activities/sync",
        headers: { ...userOneAuth, "idempotency-key": "server-sync-001" }
      });
      expect(repeatedSync.statusCode).toBe(202);
      expect(repeatedSync.json()).toEqual({
        status: "alreadyRunning",
        requestedAt: sync.json().requestedAt
      });

      const activities = await app.inject({ method: "GET", url: "/v1/activities", headers: userOneAuth });
      expect(activities.statusCode).toBe(200);
      expect(activities.json().data).toEqual(expect.arrayContaining([
        expect.objectContaining({ provider: "strava", providerActivityId: "mock-strava-001", importStatus: "eligible" })
      ]));

      const disconnect = await app.inject({ method: "DELETE", url: "/v1/integrations/strava", headers: userOneAuth });
      expect(disconnect.statusCode).toBe(204);

      const revokedStatus = await app.inject({ method: "GET", url: "/v1/integrations/strava/status", headers: userOneAuth });
      expect(revokedStatus.statusCode).toBe(200);
      expect(revokedStatus.json()).toMatchObject({ status: "revoked" });
    } finally {
      await app.close();
    }
  });

  test("rejects replayed Strava OAuth callback state", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository, stravaGateway: new MockStravaGateway() });

    try {
      const start = await app.inject({ method: "POST", url: "/v1/auth/strava/start", headers: userOneAuth });
      const state = new URL(start.json().authorizationUrl).searchParams.get("state");
      const first = await app.inject({ method: "GET", url: `/v1/auth/strava/callback?code=first&state=${state}` });
      expect(first.statusCode).toBe(302);

      const second = await app.inject({ method: "GET", url: `/v1/auth/strava/callback?code=second&state=${state}` });
      expect(second.statusCode).toBe(400);
      expectErrorResponse(second, "bad_request", "Strava authorization state was already used.");
    } finally {
      await app.close();
    }
  });

  test("scopes current rider and activities to the bearer token user", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const riderResponse = await app.inject({ method: "GET", url: "/v1/riders/me", headers: userTwoAuth });
      expect(riderResponse.statusCode).toBe(200);
      expect(riderResponse.json()).toMatchObject({ id: "rider-002", userId: "user-002" });

      const activityList = await app.inject({ method: "GET", url: "/v1/activities", headers: userTwoAuth });
      expect(activityList.statusCode).toBe(200);
      expect(activityList.json()).toEqual({ data: [], pagination: { nextCursor: null } });

      const otherUserActivity = await app.inject({ method: "GET", url: "/v1/activities/activity-001", headers: userTwoAuth });
      expect(otherUserActivity.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  test("enforces group membership and owner-only member additions", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const memberRead = await app.inject({ method: "GET", url: "/v1/groups/group-001", headers: userTwoAuth });
      expect(memberRead.statusCode).toBe(200);

      const nonMemberRead = await app.inject({ method: "GET", url: "/v1/groups/group-001", headers: userThreeAuth });
      expect(nonMemberRead.statusCode).toBe(403);

      const memberAdd = await app.inject({
        method: "POST",
        url: "/v1/groups/group-001/members",
        headers: userTwoAuth,
        payload: { riderId: "rider-002" }
      });
      expect(memberAdd.statusCode).toBe(403);

      const ownerAdd = await app.inject({
        method: "POST",
        url: "/v1/groups/group-001/members",
        headers: userOneAuth,
        payload: { riderId: "rider-002" }
      });
      expect(ownerAdd.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  test("serves group stage list and stage detail through repository-backed use cases", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const list = await app.inject({ method: "GET", url: "/v1/groups/group-001/stages", headers: userOneAuth });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject({
        data: [
          {
            id: "stage-001",
            orderedMarkers: [
              { id: "marker-sprint-001", pointsSchedule: [20, 17, 15, 13, 11] },
              { id: "marker-climb-001", pointsSchedule: [10, 8, 6, 4, 2] }
            ]
          }
        ]
      });

      const detail = await app.inject({ method: "GET", url: "/v1/stages/stage-001", headers: userTwoAuth });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({ id: "stage-001", route: { distanceMeters: 42195 } });

      const missing = await app.inject({ method: "GET", url: "/v1/stages/missing", headers: userOneAuth });
      expect(missing.statusCode).toBe(404);

      const forbidden = await app.inject({ method: "GET", url: "/v1/groups/group-001/stages", headers: userThreeAuth });
      expect(forbidden.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  test("echoes incoming request IDs on errors and response headers", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/activities/missing",
        headers: { ...userOneAuth, "x-request-id": "issue-25-request-id" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers["x-request-id"]).toBe("issue-25-request-id");
      expectErrorResponse(response, "not_found", "Activity not found.", "issue-25-request-id");
    } finally {
      await app.close();
    }
  });

  test("normalizes unknown route errors with request IDs", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const response = await app.inject({ method: "GET", url: "/v1/nope", headers: userOneAuth });
      expect(response.statusCode).toBe(404);
      expectErrorResponse(response, "not_found", "Route not found.");
    } finally {
      await app.close();
    }
  });

  test("redacts known sensitive fields from request logs", () => {
    expect(sensitiveLogRedactionPaths).toEqual(expect.arrayContaining([
      "req.headers.authorization",
      "req.query.code",
      "req.query.state",
      "accessToken",
      "refreshToken",
      "encryptedAccessToken",
      "encryptedRefreshToken",
      "STRAVA_CLIENT_SECRET",
      "STRAVA_TOKEN_ENCRYPTION_KEY",
      "DATABASE_URL"
    ]));
  });
});
