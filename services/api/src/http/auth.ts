import type { FastifyReply, FastifyRequest } from "fastify";
import { RateLimiterMemory } from "rate-limiter-flexible";
import type { AppConfig } from "../config/env.js";
import { sendErrorResponse } from "./errors.js";

export interface AuthenticatedSession {
  userId: string;
}

export interface AuthFailure {
  code: "unauthorized";
  message: string;
}

export type AuthResult = { ok: true; session: AuthenticatedSession } | { ok: false; error: AuthFailure };

declare module "fastify" {
  interface FastifyRequest {
    authenticatedSession?: AuthenticatedSession;
  }
}

function parseFixtureAuthTokens(value: string): ReadonlyMap<string, string> {
  const tokenToUserId = new Map<string, string>();
  for (const entry of value.split(",")) {
    const [userId, token] = entry.split(":");
    if (userId && token) {
      tokenToUserId.set(token, userId);
    }
  }
  return tokenToUserId;
}

export function resolveBearerSession(request: FastifyRequest, config: AppConfig): AuthResult {
  if (config.AUTH_MODE === "disabled") {
    return { ok: true, session: { userId: config.CURRENT_USER_ID } };
  }

  const header = request.headers.authorization;
  if (!header) {
    return { ok: false, error: { code: "unauthorized", message: "Missing bearer token." } };
  }

  const [scheme, token, extra] = header.split(/\s+/u);
  if (scheme !== "Bearer" || !token || extra) {
    return { ok: false, error: { code: "unauthorized", message: "Malformed bearer token." } };
  }

  const userId = parseFixtureAuthTokens(config.FIXTURE_AUTH_TOKENS).get(token);
  if (!userId) {
    return { ok: false, error: { code: "unauthorized", message: "Invalid bearer token." } };
  }

  return { ok: true, session: { userId } };
}

function isPublicPath(path: string): boolean {
  return path === "/health" || path === "/v1/auth/strava/callback" || path.startsWith("/docs");
}

export function createSessionPreHandler(config: AppConfig) {
  const rateLimiter = new RateLimiterMemory({
    points: config.AUTH_RATE_LIMIT_MAX,
    duration: config.AUTH_RATE_LIMIT_WINDOW_SECONDS
  });

  return async function sessionPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const path = request.url.split("?")[0] ?? request.url;
    if (isPublicPath(path)) {
      return;
    }

    if (config.AUTH_MODE !== "disabled") {
      try {
        await rateLimiter.consume(request.ip);
      } catch {
        sendErrorResponse(reply, request, 429, "rate_limited", "Too many authentication attempts.");
        return;
      }
    }

    const sessionResult = resolveBearerSession(request, config);
    if (!sessionResult.ok) {
      sendErrorResponse(reply, request, 401, sessionResult.error.code, sessionResult.error.message);
      return;
    }
    request.authenticatedSession = sessionResult.session;
  };
}
