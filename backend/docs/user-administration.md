# HIIEKO User Administration and Access Control

## Administrative controls

- User provisioning creates `PENDING`, inactive accounts; approval/activation is a separate administrator operation.
- User status/role changes, permission-grant changes, identity linking, session revocation, and offboarding are backend-authorized and audited.
- Ordinary `ADMIN` actors cannot assign, alter, suspend, link, or manage sessions for `OWNER` users, or grant the `OWNER` role. Explicit `OWNER`-only routes are not covered by the ordinary ADMIN role bypass.
- The role permissions screen edits persisted `RolePermission` assignments. It does not seed or infer grants from role names. Existing ADMIN/OWNER global-role and permission-guard bypasses are retained for compatibility; the grant editor is not offered for those built-in roles.
- Permission grants are role-level, not per-user overrides. A user receives the explicitly stored grants for their assigned role; a separate `UserPermission` model would require a migration and is not part of this phase.
- Provisioned users have no local password by default. After administrator activation, a mobile user can establish a password through the existing password-reset flow; the mobile authentication request itself is unchanged.
- Session administration exposes session metadata only; it never returns access tokens, refresh tokens, or refresh-token hashes.
- Offboarding transfers project memberships and task assignments to an active same-organization replacement, deactivates any associated Employee row, suspends the source user, revokes active sessions/refresh tokens, and preserves user/business records.

## CRM lead reassignment blocker

The current backend schema/source has no CRM Lead model, owner field, or Lead API. `Client` is a customer/company record related to projects and has no employee owner. It is not safe to treat a Client as a lead or to invent lead records. The current offboarding API therefore reports CRM lead reassignment as unavailable. A source system/model and ownership semantics must be identified before lead reassignment can be implemented; a new Lead schema would require a migration proposal and approval.

Project membership and task assignment transfer does not change historical creators, reports, approvals, documents, or other business records. Team membership/leadership and other employee references need a separate ownership inventory before claiming that every user reference has been reassigned.

## Historical access tokens without `sid` — unresolved

The current `JwtAuthGuard` accepts pre-session JWTs without `sid`. Account status is checked on each request, so an inactive user is rejected while inactive, but an old token may work again if the user is reactivated. Session-row revocation cannot identify or revoke a sid-less token. This remains an unresolved security requirement; Phase 3 does not change compatibility behavior.

### Safe proposed solution (schema change; not implemented)

Add an integer `auth_version` to `User`, default `0`. Newly issued HIIEKO JWTs carry an `av` claim. The guard compares it to the current user row. For backwards compatibility, a missing `av` is interpreted as version `0` initially. On suspension/deactivation, offboarding, role/authorization loss, password reset, or administrator revoke-all, increment `auth_version` in the same transaction that updates account state, writes required audit events, and revokes all session/refresh-token rows. That invalidates historical sid-less tokens for that user and keeps them invalid after reactivation. Fresh login—web or the unchanged mobile login request—issues the current version.

This requires an additive Prisma migration and careful rollout/testing. Do not implement or apply it until the migration change is separately reviewed and approved. Individual-session revocation cannot identify a sid-less token; the version bump is reserved for user-wide revocation. A controlled reauthentication/sunset plan is still needed for any remaining sid-less tokens not associated with a user-wide revoke.

## Entra deployment gates

Keep both `ENTRA_ENABLED` and `ENTRA_LINKING_ENABLED` false until the existing Microsoft identity migration and deployment configuration are independently verified and approved. `NEXT_PUBLIC_ENTRA_LINKING_ENABLED` only controls the admin linking UI; it does not enable OIDC sign-in.
