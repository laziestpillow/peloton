import { describe, expect, test } from "vitest";
import { buildServer } from "../../src/http/server.js";
import type { AppConfig } from "../../src/config/env.js";
import { loadApiFixtureData } from "../../src/application/fixtureData.js";
import { FixtureRepository } from "../../src/infrastructure/repositories/FixtureRepository.js";

const config: AppConfig = {
  NODE_ENV: "test",
  DATA_SOURCE: "fixture",
  CURRENT_USER_ID: "user-001",
  API_HOST: "127.0.0.1",
  API_PORT: 8080,
  DATABASE_URL: "postgres://peloton:peloton@127.0.0.1:5432/peloton",
  LOG_LEVEL: "silent",
  STRAVA_CALLBACK_URL: "http://127.0.0.1:8080/v1/auth/strava/callback",
  APP_DEEP_LINK_URL: "peloton://strava/callback"
};

describe("server repository-backed routes", () => {
  test("serves current rider and activities through injected repository", async () => {
    const repository = new FixtureRepository(await loadApiFixtureData());
    const app = await buildServer(config, { repository });

    try {
      const riderResponse = await app.inject({ method: "GET", url: "/v1/riders/me" });
      expect(riderResponse.statusCode).toBe(200);
      expect(riderResponse.json()).toMatchObject({ id: "rider-001", userId: "user-001" });

      const activityResponse = await app.inject({ method: "GET", url: "/v1/activities/activity-001" });
      expect(activityResponse.statusCode).toBe(200);
      expect(activityResponse.json()).toMatchObject({ id: "activity-001", processedStageId: "stage-001" });
    } finally {
      await app.close();
    }
  });
});
