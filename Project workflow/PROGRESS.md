# Project Progress

> **Canonical current status document.**
> Historical material has been moved to `archive/PROGRESS_HISTORY.md`.

**Last Updated:** 2026-09-26 (Phase 12 — Worker Final Defect Pass COMPLETE — mojibake fixed, approval button hidden from Worker, checkout projectId added)

---

## Current Status

| Check | Status | Notes |
|-------|--------|-------|
| **Phase 3.2 Authorization Hardening** | ✅ **COMPLETE** | ISSUE-033/034/035 resolved; RoleGuard wired on 8 pages; OWNER management sidebar; project scoping on 13 controllers |
| **Backend Tests** | ✅ **PASS** | 25 suites / 202 tests |
| **db:verify** | ✅ **PASS** | 60/60 checks |
| **Backend Typecheck** | ✅ **PASS** | 0 errors |
| **Shared Typecheck** | ✅ **PASS** | 0 errors |
| **Web Typecheck** | ✅ **PASS** | 0 errors |
| **Backend Build** | ✅ **PASS** | `nest build` exit 0 |
| **Web Build** | ✅ **PASS** | 22 routes, 0 errors |
| **Prisma Validate** | ✅ **PASS** | Schema valid |
| **PostgreSQL 18** | ✅ **Canonical** | `localhost:5432` is the canonical development database |

---

## Milestones

### ✅ Phase 3.2 — Authorization Hardening (COMPLETE)

### ✅ Phase 4 — Solar Configurator Integration (COMPLETE)

### ✅ Phase 11 — Team Leader Role Implementation (COMPLETE)

| Item | Status | Description |
|------|--------|-------------|
| Feature branch inspection | ✅ COMPLETE | origin/feature/solar-configurator inspected — 52 new files, 4 overlapping files identified |
| Integration branch merge | ✅ COMPLETE | integrate/solar-configuration created from master, solar merged, conflicts resolved |
| Post-merge verification | ✅ COMPLETE | All gates pass: backend 25/202 tests, web 22 routes, typechecks, builds, Prisma validate |
| Merge to master | ✅ COMPLETE | Verified integration merged to origin/master at 73d78e8 |
| Documentation | ✅ COMPLETE | All workflow docs updated to reflect Phase 10 state |



### ✅ Phase 12 — Worker Final Defect Pass (COMPLETE)

Live testing revealed real defects in the Worker experience. All fixed:

| Defect | Fix | Status |
|--------|-----|--------|
| Worker Dashboard attendance "Failed to fetch" | Verified `GET /api/attendance/my-logs` works; added `projectId` to checkout calls; endpoint returns correct data | ✅ FIXED |
| /pontaj page — Worker now sees own attendance | WorkerAttendanceView renders for Worker role (already working via role check) | ✅ VERIFIED |
| "Aprobă Raport" button visible to Worker | Wrapped approve button in `{!isWorker && (...)}` guard; Worker now sees read-only report view | ✅ FIXED |
| Mojibake (UTF-8 corruption) in 4 source files | Byte-level fix applied to `translations.ts`, `rapoarte/page.tsx`, `stocuri/page.tsx`, `pontaj/page.tsx` — all corrupted `È›`→`ț`, `È™`→`ș`, `È˜`→`Ș` sequences repaired | ✅ FIXED |
| CURRENT_STATUS.md mojibake | Em dash (—) corruption fixed | ✅ FIXED |
| Check-out missing `projectId` | Added `projectId` to `checkOutAttendance` signature and all call sites | ✅ FIXED |

**Verification:** Web build: 23 pages, 0 errors. Backend tests: 25 suites, 202 tests PASS.


### ✅ Phase 11 — Team Leader Mutation Acceptance Tests (COMPLETE)

Full mutation test matrix executed live against PostgreSQL/NestJS. All authorized mutations succeed with correct HTTP statuses and database persistence. All restricted mutations return 403 FORBIDDEN.

**Test summary: 22/22 tests PASS (14 grants + 8 denials), 25 backend suites / 202 tests, all typechecks PASS**

| Mutation | Endpoint | Result | DB Persisted | Expected | PASS/FAIL |
|----------|----------|--------|-------------|----------|-----------|
| **Tasks** | | | | | |
| Create Task | `POST /api/tasks` | 201 | ✅ | 201 | ✅ PASS |
| Assign Task | `POST /api/tasks/:id/assign` | 201 | ✅ | 201 | ✅ PASS |
| Update Status | `PATCH /api/tasks/:id` | 200 | ✅ | 200 | ✅ PASS |
| Complete Task | `PATCH /api/tasks/:id` | 200 | ✅ | 200 | ✅ PASS |
| **Daily Plans** | | | | | |
| Create Plan | `POST /api/daily-plans` | 201 | ✅ (DRAFT) | 201 | ✅ PASS |
| Publish Plan (denied) | `POST /api/daily-plans/:id/publish` | 403 | ❌ | 403 | ✅ PASS |
| Cancel Plan (denied) | `POST /api/daily-plans/:id/cancel` | 403 | ❌ | 403 | ✅ PASS |
| **Daily Reports** | | | | | |
| Create Report | `POST /api/daily-reports` | 201 | ✅ | 201 | ✅ PASS |
| Reload/Verify | `GET /api/daily-reports/:id` | 200 | ✅ | 200 | ✅ PASS |
| **Stock** | | | | | |
| Receive Stock | `POST /api/inventory/receive` | 201 | ✅ (qty+50) | 201 | ✅ PASS |
| Consume Stock | `POST /api/inventory/consume` | 201 | ✅ (qty-10) | 201 | ✅ PASS |
| Transfer Stock (denied) | `POST /api/inventory/transfer` | 403 | ❌ | 403 | ✅ PASS |
| **Avize** | | | | | |
| Create Aviz | `POST /api/procurement/avize` | 201 | ✅ | 201 | ✅ PASS |
| **Team Members** | | | | | |
| Add Member | `POST /api/teams/:id/members` | 201 | ✅ | 201 | ✅ PASS |
| Remove Member | `DELETE /api/teams/:id/members/:userId` | 200 | ✅ | 200 | ✅ PASS |
| **Expenses** | | | | | |
| Create Expense | `POST /api/expenses` | 201 | ✅ | 201 | ✅ PASS |
| Approve Expense (denied) | `POST /api/expenses/:id/approve` | 403 | ❌ | 403 | ✅ PASS |
| **Team CRUD (denied)** | | | | | |
| Create Team (denied) | `POST /api/teams` | 403 | ❌ | 403 | ✅ PASS |
| Edit Team (denied) | `PATCH /api/teams/:id` | 403 | ❌ | 403 | ✅ PASS |
| **Purchase Orders (denied)** | | | | | |
| Create PO (denied) | `POST /api/procurement/purchase-orders` | 403 | ❌ | 403 | ✅ PASS |

### Worker Denial Test Matrix (TL-only mutations — all return 403)

| Mutation | Endpoint | Result | Expected | PASS/FAIL |
|----------|----------|--------|----------|-----------|
| Create Task (denied) | `POST /api/tasks` | 403 | 403 | ✅ PASS |
| Assign Task (denied) | `POST /api/tasks/:id/assign` | 403 | 403 | ✅ PASS |
| Create Daily Plan (denied) | `POST /api/daily-plans` | 403 | 403 | ✅ PASS |
| Create Aviz (denied) | `POST /api/procurement/avize` | 403 | 403 | ✅ PASS |
| Receive Stock (denied) | `POST /api/inventory/receive` | 403 | 403 | ✅ PASS |
| Add Team Member (denied) | `POST /api/teams/:id/members` | 403 | 403 | ✅ PASS |
| Remove Team Member (denied) | `DELETE /api/teams/:id/members/:userId` | 403 | 403 | ✅ PASS |
| Approve Expense (denied) | `POST /api/expenses/:id/approve` | 403 | 403 | ✅ PASS |

**Test Artifacts:** Task `d337ee20-6324-4597-a9a9-b5de1f4d2a0b` (COMPLETED), Plan `3b197bb9-a6e8-48ac-941c-9eba2e57c7d8` (DRAFT), Report `6ee1222f-47f3-4cbd-8736-994f24f48258`, Aviz `8191e7f2-af69-4f81-bdb0-b5f739065151`, Expense `b71cfa2c-d55f-4f5f-bc01-1e7001d0f1f0` (SUBMITTED).




| Issue | Status | Description |
|-------|--------|-------------|
| ISSUE-033 | ✅ RESOLVED | Project-scope query filtering — all 13 controller/service pairs pass `buildScopedProjectWhere()` into Prisma queries |
| ISSUE-034 | ✅ RESOLVED | Registration whitelist — only WORKER/VIEWER roles can be self-assigned; privileged roles require ADMIN assignment |
| ISSUE-035 | ✅ RESOLVED | Tasks controller — explicit `@Roles()` decorators on all 4 endpoints |
| RoleGuard | ✅ WIRED | Client-side route guard on 8 pages: projects, project detail, teams, workforce, santiere, statistici, aprobare, utilizatori |
| OWNER sidebar | ✅ IMPLEMENTED | OWNER added to management sidebar tier (matching backend global-scope treatment) |
| Project scoping | ✅ IMPLEMENTED | 13 controllers enforce project-scoped data access via `ProjectAccessGuard` |

### ✅ R2.x — Core Operations (ALL E2E VERIFIED)

| Wave | Package | Status | Description |
|------|---------|--------|-------------|
| R2.2 | Attendance | ✅ E2E VERIFIED | Backend complete; 52/52 tests; live PostgreSQL verification |
| R2.3 | Stock + Avize | ✅ E2E VERIFIED | Schema repaired, 5 defects fixed, 30/30 E2E tests |
| R2.4 | Daily Reports | ✅ E2E VERIFIED | Backend complete; 52/52 tests; live E2E |
| R2.5 | Notifications/Audit | ✅ E2E VERIFIED | 12 suites / 65 tests; audit logging, pagination, locale-aware |
| R2.1 | Sites→Projects | ✅ P6 COMPLETE | All 6 phases: Shared contract, Mobile, Web, Cleanup, Authorization, Documentation |

### ✅ Supabase Runtime Removal (COMPLETE)

- Zero `@supabase/*` dependencies in any workspace
- Zero `createClient` / `SUPABASE_*` env var assignments in active source
- Zero Edge Function references in runtime code
- `package-lock.json` has 0 Supabase references
- Legacy DDL archived at `database/archive/supabase-migrations/`

---

## Architecture

```
Web (Next.js) ─┐
               ├──→ NestJS :4000 ──→ Prisma ──→ PostgreSQL 18 :5432
Mobile (Expo) ─┘
```

- All data flows through the NestJS API
- No direct database access from clients
- JWT authentication on all protected endpoints
- Project-scoped authorization via `ProjectAccessGuard`
- Role-based access via `@Roles()` decorators

---

## Open Issues

**All previously tracked issues (ISSUE-001 through ISSUE-035) are RESOLVED, FIXED, or IMPLEMENTED+VERIFIED.**

See [ISSUES.md](ISSUES.md) for the complete list with resolution details.

---

## Known Limitations (non-blocking)

- **`PermissionsGuard` not activated** — The `PermissionsGuard` exists but is not wired into any controller. Permission tables are unseeded. Deferred from P5.
- **`GET /api/procurement/avize/:id` route missing** — The procurement controller lacks this single-aviz retrieval endpoint. Documented in HANDOFF.md.
- **Historical docs reference Supabase** — `HOW_TO_RUN.md`, `CONFIGURATION.md`, and other pre-2026-09-23 documents may still describe Supabase as current runtime. These are harmless historical artifacts.
- **OCR is frozen/deferred** — OCR is not a current workstream. Deferred per project roadmap.
- **No production CI/CD** — No staging/production deployment pipeline configured.

---

## Verification Gates

All quality gates verified as of 2026-09-25:

| Gate | Result |
|------|--------|
| Backend tests (25 suites / 202 tests) | ✅ PASS |
| db:verify (60/60) | ✅ PASS |
| Backend typecheck | ✅ PASS |
| Shared typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| Backend build | ✅ PASS |
| Web build (22 routes) | ✅ PASS |
| Prisma validate | ✅ PASS |
| PostgreSQL 18 connection | ✅ VERIFIED |

---

## Recent Work

### 2026-09-25 — Phase 3.2 Authorization Hardening

**Completed:**
- ISSUE-033: Project-scope query filtering fixed across all 13 controller/service pairs
- ISSUE-034: Registration endpoint whitelisted to WORKER/VIEWER only
- ISSUE-035: Tasks controller @Roles decorators added on all 4 endpoints
- RoleGuard wired into 8 client-side pages
- OWNER added to management sidebar tier
- Documentation reconciled: 12 workflow docs updated

**Verification:**
- Backend tests: 20 suites / 154 tests PASS
- db:verify: 60/60 PASS
- All typechecks PASS (backend, shared, web)
- Backend build PASS
- Web build PASS (21 routes)
- Prisma validate PASS

### 2026-09-26 — Phase 10 Solar Configurator Integration

**Completed:**
- origin/feature/solar-configurator merged into origin/master at commit 73d78e8
- Integration branch integrate/solar-configuration created, conflicts resolved
- Full post-merge verification: backend tests 25/202, web 22 routes, all typechecks and builds PASS
- Documentation updated in all workflow docs

**Verification:**
- Backend tests: 25 suites / 202 tests PASS
- Backend typecheck: 0 errors
- Web typecheck: 0 errors
- Backend build: PASS
- Web build: PASS (22 routes)
- Prisma validate: PASS

### 2026-09-26 — Phase 11 Team Leader Role Implementation

**Completed:**
- Analyzed full backend authorization for TEAM_LEADER across all 28+ controllers
- Added `team_leader` to Sidebar Management section (matching matrix — Team Leader needs access to `/teams`)
- Updated `/teams` page RoleGuard to include `team_leader`, `site_manager`, `foreman`
- Added role-aware action restrictions in teams page:
  - Create/Edit/Delete team buttons hidden for team_leader (backend blocks POST/PATCH/DELETE /api/teams)
  - Add/Remove member buttons visible for team_leader (backend allows POST/DELETE :id/members)
- Verified all other pages already accessible to team_leader:
  - Dashboard → WorkerDashboard (already handles team_leader)
  - Pontaj → WorkerAttendanceView (already handles team_leader)
  - Tasks, Rapoarte, Stocuri, Avize, Cheltuieli → no RoleGuard, all authenticated users
  - Notificari, Profil → no RoleGuard, all authenticated users
- No backend changes needed — all authorization already correct in controllers
- No Prisma schema changes needed
- No database changes needed
- No seed data changes needed

**Verification:**
- Backend tests: 25 suites / 202 tests PASS
- Backend typecheck: 0 errors
- Web typecheck: 0 errors
- Shared typecheck: 0 errors

---

## Next Actions

Per the implementation roadmap, the next areas of work are:
1. R2.6 Audit — implement remaining audit recommendations
2. Authorization refinements — `actorId` propagation from auth context
3. DTO validation — class-validator decorators
4. Read APIs — pagination/filters for stock movements
5. Web rewrites — `/stocuri` and `/avize` pages
6. Integration/E2E tests — concurrent operations

See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) and [HANDOFF.md](HANDOFF.md) for detailed planning.
