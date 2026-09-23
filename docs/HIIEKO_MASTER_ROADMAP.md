# HIIEKO Master Roadmap for Cline

**Version:** 1.0  
**Date:** 2026-09-23  
**Purpose:** Single execution roadmap for Cline that reconciles the current repository state, the active NestJS/PostgreSQL migration, the dual-write transition, and the target-state HIIEKO application specification.

---

## 1. What this roadmap changes

The earlier **HIIEKO Application Gap & Build Specification** remains the target-state capability specification.

This document is the **execution roadmap**.

Cline must NOT treat every missing gap as immediate development work. The repository is already in an active migration from legacy Supabase-backed runtime paths toward NestJS + Prisma + PostgreSQL, using adapters and dual-write during the transition.

### Source-of-truth order for implementation

1. Existing source code and migrations
2. Current `PROGRESS.md`, `ISSUES.md`, `TODO.md`, `VERIFICATION.md`
3. Existing tests and runtime evidence
4. `docs/HIIEKO_Application_Gap_and_Build_Specification_v1.0.docx`
5. This roadmap as the execution reconciliation layer

When sources conflict, stop and record a decision. Never silently replace the active migration strategy.

---

## 2. Current state: what is already DONE

### Milestone R0 — Repo stabilization
**Status: DONE.**

The current progress record marks R0 complete, including the previously identified issues around dashboard queries, mobile authentication bypass, mobile submission persistence, gitignore hygiene, OCR documentation references, pytest support, SQL header drift and encoding cleanup.

### Milestone R1 — NestJS foundation
**Status: DONE.**

R1.1–R1.5 are complete. This includes:

- NestJS workspace and root scripts
- JWT guard and authorization foundation
- health/profile/auth endpoints
- NestJS API client seam
- Supabase compatibility adapters
- standardized error envelope and 401/403/404/422/500 contract tests

### Current backend/data foundation

Preserve the confirmed runtime:

`Web + Mobile → NestJS :4000 → Prisma 5.22 → PostgreSQL 14 :5433`

The local Prisma migration is applied and the PostgreSQL schema is in sync. Do not rebuild this foundation.

### Mobile authentication
**Status: DONE at foundation level.**

The mobile demo-user bypass has been removed. Real login/auth state is wired through `AuthContext`, with logout and offline cached-user behavior.

### Mobile persistence / offline queue
**Status: PARTIALLY DONE, materially improved.**

The real SQLite sync queue is now used by attendance, daily reports, expenses and delivery intake. Idempotency and auto-sync are already part of the implementation.

The remaining gap is **full conflict/error/retry semantics**, not basic persistence.

### Attendance
**Status: IN MIGRATION / VERIFICATION.**

The new attendance backend is substantially implemented. Current migration adds best-effort legacy `time_logs` dual-write while `attendance_records` remains primary.

### Daily reports
**Status: CORE BACKEND/UI FUNCTIONAL; DUAL-WRITE STILL REQUIRED.**

The current progress record marks the PostgreSQL daily reports integration as complete, but R2.4 still requires legacy compatibility dual-write and end-to-end verification.

### Daily plan workflow
**Status: IMPLEMENTED; REQUIRES REGRESSION VERIFICATION.**

The repository now contains a draft/published/completed/cancelled daily-plan workflow, task assignment lookup, task progress updates, audit integration and role-gated endpoints.

### Control Tower / existing domains
Preserve and extend existing working functionality. Do not recreate it as a new dashboard.

### OCR
**Status: IMPLEMENTED IN SOURCE; PRODUCTION ARCHITECTURE STILL OPEN.**

PaddleOCR path, Romanian normalization, e-Factura support and validation exist. The live storage/proxy architecture still has legacy Supabase/Edge Function elements and must be explicitly decided before final cut-over.

---

## 3. What is CURRENTLY being migrated

### R2 — Core Operations Dual-Write
**Overall status: IN PROGRESS.**

| Order | Package | Current status | Cline action |
|---|---|---|---|
| R2.2 | Attendance | In progress | Finish E2E verification; prove new + legacy writes and offline/idempotency behavior |
| R2.4 | Daily Reports | Not started for dual-write | Add legacy compatibility write + mapping + E2E verification |
| R2.5 | Notifications / Audit | Not started for dual-write | Map legacy records, verify audit/notification consistency |
| R2.3 | Stock + Avize | Not started | Inspect current mapping, migrate/verify without duplicating inventory logic |
| R2.1 | Sites → Projects | Not started; largest schema change | Produce migration plan first; then implement controlled schema/data/API migration |

### R2 execution rule

Do not jump from R2 into a large new capability simply because it is listed as a gap in the target specification.

R2 exists to prove that the new NestJS/PostgreSQL system can coexist safely with the existing application while preserving data and behavior.

---

## 4. Immediate next actions

### NOW — R2.2 Attendance

Cline must finish and verify:

1. authenticated mobile/web login
2. online check-in
3. `attendance_records` creation
4. legacy `time_logs` compatibility write
5. check-out
6. legacy check-out update
7. GPS/geofence validation
8. duplicate/conflict prevention
9. offline queue creation
10. sync after reconnect
11. idempotent retry
12. audit trail
13. error behavior when the legacy write fails

**Exit condition:** all relevant backend tests pass and a real PostgreSQL E2E run proves both primary and legacy states are correct.

### NEXT — R2.4 Daily Reports

Preserve the current daily-report implementation. Add the required legacy compatibility mapping and verify online/offline/idempotent behavior.

### NEXT — R2.5 Notifications / Audit

Do not create a new notification framework if one already exists. Reconcile the current NestJS records with the legacy representation, then verify event delivery and audit consistency.

### NEXT — R2.3 Stock + Avize

Preserve the existing stock invariants, especially **no negative stock**. Add legacy compatibility only where required. Verify delivery-note creation, stock movements and sync behavior.

### NEXT — R2.1 Sites → Projects

This is the major schema migration. Before editing the schema, create:

`docs/R2.1_SITES_PROJECTS_MIGRATION_PLAN.md`

It must contain:

- current schema
- target schema
- affected models/tables
- foreign keys/indexes
- legacy field mappings
- API changes
- web/mobile impact
- data migration order
- rollback plan
- verification queries/tests

Do not implement R2.1 blindly.

---

## 5. What comes AFTER R2 but BEFORE final cut-over

The exact repository-specific R3–R6 milestone names are not established in the supplied progress record. Cline must use the repository's own milestone documents if they exist and must not invent milestone IDs.

The following are **capability gates**, not invented milestone names.

### Gate A — Authorization and scope alignment

The application target state requires role + organization + project/site scope + action permission.

Resolve:

- `team_leader` vs formal `Foreman`
- project/site membership model
- Site Manager scope / shift model
- approval authority matrix
- external user ownership model

Do not perform a destructive role rewrite while R2 migration is active. First establish a compatibility mapping and tests.

### Gate B — Mobile production readiness

Mobile authentication foundation is done. Before cut-over, finish:

- token/session refresh
- session expiry behavior
- role-aware navigation
- permission-aware actions
- retry semantics
- sync failure states
- conflict handling
- durable idempotency
- device/version diagnostics

### Gate C — Data integrity and migration observability

Every migrated domain must have:

- source → target field mapping
- duplicate prevention
- reconciliation checks
- failure logging
- rollback/repair procedure
- audit evidence

### Gate D — OCR and file architecture decision

Before final cut-over, management/technical owner must explicitly choose:

- file/object storage provider
- private access mechanism
- OCR request path
- whether Supabase Edge Function remains temporarily
- final NestJS-owned path, if required

No silent architecture migration.

### Gate E — Production infrastructure

Before final cut-over:

- staging environment
- production environment
- migration rehearsal
- backup/restore test
- secrets management
- monitoring/logging
- error tracking
- health/readiness endpoints
- release/rollback procedure
- production smoke suite

---

## 6. What SHOULD NOT be built as large new features before cut-over unless explicitly pulled forward

The target-state gap document contains many capabilities that are valid but not necessary to destabilize the migration. The following should generally wait until the core migration is stable and the cut-over plan is approved:

### Postponed business-expansion features

- full Project Manager financial/control layer (budget, forecast, variations, risks/issues beyond existing Control Tower needs)
- full procurement workflow: material request → quotation → comparison → PO → approval → receipt
- advanced stock traceability, tools and asset custody
- complete HSE module
- full quality / punch-list module
- RFI / technical change workflow
- subcontractor management
- client/stakeholder communication workflows
- full project document management/versioning
- commissioning / EPC handover / O&M asset management
- Commercial → Project formal handover workflow

These are **target-state backlog items**, not reasons to interrupt R2 migration.

### Exception
A feature may be pulled forward only when it is required to:

- protect data integrity,
- complete an active migration,
- unblock a critical production workflow,
- close a confirmed security/control defect,
- or satisfy a formally approved business priority.

If pulled forward, record the reason in `docs/HIIEKO_IMPLEMENTATION_DECISIONS.md`.

---

## 7. Final cut-over preparation

The final cut-over is a migration event, not a normal feature release.

### Required pre-cut-over checklist

- [ ] All R2 domain dual-writes verified
- [ ] R2.1 Sites → Projects migration complete and reconciled
- [ ] All critical API contracts stable
- [ ] Web uses NestJS as primary
- [ ] Mobile uses NestJS as primary
- [ ] Legacy mappings documented
- [ ] Data reconciliation reports pass
- [ ] No unacceptable data drift
- [ ] Authentication/session lifecycle validated
- [ ] Offline sync validated
- [ ] OCR/file architecture decision resolved
- [ ] Staging migration rehearsal passed
- [ ] Backup restore tested
- [ ] Monitoring/alerts configured
- [ ] Rollback procedure tested
- [ ] Critical journey suite passes
- [ ] Security/scope tests pass
- [ ] Production smoke suite prepared
- [ ] Cut-over owner and rollback owner assigned

### Cut-over sequence

1. freeze schema-changing feature work
2. complete final reconciliation
3. drain/synchronize pending legacy-compatible operations
4. take verified backup/snapshot
5. apply production migrations
6. switch traffic/configuration to NestJS/PostgreSQL primary path
7. run smoke tests
8. monitor critical journeys and error rates
9. keep a controlled rollback window
10. formally record cut-over completion

Do not delete legacy infrastructure during this event.

---

## 8. What happens AFTER final cut-over

### Post-cut-over Wave 1 — Legacy retirement

Only after stable operation:

- remove unused Supabase runtime adapters
- remove obsolete legacy client paths
- remove dead environment variables
- remove legacy API calls/imports
- remove temporary dual-write code
- remove legacy tables only after formal retention/data-archive decision
- add static checks preventing reintroduction of legacy runtime dependencies

This is the target **GAP-18** phase.

### Post-cut-over Wave 2 — Complete business capabilities

Then implement the remaining target-state gaps in controlled product waves:

1. role/permission hardening
2. PM control layer
3. procurement
4. stock/assets
5. HSE
6. quality
7. RFI/technical changes
8. document management
9. subcontractors
10. client/stakeholder workflows
11. commissioning/handover/O&M
12. commercial handover

Exact ordering may change after cut-over if business priorities change, but dependencies in the target specification must be respected.

### Post-cut-over Wave 3 — Full UAT / production hardening

Complete:

- full end-to-end test suite
- role-by-role UAT
- real-device mobile tests
- offline/online transitions
- OCR/camera flows
- concurrency/integrity testing
- security testing
- performance baselines
- backup/restore rehearsal
- disaster recovery runbook
- deployment documentation

---

## 9. Status of the 21 target gaps against the current roadmap

| Gap | Current treatment |
|---|---|
| GAP-01 Role & permission redesign | **Compatibility/decision now; full hardening after core migration** |
| GAP-02 Daily planning & task assignment | **Already materially implemented; verify and extend after R2 stabilization** |
| GAP-03 PM control layer | **Post-cut-over business expansion unless needed earlier** |
| GAP-04 Procurement/material requests | **Post-cut-over business expansion; preserve existing Avize/logistics path during R2** |
| GAP-05 Stock/tools/assets | **Stock migration now; advanced traceability/assets later** |
| GAP-06 HSE | **Post-cut-over** |
| GAP-07 Quality/punch list | **Post-cut-over** |
| GAP-08 RFI/technical changes | **Post-cut-over** |
| GAP-09 Documents | **Architecture decision before cut-over; full module later** |
| GAP-10 Subcontractors | **Post-cut-over** |
| GAP-11 Client/stakeholder communications | **Post-cut-over** |
| GAP-12 Commissioning/handover/O&M | **Post-cut-over** |
| GAP-13 Mobile authentication | **DONE at foundation level; harden session lifecycle before cut-over** |
| GAP-14 Offline sync/conflict handling | **Partially done; complete reliability before cut-over** |
| GAP-15 Expense + OCR | **Core exists; complete live/deploy architecture + full workflow before production cut-over** |
| GAP-16 Notifications | **Existing backend; finish migration/dual-write before cut-over** |
| GAP-17 Audit/security governance | **Core AuditService exists; expand coverage before cut-over** |
| GAP-18 Legacy runtime removal | **WAIT until after final cut-over** |
| GAP-19 Production/deployment/observability | **Must be completed before production cut-over** |
| GAP-20 Full E2E/UAT | **Must be completed as release gate before production** |
| GAP-21 Commercial → Project handover | **Post-cut-over unless approved earlier as a business dependency** |

---

## 10. Non-negotiable engineering rules for Cline

- Preserve working functionality.
- Do not rebuild completed foundations.
- Do not delete legacy paths while dual-write is active.
- NestJS/PostgreSQL is the new primary path; Supabase is transitional compatibility until formal cut-over.
- Use Prisma migrations for schema changes.
- Do not create duplicate concepts when an existing model can be extended safely.
- Enforce authorization server-side.
- Preserve no-negative-stock and no-self-approval rules.
- Use database transactions for multi-record financial/stock/approval transitions.
- Make mobile sync idempotent.
- Record before/after audit information for high-risk changes.
- Do not add mock/fallback runtime data to hide missing functionality.
- Do not invent R3–R6 milestone definitions when the repository does not document them.
- Every completed item must have tests and updated project documentation.

---

## 11. Required Cline workflow

For every task:

1. Read current progress/docs.
2. Inspect actual code before deciding status.
3. Identify whether the task is migration work, cut-over readiness, or post-cut-over feature work.
4. Make the smallest safe change.
5. Add/update tests.
6. Run typecheck/build/tests relevant to the change.
7. Update `PROGRESS.md` and the appropriate decision/migration document.
8. Do not move to the next migration package until the current package meets its exit criteria.

### Required tracking files

Maintain:

- `docs/HIIEKO_MASTER_ROADMAP.md`
- `docs/HIIEKO_IMPLEMENTATION_DECISIONS.md`
- `docs/HIIEKO_SPEC_RECONCILIATION.md`
- `docs/HIIEKO_TEST_MATRIX.md`
- `docs/HIIEKO_DEPLOYMENT_READINESS.md`

---

## 12. Cline starting instruction

> Read `docs/HIIEKO_MASTER_ROADMAP.md` before making code changes.
>
> Treat the current repository and `PROGRESS.md` as the implementation reality. Treat `docs/HIIEKO_Application_Gap_and_Build_Specification_v1.0.docx` as the target state. Do not restart the application or implement the target-state gaps blindly.
>
> Finish the active R2 migration first. The immediate task is R2.2 Attendance E2E verification, including PostgreSQL primary write, legacy `time_logs` compatibility write, check-out, offline sync, idempotency, geofence/conflict behavior and audit. After R2.2 passes, continue the documented R2 sequence.
>
> Do not remove Supabase adapters or legacy paths while dual-write is active. Do not invent undocumented R3–R6 milestone names. Before any large schema migration, create a migration plan and verify the data mapping.
>
> When R2 is complete, move to cut-over readiness: authorization/scope alignment, mobile sync reliability, OCR/file architecture decision, production infrastructure, reconciliation, backup/restore, observability, security tests and full critical-journey verification.
>
> Only after formal final cut-over should legacy runtime removal begin. Only then should the larger post-cut-over business capabilities in the HIIEKO specification be implemented as new product waves.
>
> Keep the repository runnable after every change and update the roadmap/progress/decision/test documents continuously.

---

## 13. Definition of “on track”

The project is on track when:

- R2 migration packages are completed without data drift;
- NestJS/PostgreSQL becomes the verified primary system of record;
- dual-write is temporary, observable and removable;
- production cut-over has a tested rollback path;
- legacy removal happens only after cut-over;
- target-state business modules are added after the migration foundation is stable;
- documentation always reflects what the repository actually does.
