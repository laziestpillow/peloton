export const tokenRedactionPaths = [
  "req.headers.authorization",
  "authorization",
  "accessToken",
  "refreshToken",
  "strava.accessToken",
  "strava.refreshToken",
  "strava.token.accessToken",
  "strava.token.refreshToken",
  "tokenCiphertext",
  "token.encryptedValue"
] as const;

export function redactToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return "[REDACTED]";
}

export function redactBearerAuthorization(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase().startsWith("bearer ") ? "Bearer [REDACTED]" : "[REDACTED]";
}
