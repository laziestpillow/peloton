import type { StravaWebhookAction, StravaWebhookEvent } from "./models.js";

function requireStringEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Invalid Strava webhook ${field}.`);
  }
  return value as T;
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Invalid Strava webhook ${field}.`);
  }
  return value;
}

function stringUpdates(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

export function parseStravaWebhookEvent(payload: unknown): StravaWebhookEvent {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Invalid Strava webhook payload.");
  }

  const record = payload as Record<string, unknown>;
  return {
    objectType: requireStringEnum(record.object_type, ["activity", "athlete"], "object_type"),
    objectId: String(requireInteger(record.object_id, "object_id")),
    aspectType: requireStringEnum(record.aspect_type, ["create", "update", "delete"], "aspect_type"),
    ownerId: String(requireInteger(record.owner_id, "owner_id")),
    subscriptionId: requireInteger(record.subscription_id, "subscription_id"),
    eventTime: new Date(requireInteger(record.event_time, "event_time") * 1000),
    updates: stringUpdates(record.updates)
  };
}

export function actionForStravaWebhookEvent(event: StravaWebhookEvent): StravaWebhookAction {
  if (event.objectType === "athlete" && event.updates.authorized === "false") {
    return "deauthorization_requested";
  }
  if (event.objectType === "activity" && (event.aspectType === "create" || event.aspectType === "update")) {
    return "sync_requested";
  }
  if (event.objectType === "activity" && event.aspectType === "delete") {
    return "delete_requested";
  }
  return "ignored";
}
