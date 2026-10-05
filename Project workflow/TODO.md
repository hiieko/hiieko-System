# TODO — Current Work Queue

Last Updated: 2026-10-05

> This file is now a **current-work queue**. Historical Supabase-era TODOs are intentionally not actionable here; the migration is complete and those records remain in repository history/documentation only.

## Active

- [ ] **Production deployment verification** — verify the canonical Netlify production deployment/domain and document the result.
- [ ] **Mobile acceptance** — run the Android/iOS emulator or physical-device smoke test, including offline → reconnect → sync, GPS, and hardware-dependent flows.

## Deferred / Explicitly Frozen

- [ ] **OCR** — intentionally frozen; do not reopen unless explicitly requested.
- [ ] **Granular PermissionsGuard activation** — governance/catalog work is complete; runtime activation remains intentionally deferred pending a complete business permission matrix.
- [ ] **Production monitoring / rollback automation** — requires deployment-provider credentials/configuration.

## Completed Recently

- [x] **Mobile offline sync hardening** — PR #27 merged; pending-sync indicator now reads the SQLite queue and unsupported issue sync cannot be falsely acknowledged.
- [x] **Daily report approval workflow** — PR #25 merged.
- [x] **Frontend role-oriented v0 home** — PR #23/PR #24 merged; obsolete PR #21 closed.
- [x] **Netlify runtime configuration** — PR #22 merged; obsolete PR #20 closed.
- [x] **Frontend permission UX reconciliation** — PR #26 merged after green CI.
- [x] **Documentation reconciliation** — current status, handoff, progress, verification, and TODO reconciled.

## Historical Records

Supabase-era deployment, OCR-service, Edge Function, and legacy issue lists are preserved in historical documents/commits. They are not current implementation tasks.
