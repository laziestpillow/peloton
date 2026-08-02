import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export type ErrorCode = "bad_request" | "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "internal_error";

export function sendErrorResponse(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: ErrorCode,
  message: string
): FastifyReply {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
      requestId: request.id
    }
  });
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    sendErrorResponse(reply, request, 404, "not_found", "Route not found.");
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode === 400 || error.validation) {
      sendErrorResponse(reply, request, 400, "bad_request", "Invalid request.");
      return;
    }

    request.log.error({ err: error }, "Unhandled request error.");
    sendErrorResponse(reply, request, 500, "internal_error", "Internal server error.");
  });
}
