import { describe, expect, test } from "vitest";
import { MockStravaGateway } from "../../src/infrastructure/strava/MockStravaGateway.js";

describe("MockStravaGateway", () => {
  test("supports oauth exchange and refresh without real Strava tokens", async () => {
    const gateway = new MockStravaGateway();

    await expect(gateway.exchangeAuthorizationCode("code-001")).resolves.toMatchObject({
      athleteId: "fixture-athlete-001",
      accessToken: "fixture-access-code-001",
      refreshToken: "fixture-refresh-code-001",
      acceptedScopes: ["read", "activity:read_all"]
    });

    await expect(gateway.refreshAccessToken("refresh-001")).resolves.toMatchObject({
      athleteId: "fixture-athlete-001",
      accessToken: "fixture-access-refreshed-refresh-001",
      refreshToken: "refresh-001"
    });
  });

  test("provides activities and streams for fixture imports", async () => {
    const gateway = new MockStravaGateway();

    await expect(gateway.listRecentActivities("rider-001")).resolves.toEqual([
      {
        providerActivityId: "mock-rider-001-001",
        startedAt: "2026-07-18T07:30:00Z",
        distanceMeters: 42195,
        elapsedTimeSeconds: 6120,
        elevationGainMeters: 680
      }
    ]);
    await expect(gateway.getActivityStreams("mock-rider-001-001")).resolves.toHaveLength(2);
  });

  test("validates webhook challenge and parses webhook events", () => {
    const gateway = new MockStravaGateway("verify-me");

    expect(gateway.verifyWebhookChallenge("subscribe", "verify-me", "challenge-value")).toBe("challenge-value");
    expect(gateway.verifyWebhookChallenge("subscribe", "wrong", "challenge-value")).toBeNull();
    expect(gateway.parseWebhookEvent({
      object_type: "activity",
      object_id: 123,
      aspect_type: "update",
      owner_id: 456,
      subscription_id: 789,
      event_time: 1785499200,
      updates: { title: "Evening Ride" }
    })).toMatchObject({
      objectType: "activity",
      objectId: "123",
      aspectType: "update",
      ownerId: "456",
      subscriptionId: "789",
      updates: { title: "Evening Ride" }
    });
  });
});
