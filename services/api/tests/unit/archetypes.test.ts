import { describe, expect, test } from "vitest";
import { classifyArchetype } from "../../src/domain/archetypes.js";

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
});

