import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["test", "development", "staging", "production"]).default("development"),
  AUTH_MODE: z.enum(["fixture", "dev"]).default("fixture"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url().default("postgres://peloton:peloton@127.0.0.1:5432/peloton"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SESSION_TOKEN_ISSUER: z.string().default("peloton-fixture"),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_CALLBACK_URL: z.string().url().default("http://127.0.0.1:8080/v1/auth/strava/callback"),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  STRAVA_ACTIVITY_PAGE_SIZE: z.coerce.number().int().positive().max(200).default(30),
  APP_DEEP_LINK_URL: z.string().default("peloton://strava/callback")
});

export type LoadedAppConfig = z.output<typeof envSchema>;
export type AppConfig = Partial<LoadedAppConfig> & Pick<
  LoadedAppConfig,
  "NODE_ENV" | "API_HOST" | "API_PORT" | "DATABASE_URL" | "LOG_LEVEL" | "APP_DEEP_LINK_URL"
>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): LoadedAppConfig {
  return envSchema.parse(source);
}
