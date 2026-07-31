import { randomBytes, timingSafeEqual } from "node:crypto";

export interface OAuthStateRecord {
  state: string;
  userId: string;
  redirectUrl: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface OAuthStateStore {
  save(record: OAuthStateRecord): Promise<void>;
  find(state: string): Promise<OAuthStateRecord | null>;
  consume(state: string, consumedAt: Date): Promise<void>;
}

export type OAuthStateValidationFailure = "missing" | "notFound" | "expired" | "alreadyConsumed" | "userMismatch";

export type OAuthStateValidationResult =
  | { ok: true; record: OAuthStateRecord }
  | { ok: false; reason: OAuthStateValidationFailure };

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function statesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function validateOAuthState(
  store: OAuthStateStore,
  state: string | null | undefined,
  expectedUserId: string,
  now = new Date()
): Promise<OAuthStateValidationResult> {
  if (!state) {
    return { ok: false, reason: "missing" };
  }

  const record = await store.find(state);
  if (!record || !statesMatch(record.state, state)) {
    return { ok: false, reason: "notFound" };
  }

  if (record.consumedAt) {
    return { ok: false, reason: "alreadyConsumed" };
  }

  if (record.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }

  if (record.userId !== expectedUserId) {
    return { ok: false, reason: "userMismatch" };
  }

  return { ok: true, record };
}

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private readonly records = new Map<string, OAuthStateRecord>();

  async save(record: OAuthStateRecord): Promise<void> {
    this.records.set(record.state, { ...record });
  }

  async find(state: string): Promise<OAuthStateRecord | null> {
    const record = this.records.get(state);
    return record ? { ...record } : null;
  }

  async consume(state: string, consumedAt: Date): Promise<void> {
    const record = this.records.get(state);
    if (record) {
      this.records.set(state, { ...record, consumedAt });
    }
  }
}
