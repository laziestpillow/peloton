import { readFixture } from "./fixtureData.js";

export interface ActivityListResponse {
  data: readonly unknown[];
  pagination: { nextCursor: string | null };
}

export type JsonObject = Record<string, unknown>;

export interface RiderAppearance {
  jerseyColor: string;
  accentColor: string;
  helmetColor: string;
  bikeColor: string;
  pattern: "solid" | "stripes" | "polkaDots";
}

export interface CreateGroupInput {
  name: string;
}

export interface AddGroupMemberInput {
  groupId: string;
  riderId: string;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringProperty(value: unknown, property: string): string | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const propertyValue = value[property];
  return typeof propertyValue === "string" ? propertyValue : null;
}

async function getFixtureSeasonId(): Promise<string> {
  const standings = await readFixture<{ seasonId: string }>("season-standings.json");
  return standings.seasonId;
}

async function getRiders(): Promise<readonly unknown[]> {
  const recap = await readFixture<{ riders: readonly unknown[] }>("recap.json");
  return recap.riders;
}

async function hasRider(riderId: string): Promise<boolean> {
  const riders = await getRiders();
  return riders.some((rider) => getStringProperty(rider, "id") === riderId);
}

export async function startStravaAuthorization(): Promise<JsonObject> {
  return {
    authorizationUrl: "https://www.strava.com/oauth/authorize?client_id=fixture&response_type=code&state=fixture-state",
    stateExpiresAt: "2026-07-30T14:00:00Z"
  };
}

export async function getStravaIntegrationStatus(): Promise<JsonObject> {
  return readFixture<JsonObject>("strava-status.json");
}

export async function syncActivities(requestedAt = new Date()): Promise<JsonObject> {
  return {
    status: "accepted",
    requestedAt: requestedAt.toISOString()
  };
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
  return readFixture<JsonObject>("rider-profile.json");
}

export async function updateCurrentRiderAppearance(appearance: RiderAppearance): Promise<JsonObject> {
  return {
    ...await getCurrentRider(),
    appearance,
    updatedAt: new Date().toISOString()
  };
}

export async function createGroup(input: CreateGroupInput): Promise<JsonObject> {
  return {
    id: "group-001",
    name: input.name,
    ownerId: "user-001",
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z"
  };
}

export async function getGroup(groupId: string): Promise<JsonObject | null> {
  if (groupId !== "group-001") {
    return null;
  }

  return createGroup({ name: "Fixture Club" });
}

export async function addGroupMember(input: AddGroupMemberInput): Promise<JsonObject | null> {
  const group = await getGroup(input.groupId);
  if (!group || !await hasRider(input.riderId)) {
    return null;
  }

  return {
    groupId: input.groupId,
    riderId: input.riderId,
    role: "member",
    status: "active",
    joinedAt: new Date().toISOString()
  };
}

export async function getStage(stageId: string): Promise<JsonObject | null> {
  const stages = await readFixture<{ data: readonly unknown[] }>("stages.json");
  const stage = stages.data.find((candidate) => getStringProperty(candidate, "id") === stageId);
  return isJsonObject(stage) ? stage : null;
}

export async function listGroupStages(groupId: string): Promise<{ data: readonly JsonObject[] } | null> {
  const group = await getGroup(groupId);
  if (!group) {
    return null;
  }

  return readFixture<{ data: readonly JsonObject[] }>("stages.json");
}

export async function getStageRecap(stageId: string): Promise<unknown | null> {
  const recap = await readFixture<{ stageId: string }>("recap.json");
  return recap.stageId === stageId ? recap : null;
}

export async function getStageResults(stageId: string): Promise<unknown | null> {
  const results = await readFixture<{ stageId: string }>("stage-results.json");
  return results.stageId === stageId ? results : null;
}

export async function getSeasonStandings(seasonId: string): Promise<unknown | null> {
  const standings = await readFixture<{ seasonId: string }>("season-standings.json");
  return standings.seasonId === seasonId ? standings : null;
}

export async function getSeasonArchetypes(seasonId: string): Promise<unknown | null> {
  if (seasonId !== await getFixtureSeasonId()) {
    return null;
  }

  return readFixture("archetypes.json");
}
