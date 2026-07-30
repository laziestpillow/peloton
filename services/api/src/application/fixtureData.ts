import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, "../../../..");

export async function readFixture<T>(name: string): Promise<T> {
  const content = await readFile(resolve(rootDir, "contracts/fixtures", name), "utf8");
  return JSON.parse(content) as T;
}

