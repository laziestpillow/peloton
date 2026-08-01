import { describe, expect, test } from "vitest";
import { classifyArchetype, materializeArchetypeSnapshots } from "../../src/domain/archetypes.js";

describe("archetypes", () => {
  test("keeps new riders as rookie until the evidence threshold", () => {
    const result = classifyArchetype({
      riderId: "rider-a",
      sampleSize: 2,
      sprintRelativeScore: 0.9,
      climbRelativeScore: 0.2,
      shortEffortScore: 0.5,
      sustainedEffortScore: 0.5
    });

    expect(result.archetype).toBe("rookie");
    expect(result.confidence).toBeLessThanOrEqual(0.45);
  });

  test.each([
    ["climber", { sprintRelativeScore: 0.5, climbRelativeScore: 0.75, shortEffortScore: 0.45, sustainedEffortScore: 0.55 }],
    ["sprinter", { sprintRelativeScore: 0.8, climbRelativeScore: 0.55, shortEffortScore: 0.65, sustainedEffortScore: 0.5 }],
    ["puncheur", { sprintRelativeScore: 0.58, climbRelativeScore: 0.56, shortEffortScore: 0.7, sustainedEffortScore: 0.52 }],
    ["rouleur", { sprintRelativeScore: 0.58, climbRelativeScore: 0.56, shortEffortScore: 0.52, sustainedEffortScore: 0.7 }],
    ["allRounder", { sprintRelativeScore: 0.62, climbRelativeScore: 0.61, shortEffortScore: 0.6, sustainedEffortScore: 0.59 }]
  ] as const)("classifies %s", (expected, scores) => {
    const result = classifyArchetype({ riderId: "rider-a", sampleSize: 5, ...scores });
    expect(result.archetype).toBe(expected);
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  test("reports profile drift separately from strength", () => {
    const result = classifyArchetype({
      riderId: "rider-a",
      sampleSize: 8,
      sprintRelativeScore: 0.81,
      climbRelativeScore: 0.5,
      shortEffortScore: 0.55,
      sustainedEffortScore: 0.52,
      previousArchetype: "climber"
    });

    expect(result.reasons.join(" ")).toContain("drifted");
  });

  test("materializes backend-owned snapshots from stage scores", () => {
    const effectiveAt = new Date("2026-07-20T10:00:00.000Z");

    const snapshots = materializeArchetypeSnapshots("season-001", [
      { stageId: "stage-001", riderId: "rider-a", sprintPoints: 20, komPoints: 2, finishBonus: 5, todayTotal: 27, gcTimeSeconds: 300 },
      { stageId: "stage-002", riderId: "rider-a", sprintPoints: 18, komPoints: 2, finishBonus: 5, todayTotal: 25, gcTimeSeconds: 305 },
      { stageId: "stage-003", riderId: "rider-a", sprintPoints: 20, komPoints: 1, finishBonus: 5, todayTotal: 26, gcTimeSeconds: 302 },
      { stageId: "stage-001", riderId: "rider-b", sprintPoints: 1, komPoints: 10, finishBonus: 0, todayTotal: 11, gcTimeSeconds: 330 },
      { stageId: "stage-002", riderId: "rider-b", sprintPoints: 2, komPoints: 10, finishBonus: 1, todayTotal: 13, gcTimeSeconds: 325 },
      { stageId: "stage-003", riderId: "rider-b", sprintPoints: 1, komPoints: 10, finishBonus: 0, todayTotal: 11, gcTimeSeconds: 328 },
      { stageId: "stage-001", riderId: "rider-c", sprintPoints: 20, komPoints: 10, finishBonus: 5, todayTotal: 35, gcTimeSeconds: 290 }
    ], effectiveAt, [
      { riderId: "rider-a", archetype: "climber" }
    ]);

    expect(snapshots).toMatchObject([
      {
        seasonId: "season-001",
        riderId: "rider-a",
        archetype: "sprinter",
        sampleSize: 3,
        sprintRelativeScore: 1,
        effectiveAt: "2026-07-20T10:00:00.000Z",
        reasons: expect.arrayContaining(["Sprint score is the strongest relative signal.", "Profile drifted from climber to sprinter."])
      },
      {
        seasonId: "season-001",
        riderId: "rider-b",
        archetype: "climber",
        sampleSize: 3,
        climbRelativeScore: 1
      },
      {
        seasonId: "season-001",
        riderId: "rider-c",
        archetype: "rookie",
        sampleSize: 1
      }
    ]);
  });
});
