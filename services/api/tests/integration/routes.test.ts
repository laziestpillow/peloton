import { afterEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/http/server.js";
import { loadConfig } from "../../src/config/env.js";

const testConfig = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  APP_DEEP_LINK_URL: "peloton://strava/callback"
});

let app: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  app = await buildServer(testConfig);
  return app;
}

afterEach(async () => {
  await app?.close();
  app = null;
});

describe("fixture API routes", () => {
  test("serves authentication and integration fixture routes", async () => {
    const server = await getApp();

    const start = await server.inject({ method: "POST", url: "/v1/auth/strava/start" });
    expect(start.statusCode).toBe(200);
    expect(start.json()).toMatchObject({
      authorizationUrl: expect.stringContaining("https://www.strava.com/oauth/authorize"),
      stateExpiresAt: expect.any(String)
    });

    const callback = await server.inject({ method: "GET", url: "/v1/auth/strava/callback?code=fixture-code&state=fixture-state" });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("peloton://strava/callback");

    const missingCallbackQuery = await server.inject({ method: "GET", url: "/v1/auth/strava/callback?code=fixture-code" });
    expect(missingCallbackQuery.statusCode).toBe(400);
    expect(missingCallbackQuery.json()).toMatchObject({ error: { code: "bad_request" } });

    const status = await server.inject({ method: "GET", url: "/v1/integrations/strava/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      status: "notConnected",
      acceptedScopes: [],
      lastSyncedAt: null
    });

    const disconnect = await server.inject({ method: "DELETE", url: "/v1/integrations/strava" });
    expect(disconnect.statusCode).toBe(204);
  });

  test("serves activity fixture routes", async () => {
    const server = await getApp();

    const sync = await server.inject({ method: "POST", url: "/v1/activities/sync" });
    expect(sync.statusCode).toBe(202);
    expect(sync.json()).toMatchObject({ status: "accepted", requestedAt: expect.any(String) });

    const list = await server.inject({ method: "GET", url: "/v1/activities" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: "activity-001" })]),
      pagination: { nextCursor: null }
    });

    const detail = await server.inject({ method: "GET", url: "/v1/activities/activity-001" });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: "activity-001", processedStageId: "stage-001" });

    const missing = await server.inject({ method: "GET", url: "/v1/activities/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "not_found" } });
  });

  test("serves rider and group fixture routes", async () => {
    const server = await getApp();

    const rider = await server.inject({ method: "GET", url: "/v1/riders/me" });
    expect(rider.statusCode).toBe(200);
    expect(rider.json()).toMatchObject({ id: "rider-001", userId: "user-001" });

    const appearance = {
      jerseyColor: "#123456",
      accentColor: "#ABCDEF",
      helmetColor: "#111111",
      bikeColor: "#222222",
      pattern: "solid"
    };
    const updateAppearance = await server.inject({ method: "PATCH", url: "/v1/riders/me/appearance", payload: appearance });
    expect(updateAppearance.statusCode).toBe(200);
    expect(updateAppearance.json()).toMatchObject({ id: "rider-001", appearance });

    const invalidAppearance = await server.inject({ method: "PATCH", url: "/v1/riders/me/appearance", payload: { pattern: "solid" } });
    expect(invalidAppearance.statusCode).toBe(400);
    expect(invalidAppearance.json()).toMatchObject({ error: { code: "bad_request" } });

    const createGroup = await server.inject({ method: "POST", url: "/v1/groups", payload: { name: "Tuesday Ride" } });
    expect(createGroup.statusCode).toBe(201);
    expect(createGroup.json()).toMatchObject({ id: "group-001", name: "Tuesday Ride" });

    const invalidGroup = await server.inject({ method: "POST", url: "/v1/groups", payload: {} });
    expect(invalidGroup.statusCode).toBe(400);

    const group = await server.inject({ method: "GET", url: "/v1/groups/group-001" });
    expect(group.statusCode).toBe(200);
    expect(group.json()).toMatchObject({ id: "group-001", name: "Fixture Club" });

    const member = await server.inject({ method: "POST", url: "/v1/groups/group-001/members", payload: { riderId: "rider-001" } });
    expect(member.statusCode).toBe(201);
    expect(member.json()).toMatchObject({ groupId: "group-001", riderId: "rider-001", role: "member" });

    const missingMemberTarget = await server.inject({ method: "POST", url: "/v1/groups/group-001/members", payload: { riderId: "missing" } });
    expect(missingMemberTarget.statusCode).toBe(404);
  });

  test("serves stage and season fixture routes", async () => {
    const server = await getApp();

    const groupStages = await server.inject({ method: "GET", url: "/v1/groups/group-001/stages" });
    expect(groupStages.statusCode).toBe(200);
    expect(groupStages.json()).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: "stage-001" })])
    });

    const stage = await server.inject({ method: "GET", url: "/v1/stages/stage-001" });
    expect(stage.statusCode).toBe(200);
    expect(stage.json()).toMatchObject({ id: "stage-001", seasonId: "season-001", status: "completed" });

    const recap = await server.inject({ method: "GET", url: "/v1/stages/stage-001/recap" });
    expect(recap.statusCode).toBe(200);
    expect(recap.json()).toMatchObject({ stageId: "stage-001", riders: expect.any(Array), timeline: expect.any(Array) });

    const results = await server.inject({ method: "GET", url: "/v1/stages/stage-001/results" });
    expect(results.statusCode).toBe(200);
    expect(results.json()).toMatchObject({ stageId: "stage-001", jerseyLeaders: expect.any(Object) });

    const standings = await server.inject({ method: "GET", url: "/v1/seasons/season-001/standings" });
    expect(standings.statusCode).toBe(200);
    expect(standings.json()).toMatchObject({ seasonId: "season-001", standings: expect.any(Array) });

    const archetypes = await server.inject({ method: "GET", url: "/v1/seasons/season-001/archetypes" });
    expect(archetypes.statusCode).toBe(200);
    expect(archetypes.json()).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ seasonId: "season-001" })])
    });

    const missingStage = await server.inject({ method: "GET", url: "/v1/stages/missing" });
    expect(missingStage.statusCode).toBe(404);
    expect(missingStage.json()).toMatchObject({ error: { code: "not_found" } });

    const missingSeason = await server.inject({ method: "GET", url: "/v1/seasons/missing/standings" });
    expect(missingSeason.statusCode).toBe(404);
  });

  test("returns a contract-shaped 404 for unknown routes", async () => {
    const server = await getApp();

    const response = await server.inject({ method: "GET", url: "/v1/unknown" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "not_found", message: "Route not found." } });
  });

  test("returns a contract-shaped 400 for malformed request bodies", async () => {
    const server = await getApp();

    const response = await server.inject({
      method: "POST",
      url: "/v1/groups",
      headers: { "content-type": "application/json" },
      payload: "{"
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "bad_request" } });
  });
});
