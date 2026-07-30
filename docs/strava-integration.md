# Strava Integration

The iOS app requests an authorization URL from the Peloton backend, opens Strava authorization through the app or `ASWebAuthenticationSession`, and receives completion through a deep link after the backend callback.

The backend stores OAuth state, exchanges codes with the server-side client secret, encrypts refresh tokens, refreshes access tokens, handles webhooks, and never logs tokens.

New development environments should use `MockStravaGateway` until real Strava credentials are configured.

