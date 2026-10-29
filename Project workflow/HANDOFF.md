# AI Handoff — Current

> **Continuation point (documentation reconciliation 2026-10-23).** The inspected repository HEAD is `6c26b01` (2026-10-21), and the worktree already contains modified and untracked files. Do not overwrite, stage, or assume ownership of those changes. This documentation pass did not run application tests or inspect production.

## Current architecture

- Web: Next.js workspace.
- Mobile: Expo workspace.
- Backend: NestJS + Prisma.
- Database: PostgreSQL 18.
- Clients communicate through the NestJS API.
- Netlify is the documented/canonical web deployment target; production deployment/domain verification is outstanding. Render is the documented backend target, not verified live.

## Current status

- The Oct 20 master audit (baseline `3457db9`, not this worktree) reports backend 48 suites / 567 tests and a 35-route web build; not rerun here.
- Core authentication, project authorization and operational modules are documented as implemented; production-runtime acceptance is not established.
- Mobile repository-side offline work is recorded as implemented; physical device/emulator acceptance remains required.
- OCR is frozen by prior workflow documentation, but its inclusion in the proposed V1 scope is unresolved. Do not reopen it without an explicit decision.
- `PermissionsGuard` activation remains deferred pending an approved permission matrix.
- Production hosting/database/email/storage and end-to-end acceptance remain unverified.

## Canonical continuation references

- Current status and evidence boundary: `CURRENT_STATUS.md`.
- Unresolved issues / owner decisions: `ISSUES.md`.
- Verification snapshots and acceptance gates: `VERIFICATION.md`.
- Decisions and unresolved decision records: `DECISIONS.md`.
- Single proposed V1 execution order: `docs/HIIEKO_IMPLEMENTATION_PLAN.md` (scope itself remains proposed).

## Historical checkpoint retained (2026-10-05)

The prior handoff recorded PR #22 (Netlify runtime configuration), #23/#24 (role-oriented home and UX refinement), #25 (daily-report approval), #26 (frontend permission UX reconciliation), and #27 (Mobile offline-sync hardening) as merged, with obsolete PRs #20/#21 closed. These are historical repository records, not current CI or production acceptance evidence.

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

## Safe next priorities

1. Resolve scope/owner decisions before implementation (especially OCR versus freeze, expense approval rules, authorization divergences, and storage/pilot environment).
2. Obtain authorized access to verify the documented production targets and existing file storage; do not apply migrations or perform a cutover as part of documentation work.
3. Schedule Mobile device/emulator acceptance and record environment, version, steps, and outcome.
4. Follow the proposed execution plan only after the scope baseline and affected decisions are approved.
