# Security Policy

Report security issues privately to the repository owners.

Do not commit:

- `.env`
- Strava client secrets
- Access or refresh tokens
- Signing certificates
- Provisioning profiles
- Local databases
- Production logs containing sensitive values

The iOS app stores only the Peloton session in Keychain. Strava refresh tokens and client secrets are backend-only.

