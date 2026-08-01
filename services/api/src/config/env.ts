import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["test", "development", "staging", "production"]).default("development"),
  DATA_SOURCE: z.enum(["fixture", "postgres"]).default("postgres"),
  AUTH_MODE: z.enum(["fixture", "disabled"]).default("fixture"),
  FIXTURE_AUTH_TOKENS: z.string().default("user-001:dev-token-user-001,user-002:dev-token-user-002,user-003:dev-token-user-003"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  CURRENT_USER_ID: z.string().default("user-001"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url().default("postgres://peloton:peloton@127.0.0.1:5432/peloton"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_CALLBACK_URL: z.string().url().default("http://127.0.0.1:8080/v1/auth/strava/callback"),
  STRAVA_OAUTH_SCOPE: z.string().default("read,activity:read_all"),
  STRAVA_OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  STRAVA_TOKEN_ENCRYPTION_KEY: z.string().default("0000000000000000000000000000000000000000000000000000000000000000"),
  APP_DEEP_LINK_URL: z.string().default("peloton://strava/callback"),
  ALLOW_LIVE_DATABASE_TASKS: envBoolean.default(false)
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production" && value.NODE_ENV !== "staging") {
    return;
  }

  for (const key of ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] as const) {
    if (!value[key]) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required in ${value.NODE_ENV}.`
      });
    }
  }

  if (!/^[0-9a-fA-F]{64}$/u.test(value.STRAVA_TOKEN_ENCRYPTION_KEY)) {
    context.addIssue({
      code: "custom",
      path: ["STRAVA_TOKEN_ENCRYPTION_KEY"],
      message: "STRAVA_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string in live environments."
    });
  }
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}

export function assertSafeDatabaseTask(config: AppConfig, taskName: "migration" | "seed"): void {
  if (config.NODE_ENV === "production" && !config.ALLOW_LIVE_DATABASE_TASKS) {
    throw new Error(`Refusing to run ${taskName} against production without ALLOW_LIVE_DATABASE_TASKS=true.`);
  }

  if (taskName === "seed" && config.NODE_ENV !== "development" && config.NODE_ENV !== "test" && !config.ALLOW_LIVE_DATABASE_TASKS) {
    throw new Error(`Refusing to seed ${config.NODE_ENV} without ALLOW_LIVE_DATABASE_TASKS=true.`);
  }
}
