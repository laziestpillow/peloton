import { describe, expect, test } from "vitest";
import { distanceMetersBetween, matchActivityToStages } from "../../src/domain/routeMatching.js";
import type { ActivityStreamSample, ImportedActivity, Stage } from "../../src/domain/models.js";

const activity: ImportedActivity = {
  id: "activity-001",
  riderId: "rider-001",
  provider: "strava",
  providerActivityId: "strava-001",
  activityType: "ride",
  startedAt: "2026-07-18T07:30:00.000Z",
  distanceMeters: 1000,
  elapsedTimeSeconds: 300,
  movingTimeSeconds: 280,
  elevationGainMeters: 10,
  routeSummary: {
    polyline: "",
    previewBounds: {
      southWest: { latitude: 0, longitude: 0 },
      northEast: { latitude: 0, longitude: 0 }
    }
  },
  importStatus: "eligible",
  processedStageId: null
};

const stage: Stage = {
  id: "stage-001",
  seasonId: "season-001",
  name: "Stage",
  route: {
    distanceMeters: 1000,
    elevation: []
  },
  orderedMarkers: [
    {
      id: "marker-001",
      type: "sprint",
      positionMeters: 500,
      latitude: 41.39,
      longitude: 2.16,
      geofenceRadiusMeters: 30,
      category: null,
      pointsSchedule: [20, 17]
    }
  ],
  scheduledAt: "2026-07-18T07:30:00.000Z",
  status: "scheduled"
};

describe("route matching", () => {
  test("matches by stage time, route distance, and marker geofence", () => {
    const samples: readonly ActivityStreamSample[] = [
      { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: null, velocityMetersPerSecond: null },
      { sequence: 1, timeSeconds: 50, distanceMeters: 500, latitude: 41.39, longitude: 2.16, altitudeMeters: null, velocityMetersPerSecond: null },
      { sequence: 2, timeSeconds: 100, distanceMeters: 1000, latitude: 41.4, longitude: 2.17, altitudeMeters: null, velocityMetersPerSecond: null }
    ];

    expect(matchActivityToStages(activity, samples, [stage])).toEqual({
      stage,
      finishTimeSeconds: 100,
      markerCrossings: [{ markerId: "marker-001", riderId: "rider-001", crossedAtSeconds: 50 }]
    });
  });

  test("rejects stage candidates when marker crossing misses the geofence", () => {
    const samples: readonly ActivityStreamSample[] = [
      { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.38, longitude: 2.15, altitudeMeters: null, velocityMetersPerSecond: null },
      { sequence: 1, timeSeconds: 50, distanceMeters: 500, latitude: 42, longitude: 3, altitudeMeters: null, velocityMetersPerSecond: null },
      { sequence: 2, timeSeconds: 100, distanceMeters: 1000, latitude: 42.1, longitude: 3.1, altitudeMeters: null, velocityMetersPerSecond: null }
    ];

    expect(matchActivityToStages(activity, samples, [stage])).toBeNull();
  });

  test("calculates geofence distance in meters", () => {
    expect(distanceMetersBetween({ latitude: 41.39, longitude: 2.16 }, { latitude: 41.3901, longitude: 2.1601 })).toBeLessThan(15);
  });
});
