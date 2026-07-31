import { describe, expect, test } from "vitest";
import { FixtureSessionVerifier, fixtureSessionToken, readBearerToken } from "../../src/application/auth/session.js";
import {
  InMemoryOAuthStateStore,
  createOAuthState,
  validateOAuthState
} from "../../src/application/auth/oauthState.js";
import { AesGcmTokenEncryptor, FixtureTokenEncryptor } from "../../src/application/strava/tokenEncryption.js";
import { redactBearerAuthorization, redactToken } from "../../src/config/redaction.js";

describe("session auth foundation", () => {
  test("reads strict bearer tokens", () => {
    expect(readBearerToken(`Bearer ${fixtureSessionToken}`)).toBe(fixtureSessionToken);
    expect(readBearerToken(`bearer ${fixtureSessionToken}`)).toBe(fixtureSessionToken);
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken("Bearer token extra")).toBeNull();
  });

  test("fixture verifier loads the API-shaped rider fixture identity", async () => {
    const principal = await new FixtureSessionVerifier().verify(fixtureSessionToken);

    expect(principal).toMatchObject({
      userId: "user-001",
      riderId: "rider-001",
      mode: "fixture"
    });
  });
});

describe("oauth state foundation", () => {
  test("validates unconsumed, unexpired state for expected user", async () => {
    const store = new InMemoryOAuthStateStore();
    const state = createOAuthState();
    const expiresAt = new Date("2026-07-31T12:05:00Z");
    await store.save({
      state,
      userId: "user-001",
      redirectUrl: "peloton://strava/callback",
      expiresAt,
      consumedAt: null
    });

    await expect(validateOAuthState(store, state, "user-001", new Date("2026-07-31T12:00:00Z"))).resolves.toMatchObject({
      ok: true,
      record: { state, expiresAt }
    });
  });

  test("rejects expired or already consumed state", async () => {
    const store = new InMemoryOAuthStateStore();
    await store.save({
      state: "expired-state",
      userId: "user-001",
      redirectUrl: "peloton://strava/callback",
      expiresAt: new Date("2026-07-31T11:59:59Z"),
      consumedAt: null
    });
    await store.save({
      state: "consumed-state",
      userId: "user-001",
      redirectUrl: "peloton://strava/callback",
      expiresAt: new Date("2026-07-31T12:05:00Z"),
      consumedAt: new Date("2026-07-31T12:00:00Z")
    });

    await expect(validateOAuthState(store, "expired-state", "user-001", new Date("2026-07-31T12:00:00Z"))).resolves.toEqual({
      ok: false,
      reason: "expired"
    });
    await expect(validateOAuthState(store, "consumed-state", "user-001", new Date("2026-07-31T12:00:00Z"))).resolves.toEqual({
      ok: false,
      reason: "alreadyConsumed"
    });
  });
});

describe("token encryption foundation", () => {
  test("round-trips live token ciphertext without exposing plaintext", async () => {
    const encryptor = new AesGcmTokenEncryptor("0123456789abcdef0123456789abcdef");
    const encrypted = await encryptor.encrypt("strava-access-token");

    expect(encrypted.ciphertext).not.toContain("strava-access-token");
    await expect(encryptor.decrypt(encrypted)).resolves.toBe("strava-access-token");
  });

  test("fixture encryptor is deterministic for fixture-only tests", async () => {
    const encryptor = new FixtureTokenEncryptor();
    const encrypted = await encryptor.encrypt("fixture-token");

    expect(encrypted.keyId).toBe("fixture");
    await expect(encryptor.decrypt(encrypted)).resolves.toBe("fixture-token");
  });
});

describe("token redaction", () => {
  test("redacts bearer and raw token values", () => {
    expect(redactBearerAuthorization("Bearer secret-token")).toBe("Bearer [REDACTED]");
    expect(redactToken("secret-token")).toBe("[REDACTED]");
  });
});
