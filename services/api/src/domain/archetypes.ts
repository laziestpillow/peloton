import type { Archetype, ArchetypeInput, ArchetypeResult } from "./models.js";

export interface ArchetypeConfig {
  minimumEstablishedSampleSize: number;
  fullyEvidencedSampleSize: number;
  minimumSpecialistScore: number;
  minimumSpecialistMargin: number;
  minimumEffortScore: number;
  minimumEffortMargin: number;
  driftConfidencePenalty: number;
}

interface ArchetypeCandidate {
  archetype: Exclude<Archetype, "rookie">;
  score: number;
  reason: string;
}

const defaultConfig: ArchetypeConfig = {
  minimumEstablishedSampleSize: 3,
  fullyEvidencedSampleSize: 8,
  minimumSpecialistScore: 0.68,
  minimumSpecialistMargin: 0.12,
  minimumEffortScore: 0.66,
  minimumEffortMargin: 0.1,
  driftConfidencePenalty: 0.08
};

const candidatePriority: readonly Archetype[] = ["climber", "sprinter", "puncheur", "rouleur", "allRounder"];

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(1, score));
}

function roundConfidence(confidence: number): number {
  return Number(Math.max(0, Math.min(0.95, confidence)).toFixed(2));
}

function confidenceFor(input: ArchetypeInput, archetype: Archetype, margin: number, config: ArchetypeConfig): number {
  if (archetype === "rookie") {
    return roundConfidence(Math.min(0.45, input.sampleSize / config.minimumEstablishedSampleSize));
  }

  const scores = [
    clampScore(input.sprintRelativeScore),
    clampScore(input.climbRelativeScore),
    clampScore(input.shortEffortScore),
    clampScore(input.sustainedEffortScore)
  ];
  const evidence = Math.min(1, input.sampleSize / config.fullyEvidencedSampleSize);
  const spread = Math.max(...scores) - Math.min(...scores);
  const driftPenalty = input.previousArchetype && input.previousArchetype !== archetype ? config.driftConfidencePenalty : 0;
  const baseConfidence = Math.min(0.95, 0.35 + evidence * 0.42 + spread * 0.14 + Math.max(0, margin) * 0.25);

  return roundConfidence(baseConfidence - driftPenalty);
}

function compareCandidates(left: ArchetypeCandidate, right: ArchetypeCandidate): number {
  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }
  return candidatePriority.indexOf(left.archetype) - candidatePriority.indexOf(right.archetype);
}

function buildCandidates(input: ArchetypeInput, config: ArchetypeConfig): readonly ArchetypeCandidate[] {
  const sprint = clampScore(input.sprintRelativeScore);
  const climb = clampScore(input.climbRelativeScore);
  const short = clampScore(input.shortEffortScore);
  const sustained = clampScore(input.sustainedEffortScore);
  const candidates: ArchetypeCandidate[] = [];

  if (climb >= config.minimumSpecialistScore && climb - sprint >= config.minimumSpecialistMargin) {
    candidates.push({
      archetype: "climber",
      score: climb + (climb - sprint),
      reason: `Climb score ${climb.toFixed(2)} leads sprint by ${(climb - sprint).toFixed(2)}.`
    });
  }
  if (sprint >= config.minimumSpecialistScore && sprint - climb >= config.minimumSpecialistMargin) {
    candidates.push({
      archetype: "sprinter",
      score: sprint + (sprint - climb),
      reason: `Sprint score ${sprint.toFixed(2)} leads climb by ${(sprint - climb).toFixed(2)}.`
    });
  }
  if (short >= config.minimumEffortScore && short - sustained >= config.minimumEffortMargin) {
    candidates.push({
      archetype: "puncheur",
      score: short + (short - sustained),
      reason: `Short effort score ${short.toFixed(2)} leads sustained by ${(short - sustained).toFixed(2)}.`
    });
  }
  if (sustained >= config.minimumEffortScore && sustained - short >= config.minimumEffortMargin) {
    candidates.push({
      archetype: "rouleur",
      score: sustained + (sustained - short),
      reason: `Sustained effort score ${sustained.toFixed(2)} leads short effort by ${(sustained - short).toFixed(2)}.`
    });
  }

  candidates.push({
    archetype: "allRounder",
    score: (sprint + climb + short + sustained) / 4 - (Math.max(sprint, climb, short, sustained) - Math.min(sprint, climb, short, sustained)),
    reason: "Relative scores are balanced across event shapes."
  });

  return candidates.toSorted(compareCandidates);
}

export function classifyArchetype(input: ArchetypeInput, overrides: Partial<ArchetypeConfig> = {}): ArchetypeResult {
  const config = { ...defaultConfig, ...overrides };

  if (input.sampleSize < config.minimumEstablishedSampleSize) {
    return {
      riderId: input.riderId,
      archetype: "rookie",
      confidence: confidenceFor(input, "rookie", 0, config),
      reasons: [`Minimum sample size has not been reached (${input.sampleSize}/${config.minimumEstablishedSampleSize}).`]
    };
  }

  const [winner, runnerUp] = buildCandidates(input, config);
  const archetype = winner?.archetype ?? "allRounder";
  const winningMargin = winner && runnerUp ? winner.score - runnerUp.score : 0;
  const reasons = [winner?.reason ?? "Relative scores are balanced across event shapes."];

  if (runnerUp && winningMargin <= 0.05) {
    reasons.push(`Tie broken toward ${archetype} over ${runnerUp.archetype}.`);
  }

  if (input.previousArchetype && input.previousArchetype !== archetype) {
    reasons.push(`Profile drifted from ${input.previousArchetype} to ${archetype}.`);
  }

  return {
    riderId: input.riderId,
    archetype,
    confidence: confidenceFor(input, archetype, winningMargin, config),
    reasons
  };
}
