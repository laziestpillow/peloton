import type { Marker, MarkerCrossing, RankedCrossing, SeasonStanding, StageScore } from "./models.js";

export interface FinishResult {
  riderId: string;
  finishTimeSeconds: number;
}

export interface ScoringConfig {
  finishBonusSchedule: readonly number[];
  markerPointSchedules?: Readonly<Record<string, readonly number[]>>;
}

export interface StageRanking {
  stageId: string;
  riderId: string;
  rank: number;
  todayTotal: number;
  gcTimeSeconds: number;
}

function isPointSchedule(value: readonly number[] | ScoringConfig): value is readonly number[] {
  return Array.isArray(value);
}

const compareRiderIds = (left: string, right: string): number => left.localeCompare(right);

const compareFinishResults = (left: FinishResult, right: FinishResult): number => {
  const timeDifference = left.finishTimeSeconds - right.finishTimeSeconds;
  return timeDifference === 0 ? compareRiderIds(left.riderId, right.riderId) : timeDifference;
};

const compareStageScores = (left: StageScore, right: StageScore): number => {
  const pointsDifference = right.todayTotal - left.todayTotal;
  if (pointsDifference !== 0) {
    return pointsDifference;
  }

  const timeDifference = left.gcTimeSeconds - right.gcTimeSeconds;
  return timeDifference === 0 ? compareRiderIds(left.riderId, right.riderId) : timeDifference;
};

const compareSeasonStandings = (left: SeasonStanding, right: SeasonStanding): number => {
  const pointsDifference = right.seasonTotal - left.seasonTotal;
  if (pointsDifference !== 0) {
    return pointsDifference;
  }

  const previousRankDifference = (left.previousRank ?? Number.MAX_SAFE_INTEGER) - (right.previousRank ?? Number.MAX_SAFE_INTEGER);
  return previousRankDifference === 0 ? compareRiderIds(left.riderId, right.riderId) : previousRankDifference;
};

function pointsFor(marker: Marker, config?: ScoringConfig): readonly number[] {
  return config?.markerPointSchedules?.[marker.id] ?? marker.pointsSchedule;
}

export function rankMarkerCrossings(marker: Marker, crossings: readonly MarkerCrossing[]): readonly RankedCrossing[] {
  return crossings
    .filter((crossing) => crossing.markerId === marker.id)
    .toSorted((left, right) => {
      const timeDifference = left.crossedAtSeconds - right.crossedAtSeconds;
      return timeDifference === 0 ? compareRiderIds(left.riderId, right.riderId) : timeDifference;
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
  finishBonusScheduleOrConfig: readonly number[] | ScoringConfig
): readonly StageScore[] {
  const config: ScoringConfig = isPointSchedule(finishBonusScheduleOrConfig)
    ? { finishBonusSchedule: finishBonusScheduleOrConfig }
    : finishBonusScheduleOrConfig;
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
    const configuredMarker = { ...marker, pointsSchedule: pointsFor(marker, config) };
    for (const crossing of rankMarkerCrossings(configuredMarker, crossings)) {
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

  const rankedFinishes = finishes.toSorted(compareFinishResults);

  rankedFinishes.forEach((finish, index) => {
    const current = scores.get(finish.riderId);
    if (current) {
      current.finishBonus = config.finishBonusSchedule[index] ?? 0;
    }
  });

  return [...scores.values()]
    .map((score) => ({
      ...score,
      todayTotal: score.sprintPoints + score.komPoints + score.finishBonus
    }))
    .toSorted(compareStageScores);
}

export function aggregateSeasonTotals(stageScores: readonly StageScore[]): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const score of stageScores) {
    totals.set(score.riderId, (totals.get(score.riderId) ?? 0) + score.todayTotal);
  }
  return totals;
}

export function rankStageScores(stageScores: readonly StageScore[]): readonly StageRanking[] {
  return stageScores.toSorted(compareStageScores).map((score, index) => ({
    stageId: score.stageId,
    riderId: score.riderId,
    rank: index + 1,
    todayTotal: score.todayTotal,
    gcTimeSeconds: score.gcTimeSeconds
  }));
}

export function calculateSeasonStandings(
  seasonId: string,
  stageScores: readonly StageScore[],
  previousStandings: readonly Pick<SeasonStanding, "riderId" | "rank">[] = []
): readonly SeasonStanding[] {
  const previousRanks = new Map(previousStandings.map((standing) => [standing.riderId, standing.rank]));

  return [...aggregateSeasonTotals(stageScores)]
    .map(([riderId, seasonTotal]) => ({
      seasonId,
      riderId,
      seasonTotal,
      rank: 0,
      previousRank: previousRanks.get(riderId) ?? null
    }))
    .toSorted(compareSeasonStandings)
    .map((standing, index) => ({
      ...standing,
      rank: index + 1
    }));
}
