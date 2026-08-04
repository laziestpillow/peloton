import { assertSafeDatabaseTask, loadConfig } from "../config/env.js";
import { createDatabaseConnection } from "../infrastructure/database/client.js";
import { PostgresRepository } from "../infrastructure/repositories/PostgresRepository.js";

const retentionDays = 7;
const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

const config = loadConfig();
assertSafeDatabaseTask(config, "retention");

const now = new Date();
const cutoff = new Date(now.getTime() - retentionMs);
const connection = createDatabaseConnection(config.DATABASE_URL);

try {
  const repository = new PostgresRepository(connection.db);
  const result = await repository.deleteExpiredStravaData({ cutoff, effectiveAt: now });
  console.log(JSON.stringify({
    retentionDays,
    cutoff: cutoff.toISOString(),
    ...result
  }));
} finally {
  await connection.pool.end();
}
