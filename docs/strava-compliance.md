# Strava Compliance Review

This review blocks external beta and public multiplayer sharing until the implementation tickets below are complete or product explicitly waives the risk.

## Reviewed Sources

- Strava API Agreement, effective June 1, 2026: https://www.strava.com/legal/api?hl=en
- Strava API Policy, effective June 1, 2026: https://www.strava.com/legal/api_policy
- Strava API Brand Guidelines, last revised September 29, 2025: https://developers.strava.com/guidelines/
- Strava rate limit guidance: https://developers.strava.com/docs/rate-limits/
- Strava API changelog: https://developers.strava.com/docs/changelog/
- Strava help article about third-party data display restrictions: https://support.strava.com/en-us/articles/15401608-api-agreement-update-how-data-appears-on-3rd-party-apps

## Policy

Raw Strava Data is self-only in Peloton. Imported activity summaries, provider activity IDs, route summaries, streams, maps, polylines, geolocation samples, tokens, webhook events, and activity metadata must be displayed or disclosed only to the Strava user who authorized that data.

Shared group experiences may display Peloton-native race state derived from the user's authorized activity:

- Rider profile fields created in Peloton, including display name and appearance.
- Stage ranking, marker ranking, points, jersey leaders, finish times, and season standings.
- Recap positions on the Peloton stage route, provided they do not reveal another rider's original Strava route, map, polyline, raw stream, or source activity metadata.
- Stage and marker definitions created by Peloton.

Shared group experiences must not display another rider's original Strava activity, map, route, polyline, segments, leaderboard data, detailed metrics, provider IDs, or links to source Strava activities unless Strava has explicitly approved that use case.

## Current Implementation Boundary

The OpenAPI contract already exposes two different categories:

- `/v1/activities` and `/v1/activities/{activityId}` return `ImportedActivity`, including `provider`, `providerActivityId`, activity metrics, and `routeSummary`. Treat these endpoints as self-only Strava import views.
- `/v1/stages/{stageId}/recap`, `/v1/stages/{stageId}/results`, and season standings return normalized race state. Treat these as the only data allowed in group views.

The backend persists raw Strava-derived data in `imported_activities` and `activity_stream_samples`, then materializes Peloton-native race outputs in stage result, marker crossing, classification, standing, and archetype tables. Any future API that mixes these categories must update `contracts/openapi.yaml` first and document the privacy boundary.

## Consent And User Control

Before Strava authorization, the app must tell users:

- What Peloton collects: Strava activity summaries, route summaries, activity streams needed for stage matching, athlete identity needed to maintain the connection, OAuth tokens, and webhook events.
- How Peloton uses it: importing rides, matching rides to stages, calculating Peloton results, producing recaps, and maintaining the Strava connection.
- What Peloton shares: Peloton-native race results may appear in group views; raw Strava activity data remains self-only.
- How to disconnect Strava.
- How to request export or deletion of stored data.
- How to contact support.

The Strava client secret, OAuth tokens, refresh tokens, authorization codes, webhook verify token, and token encryption key must remain backend-only and must never appear in iOS code, fixtures, logs, Git history, or client requests.

## Disconnect, Deletion, And Retention

Peloton must support these controls before external beta:

- Disconnect Strava and revoke local access tokens.
- Delete or anonymize all stored Strava Data for a user when the user requests deletion, disconnects in a way that requires deletion, or deauthorizes Peloton from Strava.
- Reflect Strava activity deletes and privacy removals expeditiously and within 48 hours.
- Keep Strava cache data for no longer than seven days unless Strava explicitly permits longer retention for the registered use case.
- Record deletion completion in an auditable operations path without logging secrets.

## Attribution And Brand

Use Strava attribution only as allowed by the Strava API Brand Guidelines:

- The connect button must follow Strava's OAuth and brand requirements.
- Original Strava data displayed to the connected user needs appropriate Strava links or labels.
- Group race results must not imply Strava sponsorship, approval, or endorsement.
- Garmin attribution is required when displaying data that is derived from Garmin-sourced activity data returned through Strava.

## Prohibited Uses

Peloton must not use Strava API Materials or Strava Data for:

- AI, machine learning, or similar model training.
- Targeted advertising or advertising content.
- Analytics, customer insight generation, unrelated product improvement, or benchmarking.
- Replicating, imitating, or competing with Strava functionality.
- Combining Strava Data with unrelated customer data.
- Displaying Strava Data for one user to another user without explicit Strava approval for the use case.

## Operational Notes

Strava access is discretionary and subject to app capacity, endpoint availability, rate limits, and review. Staging should use webhooks and throttled backfills instead of polling. Expanded access requires the Developer Program review path and screenshots that show Strava data usage, the connect button, attribution, and privacy controls.

The June 1, 2026 changelog says Strava is moving the API base URL from `https://www.strava.com/api/v3` to `https://api-v3.strava.com`. Local testing previously observed DNS failures for `api-v3.strava.com`, so the backend should make the API base URL configurable and verify the official base URL in staging before public launch.

## Implementation Tickets

These tickets represent the required follow-up implementation scope:

- Enforce Strava data visibility and retention boundaries.
- Add Strava consent, attribution, disconnect, and deletion UX.
- Make the Strava API base URL configurable and verify the `api-v3.strava.com` migration.
- Complete staging deployment and live smoke checks before external testing.

