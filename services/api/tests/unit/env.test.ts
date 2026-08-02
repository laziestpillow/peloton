import { describe, expect, test } from "vitest";
import { assertSafeDatabaseTask, loadConfig } from "../../src/config/env.js";

const liveConfig = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://peloton:peloton@db.internal:5432/peloton",
  FIXTURE_AUTH_TOKENS: "user-001:live-token-user-001",
  STRAVA_CLIENT_ID: "12345",
  STRAVA_CLIENT_SECRET: "secret",
  STRAVA_CALLBACK_URL: "https://api.example.com/v1/auth/strava/callback",
  STRAVA_WEBHOOK_CALLBACK_URL: "https://api.example.com/v1/webhooks/strava",
  STRAVA_WEBHOOK_VERIFY_TOKEN: "webhook-secret",
  STRAVA_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
} as const;

describe("environment config", () => {
  test("allows local fixture defaults", () => {
    expect(loadConfig({ NODE_ENV: "development" })).toMatchObject({
      NODE_ENV: "development",
      STRAVA_OAUTH_SCOPE: "read,activity:read_all"
    });
  });

  test("requires Strava secrets and encryption key in production", () => {
    expect(() => loadConfig({
      ...liveConfig,
      STRAVA_CLIENT_SECRET: "",
      STRAVA_TOKEN_ENCRYPTION_KEY: "not-hex"
    })).toThrow();
  });

  test("accepts fully configured production environment", () => {
    expect(loadConfig(liveConfig)).toMatchObject({
      NODE_ENV: "production",
      STRAVA_CLIENT_ID: "12345",
      ALLOW_LIVE_DATABASE_TASKS: false
    });
  });

  test("rejects unsafe live auth and database defaults", () => {
    expect(() => loadConfig({ ...liveConfig, AUTH_MODE: "disabled" })).toThrow("AUTH_MODE");
    expect(() => loadConfig({ ...liveConfig, FIXTURE_AUTH_TOKENS: "user-001:dev-token-user-001,user-002:dev-token-user-002,user-003:dev-token-user-003" })).toThrow("FIXTURE_AUTH_TOKENS");
    expect(() => loadConfig({ ...liveConfig, DATABASE_URL: "postgres://peloton:peloton@127.0.0.1:5432/peloton" })).toThrow("DATABASE_URL");
  });

  test("rejects default live callback URLs and encryption key", () => {
    expect(() => loadConfig({ ...liveConfig, STRAVA_CALLBACK_URL: "http://127.0.0.1:8080/v1/auth/strava/callback" })).toThrow("STRAVA_CALLBACK_URL");
    expect(() => loadConfig({ ...liveConfig, STRAVA_WEBHOOK_CALLBACK_URL: "http://localhost:8080/v1/webhooks/strava" })).toThrow("STRAVA_WEBHOOK_CALLBACK_URL");
    expect(() => loadConfig({ ...liveConfig, STRAVA_TOKEN_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000" })).toThrow("STRAVA_TOKEN_ENCRYPTION_KEY");
  });

  test("blocks production migrations and non-local seed tasks by default", () => {
    const productionConfig = loadConfig(liveConfig);
    const stagingConfig = loadConfig({
      ...liveConfig,
      NODE_ENV: "staging",
    });

    expect(() => assertSafeDatabaseTask(productionConfig, "migration")).toThrow("production");
    expect(() => assertSafeDatabaseTask(stagingConfig, "seed")).toThrow("staging");
  });

  test("allows explicit live database task override", () => {
    const config = loadConfig({
      ...liveConfig,
      ALLOW_LIVE_DATABASE_TASKS: "true"
    });

    expect(() => assertSafeDatabaseTask(config, "migration")).not.toThrow();
    expect(() => assertSafeDatabaseTask(config, "seed")).not.toThrow();
  });

  test("parses false live database task override literally", () => {
    const config = loadConfig({ NODE_ENV: "development", ALLOW_LIVE_DATABASE_TASKS: "false" });

    expect(config.ALLOW_LIVE_DATABASE_TASKS).toBe(false);
  });
});
