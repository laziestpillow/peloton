import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const version = "v1";

export interface TokenCipher {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
}

export function createTokenCipher(hexKey: string): TokenCipher {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error("STRAVA_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string.");
  }

  return {
    encrypt(plainText: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return [version, iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(".");
    },
    decrypt(cipherText: string): string {
      const [cipherVersion, iv, authTag, encrypted] = cipherText.split(".");
      if (cipherVersion !== version || !iv || !authTag || !encrypted) {
        throw new Error("Unsupported encrypted token format.");
      }
      const decipher = createDecipheriv(algorithm, key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(authTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final()
      ]).toString("utf8");
    }
  };
}
