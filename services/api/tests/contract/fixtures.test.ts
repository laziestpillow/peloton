import { describe, expect, test } from "vitest";
import { checkContract } from "../../scripts/contract-check.js";

describe("contract fixtures", () => {
  test("contract check script passes", async () => {
    await expect(checkContract()).resolves.toBeUndefined();
  });
});
