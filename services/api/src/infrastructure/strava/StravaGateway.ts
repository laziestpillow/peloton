export interface StravaActivitySummary {
  providerActivityId: string;
  startedAt: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
}

export interface StravaGateway {
  listRecentActivities(riderId: string): Promise<readonly StravaActivitySummary[]>;
  refreshAccessToken(userId: string): Promise<{ expiresAt: Date }>;
}

