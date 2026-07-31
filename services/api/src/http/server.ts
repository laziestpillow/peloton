import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { loadApiFixtureData, type ApiFixtureData } from "../application/fixtureData.js";
import type { AppConfig } from "../config/env.js";
import { createApplicationUseCases, type ApplicationRepository, type ApplicationUseCases } from "../application/useCases.js";
import type { RiderAppearance } from "../domain/models.js";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/database/client.js";
import { FixtureRepository } from "../infrastructure/repositories/FixtureRepository.js";
import { PostgresRepository } from "../infrastructure/repositories/PostgresRepository.js";

export interface ServerOptions {
  repository?: ApplicationRepository;
}

function createRepository(config: AppConfig, fixtureData: ApiFixtureData): { repository: ApplicationRepository; connection?: DatabaseConnection } {
  if (config.DATA_SOURCE === "fixture") {
    return { repository: new FixtureRepository(fixtureData) };
  }

  const connection = createDatabaseConnection(config.DATABASE_URL);
  return {
    repository: new PostgresRepository(connection.db),
    connection
  };
}

export async function buildServer(config: AppConfig, options: ServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "strava.accessToken", "strava.refreshToken"]
    }
  });
  const fixtureData = await loadApiFixtureData();
  const liveRepository = options.repository ? { repository: options.repository } : createRepository(config, fixtureData);
  const useCases: ApplicationUseCases = createApplicationUseCases(liveRepository.repository, config.CURRENT_USER_ID, fixtureData);

  if (liveRepository.connection) {
    app.addHook("onClose", async () => {
      await liveRepository.connection?.pool.end();
    });
  }

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

  app.get("/v1/activities", async () => useCases.listActivities());
  app.get<{ Params: { activityId: string } }>("/v1/activities/:activityId", async (request, reply) => {
    const activity = await useCases.getActivity(request.params.activityId);
    if (!activity) {
      return reply.status(404).send({ error: { code: "not_found", message: "Activity not found." } });
    }
    return activity;
  });

  app.get("/v1/riders/me", async () => useCases.getCurrentRider());
  app.patch<{ Body: RiderAppearance }>("/v1/riders/me/appearance", async (request) => useCases.updateCurrentRiderAppearance(request.body));

  app.post<{ Body: { name?: string } }>("/v1/groups", async (request, reply) => {
    const input = request.body?.name ? { name: request.body.name } : {};
    return reply.status(201).send(await useCases.createGroup(input));
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId", async (request, reply) => {
    const group = await useCases.getGroup(request.params.groupId);
    if (!group) {
      return reply.status(404).send({ error: { code: "not_found", message: "Group not found." } });
    }
    return group;
  });

  app.post<{ Params: { groupId: string }; Body: { riderId: string } }>("/v1/groups/:groupId/members", async (request, reply) => {
    return reply.status(201).send(await useCases.addGroupMember({
      groupId: request.params.groupId,
      riderId: request.body.riderId
    }));
  });

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
  app.get("/v1/stages/:stageId/recap", async () => useCases.getStageRecap());
  app.get("/v1/stages/:stageId/results", async () => useCases.getStageResults());
  app.get("/v1/seasons/:seasonId/standings", async () => useCases.getSeasonStandings());
  app.get("/v1/seasons/:seasonId/archetypes", async () => useCases.getSeasonArchetypes());

  return app;
}
