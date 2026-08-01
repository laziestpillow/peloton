import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ActivityListResponse, RiderProfile, SeasonArchetypesResponse, SeasonStandingsResponse, Stage, StageResultsResponse } from "../domain/models.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, "../../../..");

export interface RecapFixture {
  riders: readonly RiderProfile[];
}

export interface ApiFixtureData {
  activities: ActivityListResponse;
  stages: { data: readonly Stage[] };
  recap: RecapFixture;
  stageResults: StageResultsResponse;
  seasonStandings: SeasonStandingsResponse;
  seasonArchetypes: SeasonArchetypesResponse;
}

export async function readFixture<T>(name: string): Promise<T> {
  const content = await readFile(resolve(rootDir, "contracts/fixtures", name), "utf8");
  return JSON.parse(content) as T;
}

export async function loadApiFixtureData(): Promise<ApiFixtureData> {
  const [activities, stages, recap, stageResults, seasonStandings, seasonArchetypes] = await Promise.all([
    readFixture<ActivityListResponse>("activities.json"),
    readFixture<{ data: readonly Stage[] }>("stages.json"),
    readFixture<RecapFixture>("recap.json"),
    readFixture<StageResultsResponse>("stage-results.json"),
    readFixture<SeasonStandingsResponse>("season-standings.json"),
    readFixture<SeasonArchetypesResponse>("archetypes.json")
  ]);

  return { activities, stages, recap, stageResults, seasonStandings, seasonArchetypes };
}
