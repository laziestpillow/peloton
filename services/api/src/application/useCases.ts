import { readFixture } from "./fixtureData.js";

export interface ActivityListResponse {
  data: readonly unknown[];
  pagination: { nextCursor: string | null };
}

export type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function listActivities(): Promise<ActivityListResponse> {
  return readFixture<ActivityListResponse>("activities.json");
}

export async function getActivity(activityId: string): Promise<unknown | null> {
  const activities = await listActivities();
  return activities.data.find((activity) => {
    if (typeof activity !== "object" || activity === null || !("id" in activity)) {
      return false;
    }
    return activity.id === activityId;
  }) ?? null;
}

export async function getCurrentRider(): Promise<JsonObject> {
  const recap = await readFixture<{ riders: readonly unknown[] }>("recap.json");
  const firstRider = recap.riders[0];
  if (!isJsonObject(firstRider)) {
    throw new Error("Fixture recap has no riders.");
  }
  return firstRider;
}

export async function getStageRecap(): Promise<unknown> {
  return readFixture("recap.json");
}

export async function getStageResults(): Promise<unknown> {
  return readFixture("stage-results.json");
}

export async function getSeasonStandings(): Promise<unknown> {
  return readFixture("season-standings.json");
}

export async function getSeasonArchetypes(): Promise<unknown> {
  return {
    data: [
      {
        seasonId: "season-001",
        riderId: "rider-001",
        archetype: "sprinter",
        confidence: 0.76,
        sampleSize: 5,
        sprintRelativeScore: 0.82,
        climbRelativeScore: 0.61,
        shortEffortScore: 0.7,
        sustainedEffortScore: 0.58,
        effectiveAt: "2026-07-20T10:00:00Z",
        reasons: ["Sprint score is the strongest relative signal."]
      }
    ]
  };
}
