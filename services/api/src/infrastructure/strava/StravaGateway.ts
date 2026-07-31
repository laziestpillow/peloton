export interface StravaActivitySummary {
  providerActivityId: string;
  startedAt: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
}

export interface StravaTokenSet {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  acceptedScopes: readonly string[];
}

export interface StravaActivityStreamPoint {
  distanceMeters: number;
  elapsedTimeSeconds: number;
  altitudeMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  velocityMetersPerSecond: number | null;
  heartrate: number | null;
  watts: number | null;
}

export interface StravaWebhookSubscription {
  id: string;
  applicationId: string;
  callbackUrl: string;
  createdAt: Date;
}

export interface StravaWebhookEvent {
  objectType: "activity" | "athlete";
  objectId: string;
  aspectType: "create" | "update" | "delete";
  ownerId: string;
  subscriptionId: string;
  eventTime: Date;
  updates: Readonly<Record<string, string>>;
}

export interface StravaGateway {
  exchangeAuthorizationCode(code: string): Promise<StravaTokenSet>;
  listRecentActivities(riderId: string): Promise<readonly StravaActivitySummary[]>;
  refreshAccessToken(refreshToken: string): Promise<StravaTokenSet>;
  getActivityStreams(providerActivityId: string): Promise<readonly StravaActivityStreamPoint[]>;
  disconnect(accessToken: string): Promise<void>;
  createWebhookSubscription(callbackUrl: string, verifyToken: string): Promise<StravaWebhookSubscription>;
  deleteWebhookSubscription(subscriptionId: string): Promise<void>;
  verifyWebhookChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null;
  parseWebhookEvent(payload: unknown): StravaWebhookEvent;
}
