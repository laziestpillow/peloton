export interface StravaActivitySummary {
  providerActivityId: string;
  sportType?: string;
  startedAt: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  polyline?: string;
}

export interface StravaTokenExchange {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  acceptedScopes: readonly string[];
}

export interface StravaTokenRefresh {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface StravaGateway {
  exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    acceptedScope?: string;
  }): Promise<StravaTokenExchange>;
  listRecentActivities(input: { accessToken: string }): Promise<readonly StravaActivitySummary[]>;
  refreshAccessToken(input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<StravaTokenRefresh>;
  revokeToken(input: {
    clientId: string;
    clientSecret: string;
    token: string;
    tokenTypeHint: "access_token" | "refresh_token";
  }): Promise<void>;
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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

  async listRecentActivities(input: { accessToken: string }): Promise<readonly StravaActivitySummary[]> {
    const response = await fetch("https://api-v3.strava.com/athlete/activities?per_page=30", {
      headers: { authorization: `Bearer ${input.accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Strava activity listing failed with status ${response.status}.`);
    }

    const payload = await response.json() as Array<{
      id?: unknown;
      sport_type?: unknown;
      type?: unknown;
      start_date?: unknown;
      distance?: unknown;
      elapsed_time?: unknown;
      moving_time?: unknown;
      total_elevation_gain?: unknown;
      map?: { summary_polyline?: unknown };
    }>;

    return payload.map((activity) => {
      const sportType = optionalString(activity.sport_type) ?? optionalString(activity.type);
      const polyline = optionalString(activity.map?.summary_polyline);
      return {
        providerActivityId: String(requireNumber(activity.id, "id")),
        ...(sportType ? { sportType } : {}),
        startedAt: requireString(activity.start_date, "start_date"),
        distanceMeters: requireNumber(activity.distance, "distance"),
        elapsedTimeSeconds: requireNumber(activity.elapsed_time, "elapsed_time"),
        movingTimeSeconds: requireNumber(activity.moving_time, "moving_time"),
        elevationGainMeters: requireNumber(activity.total_elevation_gain, "total_elevation_gain"),
        ...(polyline ? { polyline } : {})
      };
    });
  }

  async refreshAccessToken(input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): Promise<StravaTokenRefresh> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken
    });

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });

    if (!response.ok) {
      throw new Error(`Strava token refresh failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_at?: unknown;
    };
    return {
      accessToken: requireString(payload.access_token, "access_token"),
      refreshToken: requireString(payload.refresh_token, "refresh_token"),
      expiresAt: new Date(requireNumber(payload.expires_at, "expires_at") * 1000)
    };
  }

  async revokeToken(input: {
    clientId: string;
    clientSecret: string;
    token: string;
    tokenTypeHint: "access_token" | "refresh_token";
  }): Promise<void> {
    const credentials = Buffer.from(`${input.clientId}:${input.clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
      token: input.token,
      token_type_hint: input.tokenTypeHint
    });

    const response = await fetch("https://www.strava.com/oauth/revoke", {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Strava token revoke failed with status ${response.status}.`);
    }
  }
}
