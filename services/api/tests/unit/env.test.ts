import { describe, expect, test } from "vitest";
import { assertSafeDatabaseTask, loadConfig } from "../../src/config/env.js";

describe("environment config", () => {
  test("allows local fixture defaults", () => {
    expect(loadConfig({ NODE_ENV: "development" })).toMatchObject({
      NODE_ENV: "development",
      STRAVA_OAUTH_SCOPE: "read,activity:read_all"
    });
  });

  test("requires Strava secrets and encryption key in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      STRAVA_TOKEN_ENCRYPTION_KEY: "not-hex"
    })).toThrow();
  });

  test("accepts fully configured production environment", () => {
    expect(loadConfig({
      NODE_ENV: "production",
      STRAVA_CLIENT_ID: "12345",
      STRAVA_CLIENT_SECRET: "secret",
      STRAVA_WEBHOOK_VERIFY_TOKEN: "webhook-secret",
      STRAVA_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    })).toMatchObject({
      NODE_ENV: "production",
      STRAVA_CLIENT_ID: "12345",
      ALLOW_LIVE_DATABASE_TASKS: false
    });
  });

  test("blocks production migrations and non-local seed tasks by default", () => {
    const productionConfig = loadConfig({
      NODE_ENV: "production",
      STRAVA_CLIENT_ID: "12345",
      STRAVA_CLIENT_SECRET: "secret",
      STRAVA_WEBHOOK_VERIFY_TOKEN: "webhook-secret",
      STRAVA_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    });
    const stagingConfig = loadConfig({
      NODE_ENV: "staging",
      STRAVA_CLIENT_ID: "12345",
      STRAVA_CLIENT_SECRET: "secret",
      STRAVA_WEBHOOK_VERIFY_TOKEN: "webhook-secret",
      STRAVA_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(() => assertSafeDatabaseTask(productionConfig, "migration")).toThrow("production");
    expect(() => assertSafeDatabaseTask(stagingConfig, "seed")).toThrow("staging");
  });

  test("allows explicit live database task override", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      STRAVA_CLIENT_ID: "12345",
      STRAVA_CLIENT_SECRET: "secret",
      STRAVA_WEBHOOK_VERIFY_TOKEN: "webhook-secret",
      STRAVA_TOKEN_ENCRYPTION_KEY: "1111111111111111111111111111111111111111111111111111111111111111",
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
