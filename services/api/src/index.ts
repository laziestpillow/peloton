import { loadConfig } from "./config/env.js";
import { buildServer } from "./http/server.js";

const config = loadConfig();
const server = await buildServer(config);

try {
  await server.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

