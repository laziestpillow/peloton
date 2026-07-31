import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface EncryptedToken {
  algorithm: "aes-256-gcm";
  keyId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface TokenEncryptor {
  encrypt(plaintext: string): Promise<EncryptedToken>;
  decrypt(token: EncryptedToken): Promise<string>;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export class AesGcmTokenEncryptor implements TokenEncryptor {
  private readonly key: Buffer;

  constructor(secret: string, private readonly keyId = "primary") {
    if (secret.length < 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
    }

    this.key = deriveKey(secret);
  }

  async encrypt(plaintext: string): Promise<EncryptedToken> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: "aes-256-gcm",
      keyId: this.keyId,
      iv: iv.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      authTag: authTag.toString("base64url")
    };
  }

  async decrypt(token: EncryptedToken): Promise<string> {
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(token.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(token.authTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(token.ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }
}

export class FixtureTokenEncryptor implements TokenEncryptor {
  async encrypt(plaintext: string): Promise<EncryptedToken> {
    return {
      algorithm: "aes-256-gcm",
      keyId: "fixture",
      iv: "fixture",
      ciphertext: Buffer.from(plaintext, "utf8").toString("base64url"),
      authTag: "fixture"
    };
  }

  async decrypt(token: EncryptedToken): Promise<string> {
    if (token.keyId !== "fixture") {
      throw new Error("FixtureTokenEncryptor can only decrypt fixture tokens.");
    }

    return Buffer.from(token.ciphertext, "base64url").toString("utf8");
  }
}
