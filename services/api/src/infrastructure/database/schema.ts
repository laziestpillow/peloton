import { integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

export const appearancePattern = pgEnum("appearance_pattern", ["solid", "stripes", "polkaDots"]);
export const connectionStatus = pgEnum("connection_status", ["connected", "expired", "error", "revoked"]);

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
