import { describe, expect, test } from "vitest";
import { buildSeedData } from "../../src/seed.js";

describe("seed data", () => {
  test("builds deterministic persistence rows from API-shaped fixtures", async () => {
    const data = await buildSeedData();

    expect(data.users.map((user) => user.id)).toEqual(["user-001", "user-002", "user-003", "user-004"]);
    expect(data.riderProfiles.map((profile) => profile.id)).toEqual(["rider-001", "rider-002", "rider-003", "rider-004"]);
    expect(data.groups).toHaveLength(1);
    expect(data.seasons).toMatchObject([{ id: "season-001", groupId: "group-001" }]);
    expect(data.stages).toMatchObject([{ id: "stage-001", seasonId: "season-001", status: "completed" }]);
    expect(data.markers.map((marker) => marker.id)).toEqual(["marker-sprint-001", "marker-climb-001"]);
    expect(data.importedActivities.map((activity) => activity.id)).toEqual(["activity-001", "activity-002", "activity-003", "activity-004"]);
    expect(data.rideResults.find((result) => result.riderId === "rider-001")?.importedActivityId).toBe("activity-001");
    expect(data.markerCrossings).toHaveLength(8);
    expect(data.stageResults.map((result) => result.todayTotal)).toEqual([33, 30, 22, 17]);
    expect(data.seasonStandings.map((standing) => standing.rank)).toEqual([1, 2, 3, 4]);
    expect(data.archetypeSnapshots.map((snapshot) => snapshot.riderId)).toEqual(["rider-001", "rider-002", "rider-003", "rider-004"]);
    expect(data.oauthStates).toMatchObject([{ state: "oauth-state-001", userId: "user-001", status: "pending" }]);
    expect(data.stravaConnections).toMatchObject([{ userId: "user-001", status: "connected" }]);
  });
});
