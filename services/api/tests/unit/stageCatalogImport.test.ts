import { describe, expect, test } from "vitest";
import { parseStageCatalog } from "../../src/admin/stageCatalogImport.js";

const validCatalog = {
  seasons: [{
    id: "season-2026-summer",
    groupId: "group-001",
    name: "Summer Series",
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: null
  }],
  stages: [{
    id: "stage-barcelona-hills",
    seasonId: "season-2026-summer",
    name: "Barcelona Hills",
    scheduledAt: "2026-07-18T07:30:00.000Z",
    status: "scheduled",
    route: {
      distanceMeters: 42195,
      elevation: [
        { positionMeters: 0, altitudeMeters: 35 },
        { positionMeters: 42195, altitudeMeters: 88 }
      ]
    },
    orderedMarkers: [{
      id: "marker-sprint-001",
      type: "sprint",
      positionMeters: 12000,
      latitude: 41.39,
      longitude: 2.16,
      geofenceRadiusMeters: 25,
      category: null,
      pointsSchedule: [20, 17, 15, 13, 11]
    }]
  }]
};
const validStage = validCatalog.stages[0]!;
const validMarker = validStage.orderedMarkers[0]!;

describe("stage catalog import validation", () => {
  test("accepts a valid season and stage catalog", () => {
    expect(parseStageCatalog(validCatalog)).toMatchObject({
      seasons: [{ id: "season-2026-summer" }],
      stages: [{ id: "stage-barcelona-hills", orderedMarkers: [{ id: "marker-sprint-001" }] }]
    });
  });

  test("rejects stages that reference missing seasons", () => {
    expect(() => parseStageCatalog({
      ...validCatalog,
      stages: [{ ...validStage, seasonId: "missing-season" }]
    })).toThrow("Stage seasonId must reference a season in this catalog.");
  });

  test("rejects route points and markers beyond stage distance", () => {
    expect(() => parseStageCatalog({
      ...validCatalog,
      stages: [{
        ...validStage,
        route: {
          distanceMeters: 1000,
          elevation: [
            { positionMeters: 0, altitudeMeters: 35 },
            { positionMeters: 1200, altitudeMeters: 88 }
          ]
        }
      }]
    })).toThrow("Route elevation positions cannot exceed distanceMeters.");

    expect(() => parseStageCatalog({
      ...validCatalog,
      stages: [{
        ...validStage,
        orderedMarkers: [{ ...validMarker, positionMeters: 50000 }]
      }]
    })).toThrow("Marker positionMeters cannot exceed route distanceMeters.");
  });
});
