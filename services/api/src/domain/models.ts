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

export interface ActivityStreamSample {
  sequence: number;
  timeSeconds: number;
  distanceMeters: number;
  latitude: number | null;
  longitude: number | null;
  altitudeMeters: number | null;
  velocityMetersPerSecond: number | null;
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
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  pointsSchedule: readonly number[];
  category?: number | null;
}

export interface RouteElevationPoint {
  positionMeters: number;
  altitudeMeters: number;
}

export interface RouteProfile {
  distanceMeters: number;
  elevation: readonly RouteElevationPoint[];
}

export interface Stage {
  id: string;
  seasonId: string;
  name: string;
  route: RouteProfile;
  orderedMarkers: readonly Marker[];
  scheduledAt: string;
  status: "scheduled" | "active" | "completed";
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

export interface StageMarkerResult {
  markerId: string;
  type: MarkerType;
  crossings: readonly StageResultMarkerCrossing[];
}

export interface StageResultMarkerCrossing {
  riderId: string;
  crossedAtSeconds: number;
  rank: number;
  points: number;
}

export interface StageResultsResponse {
  stageId: string;
  markerResults: readonly StageMarkerResult[];
  classifications: readonly StageScore[];
  jerseyLeaders: {
    green: string;
    polkaDot: string;
    yellow: string;
  };
}

export interface SeasonStanding {
  seasonId: string;
  riderId: string;
  seasonTotal: number;
  rank: number;
  previousRank: number | null;
}

export interface SeasonStandingsResponse {
  seasonId: string;
  standings: readonly SeasonStanding[];
}

export interface StageActivityResult {
  stageId: string;
  activityId: string;
  riderId: string;
  finishTimeSeconds: number;
  matchedAt: string;
}

export interface StageMarkerCrossing {
  stageId: string;
  markerId: string;
  activityId: string;
  riderId: string;
  crossedAtSeconds: number;
  rank: number;
  points: number;
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
