import type { StravaActivityStreams, StravaActivitySummary, StravaGateway, StravaTokenExchange } from "./StravaGateway.js";

export class MockStravaGateway implements StravaGateway {
  private readonly subscriptions = new Map<number, {
    id: number;
    applicationId: number;
    callbackUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }>();

  constructor(
    private readonly activities?: readonly StravaActivitySummary[],
    private readonly streamsByActivityId: ReadonlyMap<string, StravaActivityStreams> = new Map()
  ) {}

  async exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    acceptedScope?: string;
  }): Promise<StravaTokenExchange> {
    return {
      athleteId: "100001",
      accessToken: `mock-access-${input.code}`,
      refreshToken: `mock-refresh-${input.code}`,
      expiresAt: new Date("2026-07-31T20:00:00.000Z"),
      acceptedScopes: input.acceptedScope?.split(/[,\s]+/u).filter(Boolean) ?? ["read", "activity:read_all"]
    };
  }

  async listRecentActivities(_input: { accessToken: string }): Promise<readonly StravaActivitySummary[]> {
    return this.activities ?? [
      {
        providerActivityId: "mock-strava-001",
        sportType: "Ride",
        startedAt: "2026-07-18T07:30:00Z",
        distanceMeters: 42195,
        elapsedTimeSeconds: 6120,
        movingTimeSeconds: 5890,
        elevationGainMeters: 680,
        polyline: "mock_polyline"
      }
    ];
  }

  async getActivityStreams(input: { accessToken: string; providerActivityId: string }): Promise<StravaActivityStreams> {
    return this.streamsByActivityId.get(input.providerActivityId) ?? {
      time: [0, 60, 120],
      distance: [0, 350, 725],
      latlng: [
        [41.39, 2.16],
        [41.391, 2.161],
        [41.392, 2.162]
      ],
      altitude: [35, 38, 41],
      velocitySmooth: [0, 5.8, 6.1]
    };
  }

  async refreshAccessToken(input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    return {
      accessToken: `mock-access-refreshed-${input.refreshToken}`,
      refreshToken: `mock-refresh-rotated-${input.refreshToken}`,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
    };
  }

  async revokeToken(_input: {
    clientId: string;
    clientSecret: string;
    token: string;
    tokenTypeHint: "access_token" | "refresh_token";
  }): Promise<void> {
    return;
  }

  async createWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    verifyToken: string;
  }): Promise<{ id: number }> {
    const id = this.subscriptions.size + 1;
    this.subscriptions.set(id, {
      id,
      applicationId: Number(input.clientId),
      callbackUrl: input.callbackUrl,
      createdAt: new Date("2026-07-31T10:00:00.000Z"),
      updatedAt: new Date("2026-07-31T10:00:00.000Z")
    });
    return { id };
  }

  async listWebhookSubscriptions(_input: {
    clientId: string;
    clientSecret: string;
  }): Promise<readonly {
    id: number;
    applicationId: number;
    callbackUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }[]> {
    return [...this.subscriptions.values()];
  }

  async deleteWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    subscriptionId: number;
  }): Promise<void> {
    this.subscriptions.delete(input.subscriptionId);
  }
}
