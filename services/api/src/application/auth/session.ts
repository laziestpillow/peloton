import { getCurrentRider, type JsonObject } from "../useCases.js";
import type { AppConfig } from "../../config/env.js";

export type AuthMode = NonNullable<AppConfig["AUTH_MODE"]>;

export interface PelotonPrincipal {
  userId: string;
  riderId: string;
  displayName: string;
  mode: AuthMode;
}

export interface SessionVerifier {
  verify(token: string): Promise<PelotonPrincipal | null>;
}

export const fixtureSessionToken = "peloton-fixture-session";

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/u);
  if (extra.length > 0 || scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function requireString(source: JsonObject, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Fixture rider is missing ${key}.`);
  }

  return value;
}

export async function loadFixturePrincipal(): Promise<PelotonPrincipal> {
  const rider = await getCurrentRider();
  return {
    userId: requireString(rider, "userId"),
    riderId: requireString(rider, "id"),
    displayName: requireString(rider, "displayName"),
    mode: "fixture"
  };
}

export class FixtureSessionVerifier implements SessionVerifier {
  constructor(private readonly acceptedToken = fixtureSessionToken) {}

  async verify(token: string): Promise<PelotonPrincipal | null> {
    if (token !== this.acceptedToken) {
      return null;
    }

    return loadFixturePrincipal();
  }
}

export class DevSessionVerifier implements SessionVerifier {
  constructor(private readonly acceptedToken: string, private readonly principal: PelotonPrincipal) {}

  async verify(token: string): Promise<PelotonPrincipal | null> {
    return token === this.acceptedToken ? this.principal : null;
  }
}

export function createSessionVerifier(config: Pick<AppConfig, "AUTH_MODE">): SessionVerifier {
  if (config.AUTH_MODE === "dev") {
    return new DevSessionVerifier("peloton-dev-session", {
      userId: "dev-user-001",
      riderId: "dev-rider-001",
      displayName: "Dev Rider",
      mode: "dev"
    });
  }

  return new FixtureSessionVerifier();
}
