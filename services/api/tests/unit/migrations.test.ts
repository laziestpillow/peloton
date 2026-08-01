import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { migrationNames } from "../../src/infrastructure/database/migrate.js";

const execFileAsync = promisify(execFile);

describe("database migrations", () => {
  test("runner includes every tracked SQL migration", async () => {
    const { stdout } = await execFileAsync("git", ["ls-files", "services/api/migrations/*.sql"], {
      cwd: resolveWorkspaceRoot()
    });
    const migrationFiles = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((path) => path.replace("services/api/migrations/", ""))
      .sort();

    expect([...migrationNames].sort()).toEqual(migrationFiles);
  });
});

function resolveWorkspaceRoot(): string {
  return new URL("../../../..", import.meta.url).pathname;
}
