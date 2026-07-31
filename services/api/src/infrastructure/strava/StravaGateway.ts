export interface StravaActivitySummary {
  providerActivityId: string;
  startedAt: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
}

export interface StravaTokenExchange {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  acceptedScopes: readonly string[];
}

export interface StravaGateway {
  exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    acceptedScope?: string;
  }): Promise<StravaTokenExchange>;
  listRecentActivities(riderId: string): Promise<readonly StravaActivitySummary[]>;
  refreshAccessToken(userId: string): Promise<{ expiresAt: Date }>;
}

function normalizeScopes(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }
  return value.split(/[,\s]+/u).map((scope) => scope.trim()).filter(Boolean);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Strava token response missing ${field}.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Strava token response missing ${field}.`);
  }
  return value;
}

export class HttpStravaGateway implements StravaGateway {
  async exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    acceptedScope?: string;
  }): Promise<StravaTokenExchange> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: "authorization_code"
    });

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new Error(`Strava token exchange failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_at?: unknown;
      scope?: unknown;
      athlete?: { id?: unknown };
    };
    const athleteId = String(requireNumber(payload.athlete?.id, "athlete.id"));
    return {
      athleteId,
      accessToken: requireString(payload.access_token, "access_token"),
      refreshToken: requireString(payload.refresh_token, "refresh_token"),
      expiresAt: new Date(requireNumber(payload.expires_at, "expires_at") * 1000),
      acceptedScopes: normalizeScopes(typeof payload.scope === "string" ? payload.scope : input.acceptedScope)
    };
  }

  async listRecentActivities(_riderId: string): Promise<readonly StravaActivitySummary[]> {
    throw new Error("Strava activity listing is not implemented yet.");
  }

  async refreshAccessToken(_userId: string): Promise<{ expiresAt: Date }> {
    throw new Error("Strava token refresh is not implemented yet.");
  }
}
