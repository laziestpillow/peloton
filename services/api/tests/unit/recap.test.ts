import { describe, expect, test } from "vitest";
import { materializeStageRecap } from "../../src/domain/recap.js";
import type { ActivityStreamSample, RiderProfile, Stage, StageActivityResult, StageMarkerCrossing } from "../../src/domain/models.js";

const rider: RiderProfile = {
  id: "rider-001",
  userId: "user-001",
  displayName: "Marta",
  appearance: {
    jerseyColor: "#2563eb",
    accentColor: "#facc15",
    helmetColor: "#ffffff",
    bikeColor: "#111827",
    pattern: "stripes"
  },
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z"
};

const stage: Stage = {
  id: "stage-001",
  seasonId: "season-001",
  name: "Barcelona Hills",
  route: {
    distanceMeters: 1000,
    elevation: []
  },
  orderedMarkers: [
    {
      id: "marker-sprint-001",
      type: "sprint",
      positionMeters: 500,
      latitude: 41.4,
      longitude: 2.1,
      geofenceRadiusMeters: 25,
      pointsSchedule: [20, 17, 15]
    }
  ],
  scheduledAt: "2026-07-18T07:00:00.000Z",
  status: "completed"
};

const activityResult: StageActivityResult = {
  stageId: stage.id,
  activityId: "activity-001",
  riderId: rider.id,
  finishTimeSeconds: 120,
  matchedAt: "2026-07-18T09:00:00.000Z"
};

const samples: readonly ActivityStreamSample[] = [
  { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: null, longitude: null, altitudeMeters: null, velocityMetersPerSecond: 0 },
  { sequence: 1, timeSeconds: 60, distanceMeters: 520, latitude: null, longitude: null, altitudeMeters: null, velocityMetersPerSecond: 8.6 },
  { sequence: 2, timeSeconds: 120, distanceMeters: 1015, latitude: null, longitude: null, altitudeMeters: null, velocityMetersPerSecond: 7.9 }
];

const crossing: StageMarkerCrossing = {
  stageId: stage.id,
  markerId: "marker-sprint-001",
  activityId: "activity-001",
  riderId: rider.id,
  crossedAtSeconds: 60,
  rank: 1,
  points: 20
};

describe("recap materialization", () => {
  test("builds recap frames from activity samples and marker crossings", () => {
    const recap = materializeStageRecap({
      stage,
      riders: [rider],
      activityResults: [activityResult],
      samplesByActivityId: new Map([["activity-001", samples]]),
      markerCrossings: [crossing]
    });

    expect(recap).toMatchObject({
      stageId: "stage-001",
      durationSeconds: 120,
      riders: [rider],
      markers: stage.orderedMarkers
    });
    expect(recap.timeline).toEqual([
      { timeSeconds: 0, positions: [{ riderId: "rider-001", positionMeters: 0, speedMetersPerSecond: 0, markerEventId: null }] },
      { timeSeconds: 60, positions: [{ riderId: "rider-001", positionMeters: 520, speedMetersPerSecond: 8.6, markerEventId: "marker-sprint-001" }] },
      { timeSeconds: 120, positions: [{ riderId: "rider-001", positionMeters: 1000, speedMetersPerSecond: 7.9, markerEventId: null }] }
    ]);
  });

  test("returns an empty timeline when no riders have stage results", () => {
    expect(materializeStageRecap({
      stage,
      riders: [],
      activityResults: [],
      samplesByActivityId: new Map(),
      markerCrossings: []
    })).toEqual({
      stageId: "stage-001",
      durationSeconds: 0,
      riders: [],
      markers: stage.orderedMarkers,
      timeline: []
    });
  });
});
