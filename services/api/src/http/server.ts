import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { AppConfig } from "../config/env.js";
import {
  getActivity,
  getCurrentRider,
  getSeasonArchetypes,
  getSeasonStandings,
  getStageRecap,
  getStageResults,
  listActivities
} from "../application/useCases.js";

export async function buildServer(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "strava.accessToken", "strava.refreshToken"]
    }
  });

  const openApiText = await readFile(resolve(process.cwd(), "../../contracts/openapi.yaml"), "utf8");
  await app.register(swagger, { mode: "static", specification: { document: YAML.parse(openApiText) } });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/auth/strava/start", async () => ({
    authorizationUrl: "https://www.strava.com/oauth/authorize?client_id=fixture&response_type=code&state=fixture-state",
    stateExpiresAt: "2026-07-30T14:00:00Z"
  }));

  app.get("/v1/auth/strava/callback", async (_request, reply) => {
    return reply.redirect(config.APP_DEEP_LINK_URL);
  });

  app.delete("/v1/integrations/strava", async (_request, reply) => reply.status(204).send());

  app.get("/v1/integrations/strava/status", async () => ({
    status: "notConnected",
    acceptedScopes: [],
    lastSyncedAt: null
  }));

  app.post("/v1/activities/sync", async (_request, reply) => reply.status(202).send({
    status: "accepted",
    requestedAt: new Date().toISOString()
  }));

  app.get("/v1/activities", async () => listActivities());
  app.get<{ Params: { activityId: string } }>("/v1/activities/:activityId", async (request, reply) => {
    const activity = await getActivity(request.params.activityId);
    if (!activity) {
      return reply.status(404).send({ error: { code: "not_found", message: "Activity not found." } });
    }
    return activity;
  });

  app.get("/v1/riders/me", async () => getCurrentRider());
  app.patch("/v1/riders/me/appearance", async (request) => ({
    ...await getCurrentRider(),
    appearance: request.body
  }));

  app.post("/v1/groups", async (_request, reply) => reply.status(201).send({
    id: "group-001",
    name: "Fixture Club",
    ownerId: "user-001",
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z"
  }));

  app.get("/v1/groups/:groupId", async () => ({
    id: "group-001",
    name: "Fixture Club",
    ownerId: "user-001",
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z"
  }));

  app.post<{ Params: { groupId: string }; Body: { riderId: string } }>("/v1/groups/:groupId/members", async (request, reply) => reply.status(201).send({
    groupId: request.params.groupId,
    riderId: request.body.riderId,
    role: "member",
    status: "active",
    joinedAt: new Date().toISOString()
  }));

  app.get("/v1/groups/:groupId/stages", async () => ({
    data: [
      {
        id: "stage-001",
        seasonId: "season-001",
        name: "Barcelona Hills",
        route: { distanceMeters: 42195, elevation: [{ positionMeters: 0, altitudeMeters: 35 }, { positionMeters: 42195, altitudeMeters: 88 }] },
        orderedMarkers: [],
        scheduledAt: "2026-07-18T07:30:00Z",
        status: "completed"
      }
    ]
  }));

  app.get("/v1/stages/:stageId", async () => ({
    id: "stage-001",
    seasonId: "season-001",
    name: "Barcelona Hills",
    route: { distanceMeters: 42195, elevation: [{ positionMeters: 0, altitudeMeters: 35 }, { positionMeters: 42195, altitudeMeters: 88 }] },
    orderedMarkers: [],
    scheduledAt: "2026-07-18T07:30:00Z",
    status: "completed"
  }));
  app.get("/v1/stages/:stageId/recap", async () => getStageRecap());
  app.get("/v1/stages/:stageId/results", async () => getStageResults());
  app.get("/v1/seasons/:seasonId/standings", async () => getSeasonStandings());
  app.get("/v1/seasons/:seasonId/archetypes", async () => getSeasonArchetypes());

  return app;
}

