import type {
  SeasonStanding,
  SeasonStandingsResponse,
  Stage,
  StageActivityResult,
  StageMarkerCrossing,
  StageResultsResponse,
  StageScore
} from "./models.js";
import { aggregateSeasonTotals, calculateStageScores } from "./scoring.js";

export const defaultFinishBonusSchedule = [5, 3, 1];

export function materializeStageResults(
  stage: Stage,
  activityResults: readonly Pick<StageActivityResult, "riderId" | "finishTimeSeconds">[],
  markerCrossings: readonly StageMarkerCrossing[],
  finishBonusSchedule: readonly number[] = defaultFinishBonusSchedule
): StageResultsResponse {
  const classifications = calculateStageScores(
    stage.id,
    stage.orderedMarkers,
    markerCrossings.map((crossing) => ({
      markerId: crossing.markerId,
      riderId: crossing.riderId,
      crossedAtSeconds: crossing.crossedAtSeconds
    })),
    activityResults,
    finishBonusSchedule
  );

  const leaderBy = (score: (classification: StageScore) => number, direction: "asc" | "desc"): string => {
    const [leader] = classifications.toSorted((left, right) => {
      const scoreDifference = direction === "asc" ? score(left) - score(right) : score(right) - score(left);
      return scoreDifference === 0 ? left.riderId.localeCompare(right.riderId) : scoreDifference;
    });
    return leader?.riderId ?? "";
  };

  return {
    stageId: stage.id,
    markerResults: stage.orderedMarkers.map((marker) => ({
      markerId: marker.id,
      type: marker.type,
      crossings: markerCrossings
        .filter((crossing) => crossing.markerId === marker.id)
        .toSorted((left, right) => left.rank - right.rank)
        .map((crossing) => ({
          riderId: crossing.riderId,
          crossedAtSeconds: crossing.crossedAtSeconds,
          rank: crossing.rank,
          points: crossing.points
        }))
    })),
    classifications,
    jerseyLeaders: {
      green: leaderBy((classification) => classification.sprintPoints, "desc"),
      polkaDot: leaderBy((classification) => classification.komPoints, "desc"),
      yellow: leaderBy((classification) => classification.gcTimeSeconds, "asc")
    }
  };
}

export function materializeSeasonStandings(
  seasonId: string,
  stageScores: readonly StageScore[],
  previousStandings: readonly Pick<SeasonStanding, "riderId" | "rank">[] = []
): SeasonStandingsResponse {
  const previousRanks = new Map(previousStandings.map((standing) => [standing.riderId, standing.rank]));
  const totals = aggregateSeasonTotals(stageScores);
  return {
    seasonId,
    standings: [...totals.entries()]
      .toSorted((left, right) => {
        const pointsDifference = right[1] - left[1];
        return pointsDifference === 0 ? left[0].localeCompare(right[0]) : pointsDifference;
      })
      .map(([riderId, seasonTotal], index) => ({
        seasonId,
        riderId,
        seasonTotal,
        rank: index + 1,
        previousRank: previousRanks.get(riderId) ?? null
      }))
  };
}
