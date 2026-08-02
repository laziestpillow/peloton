import { integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

export const appearancePattern = pgEnum("appearance_pattern", ["solid", "stripes", "polkaDots"]);
export const connectionStatus = pgEnum("connection_status", ["connected", "expired", "error", "revoked"]);
export const markerType = pgEnum("marker_type", ["sprint", "climb"]);
export const stageStatus = pgEnum("stage_status", ["scheduled", "active", "completed"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const riderProfiles = pgTable("rider_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  displayName: text("display_name").notNull(),
  jerseyColor: text("jersey_color").notNull(),
  accentColor: text("accent_color").notNull(),
  helmetColor: text("helmet_color").notNull(),
  bikeColor: text("bike_color").notNull(),
  pattern: appearancePattern("pattern").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const groupMemberships = pgTable("group_memberships", {
  groupId: text("group_id").notNull().references(() => groups.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  role: text("role").notNull(),
  status: text("status").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull()
}, (table) => [primaryKey({ columns: [table.groupId, table.riderId] })]);

export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => groups.id),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const stages = pgTable("stages", {
  id: text("id").primaryKey(),
  seasonId: text("season_id").notNull().references(() => seasons.id),
  name: text("name").notNull(),
  distanceMeters: numeric("distance_meters", { mode: "number" }).notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: stageStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const stageRoutePoints = pgTable("stage_route_points", {
  stageId: text("stage_id").notNull().references(() => stages.id),
  positionMeters: numeric("position_meters", { mode: "number" }).notNull(),
  altitudeMeters: numeric("altitude_meters", { mode: "number" }).notNull(),
  sequence: integer("sequence").notNull()
}, (table) => [primaryKey({ columns: [table.stageId, table.sequence] })]);

export const stageMarkers = pgTable("stage_markers", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull().references(() => stages.id),
  type: markerType("type").notNull(),
  positionMeters: numeric("position_meters", { mode: "number" }).notNull(),
  latitude: numeric("latitude", { mode: "number" }).notNull(),
  longitude: numeric("longitude", { mode: "number" }).notNull(),
  geofenceRadiusMeters: numeric("geofence_radius_meters", { mode: "number" }).notNull(),
  category: integer("category"),
  pointsSchedule: jsonb("points_schedule").notNull(),
  sequence: integer("sequence").notNull()
});

export const importedActivities = pgTable("imported_activities", {
  id: text("id").primaryKey(),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  provider: text("provider").notNull(),
  providerActivityId: text("provider_activity_id").notNull(),
  activityType: text("activity_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  distanceMeters: numeric("distance_meters", { mode: "number" }).notNull(),
  elapsedTimeSeconds: integer("elapsed_time_seconds").notNull(),
  movingTimeSeconds: integer("moving_time_seconds").notNull(),
  elevationGainMeters: numeric("elevation_gain_meters", { mode: "number" }).notNull(),
  routeSummary: jsonb("route_summary").notNull(),
  importStatus: text("import_status").notNull(),
  processedStageId: text("processed_stage_id")
}, (table) => [unique().on(table.provider, table.providerActivityId)]);

export const activityStreamSamples = pgTable("activity_stream_samples", {
  activityId: text("activity_id").notNull().references(() => importedActivities.id),
  sequence: integer("sequence").notNull(),
  timeSeconds: integer("time_seconds").notNull(),
  distanceMeters: numeric("distance_meters", { mode: "number" }).notNull(),
  latitude: numeric("latitude", { mode: "number" }),
  longitude: numeric("longitude", { mode: "number" }),
  altitudeMeters: numeric("altitude_meters", { mode: "number" }),
  velocityMetersPerSecond: numeric("velocity_meters_per_second", { mode: "number" })
}, (table) => [primaryKey({ columns: [table.activityId, table.sequence] })]);

export const stageActivityResults = pgTable("stage_activity_results", {
  stageId: text("stage_id").notNull().references(() => stages.id),
  activityId: text("activity_id").notNull().references(() => importedActivities.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  finishTimeSeconds: integer("finish_time_seconds").notNull(),
  matchedAt: timestamp("matched_at", { withTimezone: true }).notNull()
}, (table) => [
  primaryKey({ columns: [table.stageId, table.riderId] }),
  unique().on(table.activityId)
]);

export const stageMarkerCrossings = pgTable("stage_marker_crossings", {
  stageId: text("stage_id").notNull().references(() => stages.id),
  markerId: text("marker_id").notNull().references(() => stageMarkers.id),
  activityId: text("activity_id").notNull().references(() => importedActivities.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  crossedAtSeconds: integer("crossed_at_seconds").notNull(),
  rank: integer("rank").notNull(),
  points: integer("points").notNull()
}, (table) => [primaryKey({ columns: [table.stageId, table.markerId, table.riderId] })]);

export const stageClassifications = pgTable("stage_classifications", {
  stageId: text("stage_id").notNull().references(() => stages.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  sprintPoints: integer("sprint_points").notNull(),
  komPoints: integer("kom_points").notNull(),
  finishBonus: integer("finish_bonus").notNull(),
  todayTotal: integer("today_total").notNull(),
  gcTimeSeconds: integer("gc_time_seconds").notNull()
}, (table) => [primaryKey({ columns: [table.stageId, table.riderId] })]);

export const seasonStandings = pgTable("season_standings", {
  seasonId: text("season_id").notNull().references(() => seasons.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  seasonTotal: integer("season_total").notNull(),
  rank: integer("rank").notNull(),
  previousRank: integer("previous_rank")
}, (table) => [primaryKey({ columns: [table.seasonId, table.riderId] })]);

export const archetypeSnapshots = pgTable("archetype_snapshots", {
  seasonId: text("season_id").notNull().references(() => seasons.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  archetype: text("archetype").notNull(),
  confidence: numeric("confidence", { mode: "number" }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  sprintRelativeScore: numeric("sprint_relative_score", { mode: "number" }).notNull(),
  climbRelativeScore: numeric("climb_relative_score", { mode: "number" }).notNull(),
  shortEffortScore: numeric("short_effort_score", { mode: "number" }).notNull(),
  sustainedEffortScore: numeric("sustained_effort_score", { mode: "number" }).notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  reasons: jsonb("reasons").notNull()
}, (table) => [primaryKey({ columns: [table.seasonId, table.riderId] })]);

export const stravaWebhookEvents = pgTable("strava_webhook_events", {
  id: text("id").primaryKey(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  aspectType: text("aspect_type").notNull(),
  ownerId: text("owner_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
  updates: jsonb("updates").notNull(),
  action: text("action").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull()
}, (table) => [unique().on(table.subscriptionId, table.objectType, table.objectId, table.aspectType, table.eventTime)]);

export const stravaOAuthStates = pgTable("strava_oauth_states", {
  state: text("state").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  redirectUrl: text("redirect_url").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const stravaConnections = pgTable("strava_connections", {
  userId: text("user_id").primaryKey().references(() => users.id),
  athleteId: text("athlete_id").notNull(),
  acceptedScopes: jsonb("accepted_scopes").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  status: connectionStatus("status").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const activitySyncRequests = pgTable("activity_sync_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  idempotencyKey: text("idempotency_key"),
  status: text("status").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
}, (table) => [unique().on(table.userId, table.idempotencyKey)]);
