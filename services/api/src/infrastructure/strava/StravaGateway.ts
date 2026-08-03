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

export interface StravaActivityStreams {
  time: readonly number[];
  distance: readonly number[];
  latlng?: readonly (readonly [number, number])[];
  altitude?: readonly number[];
  velocitySmooth?: readonly number[];
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

export interface StravaWebhookSubscription {
  id: number;
  applicationId: number;
  callbackUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StravaGateway {
  exchangeAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    code: string;
    acceptedScope?: string;
  }): Promise<StravaTokenExchange>;
  listRecentActivities(input: { accessToken: string }): Promise<readonly StravaActivitySummary[]>;
  getActivity(input: { accessToken: string; providerActivityId: string }): Promise<StravaActivitySummary | null>;
  getActivityStreams(input: { accessToken: string; providerActivityId: string }): Promise<StravaActivityStreams>;
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
  createWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    verifyToken: string;
  }): Promise<{ id: number }>;
  listWebhookSubscriptions(input: {
    clientId: string;
    clientSecret: string;
  }): Promise<readonly StravaWebhookSubscription[]>;
  deleteWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    subscriptionId: number;
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

function optionalDate(value: unknown): Date {
  return typeof value === "string" ? new Date(value) : new Date(0);
}

function numberArray(value: unknown): readonly number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

function latLngArray(value: unknown): readonly (readonly [number, number])[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const points = value.filter((point): point is readonly [number, number] =>
    Array.isArray(point) &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
  return points.length > 0 ? points : undefined;
}

function streamData(payload: unknown, key: string): unknown {
  if (Array.isArray(payload)) {
    return payload.find((stream) => typeof stream === "object" && stream !== null && (stream as { type?: unknown }).type === key)?.data;
  }
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  return (payload as Record<string, { data?: unknown } | undefined>)[key]?.data;
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

  async getActivity(input: { accessToken: string; providerActivityId: string }): Promise<StravaActivitySummary | null> {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${encodeURIComponent(input.providerActivityId)}`, {
      headers: { authorization: `Bearer ${input.accessToken}` }
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Strava activity fetch failed with status ${response.status}.`);
    }

    const activity = await response.json() as {
      id?: unknown;
      sport_type?: unknown;
      type?: unknown;
      start_date?: unknown;
      distance?: unknown;
      elapsed_time?: unknown;
      moving_time?: unknown;
      total_elevation_gain?: unknown;
      map?: { summary_polyline?: unknown };
    };
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
  }

  async getActivityStreams(input: { accessToken: string; providerActivityId: string }): Promise<StravaActivityStreams> {
    const keys = ["time", "distance", "latlng", "altitude", "velocity_smooth"].join(",");
    const url = `https://www.strava.com/api/v3/activities/${encodeURIComponent(input.providerActivityId)}/streams?keys=${keys}&key_by_type=true`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${input.accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Strava activity streams fetch failed with status ${response.status}.`);
    }

    const payload = await response.json() as unknown;
    const time = numberArray(streamData(payload, "time"));
    const distance = numberArray(streamData(payload, "distance"));
    const latlng = latLngArray(streamData(payload, "latlng"));
    if (time.length === 0 || distance.length === 0) {
      throw new Error("Strava activity streams missing time or distance data.");
    }

    return {
      time,
      distance,
      ...(latlng ? { latlng } : {}),
      altitude: numberArray(streamData(payload, "altitude")),
      velocitySmooth: numberArray(streamData(payload, "velocity_smooth"))
    };
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

  async createWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    verifyToken: string;
  }): Promise<{ id: number }> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      callback_url: input.callbackUrl,
      verify_token: input.verifyToken
    });
    const response = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) {
      throw new Error(`Strava webhook subscription creation failed with status ${response.status}.`);
    }
    const payload = await response.json() as { id?: unknown };
    return { id: requireNumber(payload.id, "id") };
  }

  async listWebhookSubscriptions(input: {
    clientId: string;
    clientSecret: string;
  }): Promise<readonly StravaWebhookSubscription[]> {
    const url = new URL("https://www.strava.com/api/v3/push_subscriptions");
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("client_secret", input.clientSecret);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Strava webhook subscription listing failed with status ${response.status}.`);
    }
    const payload = await response.json() as Array<{
      id?: unknown;
      application_id?: unknown;
      callback_url?: unknown;
      created_at?: unknown;
      updated_at?: unknown;
    }>;
    return payload.map((subscription) => ({
      id: requireNumber(subscription.id, "id"),
      applicationId: requireNumber(subscription.application_id, "application_id"),
      callbackUrl: requireString(subscription.callback_url, "callback_url"),
      createdAt: optionalDate(subscription.created_at),
      updatedAt: optionalDate(subscription.updated_at)
    }));
  }

  async deleteWebhookSubscription(input: {
    clientId: string;
    clientSecret: string;
    subscriptionId: number;
  }): Promise<void> {
    const url = new URL(`https://www.strava.com/api/v3/push_subscriptions/${input.subscriptionId}`);
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("client_secret", input.clientSecret);
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Strava webhook subscription delete failed with status ${response.status}.`);
    }
  }
}
