import { describe, expect, test } from "vitest";
import { createTokenCipher } from "../../src/infrastructure/strava/TokenCipher.js";

describe("Strava token cipher", () => {
  test("encrypts and decrypts token values without storing plaintext", () => {
    const cipher = createTokenCipher("0000000000000000000000000000000000000000000000000000000000000000");
    const encrypted = cipher.encrypt("secret-token");

    expect(encrypted).not.toContain("secret-token");
    expect(cipher.decrypt(encrypted)).toBe("secret-token");
  });

  test("rejects invalid key material", () => {
    expect(() => createTokenCipher("short")).toThrow("STRAVA_TOKEN_ENCRYPTION_KEY");
  });
});
