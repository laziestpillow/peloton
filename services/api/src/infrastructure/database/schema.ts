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
