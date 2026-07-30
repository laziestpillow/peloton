import { describe, expect, test } from "vitest";
import { detectMarkerCrossings } from "../../src/domain/markerCrossing.js";

describe("marker crossing detection", () => {
  test("interpolates crossing time between position samples", () => {
    const crossings = detectMarkerCrossings(100, [
      { riderId: "rider-a", timeSeconds: 0, positionMeters: 80 },
      { riderId: "rider-a", timeSeconds: 10, positionMeters: 120 }
    ]);

    expect(crossings).toEqual([{ riderId: "rider-a", crossedAtSeconds: 5 }]);
  });
});

