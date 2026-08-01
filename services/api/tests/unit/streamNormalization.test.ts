import { describe, expect, test } from "vitest";
import { normalizeActivityStreams } from "../../src/domain/streamNormalization.js";

describe("Strava stream normalization", () => {
  test("normalizes sparse stream sets into replay samples and route bounds", () => {
    const normalized = normalizeActivityStreams({
      time: [0, 30.8, 61.2],
      distance: [0, 120.5, 250.25],
      latlng: [
        [41.39, 2.16],
        [41.38, 2.18]
      ],
      altitude: [31],
      velocitySmooth: [0, 4.2, 4.4, 4.6]
    }, "summary_polyline");

    expect(normalized.samples).toEqual([
      { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: 41.39, longitude: 2.16, altitudeMeters: 31, velocityMetersPerSecond: 0 },
      { sequence: 1, timeSeconds: 30, distanceMeters: 120.5, latitude: 41.38, longitude: 2.18, altitudeMeters: null, velocityMetersPerSecond: 4.2 },
      { sequence: 2, timeSeconds: 61, distanceMeters: 250.25, latitude: null, longitude: null, altitudeMeters: null, velocityMetersPerSecond: 4.4 }
    ]);
    expect(normalized.routeSummary).toEqual({
      polyline: "summary_polyline",
      previewBounds: {
        southWest: { latitude: 41.38, longitude: 2.16 },
        northEast: { latitude: 41.39, longitude: 2.18 }
      }
    });
  });

  test("supports non-GPS activities without route bounds", () => {
    expect(normalizeActivityStreams({
      time: [0, 60],
      distance: [0, 0],
      altitude: [15, 15]
    })).toEqual({
      samples: [
        { sequence: 0, timeSeconds: 0, distanceMeters: 0, latitude: null, longitude: null, altitudeMeters: 15, velocityMetersPerSecond: null },
        { sequence: 1, timeSeconds: 60, distanceMeters: 0, latitude: null, longitude: null, altitudeMeters: 15, velocityMetersPerSecond: null }
      ],
      routeSummary: {
        polyline: "",
        previewBounds: {
          southWest: { latitude: 0, longitude: 0 },
          northEast: { latitude: 0, longitude: 0 }
        }
      }
    });
  });

  test("rejects malformed required time or distance streams", () => {
    expect(() => normalizeActivityStreams({
      time: [0, Number.NaN],
      distance: [0, 10]
    })).toThrow("invalid time");
  });
});
