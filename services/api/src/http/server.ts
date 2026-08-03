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
import { registerErrorHandlers, sendErrorResponse, type ErrorCode } from "./errors.js";

export interface ServerOptions {
  repository?: ApplicationRepository;
  stravaGateway?: StravaGateway;
}

export const sensitiveLogRedactionPaths = [
  "req.headers.authorization",
  "req.headers.Authorization",
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "req.query.code",
  "req.query.state",
  "req.query.error",
  "req.query.hub.verify_token",
  "req.query[\"hub.verify_token\"]",
  "req.body.accessToken",
  "req.body.refreshToken",
  "req.body.encryptedAccessToken",
  "req.body.encryptedRefreshToken",
  "req.body.clientSecret",
  "req.body.stravaClientSecret",
  "req.body.STRAVA_CLIENT_SECRET",
  "req.body.STRAVA_TOKEN_ENCRYPTION_KEY",
  "req.body.STRAVA_WEBHOOK_VERIFY_TOKEN",
  "res.body.accessToken",
  "res.body.refreshToken",
  "res.body.encryptedAccessToken",
  "res.body.encryptedRefreshToken",
  "strava.accessToken",
  "strava.refreshToken",
  "accessToken",
  "refreshToken",
  "encryptedAccessToken",
  "encryptedRefreshToken",
  "clientSecret",
  "stravaClientSecret",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_WEBHOOK_VERIFY_TOKEN",
  "STRAVA_TOKEN_ENCRYPTION_KEY",
  "DATABASE_URL"
] as const;

export function createLoggerOptions(level: AppConfig["LOG_LEVEL"]) {
  return {
    level,
    redact: {
      paths: [...sensitiveLogRedactionPaths],
      censor: "[Redacted]"
    }
  };
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
    logger: createLoggerOptions(config.LOG_LEVEL),
    requestIdHeader: "x-request-id"
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
    stravaWebhookCallbackUrl: config.STRAVA_WEBHOOK_CALLBACK_URL,
    stravaWebhookVerifyToken: config.STRAVA_WEBHOOK_VERIFY_TOKEN,
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
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  app.addHook("preHandler", createSessionPreHandler(config));
  registerErrorHandlers(app);

  function sendError(request: FastifyRequest, reply: FastifyReply, statusCode: number, code: ErrorCode, message: string) {
    return sendErrorResponse(reply, request, statusCode, code, message);
  }

  function getUseCases(request: FastifyRequest): ApplicationUseCases {
    const userId = request.authenticatedSession?.userId ?? config.CURRENT_USER_ID;
    return createUseCasesForUser(userId);
  }

  async function handleApplicationError(error: unknown, request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
    if (error instanceof ApplicationError) {
      return sendErrorResponse(reply, request, error.statusCode, error.code, error.message);
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
      return sendError(request, reply, 400, "bad_request", "Missing Strava authorization state.");
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
      return handleApplicationError(error, request, reply);
    }
  });

  app.delete("/v1/integrations/strava", async (request, reply) => {
    const useCases = getUseCases(request);
    await useCases.disconnectStrava();
    return reply.status(204).send();
  });

  app.get("/v1/integrations/strava/status", async (request) => {
    const useCases = getUseCases(request);
    return useCases.getStravaStatus();
  });

  app.get("/v1/integrations/strava/webhook-subscription", async (request) => {
    const useCases = getUseCases(request);
    return useCases.listStravaWebhookSubscriptions();
  });

  app.post("/v1/integrations/strava/webhook-subscription", async (request, reply) => {
    const useCases = getUseCases(request);
    return reply.status(201).send(await useCases.createStravaWebhookSubscription());
  });

  app.delete<{ Querystring: { subscriptionId?: string } }>("/v1/integrations/strava/webhook-subscription", async (request, reply) => {
    const subscriptionId = Number(request.query.subscriptionId);
    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
      return sendError(request, reply, 400, "bad_request", "Missing or invalid Strava webhook subscription ID.");
    }
    const useCases = getUseCases(request);
    await useCases.deleteStravaWebhookSubscription(subscriptionId);
    return reply.status(204).send();
  });

  app.get<{ Querystring: { "hub.mode"?: string; "hub.challenge"?: string; "hub.verify_token"?: string } }>("/v1/webhooks/strava", async (request, reply) => {
    const useCases = createUseCasesForUser(config.CURRENT_USER_ID);
    try {
      return await useCases.verifyStravaWebhook({
        ...(request.query["hub.mode"] ? { mode: request.query["hub.mode"] } : {}),
        ...(request.query["hub.challenge"] ? { challenge: request.query["hub.challenge"] } : {}),
        ...(request.query["hub.verify_token"] ? { verifyToken: request.query["hub.verify_token"] } : {})
      });
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });

  app.post("/v1/webhooks/strava", async (request, reply) => {
    const useCases = createUseCasesForUser(config.CURRENT_USER_ID);
    try {
      return await useCases.receiveStravaWebhook(request.body);
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });

  app.post("/v1/activities/sync", async (request, reply) => {
    const useCases = getUseCases(request);
    const idempotencyHeader = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
    try {
      return reply.status(202).send(await useCases.syncActivities(idempotencyKey ? { idempotencyKey } : undefined));
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
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
        return sendError(request, reply, 404, "not_found", "Activity not found.");
      }
      return activity;
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });

  app.get("/v1/riders/me", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.getCurrentRider();
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });
  app.patch<{ Body: RiderAppearance }>("/v1/riders/me/appearance", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.updateCurrentRiderAppearance(request.body);
    } catch (error) {
      return handleApplicationError(error, request, reply);
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
      return handleApplicationError(error, request, reply);
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
      return handleApplicationError(error, request, reply);
    }
  });

  app.get<{ Params: { groupId: string } }>("/v1/groups/:groupId/stages", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      return await useCases.listGroupStages(request.params.groupId);
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });

  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      const stage = await useCases.getStage(request.params.stageId);
      if (!stage) {
        return sendError(request, reply, 404, "not_found", "Stage not found.");
      }
      return stage;
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });
  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId/recap", async (request, reply) => {
    const useCases = getUseCases(request);
    try {
      const recap = await useCases.getStageRecap(request.params.stageId);
      if (!recap) {
        return sendError(request, reply, 404, "not_found", "Stage recap not found.");
      }
      return recap;
    } catch (error) {
      return handleApplicationError(error, request, reply);
    }
  });
  app.get<{ Params: { stageId: string } }>("/v1/stages/:stageId/results", async (request, reply) => {
    const useCases = getUseCases(request);
    const results = await useCases.getStageResults(request.params.stageId);
    if (!results) {
      return sendError(request, reply, 404, "not_found", "Stage results not found.");
    }
    return results;
  });
  app.get<{ Params: { seasonId: string } }>("/v1/seasons/:seasonId/standings", async (request, reply) => {
    const useCases = getUseCases(request);
    const standings = await useCases.getSeasonStandings(request.params.seasonId);
    if (!standings) {
      return sendError(request, reply, 404, "not_found", "Season standings not found.");
    }
    return standings;
  });
  app.get<{ Params: { seasonId: string } }>("/v1/seasons/:seasonId/archetypes", async (request, reply) => {
    const useCases = getUseCases(request);
    const archetypes = await useCases.getSeasonArchetypes(request.params.seasonId);
    if (!archetypes) {
      return sendError(request, reply, 404, "not_found", "Season archetypes not found.");
    }
    return archetypes;
  });

  return app;
}
