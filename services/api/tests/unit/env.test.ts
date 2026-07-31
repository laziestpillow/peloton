import { describe, expect, test } from "vitest";
import { loadConfig } from "../../src/config/env.js";

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
});
