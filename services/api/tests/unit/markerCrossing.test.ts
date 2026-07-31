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

  test("detects riders already at the marker on their first sample", () => {
    const crossings = detectMarkerCrossings(100, [
      { riderId: "rider-a", timeSeconds: 3, positionMeters: 100 },
      { riderId: "rider-a", timeSeconds: 10, positionMeters: 130 }
    ]);

    expect(crossings).toEqual([{ riderId: "rider-a", crossedAtSeconds: 3 }]);
  });

  test("sorts equal crossing times by rider id", () => {
    const crossings = detectMarkerCrossings(100, [
      { riderId: "rider-b", timeSeconds: 0, positionMeters: 90 },
      { riderId: "rider-b", timeSeconds: 10, positionMeters: 110 },
      { riderId: "rider-a", timeSeconds: 0, positionMeters: 80 },
      { riderId: "rider-a", timeSeconds: 10, positionMeters: 120 }
    ]);

    expect(crossings.map((crossing) => crossing.riderId)).toEqual(["rider-a", "rider-b"]);
  });

  test("supports configurable crossing time rounding", () => {
    const crossings = detectMarkerCrossings(
      101,
      [
        { riderId: "rider-a", timeSeconds: 0, positionMeters: 100 },
        { riderId: "rider-a", timeSeconds: 10, positionMeters: 103 }
      ],
      { timeRounding: "floor" }
    );

    expect(crossings).toEqual([{ riderId: "rider-a", crossedAtSeconds: 3 }]);
  });
});
