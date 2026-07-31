import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { loadApiFixtureData, type ApiFixtureData } from "../application/fixtureData.js";
import type { AppConfig } from "../config/env.js";
import { ApplicationError, createApplicationUseCases, type ApplicationRepository, type ApplicationUseCases } from "../application/useCases.js";
import type { RiderAppearance } from "../domain/models.js";
import { createDatabaseConnection, type DatabaseConnection } from "../infrastructure/database/client.js";
import { FixtureRepository } from "../infrastructure/repositories/FixtureRepository.js";
import { PostgresRepository } from "../infrastructure/repositories/PostgresRepository.js";
import { HttpStravaGateway, type StravaGateway } from "../infrastructure/strava/StravaGateway.js";
import { createTokenCipher } from "../infrastructure/strava/TokenCipher.js";
import { createSessionPreHandler } from "./auth.js";

export interface ServerOptions {
  repository?: ApplicationRepository;
  stravaGateway?: StravaGateway;
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
      redact: [
        "req.headers.authorization",
        "req.query.code",
        "strava.accessToken",
        "strava.refreshToken",
        "accessToken",
        "refreshToken",
        "clientSecret"
      ]
    }
  });
  const fixtureData = await loadApiFixtureData();
  const liveRepository = options.repository ? { repository: options.repository } : createRepository(config, fixtureData);
  const stravaGateway = options.stravaGateway ?? new HttpStravaGateway();
  const tokenCipher = createTokenCipher(config.STRAVA_TOKEN_ENCRYPTION_KEY);
  const createUseCasesForUser = (userId: string): ApplicationUseCases => createApplicationUseCases(liveRepository.repository, userId, fixtureData, {
    stravaGateway,
    tokenCipher,
    stravaClientId: config.STRAVA_CLIENT_ID ?? "",
    stravaClientSecret: config.STRAVA_CLIENT_SECRET ?? "",
    stravaCallbackUrl: config.STRAVA_CALLBACK_URL,
    appDeepLinkUrl: config.APP_DEEP_LINK_URL,
    stravaOAuthScope: config.STRAVA_OAUTH_SCOPE,
    stravaOAuthStateTtlSeconds: config.STRAVA_OAUTH_STATE_TTL_SECONDS
  });

  if (liveRepository.connection) {
    app.addHook("onClose", async () => {
      await liveRepository.connection?.pool.end();
    });
  }

  const openApiText = await readFile(resolve(process.cwd(), "../../contracts/openapi.yaml"), "utf8");
  await app.register(swagger, { mode: "static", specification: { document: YAML.parse(openApiText) } });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  app.addHook("preHandler", createSessionPreHandler(config));

  function sendError(reply: FastifyReply, statusCode: 400 | 401 | 403 | 404, code: string, message: string) {
    return reply.status(statusCode).send({ error: { code, message } });
  }

  function getUseCases(request: FastifyRequest): ApplicationUseCases {
    const userId = request.authenticatedSession?.userId ?? config.CURRENT_USER_ID;
    return createUseCasesForUser(userId);
  }

  async function handleApplicationError(error: unknown, reply: FastifyReply): Promise<unknown> {
    if (error instanceof ApplicationError) {
      return sendError(reply, error.statusCode, error.code, error.message);
    }
    throw error;
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/auth/strava/start", async (request) => {
    const useCases = getUseCases(request);
    return useCases.startStravaAuthorization();
  });

  app.get<{ Querystring: { code?: string; state?: string; scope?: string; error?: string } }>("/v1/auth/strava/callback", async (request, reply) => {
    if (!request.query.state) {
      return sendError(reply, 400, "bad_request", "Missing Strava authorization state.");
    }
    const useCases = createUseCasesForUser(config.CURRENT_USER_ID);
    try {
      const result = await useCases.completeStravaAuthorization({
        state: request.query.state,
        ...(request.query.code ? { code: request.query.code } : {}),
        ...(request.query.scope ? { scope: request.query.scope } : {}),
        ...(request.query.error ? { error: request.query.error } : {})
      });
      return reply.redirect(result.redirectUrl);
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.delete("/v1/integrations/strava", async (request, reply) => {
    getUseCases(request);
    return reply.status(204).send();
  });

  app.get("/v1/integrations/strava/status", async (request) => {
    getUseCases(request);
    return {
      status: "notConnected",
      acceptedScopes: [],
      lastSyncedAt: null
    };
  });

  app.post("/v1/activities/sync", async (request, reply) => {
    getUseCases(request);
    return reply.status(202).send({
      status: "accepted",
      requestedAt: new Date().toISOString()
    });
  });

  app.get("/v1/activities", async (request) => {
    const useCases = getUseCases(request);
    return useCases.listActivities();
  });
  app.get<{ Params: { activityId: string } }>("/v1/activities/:activityId", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      const activity = await useCases.getActivity(request.params.activityId);
      if (!activity) {
        return sendError(reply, 404, "not_found", "Activity not found.");
      }
      return activity;
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.get("/v1/riders/me", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.getCurrentRider();
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });
  app.patch<{ Body: RiderAppearance }>("/v1/riders/me/appearance", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.updateCurrentRiderAppearance(request.body);
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.post<{ Body: { name?: string } }>("/v1/groups", async (request, reply) => {
    const useCases = getUseCases(request);
    const input = request.body?.name ? { name: request.body.name } : {};
    return reply.status(201).send(await useCases.createGroup(input));
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.getGroup(request.params.groupId);
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.post<{ Params: { groupId: string }; Body: { riderId: string } }>("/v1/groups/:groupId/members", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return reply.status(201).send(await useCases.addGroupMember({
        groupId: request.params.groupId,
        riderId: request.body.riderId
      }));
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId/stages", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      await useCases.getGroup(request.params.groupId);
      return {
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
      };
    } catch (error) {
      return handleApplicationError(error, reply);
    }
  });

  app.get("/v1/stages/:stageId", async (request) => {
    getUseCases(request);
    return {
      id: "stage-001",
      seasonId: "season-001",
      name: "Barcelona Hills",
      route: { distanceMeters: 42195, elevation: [{ positionMeters: 0, altitudeMeters: 35 }, { positionMeters: 42195, altitudeMeters: 88 }] },
      orderedMarkers: [],
      scheduledAt: "2026-07-18T07:30:00Z",
      status: "completed"
    };
  });
  app.get("/v1/stages/:stageId/recap", async (request) => {
    const useCases = getUseCases(request);
    return useCases.getStageRecap();
  });
  app.get("/v1/stages/:stageId/results", async (request) => {
    const useCases = getUseCases(request);
    return useCases.getStageResults();
  });
  app.get("/v1/seasons/:seasonId/standings", async (request) => {
    const useCases = getUseCases(request);
    return useCases.getSeasonStandings();
  });
  app.get("/v1/seasons/:seasonId/archetypes", async (request) => {
    const useCases = getUseCases(request);
    return useCases.getSeasonArchetypes();
  });

  return app;
}
