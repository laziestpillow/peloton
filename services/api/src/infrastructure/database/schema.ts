import { integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const appearancePattern = pgEnum("appearance_pattern", ["solid", "stripes", "polkaDots"]);
export const archetype = pgEnum("archetype", ["rookie", "climber", "sprinter", "allRounder", "puncheur", "rouleur"]);
export const connectionStatus = pgEnum("connection_status", ["connected", "expired", "error", "revoked"]);
export const importStatus = pgEnum("import_status", ["eligible", "processing", "processed", "duplicate", "unsupported", "failed"]);
export const markerType = pgEnum("marker_type", ["sprint", "climb"]);
export const oauthStateStatus = pgEnum("oauth_state_status", ["pending", "consumed", "expired"]);
export const provider = pgEnum("activity_provider", ["strava", "fixture"]);
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
  status: stageStatus("status").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const stages = pgTable("stages", {
  id: text("id").primaryKey(),
  seasonId: text("season_id").notNull().references(() => seasons.id),
  name: text("name").notNull(),
  route: jsonb("route").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: stageStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});

export const importedActivities = pgTable("imported_activities", {
  id: text("id").primaryKey(),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  provider: provider("provider").notNull(),
  providerActivityId: text("provider_activity_id").notNull(),
  activityType: text("activity_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  distanceMeters: numeric("distance_meters").notNull(),
  elapsedTimeSeconds: integer("elapsed_time_seconds").notNull(),
  movingTimeSeconds: integer("moving_time_seconds").notNull(),
  elevationGainMeters: numeric("elevation_gain_meters").notNull(),
  routeSummary: jsonb("route_summary").notNull(),
  importStatus: importStatus("import_status").notNull(),
  processedStageId: text("processed_stage_id").references(() => stages.id)
}, (table) => [uniqueIndex("imported_activities_provider_activity_uidx").on(table.provider, table.providerActivityId)]);

export const markers = pgTable("markers", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull().references(() => stages.id),
  type: markerType("type").notNull(),
  positionMeters: numeric("position_meters").notNull(),
  latitude: numeric("latitude").notNull(),
  longitude: numeric("longitude").notNull(),
  geofenceRadiusMeters: numeric("geofence_radius_meters").notNull(),
  category: integer("category"),
  pointsSchedule: jsonb("points_schedule").notNull(),
  sortOrder: integer("sort_order").notNull()
}, (table) => [uniqueIndex("markers_stage_sort_order_uidx").on(table.stageId, table.sortOrder)]);

export const rideResults = pgTable("ride_results", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull().references(() => stages.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  importedActivityId: text("imported_activity_id").references(() => importedActivities.id),
  finishTimeSeconds: integer("finish_time_seconds").notNull(),
  distanceMeters: numeric("distance_meters").notNull(),
  elapsedTimeSeconds: integer("elapsed_time_seconds").notNull(),
  movingTimeSeconds: integer("moving_time_seconds").notNull(),
  elevationGainMeters: numeric("elevation_gain_meters").notNull(),
  routeSummary: jsonb("route_summary").notNull()
}, (table) => [uniqueIndex("ride_results_stage_rider_uidx").on(table.stageId, table.riderId)]);

export const markerCrossings = pgTable("marker_crossings", {
  markerId: text("marker_id").notNull().references(() => markers.id),
  riderId: text("rider_id").notNull().references(() => riderProfiles.id),
  crossedAtSeconds: integer("crossed_at_seconds").notNull(),
  rank: integer("rank").notNull(),
  points: integer("points").notNull()
}, (table) => [primaryKey({ columns: [table.markerId, table.riderId] })]);

export const stageResults = pgTable("stage_results", {
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
  archetype: archetype("archetype").notNull(),
  confidence: numeric("confidence").notNull(),
  sampleSize: integer("sample_size").notNull(),
  sprintRelativeScore: numeric("sprint_relative_score").notNull(),
  climbRelativeScore: numeric("climb_relative_score").notNull(),
  shortEffortScore: numeric("short_effort_score").notNull(),
  sustainedEffortScore: numeric("sustained_effort_score").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  reasons: jsonb("reasons").notNull()
}, (table) => [primaryKey({ columns: [table.seasonId, table.riderId, table.effectiveAt] })]);

export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  redirectUri: text("redirect_uri").notNull(),
  scopes: jsonb("scopes").notNull(),
  status: oauthStateStatus("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const stravaConnections = pgTable("strava_connections", {
  userId: text("user_id").primaryKey().references(() => users.id),
  stravaAthleteId: text("strava_athlete_id").notNull(),
  status: connectionStatus("status").notNull(),
  acceptedScopes: jsonb("accepted_scopes").notNull(),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => [uniqueIndex("strava_connections_athlete_uidx").on(table.stravaAthleteId)]);
