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

    expect(fetch).toHaveBeenCalledWith("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
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
});
