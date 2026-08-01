import { describe, expect, test } from "vitest";
import { actionForStravaWebhookEvent, parseStravaWebhookEvent } from "../../src/domain/stravaWebhook.js";

describe("Strava webhook events", () => {
  test("parses activity create events and maps them to sync work", () => {
    const event = parseStravaWebhookEvent({
      object_type: "activity",
      object_id: 1360128428,
      aspect_type: "create",
      owner_id: 134815,
      subscription_id: 120475,
      event_time: 1516126040,
      updates: { title: "Ride" }
    });

    expect(event).toMatchObject({
      objectType: "activity",
      objectId: "1360128428",
      aspectType: "create",
      ownerId: "134815",
      subscriptionId: 120475,
      eventTime: new Date("2018-01-16T18:07:20.000Z"),
      updates: { title: "Ride" }
    });
    expect(actionForStravaWebhookEvent(event)).toBe("sync_requested");
  });

  test("maps delete and deauthorization events explicitly", () => {
    expect(actionForStravaWebhookEvent(parseStravaWebhookEvent({
      object_type: "activity",
      object_id: 1,
      aspect_type: "delete",
      owner_id: 2,
      subscription_id: 3,
      event_time: 4
    }))).toBe("delete_requested");

    expect(actionForStravaWebhookEvent(parseStravaWebhookEvent({
      object_type: "athlete",
      object_id: 2,
      aspect_type: "update",
      owner_id: 2,
      subscription_id: 3,
      event_time: 4,
      updates: { authorized: "false" }
    }))).toBe("deauthorization_requested");
  });

  test("rejects malformed events", () => {
    expect(() => parseStravaWebhookEvent({ object_type: "route" })).toThrow("object_type");
  });
});
