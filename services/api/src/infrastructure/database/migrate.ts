import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadConfig } from "../../config/env.js";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const migrationsDir = resolve(process.cwd(), "migrations");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedResult = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(appliedResult.rows.map((row) => row.name));
    const migrationNames = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).toSorted();

    for (const migrationName of migrationNames) {
      if (applied.has(migrationName)) {
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, migrationName), "utf8");
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migrationName]);
        await pool.query("COMMIT");
        console.log(`Applied migration ${migrationName}.`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  await runMigrations(config.DATABASE_URL);
}
