# Project Brief

The authoritative product and engineering brief is the handoff document supplied at repository creation. It defines the MVP, API boundaries, Strava security constraints, domain model, testing requirements, and implementation order.

Key rules:

- The OpenAPI document in `contracts/openapi.yaml` is the shared boundary.
- iOS owns navigation, presentation, local state, avatar rendering, recap playback, accessibility, and fixture/live API selection.
- Backend owns identity, Strava integration, persistence, normalization, scoring, standings, archetypes, authorization, and durable results.
- Riders may customize appearance, but performance archetypes are derived from results.
- Shape and strength remain independent.
- Strava client secrets never ship in iOS code, fixtures, logs, or client requests.

