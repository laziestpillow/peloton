# Local Development

Default development uses fixtures and local PostgreSQL.

```bash
cp .env.example .env
make bootstrap
make database
make seed
make api
```

Open `apps/ios/Peloton.xcodeproj` in Xcode. Use `fixture` mode for the default local path and `local` mode to talk to `http://127.0.0.1:8080`.

Database migration and seed commands refuse production targets by default. Set `ALLOW_LIVE_DATABASE_TASKS=true` only for an intentional live migration or seed operation after verifying `DATABASE_URL`.

See `docs/backend-operations.md` for live backend environment requirements, migration handling, and CI-safe checks.
