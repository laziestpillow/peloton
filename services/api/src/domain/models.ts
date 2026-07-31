export type MarkerType = "sprint" | "climb";
export type Archetype = "rookie" | "climber" | "sprinter" | "allRounder" | "puncheur" | "rouleur";

export interface RiderAppearance {
  jerseyColor: string;
  accentColor: string;
  helmetColor: string;
  bikeColor: string;
  pattern: "solid" | "stripes" | "polkaDots";
}

export interface RiderProfile {
  id: string;
  userId: string;
  displayName: string;
  appearance: RiderAppearance;
  createdAt: string;
  updatedAt: string;
}

export interface RouteSummary {
  polyline: string;
  previewBounds: {
    southWest: { latitude: number; longitude: number };
    northEast: { latitude: number; longitude: number };
  };
}

export interface ImportedActivity {
  id: string;
  riderId: string;
  provider: "strava" | "fixture";
  providerActivityId: string;
  activityType: "ride";
  startedAt: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
  routeSummary: RouteSummary;
  importStatus: "eligible" | "processing" | "processed" | "duplicate" | "unsupported" | "failed";
  processedStageId: string | null;
}

export interface ActivityListResponse {
  data: readonly ImportedActivity[];
  pagination: { nextCursor: string | null };
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembership {
  groupId: string;
  riderId: string;
  role: "owner" | "member";
  status: "active" | "invited" | "removed";
  joinedAt: string;
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
