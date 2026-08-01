import type { Archetype, ArchetypeInput, ArchetypeResult, ArchetypeSnapshot, StageScore } from "./models.js";

const minimumEstablishedSampleSize = 3;

function confidenceFor(input: ArchetypeInput, archetype: Archetype): number {
  if (archetype === "rookie") {
    return Math.min(0.45, input.sampleSize / minimumEstablishedSampleSize);
  }

  const evidence = Math.min(1, input.sampleSize / 8);
  const spread = Math.max(
    input.sprintRelativeScore,
    input.climbRelativeScore,
    input.shortEffortScore,
    input.sustainedEffortScore
  ) - Math.min(
    input.sprintRelativeScore,
    input.climbRelativeScore,
    input.shortEffortScore,
    input.sustainedEffortScore
  );

  return Number(Math.min(0.95, 0.35 + evidence * 0.45 + spread * 0.2).toFixed(2));
}

export function classifyArchetype(input: ArchetypeInput): ArchetypeResult {
  if (input.sampleSize < minimumEstablishedSampleSize) {
    return {
      riderId: input.riderId,
      archetype: "rookie",
      confidence: confidenceFor(input, "rookie"),
      reasons: ["Minimum sample size has not been reached."]
    };
  }

  const sprint = input.sprintRelativeScore;
  const climb = input.climbRelativeScore;
  const short = input.shortEffortScore;
  const sustained = input.sustainedEffortScore;

  let archetype: Archetype = "allRounder";
  const reasons: string[] = [];

  if (climb >= 0.68 && climb - sprint >= 0.12) {
    archetype = "climber";
    reasons.push("Climb score is the strongest relative signal.");
  } else if (sprint >= 0.68 && sprint - climb >= 0.12) {
    archetype = "sprinter";
    reasons.push("Sprint score is the strongest relative signal.");
  } else if (short >= 0.66 && short - sustained >= 0.1) {
    archetype = "puncheur";
    reasons.push("Short effort score leads sustained performance.");
  } else if (sustained >= 0.66 && sustained - short >= 0.1) {
    archetype = "rouleur";
    reasons.push("Sustained effort score leads short explosive performance.");
  } else {
    reasons.push("Relative scores are balanced across event shapes.");
  }

  if (input.previousArchetype && input.previousArchetype !== archetype) {
    reasons.push(`Profile drifted from ${input.previousArchetype} to ${archetype}.`);
  }

  return {
    riderId: input.riderId,
    archetype,
    confidence: confidenceFor(input, archetype),
    reasons
  };
}

function relativeScore(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }
  return Number(Math.min(1, value / maxValue).toFixed(2));
}

function sustainedScore(gcTimeSeconds: number, bestGcTimeSeconds: number): number {
  if (gcTimeSeconds <= 0 || bestGcTimeSeconds <= 0) {
    return 0;
  }
  return Number(Math.min(1, bestGcTimeSeconds / gcTimeSeconds).toFixed(2));
}

export function materializeArchetypeSnapshots(
  seasonId: string,
  stageScores: readonly StageScore[],
  effectiveAt: Date,
  previousSnapshots: readonly Pick<ArchetypeSnapshot, "riderId" | "archetype">[] = []
): readonly ArchetypeSnapshot[] {
  const scoresByRider = Map.groupBy(stageScores, (score) => score.riderId);
  const aggregates = [...scoresByRider.entries()].map(([riderId, scores]) => ({
    riderId,
    sampleSize: scores.length,
    sprintPoints: scores.reduce((total, score) => total + score.sprintPoints, 0),
    climbPoints: scores.reduce((total, score) => total + score.komPoints, 0),
    finishBonus: scores.reduce((total, score) => total + score.finishBonus, 0),
    gcTimeSeconds: scores.reduce((total, score) => total + score.gcTimeSeconds, 0)
  }));

  const maxSprintPoints = Math.max(0, ...aggregates.map((aggregate) => aggregate.sprintPoints));
  const maxClimbPoints = Math.max(0, ...aggregates.map((aggregate) => aggregate.climbPoints));
  const maxFinishBonus = Math.max(0, ...aggregates.map((aggregate) => aggregate.finishBonus));
  const bestGcTimeSeconds = Math.min(...aggregates.map((aggregate) => aggregate.gcTimeSeconds).filter((value) => value > 0));
  const previousByRider = new Map(previousSnapshots.map((snapshot) => [snapshot.riderId, snapshot.archetype]));

  return aggregates
    .map((aggregate) => {
      const previousArchetype = previousByRider.get(aggregate.riderId);
      const input: ArchetypeInput = {
        riderId: aggregate.riderId,
        sampleSize: aggregate.sampleSize,
        sprintRelativeScore: relativeScore(aggregate.sprintPoints, maxSprintPoints),
        climbRelativeScore: relativeScore(aggregate.climbPoints, maxClimbPoints),
        shortEffortScore: relativeScore(aggregate.finishBonus, maxFinishBonus),
        sustainedEffortScore: sustainedScore(aggregate.gcTimeSeconds, Number.isFinite(bestGcTimeSeconds) ? bestGcTimeSeconds : 0),
        ...(previousArchetype ? { previousArchetype } : {})
      };
      const result = classifyArchetype(input);
      return {
        seasonId,
        riderId: aggregate.riderId,
        archetype: result.archetype,
        confidence: result.confidence,
        sampleSize: input.sampleSize,
        sprintRelativeScore: input.sprintRelativeScore,
        climbRelativeScore: input.climbRelativeScore,
        shortEffortScore: input.shortEffortScore,
        sustainedEffortScore: input.sustainedEffortScore,
        effectiveAt: effectiveAt.toISOString(),
        reasons: result.reasons
      };
    })
    .toSorted((left, right) => left.riderId.localeCompare(right.riderId));
}
