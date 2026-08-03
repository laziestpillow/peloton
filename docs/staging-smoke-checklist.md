# Staging Smoke Checklist

Run this checklist after deploying the backend to staging and before TestFlight or external testing.

## Required Secrets

- `DATABASE_URL`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `STRAVA_TOKEN_ENCRYPTION_KEY`
- `FIXTURE_AUTH_TOKENS` or the staging bearer-token source
- `APP_DEEP_LINK_URL`
- `STRAVA_CALLBACK_URL`
- `STRAVA_WEBHOOK_CALLBACK_URL`

Keep these values in the deployment secret manager only.

## Deploy Steps

1. Deploy the backend image or artifact.
2. Run migrations as a separate one-off step with `ALLOW_LIVE_DATABASE_TASKS=true`.
3. If importing live stage data, run `pnpm stage-catalog:import <catalog.json>` as a separate one-off step with `ALLOW_LIVE_DATABASE_TASKS=true`.
4. Start the web process without `ALLOW_LIVE_DATABASE_TASKS`.

## Smoke Checks

Use a staging bearer token for protected endpoints.

```bash
curl -fsS https://staging.example.com/health
curl -fsS -H "Authorization: Bearer $TOKEN" https://staging.example.com/v1/riders/me
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" https://staging.example.com/v1/auth/strava/start
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: smoke-sync-001" https://staging.example.com/v1/activities/sync
curl -fsS "https://staging.example.com/v1/webhooks/strava?hub.mode=subscribe&hub.verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN&hub.challenge=smoke-challenge"
```

Expected results:

- `/health` returns `{ "status": "ok" }`.
- Authenticated API requests return contract-shaped JSON and include `x-request-id`.
- Strava authorization returns an authorization URL with a state expiry.
- Activity sync returns `202` with `accepted` or `alreadyRunning`.
- Webhook verification echoes `hub.challenge`.

## iOS Checks

- Configure the staging base URL in the app environment.
- Verify Strava callback redirects to `APP_DEEP_LINK_URL`.
- Confirm the app can refresh Strava status, trigger activity sync, list activities, open a stage recap, and display results from staging data.

## Rollback And Rotation

- Roll back by redeploying the previous backend artifact and rerunning only backward-compatible migrations.
- Rotate Strava and token-encryption secrets through the deployment secret manager.
- Revoke compromised Strava connections by disconnecting affected users or marking their connection state revoked in an audited operations task.

## Known MVP Limitations

- The stage catalog import is the MVP administration path; there is no admin UI yet.
- Fixture mode remains the default local path.
- Webhook processing is best-effort and acknowledges unsupported events safely.
