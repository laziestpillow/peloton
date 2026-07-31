import { describe, expect, test } from "vitest";
import { buildServer } from "../../src/http/server.js";
import type { AppConfig } from "../../src/config/env.js";
import { loadApiFixtureData } from "../../src/application/fixtureData.js";
import { FixtureRepository } from "../../src/infrastructure/repositories/FixtureRepository.js";

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
  STRAVA_CALLBACK_URL: "http://127.0.0.1:8080/v1/auth/strava/callback",
  APP_DEEP_LINK_URL: "peloton://strava/callback"
};

const userOneAuth = { authorization: "Bearer dev-token-user-001" };
const userTwoAuth = { authorization: "Bearer dev-token-user-002" };
const userThreeAuth = { authorization: "Bearer dev-token-user-003" };

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
      expect(missing.json()).toEqual({ error: { code: "unauthorized", message: "Missing bearer token." } });

      const malformed = await app.inject({ method: "GET", url: "/v1/riders/me", headers: { authorization: "Basic no" } });
      expect(malformed.statusCode).toBe(401);
      expect(malformed.json()).toEqual({ error: { code: "unauthorized", message: "Malformed bearer token." } });

      const invalid = await app.inject({ method: "GET", url: "/v1/riders/me", headers: { authorization: "Bearer nope" } });
      expect(invalid.statusCode).toBe(401);
      expect(invalid.json()).toEqual({ error: { code: "unauthorized", message: "Invalid bearer token." } });
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
      expect(second.json()).toEqual({ error: { code: "rate_limited", message: "Too many authentication attempts." } });
    } finally {
      await app.close();
    }
  });

  test("leaves health and Strava callback public", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);

      const callback = await app.inject({ method: "GET", url: "/v1/auth/strava/callback?code=abc&state=xyz" });
      expect(callback.statusCode).toBe(302);
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
});
