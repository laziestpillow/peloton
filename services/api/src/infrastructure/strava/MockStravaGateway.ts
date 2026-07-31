import type { StravaActivitySummary, StravaGateway, StravaTokenExchange } from "./StravaGateway.js";

export class MockStravaGateway implements StravaGateway {
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

  async refreshAccessToken(_userId: string): Promise<{ expiresAt: Date }> {
    return { expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) };
  }
}
