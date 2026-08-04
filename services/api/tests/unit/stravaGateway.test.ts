import { afterEach, describe, expect, test, vi } from "vitest";
import { HttpStravaGateway } from "../../src/infrastructure/strava/StravaGateway.js";

describe("HttpStravaGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists recent activities from Strava API v3 with bearer authorization", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 123456,
          sport_type: "Ride",
          start_date: "2026-08-04T06:00:00Z",
          distance: 12000.5,
          elapsed_time: 3600,
          moving_time: 3450,
          total_elevation_gain: 210.2,
          map: { summary_polyline: "encoded-polyline" }
        }
      ]
    });
    vi.stubGlobal("fetch", fetch);

    const gateway = new HttpStravaGateway();
    const activities = await gateway.listRecentActivities({ accessToken: "test-access" });

    expect(fetch).toHaveBeenCalledWith(new URL("https://api-v3.strava.com/athlete/activities?per_page=30"), {
      headers: { authorization: "Bearer test-access" }
    });
    expect(activities).toEqual([
      {
        providerActivityId: "123456",
        sportType: "Ride",
        startedAt: "2026-08-04T06:00:00Z",
        distanceMeters: 12000.5,
        elapsedTimeSeconds: 3600,
        movingTimeSeconds: 3450,
        elevationGainMeters: 210.2,
        polyline: "encoded-polyline"
      }
    ]);
  });

  test("uses configured API base URL for activity and stream requests", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 987654,
          sport_type: "Ride",
          start_date: "2026-08-04T07:00:00Z",
          distance: 18000,
          elapsed_time: 4200,
          moving_time: 4100,
          total_elevation_gain: 320,
          map: { summary_polyline: "detail-polyline" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          time: { data: [0, 60] },
          distance: { data: [0, 250] },
          latlng: { data: [[41.38, 2.17], [41.39, 2.18]] }
        })
      });
    vi.stubGlobal("fetch", fetch);

    const gateway = new HttpStravaGateway({ apiBaseUrl: "https://strava-api.example.com/api/v3" });
    await gateway.getActivity({ accessToken: "test-access", providerActivityId: "987654" });
    await gateway.getActivityStreams({ accessToken: "test-access", providerActivityId: "987654" });

    expect(fetch).toHaveBeenNthCalledWith(1, new URL("https://strava-api.example.com/api/v3/activities/987654"), {
      headers: { authorization: "Bearer test-access" }
    });
    expect(fetch).toHaveBeenNthCalledWith(2, new URL("https://strava-api.example.com/api/v3/activities/987654/streams?keys=time%2Cdistance%2Clatlng%2Caltitude%2Cvelocity_smooth&key_by_type=true"), {
      headers: { authorization: "Bearer test-access" }
    });
  });

  test("uses configured API base URL for webhook subscription requests", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 123,
            application_id: 456,
            callback_url: "https://api.example.com/v1/webhooks/strava",
            created_at: "2026-08-04T08:00:00Z",
            updated_at: "2026-08-04T08:00:00Z"
          }
        ]
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetch);

    const gateway = new HttpStravaGateway({ apiBaseUrl: "https://strava-api.example.com/api/v3/" });
    await gateway.createWebhookSubscription({
      clientId: "12345",
      clientSecret: "secret",
      callbackUrl: "https://api.example.com/v1/webhooks/strava",
      verifyToken: "verify"
    });
    await gateway.listWebhookSubscriptions({ clientId: "12345", clientSecret: "secret" });
    await gateway.deleteWebhookSubscription({ clientId: "12345", clientSecret: "secret", subscriptionId: 123 });

    expect(fetch).toHaveBeenNthCalledWith(1, new URL("https://strava-api.example.com/api/v3/push_subscriptions"), expect.objectContaining({
      method: "POST"
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, new URL("https://strava-api.example.com/api/v3/push_subscriptions?client_id=12345&client_secret=secret"));
    expect(fetch).toHaveBeenNthCalledWith(3, new URL("https://strava-api.example.com/api/v3/push_subscriptions/123?client_id=12345&client_secret=secret"), {
      method: "DELETE"
    });
  });
});
