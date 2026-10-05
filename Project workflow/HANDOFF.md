# AI Handoff — Current

> **Authoritative current continuation point.** Historical session notes remain in Git history and older documents, but the snapshot below reflects the current repository state as of 2026-10-05.

## Current architecture

- Web: Next.js workspace.
- Mobile: Expo workspace.
- Backend: NestJS + Prisma.
- Database: PostgreSQL 18.
- Clients communicate through the NestJS API.
- Netlify is the canonical web deployment path. Vercel is not the deployment authority.

## Current status

- Core remediation slices 1–7: complete.
- CI enforcement: active.
- Daily report approval workflow: complete (PR #25).
- Mobile offline-sync correctness hardening: complete (PR #27, merged).
- Frontend permission UX reconciliation: complete (PR #26 merged).
- OCR: intentionally frozen/deferred.
- Granular PermissionsGuard runtime activation: intentionally deferred.
- Production deployment verification: still required.
- Physical Mobile device/emulator acceptance: still required.

## Recent merged work

- PR #22 — Netlify runtime configuration.
- PR #23 — role-based v0 field home.
- PR #24 — production UX refinement.
- PR #25 — daily report approval workflow.
- PR #27 — Mobile offline sync hardening.

## Obsolete PR cleanup

- PR #20 — closed; superseded by the merged Netlify configuration work.
- PR #21 — closed; superseded by the merged frontend v0 work.
- PR #26 — merged; frontend permission UX reconciliation is complete.

## Mobile acceptance still outstanding

Repository-side Mobile work is substantially complete. Remaining acceptance is runtime validation on an emulator/device:

1. login/logout and role-based navigation
2. attendance + GPS/geofence
3. daily report creation/submission
4. expense and delivery flows
5. offline queue → reconnect → sync
6. notification/settings flows
7. hardware-dependent camera/barcode behavior

Do not claim device acceptance until it is actually run.

## Next priority

1. Verify canonical Netlify production deployment/domain.
2. Perform the final Mobile emulator/device acceptance pass.
4. Keep OCR and granular permission activation frozen unless explicitly reopened.
