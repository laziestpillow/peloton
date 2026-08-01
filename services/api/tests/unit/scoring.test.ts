import { describe, expect, test } from "vitest";
import { aggregateSeasonTotals, calculateStageScores, rankMarkerCrossings } from "../../src/domain/scoring.js";
import type { Marker, MarkerCrossing } from "../../src/domain/models.js";

describe("scoring", () => {
  const sprint: Marker = {
    id: "sprint-1",
    type: "sprint",
    positionMeters: 1000,
    latitude: 41.39,
    longitude: 2.16,
    geofenceRadiusMeters: 25,
    pointsSchedule: [20, 17, 15]
  };
  const climb: Marker = {
    id: "climb-1",
    type: "climb",
    positionMeters: 2000,
    latitude: 41.42,
    longitude: 2.18,
    geofenceRadiusMeters: 25,
    pointsSchedule: [10, 8, 6],
    category: 3
  };

  test("ranks marker crossings by time and awards configured points", () => {
    const result = rankMarkerCrossings(sprint, [
      { markerId: "sprint-1", riderId: "rider-b", crossedAtSeconds: 120 },
      { markerId: "sprint-1", riderId: "rider-a", crossedAtSeconds: 118 }
    ]);

    expect(result).toEqual([
      { markerId: "sprint-1", riderId: "rider-a", crossedAtSeconds: 118, rank: 1, points: 20 },
      { markerId: "sprint-1", riderId: "rider-b", crossedAtSeconds: 120, rank: 2, points: 17 }
    ]);
  });

  test("uses rider id as deterministic tie break", () => {
    const result = rankMarkerCrossings(sprint, [
      { markerId: "sprint-1", riderId: "rider-b", crossedAtSeconds: 120 },
      { markerId: "sprint-1", riderId: "rider-a", crossedAtSeconds: 120 }
    ]);

    expect(result[0]?.riderId).toBe("rider-a");
  });

  test("calculates sprint, kom, finish bonus, and total points", () => {
    const crossings: readonly MarkerCrossing[] = [
      { markerId: "sprint-1", riderId: "rider-a", crossedAtSeconds: 100 },
      { markerId: "sprint-1", riderId: "rider-b", crossedAtSeconds: 101 },
      { markerId: "climb-1", riderId: "rider-b", crossedAtSeconds: 200 },
      { markerId: "climb-1", riderId: "rider-a", crossedAtSeconds: 205 }
    ];

    const scores = calculateStageScores("stage-1", [sprint, climb], crossings, [
      { riderId: "rider-a", finishTimeSeconds: 500 },
      { riderId: "rider-b", finishTimeSeconds: 510 }
    ], [5, 3]);

    expect(scores[0]).toMatchObject({ riderId: "rider-a", sprintPoints: 20, komPoints: 8, finishBonus: 5, todayTotal: 33 });
    expect(scores[1]).toMatchObject({ riderId: "rider-b", sprintPoints: 17, komPoints: 10, finishBonus: 3, todayTotal: 30 });
  });

  test("aggregates season totals from completed stages", () => {
    const totals = aggregateSeasonTotals([
      { stageId: "a", riderId: "rider-a", sprintPoints: 5, komPoints: 0, finishBonus: 0, todayTotal: 5, gcTimeSeconds: 100 },
      { stageId: "b", riderId: "rider-a", sprintPoints: 0, komPoints: 4, finishBonus: 1, todayTotal: 5, gcTimeSeconds: 100 }
    ]);

    expect(totals.get("rider-a")).toBe(10);
  });
});
