import { describe, expect, test } from "vitest";
import { materializeSeasonStandings, materializeStageResults } from "../../src/domain/resultMaterialization.js";
import type { Stage, StageMarkerCrossing, StageScore } from "../../src/domain/models.js";

const stage: Stage = {
  id: "stage-001",
  seasonId: "season-001",
  name: "Stage",
  route: { distanceMeters: 1000, elevation: [] },
  orderedMarkers: [
    {
      id: "sprint-001",
      type: "sprint",
      positionMeters: 300,
      latitude: 41.39,
      longitude: 2.16,
      geofenceRadiusMeters: 30,
      pointsSchedule: [20, 17],
      category: null
    },
    {
      id: "climb-001",
      type: "climb",
      positionMeters: 700,
      latitude: 41.4,
      longitude: 2.17,
      geofenceRadiusMeters: 30,
      pointsSchedule: [10, 8],
      category: 3
    }
  ],
  scheduledAt: "2026-07-18T07:30:00.000Z",
  status: "completed"
};

describe("result materialization", () => {
  test("materializes stage marker results, classifications, and jersey leaders", () => {
    const crossings: readonly StageMarkerCrossing[] = [
      { stageId: stage.id, markerId: "sprint-001", activityId: "activity-a", riderId: "rider-a", crossedAtSeconds: 100, rank: 1, points: 20 },
      { stageId: stage.id, markerId: "sprint-001", activityId: "activity-b", riderId: "rider-b", crossedAtSeconds: 110, rank: 2, points: 17 },
      { stageId: stage.id, markerId: "climb-001", activityId: "activity-b", riderId: "rider-b", crossedAtSeconds: 210, rank: 1, points: 10 },
      { stageId: stage.id, markerId: "climb-001", activityId: "activity-a", riderId: "rider-a", crossedAtSeconds: 220, rank: 2, points: 8 }
    ];

    expect(materializeStageResults(stage, [
      { riderId: "rider-a", finishTimeSeconds: 300 },
      { riderId: "rider-b", finishTimeSeconds: 310 }
    ], crossings)).toEqual({
      stageId: stage.id,
      markerResults: [
        {
          markerId: "sprint-001",
          type: "sprint",
          crossings: [
            { riderId: "rider-a", crossedAtSeconds: 100, rank: 1, points: 20 },
            { riderId: "rider-b", crossedAtSeconds: 110, rank: 2, points: 17 }
          ]
        },
        {
          markerId: "climb-001",
          type: "climb",
          crossings: [
            { riderId: "rider-b", crossedAtSeconds: 210, rank: 1, points: 10 },
            { riderId: "rider-a", crossedAtSeconds: 220, rank: 2, points: 8 }
          ]
        }
      ],
      classifications: [
        { stageId: stage.id, riderId: "rider-a", sprintPoints: 20, komPoints: 8, finishBonus: 5, todayTotal: 33, gcTimeSeconds: 300 },
        { stageId: stage.id, riderId: "rider-b", sprintPoints: 17, komPoints: 10, finishBonus: 3, todayTotal: 30, gcTimeSeconds: 310 }
      ],
      jerseyLeaders: { green: "rider-a", polkaDot: "rider-b", yellow: "rider-a" }
    });
  });

  test("materializes season standings with previous ranks", () => {
    const scores: readonly StageScore[] = [
      { stageId: "stage-001", riderId: "rider-a", sprintPoints: 20, komPoints: 8, finishBonus: 5, todayTotal: 33, gcTimeSeconds: 300 },
      { stageId: "stage-002", riderId: "rider-a", sprintPoints: 5, komPoints: 0, finishBonus: 3, todayTotal: 8, gcTimeSeconds: 290 },
      { stageId: "stage-001", riderId: "rider-b", sprintPoints: 17, komPoints: 10, finishBonus: 3, todayTotal: 30, gcTimeSeconds: 310 }
    ];

    expect(materializeSeasonStandings("season-001", scores, [
      { riderId: "rider-a", rank: 2 },
      { riderId: "rider-b", rank: 1 }
    ])).toEqual({
      seasonId: "season-001",
      standings: [
        { seasonId: "season-001", riderId: "rider-a", seasonTotal: 41, rank: 1, previousRank: 2 },
        { seasonId: "season-001", riderId: "rider-b", seasonTotal: 30, rank: 2, previousRank: 1 }
      ]
    });
  });
});
