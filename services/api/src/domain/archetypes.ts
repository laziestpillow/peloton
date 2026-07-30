import type { Archetype, ArchetypeInput, ArchetypeResult } from "./models.js";

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

