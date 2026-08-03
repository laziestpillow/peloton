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

For staging verification, use `docs/staging-smoke-checklist.md`.

## Stage Catalog Import

Live mode can maintain seasons and stages without fixture seed data through a validated operational import:

```bash
cd services/api
pnpm stage-catalog:import ./catalog.json
```

The catalog shape is:

```json
{
  "seasons": [
    {
      "id": "season-2026-summer",
      "groupId": "group-001",
      "name": "Summer Series",
      "startsAt": "2026-07-01T00:00:00.000Z",
      "endsAt": null
    }
  ],
  "stages": [
    {
      "id": "stage-barcelona-hills",
      "seasonId": "season-2026-summer",
      "name": "Barcelona Hills",
      "scheduledAt": "2026-07-18T07:30:00.000Z",
      "status": "scheduled",
      "route": {
        "distanceMeters": 42195,
        "elevation": [
          { "positionMeters": 0, "altitudeMeters": 35 },
          { "positionMeters": 42195, "altitudeMeters": 88 }
        ]
      },
      "orderedMarkers": [
        {
          "id": "marker-sprint-001",
          "type": "sprint",
          "positionMeters": 12000,
          "latitude": 41.39,
          "longitude": 2.16,
          "geofenceRadiusMeters": 25,
          "category": null,
          "pointsSchedule": [20, 17, 15, 13, 11]
        }
      ]
    }
  ]
}
```

The import runs migrations first, upserts seasons and stages, replaces route elevation points, upserts ordered markers, and removes stale markers only when they are not referenced by existing marker crossings. In staging or production, set `ALLOW_LIVE_DATABASE_TASKS=true` only for the import command after verifying `DATABASE_URL`.
