# Backend Operations

The backend can run in fixture mode for local development and Postgres-backed mode for staging or production. The OpenAPI contract in `contracts/openapi.yaml` remains the public API boundary.

## Required Live Environment

`NODE_ENV=staging` and `NODE_ENV=production` fail fast unless these values are explicitly configured:

- `DATABASE_URL`: a non-local Postgres connection URL.
- `FIXTURE_AUTH_TOKENS`: non-default bearer tokens until production auth replaces fixture auth.
- `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`: backend-only Strava app credentials.
- `STRAVA_CALLBACK_URL`: public OAuth callback URL.
- `STRAVA_WEBHOOK_CALLBACK_URL`: public Strava webhook callback URL.
- `STRAVA_WEBHOOK_VERIFY_TOKEN`: backend-only webhook verification token.
- `STRAVA_TOKEN_ENCRYPTION_KEY`: non-default 32-byte hex key.

Do not put Strava secrets, bearer tokens, database URLs, signing material, or generated artifacts in the repo.

## Migrations

Run migrations with:

```bash
pnpm --filter @peloton/api db:migrate
```

Production migrations are blocked unless `ALLOW_LIVE_DATABASE_TASKS=true` is set. Set it only for an intentional deploy step after checking `DATABASE_URL`.

CI runs migrations against an isolated Postgres service. Migration safety is also covered by a unit test that verifies every tracked SQL migration is registered by the runner.

## Seeds

Run local fixture seed data with:

```bash
pnpm --filter @peloton/api seed
```

Seeding is intended for local development and test data. Non-local seeds are blocked unless `ALLOW_LIVE_DATABASE_TASKS=true` is set.

## Checks

Before opening backend PRs, run:

```bash
CI=true pnpm --filter @peloton/api lint
CI=true pnpm --filter @peloton/api test
CI=true pnpm --filter @peloton/api build
CI=true pnpm --filter @peloton/api contract:check
```
