export type MarkerType = "sprint" | "climb";
export type Archetype = "rookie" | "climber" | "sprinter" | "allRounder" | "puncheur" | "rouleur";

export interface RiderAppearance {
  jerseyColor: string;
  accentColor: string;
  helmetColor: string;
  bikeColor: string;
  pattern: "solid" | "stripes" | "polkaDots";
}

export interface Marker {
  id: string;
  type: MarkerType;
  positionMeters: number;
  pointsSchedule: readonly number[];
  category?: number | null;
}

export interface MarkerCrossing {
  markerId: string;
  riderId: string;
  crossedAtSeconds: number;
}

export interface RankedCrossing extends MarkerCrossing {
  rank: number;
  points: number;
}

export interface StageScore {
  stageId: string;
  riderId: string;
  sprintPoints: number;
  komPoints: number;
  finishBonus: number;
  todayTotal: number;
  gcTimeSeconds: number;
}

export interface ArchetypeInput {
  riderId: string;
  sampleSize: number;
  sprintRelativeScore: number;
  climbRelativeScore: number;
  shortEffortScore: number;
  sustainedEffortScore: number;
  previousArchetype?: Archetype;
}

export interface ArchetypeResult {
  riderId: string;
  archetype: Archetype;
  confidence: number;
  reasons: readonly string[];
}

