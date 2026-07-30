import type { StravaActivitySummary, StravaGateway } from "./StravaGateway.js";

export class MockStravaGateway implements StravaGateway {
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

