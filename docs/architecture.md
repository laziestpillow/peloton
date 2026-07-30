# Architecture

Peloton is a monorepo with a native SwiftUI app and a modular Fastify backend connected through `contracts/openapi.yaml`.

Backend dependency direction:

```text
HTTP routes
  -> application use cases
  -> pure domain logic
  -> repository and gateway interfaces
  -> PostgreSQL / Strava implementations
```

The iOS application can run entirely in fixture mode by decoding API-shaped fixture responses.

