import type {
  StravaActivityStreamPoint,
  StravaActivitySummary,
  StravaGateway,
  StravaTokenSet,
  StravaWebhookEvent,
  StravaWebhookSubscription
} from "./StravaGateway.js";

export class MockStravaGateway implements StravaGateway {
  constructor(private readonly webhookVerifyToken = "fixture-strava-webhook-token") {}

  async exchangeAuthorizationCode(code: string): Promise<StravaTokenSet> {
    return {
      athleteId: "fixture-athlete-001",
      accessToken: `fixture-access-${code}`,
      refreshToken: `fixture-refresh-${code}`,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      acceptedScopes: ["read", "activity:read_all"]
    };
  }

  async listRecentActivities(riderId: string): Promise<readonly StravaActivitySummary[]> {
    return [
      {
        providerActivityId: `mock-${riderId}-001`,
        startedAt: "2026-07-18T07:30:00Z",
        distanceMeters: 42195,
        elapsedTimeSeconds: 6120,
        elevationGainMeters: 680
      }
    ];
  }

  async refreshAccessToken(refreshToken: string): Promise<StravaTokenSet> {
    return {
      athleteId: "fixture-athlete-001",
      accessToken: `fixture-access-refreshed-${refreshToken}`,
      refreshToken,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      acceptedScopes: ["read", "activity:read_all"]
    };
  }

  async getActivityStreams(_providerActivityId: string): Promise<readonly StravaActivityStreamPoint[]> {
    return [
      {
        distanceMeters: 0,
        elapsedTimeSeconds: 0,
        altitudeMeters: 35,
        latitude: 41.3851,
        longitude: 2.1734,
        velocityMetersPerSecond: 0,
        heartrate: null,
        watts: null
      },
      {
        distanceMeters: 42195,
        elapsedTimeSeconds: 6120,
        altitudeMeters: 88,
        latitude: 41.4022,
        longitude: 2.1911,
        velocityMetersPerSecond: 8.1,
        heartrate: null,
        watts: null
      }
    ];
  }

  async disconnect(_accessToken: string): Promise<void> {}

  async createWebhookSubscription(callbackUrl: string, _verifyToken: string): Promise<StravaWebhookSubscription> {
    return {
      id: "fixture-webhook-subscription",
      applicationId: "fixture-client-id",
      callbackUrl,
      createdAt: new Date("2026-07-01T00:00:00Z")
    };
  }

  async deleteWebhookSubscription(_subscriptionId: string): Promise<void> {}

  verifyWebhookChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null {
    if (mode !== "subscribe" || token !== this.webhookVerifyToken || !challenge) {
      return null;
    }

    return challenge;
  }

  parseWebhookEvent(payload: unknown): StravaWebhookEvent {
    if (typeof payload !== "object" || payload === null) {
      throw new Error("Strava webhook payload must be an object.");
    }

    const source = payload as Record<string, unknown>;
    return {
      objectType: source.object_type === "athlete" ? "athlete" : "activity",
      objectId: String(source.object_id),
      aspectType: source.aspect_type === "delete" ? "delete" : source.aspect_type === "update" ? "update" : "create",
      ownerId: String(source.owner_id),
      subscriptionId: String(source.subscription_id),
      eventTime: new Date(Number(source.event_time) * 1000),
      updates: typeof source.updates === "object" && source.updates !== null
        ? Object.fromEntries(Object.entries(source.updates).map(([key, value]) => [key, String(value)]))
        : {}
    };
  }
}
