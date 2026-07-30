# Agent Guide

Use `PROJECT_BRIEF.md` and `contracts/openapi.yaml` as the primary sources of truth.

Do not duplicate backend scoring or archetype authority in Swift. Fixture mode must consume API-shaped fixture responses.

Before changing backend or iOS implementations that affect the wire contract, update `contracts/openapi.yaml` first and keep fixtures valid.

Never commit secrets, Strava tokens, signing certificates, provisioning profiles, local databases, build outputs, `node_modules`, DerivedData, or Xcode user data.

