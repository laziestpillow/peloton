import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { AppConfig } from "../config/env.js";
import {
  addGroupMember,
  createGroup,
  getActivity,
  getCurrentRider,
  getGroup,
  getSeasonArchetypes,
  getSeasonStandings,
  getStage,
  getStageRecap,
  getStageResults,
  getStravaIntegrationStatus,
  listGroupStages,
  listActivities,
  startStravaAuthorization,
  syncActivities,
  updateCurrentRiderAppearance,
  type RiderAppearance
} from "../application/useCases.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, "../../../..");

function errorResponse(code: string, message: string) {
  return { error: { code, message } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringBodyProperty(body: unknown, property: string): string | null {
  if (!isObject(body)) {
    return null;
  }

  const value = body[property];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function parseRiderAppearance(body: unknown): RiderAppearance | null {
  if (!isObject(body)) {
    return null;
  }

  const pattern = body.pattern;
  if (
    !isHexColor(body.jerseyColor)
    || !isHexColor(body.accentColor)
    || !isHexColor(body.helmetColor)
    || !isHexColor(body.bikeColor)
    || (pattern !== "solid" && pattern !== "stripes" && pattern !== "polkaDots")
  ) {
    return null;
  }

  return {
    jerseyColor: body.jerseyColor,
    accentColor: body.accentColor,
    helmetColor: body.helmetColor,
    bikeColor: body.bikeColor,
    pattern
  };
}

export async function buildServer(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "strava.accessToken", "strava.refreshToken"]
    }
  });

  const openApiText = await readFile(resolve(rootDir, "contracts/openapi.yaml"), "utf8");
  await app.register(swagger, { mode: "static", specification: { document: YAML.parse(openApiText) } });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok" }));

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send(errorResponse("not_found", "Route not found."));
  });

  app.setErrorHandler(async (error, _request, reply) => {
    const errorDetails = isObject(error) ? error : {};
    const statusCode = typeof errorDetails.statusCode === "number" ? errorDetails.statusCode : 500;
    if (statusCode >= 500) {
      app.log.error(error);
    }

    const code = statusCode < 500 ? "bad_request" : "internal_error";
    const message = statusCode < 500 && typeof errorDetails.message === "string" ? errorDetails.message : "Internal server error.";
    return reply.status(statusCode).send(errorResponse(code, message));
  });

  app.post("/v1/auth/strava/start", async () => startStravaAuthorization());

  app.get<{ Querystring: { code?: string; state?: string } }>("/v1/auth/strava/callback", async (request, reply) => {
    if (!request.query.code || !request.query.state) {
      return reply.status(400).send(errorResponse("bad_request", "Missing Strava authorization code or state."));
    }

    return reply.redirect(config.APP_DEEP_LINK_URL);
  });

  app.delete("/v1/integrations/strava", async (_request, reply) => reply.status(204).send());

  app.get("/v1/integrations/strava/status", async () => getStravaIntegrationStatus());

  app.post("/v1/activities/sync", async (_request, reply) => reply.status(202).send(await syncActivities()));

  app.get("/v1/activities", async () => listActivities());
  app.get<{ Params: { activityId: string } }>("/v1/activities/:activityId", async (request, reply) => {
    const activity = await getActivity(request.params.activityId);
    if (!activity) {
      return reply.status(404).send(errorResponse("not_found", "Activity not found."));
    }
    return activity;
  });

  app.get("/v1/riders/me", async () => getCurrentRider());
  app.patch("/v1/riders/me/appearance", async (request, reply) => {
    const appearance = parseRiderAppearance(request.body);
    if (!appearance) {
      return reply.status(400).send(errorResponse("bad_request", "Invalid rider appearance."));
    }

    return updateCurrentRiderAppearance(appearance);
  });

  app.post("/v1/groups", async (request, reply) => {
    const name = parseStringBodyProperty(request.body, "name");
    if (!name) {
      return reply.status(400).send(errorResponse("bad_request", "Group name is required."));
    }

    return reply.status(201).send(await createGroup({ name }));
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId", async (request, reply) => {
    const group = await getGroup(request.params.groupId);
    if (!group) {
      return reply.status(404).send(errorResponse("not_found", "Group not found."));
    }

    return group;
  });

  app.post<{ Params: { groupId: string } }>("/v1/groups/:groupId/members", async (request, reply) => {
    const riderId = parseStringBodyProperty(request.body, "riderId");
    if (!riderId) {
      return reply.status(400).send(errorResponse("bad_request", "Rider id is required."));
    }

    const membership = await addGroupMember({ groupId: request.params.groupId, riderId });
    if (!membership) {
      return reply.status(404).send(errorResponse("not_found", "Group or rider not found."));
    }

    return reply.status(201).send(membership);
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId/stages", async (request, reply) => {
    const stages = await listGroupStages(request.params.groupId);
    if (!stages) {
      return reply.status(404).send(errorResponse("not_found", "Group not found."));
    }

    return stages;
  });

  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId", async (request, reply) => {
    const stage = await getStage(request.params.stageId);
    if (!stage) {
      return reply.status(404).send(errorResponse("not_found", "Stage not found."));
    }

    return stage;
  });
  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId/recap", async (request, reply) => {
    const recap = await getStageRecap(request.params.stageId);
    if (!recap) {
      return reply.status(404).send(errorResponse("not_found", "Stage recap not found."));
    }

    return recap;
  });
  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId/results", async (request, reply) => {
    const results = await getStageResults(request.params.stageId);
    if (!results) {
      return reply.status(404).send(errorResponse("not_found", "Stage results not found."));
    }

    return results;
  });
  app.get<{ Params: { seasonId: string } }>("/v1/seasons/:seasonId/standings", async (request, reply) => {
    const standings = await getSeasonStandings(request.params.seasonId);
    if (!standings) {
      return reply.status(404).send(errorResponse("not_found", "Season standings not found."));
    }

    return standings;
  });
  app.get<{ Params: { seasonId: string } }>("/v1/seasons/:seasonId/archetypes", async (request, reply) => {
    const archetypes = await getSeasonArchetypes(request.params.seasonId);
    if (!archetypes) {
      return reply.status(404).send(errorResponse("not_found", "Season archetypes not found."));
    }

    return archetypes;
  });

  return app;
}
