import type { Marker, MarkerCrossing, RankedCrossing, StageScore } from "./models.js";

export interface FinishResult {
  riderId: string;
  finishTimeSeconds: number;
}

export function rankMarkerCrossings(marker: Marker, crossings: readonly MarkerCrossing[]): readonly RankedCrossing[] {
  return crossings
    .filter((crossing) => crossing.markerId === marker.id)
    .toSorted((left, right) => {
      const timeDifference = left.crossedAtSeconds - right.crossedAtSeconds;
      return timeDifference === 0 ? left.riderId.localeCompare(right.riderId) : timeDifference;
    })
    .map((crossing, index) => ({
      ...crossing,
      rank: index + 1,
      points: marker.pointsSchedule[index] ?? 0
    }));
}

export function calculateStageScores(
  stageId: string,
  markers: readonly Marker[],
  crossings: readonly MarkerCrossing[],
  finishes: readonly FinishResult[],
  finishBonusSchedule: readonly number[]
): readonly StageScore[] {
  const scores = new Map<string, Omit<StageScore, "todayTotal">>();

  for (const finish of finishes) {
    scores.set(finish.riderId, {
      stageId,
      riderId: finish.riderId,
      sprintPoints: 0,
      komPoints: 0,
      finishBonus: 0,
      gcTimeSeconds: finish.finishTimeSeconds
    });
  }

  for (const marker of markers) {
    for (const crossing of rankMarkerCrossings(marker, crossings)) {
      const current = scores.get(crossing.riderId);
      if (!current) {
        continue;
      }
      if (marker.type === "sprint") {
        current.sprintPoints += crossing.points;
      } else {
        current.komPoints += crossing.points;
      }
    }
  }

  const rankedFinishes = finishes.toSorted((left, right) => {
    const timeDifference = left.finishTimeSeconds - right.finishTimeSeconds;
    return timeDifference === 0 ? left.riderId.localeCompare(right.riderId) : timeDifference;
  });

  rankedFinishes.forEach((finish, index) => {
    const current = scores.get(finish.riderId);
    if (current) {
      current.finishBonus = finishBonusSchedule[index] ?? 0;
    }
  });

  return [...scores.values()]
    .map((score) => ({
      ...score,
      todayTotal: score.sprintPoints + score.komPoints + score.finishBonus
    }))
    .toSorted((left, right) => {
      const pointsDifference = right.todayTotal - left.todayTotal;
      return pointsDifference === 0 ? left.gcTimeSeconds - right.gcTimeSeconds : pointsDifference;
    });
}

export function aggregateSeasonTotals(stageScores: readonly StageScore[]): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const score of stageScores) {
    totals.set(score.riderId, (totals.get(score.riderId) ?? 0) + score.todayTotal);
  }
  return totals;
}

