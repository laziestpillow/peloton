# Strava Integration

The iOS app requests an authorization URL from the Peloton backend, opens Strava authorization through the app or `ASWebAuthenticationSession`, and receives completion through a deep link after the backend callback.

The backend stores OAuth state, exchanges codes with the server-side client secret, encrypts refresh tokens, refreshes access tokens, handles webhooks, and never logs tokens.

New development environments should use `MockStravaGateway` until real Strava credentials are configured.

External beta and public multiplayer sharing are blocked by the compliance policy in [strava-compliance.md](strava-compliance.md). Raw Strava imports are self-only; shared group views must use Peloton-native race state.
