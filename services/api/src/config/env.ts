import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["test", "development", "staging", "production"]).default("development"),
  DATA_SOURCE: z.enum(["fixture", "postgres"]).default("postgres"),
  CURRENT_USER_ID: z.string().default("user-001"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url().default("postgres://peloton:peloton@127.0.0.1:5432/peloton"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_CALLBACK_URL: z.string().url().default("http://127.0.0.1:8080/v1/auth/strava/callback"),
  APP_DEEP_LINK_URL: z.string().default("peloton://strava/callback")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
