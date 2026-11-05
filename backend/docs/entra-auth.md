# HIIEKO Microsoft Entra Authentication

## Configuration

Set these values in the backend deployment secret/configuration store; never commit credentials:

- `ENTRA_ENABLED=true` to enable the web OIDC endpoints.
- `ENTRA_LINKING_ENABLED=true` only after the existing identity migration and tenant configuration are separately verified. This can enable explicit admin linking while sign-in remains disabled.
- `ENTRA_TENANT_ID`: the approved HIIEKO tenant GUID (single tenant only).
- `ENTRA_CLIENT_ID`: the web application registration's client/application GUID.
- `ENTRA_CLIENT_SECRET`: confidential web application credential; prefer a certificate or managed secret mechanism where supported.
- `ENTRA_REDIRECT_URI`: exact backend callback, `/api/auth/entra/callback`.
- `ENTRA_STATE_SECRET`: cryptographically random secret of at least 32 bytes, shared by backend replicas.
- `PUBLIC_APP_URL`: trusted HIIEKO web origin.
- `NEXT_PUBLIC_ENTRA_ENABLED=true` in the web build to show Microsoft sign-in and route company-domain web login through Entra.
- `NEXT_PUBLIC_ENTRA_LINKING_ENABLED=true` to show the administrator linking form; keep it false until the backend migration/configuration is verified.

Register a single-tenant **Web** application. Configure the exact callback URI above and use authorization-code flow with PKCE. The implementation requests only `openid profile email`; it does not request Graph permissions or persist Microsoft tokens. Keep production callback and web URLs on HTTPS. Localhost HTTP is permitted only outside production.

The callback validates tenant-specific discovery metadata, token signature via Microsoft JWKS, RS256 algorithm, issuer, audience/authorized party, expiry/not-before, nonce, tenant ID, immutable object ID, and `@hiieko.ro` email. The verified object ID must already be linked to an active HIIEKO user. Email matching never creates or links an account.

When Entra is enabled, password login marked `client: web` is rejected for `@hiieko.ro` accounts. The legacy mobile request format is unchanged. That format cannot cryptographically prove a request came from an installed mobile app; direct API clients may still attempt the legacy password path. Do not treat the web UI or client discriminator as mobile-app attestation.

## Administrator linking

Provision and activate the HIIEKO user first. An `ADMIN` or `OWNER` then calls `POST /api/users/:id/microsoft-identity` with the user's Entra object ID, confirmed from the approved tenant directory. Linking is limited to an active `@hiieko.ro` user in the administrator's organization. The first sign-in does not create or activate an account.

## One-time initial Super Administrator bootstrap

The bootstrap script is an operator-only procedure and must run from a protected deployment console with two different named approvers. It requires an existing active `@hiieko.ro` HIIEKO user and the operator-verified tenant/object-ID pair. It serializes concurrent attempts, checks a persistent audit latch, links the identity, grants the existing `OWNER` role, and writes the latch in one transaction.

Required one-time environment settings:

- `HIIEKO_SUPER_ADMIN_BOOTSTRAP_ENABLED=true`
- `ENTRA_TENANT_ID`
- `HIIEKO_SUPER_ADMIN_USER_ID`
- `HIIEKO_SUPER_ADMIN_OBJECT_ID`
- `HIIEKO_SUPER_ADMIN_OPERATOR`
- `HIIEKO_SUPER_ADMIN_APPROVER` (must differ from operator)

Run `npx ts-node --transpile-only scripts/bootstrap-super-admin.ts` only after the approved operational change window. The script prompts for interactive confirmation. Immediately disable/remove all bootstrap settings afterward. A repeated invocation is blocked by the audit latch. The script was not run as part of development or testing.

## Operational limitations

- Do not enable Entra sign-in until the existing `microsoft_identity_links` migration has been applied through an explicitly approved deployment. This implementation does not apply migrations or inspect database state.
- Entra account disablement does not itself revoke an existing HIIEKO session. Deploy a separately approved Entra provisioning/deprovisioning integration to suspend the HIIEKO account and revoke sessions.
- Historical HIIEKO access tokens without a `sid` remain an unresolved security requirement. This implementation does not claim to revoke or otherwise solve them.
- Mobile password authentication is unchanged. Entra OIDC is for the company web login.
