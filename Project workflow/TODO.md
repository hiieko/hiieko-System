# TODO — Consolidated Action Index

Last reconciled: 2026-10-23. This is an index into the canonical issue and plan documents, not an independent project plan. No task below is marked complete by this documentation update.

## Evidence / operator acceptance outstanding

- [ ] Verify the documented Render backend, production database/migration state, email, and persistent file storage using an authorized release environment; record evidence without applying migrations as part of this task.
- [ ] Inventory existing files and verify authorized upload/download plus persistence/recovery before any storage cutover.
- [ ] Run and record deployed end-to-end acceptance after the environment is established.
- [ ] Run Mobile emulator/device acceptance: restart persistence, offline capture, reconnect/sync and duplicate safety, GPS permissions/location, and applicable camera/barcode behavior.

## Decisions required before affected implementation

- [ ] Reconcile OCR's existing frozen status with its inclusion in proposed `docs/V1_SCOPE.md`; no OCR work until decided.
- [ ] Approve expense approver roles, statuses, rejection/resubmission rules, and self-approval policy.
- [ ] Decide offline conflict/retry policy and supported stock/delivery states.
- [ ] Resolve authorization divergences and the permission-matrix prerequisites for `PermissionsGuard` activation.
- [ ] Confirm internal pilot environment, size/timing, existing production storage, and whether production monitoring/rollback is in scope.

## Canonical tracking

- Implementation issues and audit findings: `ISSUES.md`.
- Verification gates/evidence: `VERIFICATION.md`.
- Decisions and their status: `DECISIONS.md`.
- One proposed V1 execution sequence: `docs/HIIEKO_IMPLEMENTATION_PLAN.md`.
- Previous queue/status snapshots remain in Git history; no source file is deleted by this consolidation.
