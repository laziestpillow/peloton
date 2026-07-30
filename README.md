# Peloton

Peloton turns group cycling activities into a Tour-style race experience. Riders connect Strava, import completed rides, compete across sprint and climb markers, watch an animated recap, and accumulate season-long classification points.

The first development path is fixture-first: no Strava credentials are required to build the backend, open the iOS app, or exercise the primary product journey.

## Toolchain

- Node.js: 24.x Active LTS
- pnpm: 11.18.0
- TypeScript: 7.0.2
- Fastify: 5.10.0
- Drizzle ORM: 0.45.2
- Zod: 4.4.3
- Vitest: 4.1.10
- Xcode: 26.6 stable
- Swift: 6.3, Swift language mode 6
- Swift OpenAPI Generator: 1.11.1
- swift-openapi-urlsession: 1.3.0

## Quick Start

```bash
cp .env.example .env
make bootstrap
make database
make seed
make api
```

Open `apps/ios/Peloton.xcodeproj` in Xcode and run the Peloton scheme in `fixture` mode. The placeholder bundle identifier is `com.example.peloton`; replace it with the production identifier and signing team before device or TestFlight builds.

## Commands

```bash
make bootstrap       # install tool dependencies
make database        # start PostgreSQL
make seed            # seed deterministic development data
make api             # run the backend
make lint            # lint backend and scripts
make test            # run available tests
make contract-check  # validate OpenAPI and fixtures
```

## Fixture vs Live Development

Fixture mode reads deterministic JSON responses from `contracts/fixtures`. It is the default path and does not require Strava credentials.

Live mode talks to the backend. The iOS client never calls Strava directly and never contains a Strava client secret. Strava credentials belong only in backend environment variables or a deployment secret manager.

## Repository Layout

- `apps/ios`: SwiftUI application shell and Xcode project.
- `packages/ios`: local Swift packages for core models, API client composition, design system, and fixtures.
- `services/api`: Fastify TypeScript backend.
- `contracts`: OpenAPI 3.1 contract and API-shaped fixtures.
- `prototype`: preserved visual reference location.
- `infra`: local infrastructure.
- `docs`: architecture and operating documentation.

## Known Local Prerequisites

This repository expects full Xcode, not only Command Line Tools, for `xcodebuild`. If needed:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Use Corepack to activate pnpm if it is not installed:

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
```
