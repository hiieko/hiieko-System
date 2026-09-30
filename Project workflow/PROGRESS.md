﻿﻿﻿# Project Progress

> **Canonical current status document.**
> Historical material has been moved to `archive/PROGRESS_HISTORY.md`.

**UX-R1A foundation: C0-C5 COMPLETE (2026-09-29). R1B PENDING. Visual redesign PENDING.** See
`VERIFICATION.md` → *UX-R1A C5* for the close-out evidence and `ISSUES.md` for the carried-forward items.

**Last Updated:** 2026-09-29 (CI GREEN - GitHub Actions run 36606409946 on commit `6bd45b7`: Tests ✅ / Typecheck ✅ / Build ✅ - `ci.yml` now builds `@solar/shared` before the commands that resolve it and the root workspace casing is `Mobile`; P4.4 COMPLETE - Daily Report finalization DRAFT -> SUBMITTED is verified end-to-end: `POST /api/daily-reports/:id/submit` on the web plus the status-less Mobile one-call contract, exactly ONE immutable revision per report, exactly ONE consumption movement per material (balance 6 -> 4, restored afterwards), exactly ONE `DAILY_REPORT_SUBMITTED` audit row (a DRAFT create now audits as `DAILY_REPORT_CREATED`, so the action means exactly one thing), idempotent replays, PATCH-after-submit 400, insufficient stock refused with the report left a clean DRAFT, and `/rapoarte` + `/rapoarte/form` read-only after submit at 375px; browser gate `gate-p44-finalize.js` **25/25 PASS / 0 console errors**, backend **31 suites / 320 tests**, `db:verify` **71/71**, backend/shared/web typecheck 0 errors; ISSUE-051 opened for the Mobile daily-report screen - free-text `taskId` + draft deleted before a successful submit; earlier the same day: ISSUE-048 RESOLVED - Daily Report "Proposed Work" now persists in its own `daily_reports.proposed_work` column, separate from `general_notes`)

---

## Current Status

| Check | Status | Notes |
|-------|--------|-------|
| **P4.4 - Daily Report finalization (DRAFT -> SUBMITTED)** | ✅ **COMPLETE + E2E VERIFIED** | One trusted finalization core (`DailyReportsService.finalizeWithin()`) is shared by `POST /api/daily-reports/:id/submit` (web DRAFT -> SUBMITTED) and by `create()` when the persisted status is already `SUBMITTED` (Mobile's status-less POST + `Idempotency-Key`), so the offline queue needed no second endpoint. In ONE transaction: status `SUBMITTED`, `revision_number` 1, one immutable revision (`schema: 'daily-report-revision@1'`, snapshot `report`/`schema`/`submittedAt`/`submittedById`/`revisionNumber`/`stockReference`/`stockConsumption`), one `CONSUMPTION` stock movement per reported material with the deterministic key `daily_report:<reportId>:rev<N>:material:<materialId>` (`stock_movements.reference_type = 'daily_report'`), and the `DAILY_REPORT_SUBMITTED` audit row. A DRAFT create consumes nothing (no stock, no revision). **Verified:** browser gate `gate-p44-finalize.js` **25/25 PASS / 0 console errors** at 375px - confirmation dialog on the list (nothing sent on the first click, nothing on cancel), exactly ONE `POST .../submit` on confirm, toast, list stops offering Submit, `SUBMITTED` + revision 1, exactly one revision, exactly one movement, balance 6 -> 4, exactly ONE finalization audit row + exactly ONE `DAILY_REPORT_CREATED` row, frozen form (0 write controls, submitted banner, revision badge), read-only Review section showing "Revision: 1", idempotent replay (no second revision/consumption, `DAILY_REPORT_SUBMIT_REPLAYED` audited), PATCH on SUBMITTED -> 400, Mobile one-call contract 201 + replay creates no second report, insufficient stock -> aggregated 400 with the report left a clean DRAFT, fixtures removed and the balance restored; backend **31 suites / 320 tests PASS**, `db:verify` **71/71 PASS**, backend + shared + web typecheck 0 errors. **Audit vocabulary corrected:** the DRAFT create no longer writes `DAILY_REPORT_SUBMITTED` (it wrote the finalization action for a draft), so the action now matches exactly one event. Mobile app E2E NOT run - see ISSUE-051. |
| **ISSUE-048 — Daily Report "Proposed Work" vs "General Notes" (two persisted fields)** | ✅ **COMPLETE** | The Work section's "Proposed Work" and the Execution section's "General Notes" were both written to the single `general_notes` column, and the form never read Proposed Work back, so save → reload looked like data loss (the textarea came back empty while the text showed up under General Notes). New dedicated, nullable column `daily_reports.proposed_work` — migration `20260929170000_add_daily_report_proposed_work` (`ALTER TABLE "daily_reports" ADD COLUMN "proposed_work" TEXT;`), additive and non-destructive, no other Daily Report field touched. Backend: `proposedWork` accepted by create/PATCH (service interface + both DTO classes, decorated so the global `whitelist` ValidationPipe cannot strip it); `update()` writes each of the two text fields only when the client sends it, so editing one can never clear the other and an omitted field preserves its stored value (`''` normalises to NULL, like `start_time`); list + `GET /:id` return both. Shared: `DailyReport.proposed_work`. Web: `formStateFromReport()` reads `report.proposed_work` (it was hard-coded `''`), `toCreateDto()` / `toUpdateDto()` send the two texts separately — the `state.proposedWork &#124;&#124; state.generalNotes` fallback is gone. Data compatibility: no historical text moved or guessed — the 6 dev rows keep their `general_notes` and get `proposed_work = NULL` (their 2 non-null note values are scratch/test text, not Proposed Work). Verified: `prisma validate` exit 0, `prisma generate` exit 0 (dev server stopped, no DLL lock), `migrate deploy` + `migrate status` clean (12 migrations), shared/backend/web typecheck 0 errors, backend **30 suites / 295 tests** PASS, `db:verify` **66/66** PASS (new check 8j), web build 26 routes exit 0, browser gate `gate-issue048-browser.js` **23/23** at 375px in RO + EN with 0 console errors — reload keeps each text in its own field, and independent per-field PATCH is proven at API + database level. No status workflow / stock / approval / revision / notification change; Mobile contract unchanged. Resolves ISSUE-048 — STOP here, P4.4 not started. |
| **Dev Team Accounts / Teams / Projects / Tasks (seeded as real DB rows)** | ✅ **COMPLETE** | 12 development accounts (3 x TEAM_LEADER `chef1-3`, 3 x FOREMAN `fore1-3`, 3 x WORKER `wor1`/`wor2`/`work3`, 3 x TECHNICIAN `tech1-3`) + `UserProfile` + `Employee` + 12 `ProjectMember` + 3 teams (leadership + foreman + worker + technician, `leader_id` set, roster = `TeamMember`) + 9 `ProjectStage` / 9 `WorkPackage` + 3 `LocationZone` + 12 tasks / 24 `TaskAssignment` + 3 `PUBLISHED` `DailyPlan` (today) / 12 `DailyPlanTask` — written directly into PostgreSQL through `backend/scripts/seed-hiieko-teams.ts` (`npm run seed:teams --workspace=backend`), idempotent (2nd run produced identical counters). Applied to the 3 **existing** projects (AR-001 Parc Solar Arad, TM-002 Parc Solar Timisoara, CJ-003 Parc Solar Cluj) matched by code — no duplicate projects, no JSON/mock data, no schema/migration/API change. Verified: `db:verify` **65/65 PASS**; per-account API scoping for 8 logins (each worker/technician sees only their own assignments); `chef1` daily-plans for today → 1 PUBLISHED plan with 4 tasks; browser gate `gate-seed-teams.js` **8/8 page checks / 0 console errors** (real `/login` form → `/teams` team card + 4 members, `/tasks` AR-001-T01..T04 with status counts, `/projects/<id>` Etape + Membri tabs, worker RoleGuard + only-mine filtering, per-project isolation), evidence `gate-seed-teams.out.json`. Known leftovers: the 4 pre-existing verification fixtures (`SMOKE-40926`, `PH2-VER-01`, `P3-GATE-T1/T2` on CJ-003) were deliberately kept (ISSUE-050). |
| **Phase 4.3.1 — Daily Report Persistence: Start/End Time + OHS/SSM Checklist** | ✅ **COMPLETE** | `DailyReport.start_time` / `end_time` (nullable `HH:mm` TEXT — a draft may be incomplete) + enum `OhsRiskType` (7 controlled categories: ppe, adverse_weather, procedures, electrical, tools_machinery, fall_height, other_risks) + child model `DailyReportOhsItem` (risk_type, notes, cascade FK); migration `20260929105838_add_daily_report_time_and_ohs`, already applied (`prisma migrate status` → "Database schema is up to date", 11 migrations). API: POST/PATCH accept `startTime`/`endTime`/`ohsItems[]`, `GET /:id` and the list include `ohs_items`; PATCH replaces the OHS collection atomically when provided, preserves it when omitted, never duplicates rows on repeated saves; `''` normalises to NULL. Controlled-vocabulary guard (riskType → 400) + `HH:mm` guard (400 service / 422 VALIDATION_ERROR DTO) replace the raw Prisma 500. Web: the form's time inputs + OHS checklist/notes map both ways so a reopen shows what was saved, and a created draft keeps its id in the URL so a reload reopens the same draft. Verified: typecheck shared 0 / backend 0 / web 0 errors, 29 suites / 279 tests, db:verify 65/65, web build exit 0, HTTP gate 23/23, browser gate 24/24 (375px, RO+EN, 0 console errors). No stock consumption, no approval/rejection, no revision snapshot, no notification; Mobile contract unchanged (status-less POST still `SUBMITTED`); report stays `DRAFT`. |
| **Phase D — Design System Foundation** | ✅ **COMPLETE** | D0 docs (DEC-011, DESIGN_SYSTEM.md), D3.1 ToastProvider P0 fix, D1 tokens (tailwind.config.js, globals.css), D3.2–D3.6 shell redesign (Sidebar, Header, DropdownMenu, Breadcrumbs, hooks) |
| **Vertical Slice — Projects** | ✅ **COMPLETE** | `/projects` list + create wizard (validation per step) + `/projects/[id]` overview/members/settings/stages — all wired to real NestJS controllers via `features/projects` |
| **Phase 3.2 Authorization Hardening** | ✅ **COMPLETE** | ISSUE-033/034/035 resolved; RoleGuard wired on 8 pages; OWNER management sidebar; project scoping on 13 controllers |
| **Backend Tests** | ✅ **PASS** | 31 suites / 320 tests |
| **db:verify** | ✅ **PASS** | 71/71 checks via `npm run db:verify --workspace=backend` → `backend/scripts/db-verify.ts`. The root `npm run db:verify` runs a **different** verifier, `database/scripts/verify_migration.ts`, and reports 41/41; both PASS on the same database (`localhost:5433/hiieko`) — see `VERIFICATION.md` → *db:verify denominators - 41 (root) vs 71 (backend workspace)* |
| **Backend Typecheck** | ✅ **PASS** | 0 errors |
| **Shared Typecheck** | ✅ **PASS** | 0 errors |
| **Web Typecheck** | ✅ **PASS** | 0 errors (design system shell refactor) |
| **Backend Build** | ✅ **PASS** | `nest build` exit 0 |
| **Web Build** | ✅ **PASS** | 25 routes, 0 errors |
| **Vertical Slice — Pontaj / Field Time** | ✅ **COMPLETE** | worker shift lifecycle (check-in → live timer → assigned work → check-out → hours) + supervisor experience (`/api/attendance/today` stats, active-on-site, role-aware missing attendance, daily/monthly tables, CSV) |
| **Vertical Slice — Tasks** | ✅ **COMPLETE** | `/tasks` list (search + status tabs + "only my tasks") → create → status workflow → quantity-derived progress → assign, all wired to real `TasksController`; legacy `TODO`/`DONE`/`REVIEW`/`ON_HOLD` + `priority`/`progress` fields removed |
| **Sprint 1 P0 Foundation** | ✅ **COMPLETE** | Types/, generic api-client, shared UI lib, per-domain API modules, ProjectContext rewrite |
| **Prisma Validate** | ✅ **PASS** | Schema valid |
| **PostgreSQL 18** | ✅ **Canonical** | `localhost:5432` is the canonical development database |
| **Phase 3 Gate F follow-up — Planning progress permission parity** | ✅ **COMPLETE** | Frontend mirrors full backend verdict (role + PUBLISHED + assignment/team scope via existing `my-tasks` endpoint); 11/11 browser checks on production build; ISSUE-041 FIXED |
| **Phase 2 — Tasks Operational Experience (8 components + page rewrite)** | ✅ **COMPLETE** | `features/tasks/components/`: TaskCard (semantic `<article>`, aria-expanded/controls expand-collapse, cancel ConfirmDialog), TaskProgressBar (actual/planned only — no percent field), TaskDependencyChips (prereq/successor), TaskStatusWorkflow (TASK_WORKFLOW_NEXT-driven buttons), TaskQuantityEditor (Enter/blur save, rollback, disabled for VERIFIED/CANCELLED), TaskAssignModal (getProjectMembers + assignTask, no unassign UI), TaskCreateModal (only the 10 verified CreateTaskDto fields), TaskFilters (search + status Tabs with counts + only-mine); `/tasks` page: ProjectContext-driven fetch, role gates (CAN_CREATE/CAN_ASSIGN without TECHNICIAN/WORKER/QA_QC), workers default to only-mine. i18n: added `general.save`, `task.expand_details`, `task.collapse_details`. Gate E: 21/21 browser checks + 9 screenshots; typecheck 0; build 25 routes (9.25 kB /tasks) |
| **Phase 3 planning gates (P3-G / P3-H)** | ✅ **GREEN** | CDP browser verification on dev build (2026-09-29): P3-G 7/7 (worker/TL/admin role matrix + RO/EN labels), P3-H 10/10 (a11y/keyboard, 44px targets incl. date bar `Ieri/Azi/Mâine`, local-date month/leap boundaries, day-summary-vs-API parity, empty-state date humanization RO+EN, 375/390px overflow); 0 console + 0 network errors. Harness-only fixes — no product code changed |
| **Phase 4.1 — Domain + Database Foundation** | ✅ **COMPLETE** | Schema: `DailyReportApproval` (action/comment/reviewer audit) + `DailyReportRevision` (immutable JSON snapshot per submission) models; `DailyReport` extended with `reviewed_by`, `reviewed_at`, `revision_number`; `User` extended with `reviewed_reports`, `report_approvals`, `report_revisions` relations. Migration `20260929073840_add_daily_report_approval_revision`. Prisma generate OK. db:verify 62/62 PASS (0 fail, 0 skip). Typecheck PASS (0 errors). |
| **Phase 4.2 — Shared Types / API Contract Alignment** | ✅ **COMPLETE** | `ReportStatus` aligned to UPPERCASE (`DRAFT`/`SUBMITTED`/`APPROVED`/`REJECTED`/`CANCELLED`); added `DailyReportApprovalAction`. `DailyReport` interface rewritten to match actual API response (snake_case, weather_notes/blockages/revision_number, Prisma relations). `DailyReportTask` and `DailyReportMaterialUsage` fixed to match backend models. Added `DailyReportApproval`, `DailyReportRevision`, `DailyReportWorker`, `ProductionEntry` shared types. Web `rapoarte/page.tsx` uses shared `DailyReport` type. Mobile `IMobileApiClient.createDailyReport` aligned with backend DTO. Mobile `TeamLeaderDailyReportScreen` uses local form types. All typechecks PASS (backend/shared/web 0 errors). Shared dist rebuilt. |
| **Phase 4.3 — Backend Draft Update (PATCH)** | ✅ **COMPLETE** | Added `PATCH /api/daily-reports/:id` — DRAFT-only, owner-or-ADMIN authorization, atomic child-collection replacement (deleteMany+create), cross-project task validation. `UpdateDailyReportDto` (all fields optional). `DailyReportsService.update()` with full security checks. 9 new tests (15/15 total pass). Typecheck 0 errors. No migration, no stock deduction, no approval, no revision creation. |
| **Phase 4.3 — Frontend Daily Report Form** | ✅ **COMPLETE** | Multi-section mobile-first Team Leader field form at `/rapoarte/form`. 7 sections: Work, OHS/SSM, Personnel, Materials, Tasks, Execution, Review. Draft create via POST, draft edit via PATCH. Save confirmation, unsaved-change guard, previous-date warning, draft indicator, review summary. RO/EN i18n (50+ keys). `DailyReportForm` + 7 section components + `useDailyReportForm` hook. 26 routes web build OK. No stock deduction, no approval, no revision creation. |
| **Phase 4.3.1 — Daily Report Status Contract + PATCH Body Integrity** | ✅ **COMPLETE** | Contract: `POST` keeps the `SUBMITTED` DB default when `status` is omitted (Mobile/offline queue unchanged), accepts explicit `DRAFT`/`SUBMITTED`, and rejects anything else with 400; web `toCreateDto()` now sends `status: 'DRAFT'` so the documented draft create → PATCH edit flow actually works. `UpdateDailyReportDto` is decorated (+ nested entry classes) so the global `whitelist: true` ValidationPipe no longer strips the PATCH body. 10 new tests (4 service + 6 HTTP); backend 28 suites/259 tests PASS; live HTTP smoke 15/15 PASS against real PostgreSQL (DRAFT persisted after PATCH, Mobile-style POST → SUBMITTED, PATCH on SUBMITTED → 400); db:verify 64/64 PASS; web build exit 0. Resolves ISSUE-045 + ISSUE-046. No migration, no Prisma enum, no CHECK constraint, no approval workflow, no stock/revisions/notifications. |
| **Dev / LAN access — Tablet & phone on the same Wi-Fi** | ✅ **COMPLETE** | Web was unusable from any device other than the laptop: `web/src/lib/api-client.ts` baked `NEXT_PUBLIC_API_URL` (`http://localhost:4000`) into the browser bundle, so a tablet at `http://<laptop-ip>:3000` called *itself* (`Failed to fetch`, login included). New `resolveApiBaseUrl()` derives the API host at runtime from the page hostname when the configured value is loopback (local dev and explicit remote URLs unchanged). Backend already listened on `0.0.0.0:4000` with `origin: '*'` CORS — no backend/proxy/CORS change, no new dependency. Verified with CDP `gate-lan-tablet.js` (loopback API blocked in-browser to simulate the tablet): before → `localhost:4000` blocked + `Failed to fetch`; after → 13/13 API calls to `192.168.1.130:4000` (login 200, `/api/auth/me` 200, `/api/projects` 200, `/api/control-tower/overview` 200), login token stored, 0 console errors, PASS; localhost regression run PASS. Web typecheck 0 errors. Resolves ISSUE-047. Documented in `HOW_TO_RUN.md` (+ firewall check). |

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



### ✅ Sprint 1 (P0 Foundation) — Frontend Architecture Redesign (COMPLETE 2026-09-26)

**Architectural Shift:** Flat routing → typed API modules with generic interceptors + per-domain API functions + shared UI component library.

**Files Created (14 new):**
| File | Purpose |
|------|---------|
| `web/src/types/common.ts` | Base types (PaginatedResponse, SortState, FilterState, BaseEntity, SelectOption, TabDef) |
| `web/src/types/project.ts` | Project, ProjectMember, CreateProjectDto, UpdateProjectDto types + status/phase/color maps |
| `web/src/types/attendance.ts` | AttendanceRecord, ClockInDto, ClockOutDto, DailyAttendanceSummary, CrewMember |
| `web/src/types/task.ts` | Task, CreateTaskDto, TASK_STATUS_LABELS |
| `web/src/types/issue.ts` | Issue, CreateIssueDto, severity/status labels |
| `web/src/lib/api/index.ts` | Barrel export for per-domain API modules |
| `web/src/lib/api/projects.ts` | Typed projects API (CRUD + member management) |
| `web/src/lib/api/attendance.ts` | Typed attendance API (check-in/out, matrix, export, summary) |
| `web/src/lib/api/tasks.ts` | Typed tasks API (CRUD + dependencies + prerequisites) |
| `web/src/components/ui/index.ts` | Barrel export for UI components |
| `web/src/components/ui/Button.tsx` | Reusable Button (5 variants, 3 sizes, loading state, icon support) |
| `web/src/components/ui/Card.tsx` | Card + CardHeader/CardContent/CardFooter |
| `web/src/components/ui/Badge.tsx` | Badge (6 variants, 2 sizes, dot support) |
| `web/src/components/ui/Skeleton.tsx` | Skeleton loading placeholders + TableRowSkeleton |
| `web/src/components/ui/EmptyState.tsx` | Empty state with icon/title/description/action |
| `web/src/components/ui/ErrorState.tsx` | Error state with retry button |
| `web/src/components/ui/PageHeader.tsx` | Page header with back nav, refresh, actions slot |
| `web/src/components/ui/Toast.tsx` | Toast notification system (success/error/warning/info) |
| `web/src/components/ui/Modal.tsx` | Modal dialog (5 sizes, backdrop, Escape close) |
| `web/src/components/ui/LoadingSpinner.tsx` | Loading spinner (3 sizes, fullPage mode) |
| `web/src/components/ui/Tabs.tsx` | Tab navigation with badges and icons |

**Files Modified (2):**
| File | Change |
|------|--------|
| `web/src/lib/api-client.ts` | Added typed generic helpers (get<T>, post<T>, patch<T>, put<T>, delete<T>, getPaginated<T>) + updated architecture comment |
| `web/src/contexts/ProjectContext.tsx` | Rewritten to use typed `projectsApi` module, added `projectLoading`, `clearProject`, auto-detect from URL path |

**Verification:**
- Web typecheck: **PASS** (0 errors)
- Web build: **PASS** (25 routes, 0 errors)
- Backend tests: **PASS** (27 suites, 232 tests)
- Shared typecheck: **PASS**

### ✅ Phase 3.5 — Project Context + Role Contract Alignment (COMPLETE)

| Area | Change | Status |
|------|--------|--------|
| **Project context** — 10 pages now pass `selectedProjectId` to their API calls | `/tasks`, `/pontaj`, `/rapoarte`, `/avize`, `/stocuri`, `/cheltuieli`, `/teams`, `/aprobare`, `/statistici` | ✅ COMPLETE |
| **Project context** — pages that do NOT need filtering (global data) | `/santiere` (projects list), `/workforce` (employees), `/utilizatori` (users) | ✅ INTENTIONAL |
| **santiere RoleGuard** — added `site_manager` (matches backend `PATCH /api/projects` `@Roles`) | `['admin', 'owner', 'manager', 'pm', 'site_manager']` | ✅ FIXED |
| **solar-configurator RoleGuard** — added to match sidebar visibility + backend GET access | `['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'technician', 'worker']` | ✅ ADDED |
| **stocuri RoleGuard** — added (backend GET has no `@Roles`, so all roles allowed) | `['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']` | ✅ ADDED |
| **Tasks Worker access** — WORKER can read (GET) and mutate (PATCH) own tasks, matching backend | No frontend change needed | ✅ VERIFIED |
| **cheltuieli RoleGuard** — added `technician` (sidebar shows page to all roles, backend GET has no @Roles) | `['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician', 'worker']` | ✅ FIXED |
| **Backend tests** | 27 suites / 232 tests PASS | ✅ VERIFIED |
| **Web build** | 25 routes / 0 errors | ✅ VERIFIED |

### ✅ Phase 4 — Foreman Workflow (COMPLETE)

| Area | Change | Status |
|------|--------|--------|
| **Daily Plan page** (`/planning`) | Created Foreman-facing daily plan viewer with date picker, expandable plan cards, task visibility, and "Finalizează" action for PUBLISHED plans | ✅ CREATED |
| **Issues/Blockers page** (`/issues`) | Created issues/blockers reporting page with severity/status badges, filter tabs, create modal with title/description/severity | ✅ CREATED |
| **Sidebar links** | Added `/planning` (Plan Zilnic) and `/issues` (Probleme & Blocaje) to Operațiuni section | ✅ ADDED |
| **api-client methods** | Added `getIssues()` and `createIssue()` methods to NestApiClient and IApiClient interface | ✅ ADDED |
| **shared TutorialSectionId** | Added `planning` and `issues` to TutorialSectionId type and TUTORIALS record | ✅ ADDED |
| **Authorization** | RoleGuard on both pages includes all authenticated roles (matching backend GET which has no @Roles) | ✅ VERIFIED |
| **Project context** | Both pages use `selectedProjectId` from ProjectContext | ✅ VERIFIED |
| **Web build** | 25 routes / 0 errors | ✅ VERIFIED |
| **Sidebar visibility** | Foreman can see both new sidebar entries | ✅ VERIFIED |

### ✅ Phase 5 — Site Manager Workflow (COMPLETE)

| Area | Change | Status |
|------|--------|--------|
| **Daily Plan page** (`/planning`) | Extended with Create Plan modal (team selection, notes, date), Publish button (DRAFT→PUBLISHED), Cancel button (DRAFT/PUBLISHED→CANCELLED). All actions respect backend @Roles authorization. | ✅ EXTENDED |
| **api-client** | Added `receiveStock()`, `consumeStock()`, `transferStock()`, `getPurchaseOrders()`, `getInspections()`, `createInspection()` methods to NestApiClient and IApiClient interface | ✅ ADDED |
| **Backend audit** | All 28+ controllers audited for SITE_MANAGER authorization. Confirmed: create/publish/cancel/complete daily plans, create/update/assign tasks, create/update teams+members, receive/consume/transfer inventory, create Avize, create inspections all authorized | ✅ VERIFIED |
| **Sidebar role alignment** | All sidebar links already include `site_manager` in matching role arrays; no changes needed | ✅ VERIFIED |
| **RoleGuard alignment** | All existing pages already include `site_manager` in their RoleGuard allowedRoles | ✅ VERIFIED |
| **Project context** | All Site Manager pages already use `selectedProjectId` from ProjectContext | ✅ VERIFIED |
| **Web build** | 25 routes / 0 errors | ✅ VERIFIED |

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
| RoleGuard | ✅ WIRED | Client-side route guard on 10 pages: projects, project detail, teams, workforce, santiere, statistici, aprobare, utilizatori, stocuri, solar-configurator |
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
- **No deployment pipeline (CD)** — CI exists and is green: GitHub Actions `ci.yml` (install + typecheck + tests + build on push to `master`) passed on commit `6bd45b7` (run 36606409946: Tests ✅ / Typecheck ✅ / Build ✅). No staging/production deployment pipeline is configured.

---

## Verification Gates

All quality gates verified as of 2026-09-30 (R1B.1):

| Gate | Result |
|------|--------|
| Backend tests (31 suites / 320 tests) | ✅ PASS |
| db:verify — root `database/scripts/verify_migration.ts` (41/41) | ✅ PASS (with `DATABASE_URL` from `backend/.env`) |
| db:verify — `--workspace=backend` `backend/scripts/db-verify.ts` (71/71) | ✅ PASS |
| Backend typecheck | ✅ PASS |
| Shared typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| Mobile typecheck | ✅ PASS |
| Backend build | ✅ PASS |
| Web build (`web:build`, all routes emitted) | ✅ PASS |
| `i18n:check` (194 source files, 1009/1009 keys) | ✅ PASS |
| `guards:check` (194 source files) | ✅ PASS |
| Prisma validate | ✅ PASS |
| PostgreSQL 18 connection | ✅ VERIFIED |

---

## Recent Work

### 2026-09-30 - R1B.1: ISSUE-057 tutorial translation keys + ISSUE-058 375 px Control Tower overflow (GREEN, UNCOMMITTED)

Two scoped fixes: the 21 missing `tutorial.*` keys the C5 sweep flagged as **F1**, and the 54 px
`<main>` overflow the same sweep flagged as **F2**. No backend / Prisma / database / CI /
route-architecture / task-source change, no `WorkerAttendanceView` change, no redesign, no new
dependency. Three tracked files touched, **nothing committed**.

| Change | Detail |
|--------|--------|
| **ISSUE-057 FIXED** | `shared/src/translations.ts` +21 keys (`planning`, `teams`, `workforce` × `title`, `short`, `purpose`, `step1`, `step2`, 2 `role_*`); the table goes **988 → 1009** keys. Role notes fact-checked against the code first: `foreman`/`team_leader` create + complete a plan and work in both the Plans view and My work, **`site_manager` publishes** |
| **Recurrence guard (fail-first, landed first)** | `scripts/check-i18n.mjs` +51/−1 resolves the template-built tutorial keys (`K('planning') + '.title'`) into concrete keys and fails on an undefined one; two new `FAILURE_ORDER` categories; loud failure if `tutorials.ts` is unreadable or 0 keys resolve. Before the copy fix it failed listing exactly the 21 keys; after: PASS |
| **ISSUE-058 FIXED (measured)** | The C5 suspect was wrong — the red-flags `whitespace-nowrap` table sits inside `overflow-x-auto` and clips. The real cause is the `ControlTowerSurface` global filter row (`flex items-center space-x-3`): at 375 px its box is 301 px but its content 392 px, `flex-wrap: nowrap`, and the `Actualizează` button ends at x = 429 = `main.scrollWidth`. Fix = 2 class changes (stack below `sm`, `w-full sm:w-auto` select). `main 429/375` → **`375/375`**; ≥ 640 px unchanged |
| **Browser sweep (after)** | **30 records** = `/`, `/control-tower`, `/planning`, `/teams`, `/workforce` × {375, 768, 1440} px × {RO, EN}, real Chrome over CDP, real login + API + DB: `main.scrollWidth === clientWidth` **30/30**, `documentElement.scrollWidth === innerWidth` **30/30**, **0** raw `tutorial.*` keys in text **and** in aria-labels, cards render real copy |
| **Gates** | `i18n:check` **PASS** (194 files, 1009/1009 keys), `guards:check` **PASS**, `typecheck` exit 0 (4 workspaces), `web:typecheck` exit 0, `web:build` exit 0, `npm test` **31 suites / 320 tests PASS**, root `npm run db:verify` **41/41** (needs `DATABASE_URL`, see below), `npm run db:verify --workspace=backend` **71/71** |
| **New finding → ISSUE-059** | `PageTutorial` defaults `locale` to `'ro'` and **0 of its 16 call sites** passes it, so every introduction card stays Romanian in the EN locale (measured: `lang="en"` on all 15 EN records, RO card copy). 16 call sites → deliberately **not** fixed in R1B.1 |
| **Not claimed / environment** | swept against the `next dev` server on `:3000` (C5 used the production build on `:3100`); the ISSUE-058 fix was re-measured on the same server before/after, so the delta is attributable. Root `npm run db:verify` without `DATABASE_URL` exits 2 (`DATABASE_URL is not set.`) — pre-existing precondition, no DB/Prisma artifact touched. Harness + JSON evidence are temp-only (`%TEMP%`) |

**R1B.1 DONE and uncommitted. R1B (remaining copy work, ISSUE-059) and the visual redesign remain PENDING.**
Full detail: `VERIFICATION.md` → *R1B.1*.

### 2026-09-29 - UX-R1A C5 final foundation verification, real-browser sweep and CI guardrails (GREEN)

Close-out checkpoint: no product behaviour changed, no redesign, no backend / Prisma / database change.
The only source file C5 touched is `.github/workflows/ci.yml`.

| Change | Detail |
|--------|--------|
| **CI guardrails (closes the C1 deviation)** | `.github/workflows/ci.yml`, existing `test` job: `npm run i18n:check` + `npm run guards:check` added after the shared build and before `npm run test` - the already-existing scripts, no new job, nothing weakened. YAML validated statically (`yaml.safe_load`), job list unchanged (`typecheck`, `test`, `build`). **Not pushed**, so remote CI execution is not claimed |
| **Real-browser sweep** | real headless Chrome (`Chrome/154.0.8037.58`) over the **Chrome DevTools Protocol**, against the C5 production build served by `next start` (`:3100`) plus the real API (`:4000`) and DB (`:5433`). **130 records** = 4 roles x {375, 768, 1440} px x {RO, EN} -> **93 PASS / 37 FAIL**, every failure itemised in `VERIFICATION.md` |
| **Accounts** | all four are real rows in the live DB and all four authenticated through the real login form (`mode=ui-form`): `dev@hiieko.local` (admin), `ion.munteanu@hiieko.local` (team_leader), `fore1@hiieko.com` (foreman), `wor1@hiieko.com` (worker) |
| **Verified correct** | `documentElement.lang` equals the active locale 130/130; RO -> EN through the real switcher + reload keeps `lang="en"` / `solar:locale="en"` and renders `Tasks`; **0** sidebar-label mismatches, **0** routes advertised that the role may not use, **0** permitted routes missing; `Turn de Control` / `Control Tower` correct on all 38 pages whose role may use it; `Task-uri`, `Forță de Muncă`, `Șef de Echipă` correct and distinct from `Șef de Șantier`; 0 mojibake, 0 legacy misspellings, 0 console errors attributable to C4; the mobile drawer opens through the real header button with 12-20 visible links |
| **Findings (open, neither a C4 nor a C5 regression)** | **F1** raw `tutorial.planning/teams/workforce.*` keys on `/planning`, `/teams`, `/workforce` (19 records, RO + EN, already absent at C3) -> **ISSUE-057**; **F2** 375 px `main` overflow on the Control Tower surfaces (`main` 429 vs 375) -> **ISSUE-058**; **F3** one non-reproducible environment transient (a refused API connection during the auth bootstrap ended the session for 10 records; the isolated foreman re-run was clean at 26/32, 6 fails being F1) -> recorded as transient, not a product defect; **F4** 13 x pre-existing `403 /api/users` console entries on field/supervisor pages (ISSUE-039 / ISSUE-053, contained: no exception, no visible error) |
| **Automated verification (C5 tree)** | `i18n:check` PASS (988/988 keys), `guards:check` PASS, `typecheck` exit 0 (4 workspaces), `web:typecheck` exit 0, `web:build` exit 0 (25/25 static pages), `npm test` 31 suites / 320 tests PASS, root `npm run db:verify` **41/41** (`database/scripts/verify_migration.ts`), `npm run db:verify --workspace=backend` **71/71** (`backend/scripts/db-verify.ts`) - two scripts, two inventories, both green |
| **Issue re-confirmed** | ISSUE-049: after the C4 `next build`, all 10 `/_next/static/*` assets referenced by `/` on the `:3000` dev server returned HTTP 404. The clobbered dev server was stopped for the sweep and restarted afterwards |
| **Not claimed** | no `site_manager` / PM / manager / owner browser pass (those accounts do not exist in this database), no visual/design review, no remote CI run. The browser harness and its JSON evidence are temp-only (`%TEMP%`) and deliberately not committed |

**UX-R1A status: COMPLETE (C0-C5). R1B PENDING. Visual redesign PENDING.** Full detail:
`VERIFICATION.md` -> *UX-R1A C5*.

### 2026-09-29 - UX-R1A C4 terminology normalization: one vocabulary, one role set, `nav.control_tower` (GREEN)

Copy/vocabulary checkpoint - no redesign, no semantic or logic change, no backend / Prisma / database /
CI / route-architecture change, no new endpoint, no dependency.

**Approved RO wording (user decision):** Task → `Task-uri`, Workforce → `Forță de Muncă`, Control
Tower → `Turn de Control`. `Task-uri` / `Task-urile mele` from C3 stay (no `Sarcini` rewrite), the
`Personal` sidebar group keeps its name, and only inconsistent/incorrect labels were normalised.

| Change | Detail |
|--------|--------|
| **Control Tower nav key** | `nav.control_tower` (`Turn de Control` / `Control Tower`) replaces the temporary `nav.statistici` on the `/control-tower` item - `/statistici` has been a C2 redirect since, so the old label named a route that no longer exists. `nav.statistici` is now referenced nowhere (key kept, by decision) |
| **One role vocabulary** | `shared/src/translations.ts` `role.*` = the complete 16-role set; `getRoleLabel()` (`shared/src/permissions.ts`) resolves it via `tPrefix('role.', …)` and accepts any casing. Deleted the four hardcoded maps that carried `'Maistru'`, `'Sef Echipa'`, `'Sef Santier'`, `'Vizualizare'`, `'Admin'`, `'Director Intretinere'` (`workforce`, `utilizatori`, `projects/[id]`) |
| **Vocabulary fixes** | `nav.avize` `Procurement / Avize` → `Livrări & Avize`; `reports.tasks`/`planning.*` label-level `Sarcini` → `Task-uri`; `daily_report.team_leader` → `Șef de Echipă`; legacy keys `nav.attendance`/`nav.notifications` on worker surfaces → `nav.pontaj`/`nav.notificari` |
| **Diacritics** | 175 of 181 measured RO copy defects corrected across 24 files (shared vocabulary + page/component copy: `Șantier`, `Salvează`, `Adaugă`, `Selectează`, `Încearcă`, `În Așteptare`, `Distanță`, `Acțiune`, `Întârziere`, `Notificări`, `Setări`, `Mișcare`, `Ieșire`…) |
| **Page titles** | `/workforce`, `/utilizatori`, `/notificari`, `/pontaj`, `/issues` now render through their existing keys, so EN users stop seeing RO titles |
| **New guard row (report-only)** | `scripts/check-frontend-guards.mjs` → *Romanian copy missing diacritics* (`RO_DIACRITIC_DEBT`); tokens are ignored inside comments, paths and identifiers. It never fails CI |

**Verification (see `VERIFICATION.md` → UX-R1A C4 for the full evidence):** `i18n:check` PASS
(988/988 keys), `guards:check` PASS (terminology row 181 → 6), `typecheck` exit 0 (4 workspaces),
`web:build` exit 0 (25 routes), `npm test` 31 suites / 320 tests PASS, `db:verify` 41/41 PASS
(root script `database/scripts/verify_migration.ts`; the backend workspace verifier
`backend/scripts/db-verify.ts` reports 71/71 on the same database - two scripts, two inventories, both
PASS: `VERIFICATION.md` → C4 *db:verify denominators*),
static greps (`nav.statistici` 0 code refs, no `ROLE_LABELS`, no `Maistru`/`Vizualizare`),
`getRoleLabel` runtime smoke test, and `Turn de Control` present in the built chunks.

**Deliberately left (with reasons):** `WorkerAttendanceView.tsx` + `WorkerDashboard.tsx:101/151`
(ISSUE-055 coupling), `ControlTowerSurface` copy, Mobile `SettingsScreen.formatRole()`, established
copy (`Materiale & Stoc`, `Cheltuieli Companie`, prose `sarcini`), and the R1B prose sweep.

### 2026-09-29 - UX-R1A C3 field task sources, canonical task labels, translation cleanup (GREEN)

**Role-correct task sources, frontend-only (no backend/Prisma/CI change):** `worker` and `technician`
now read `GET /api/daily-plans/my-tasks?date=` (the backend-computed personal scope — no project
needed); `team_leader`, `foreman` and `site_manager` read
`GET /api/daily-plans?projectId=&date=` for the selected project's day plan. The legacy panel contract
(`GET /api/tasks` + `t.assigned_to_id === user.id` + `status !== 'DONE'`, done client-side) is gone
from those surfaces. New pure selector module `web/src/features/planning/fieldWork.ts`
(`taskSourceForRole`, `selectMyWorkTasks`, `selectPlannedTasks`, canonical status label/Badge helpers)
owns the filtering and ordering, and `WorkerTodayTasks` renders the canonical `TaskStatusEnum` label
with an `ui/Badge` variant plus a role-correct footer link (`/tasks` for personal work, `/planning`
for the project day plan).

**Translation cleanup:** duplicate key definitions removed, 6 mojibake lines repaired,
`expenses.project` / `planning.empty_no_open_tasks` / `planning.task_count_total` added,
`role.team_leader` RO = `Șef de Echipă`, U+FFFD and lossy `?` diacritics repaired in
`cheltuieli` / `rapoarte` / `stocuri`, Mobile receipt scan uses the `expenses.project` key, and the
last two inline `locale === 'en'` labels in the task card are now `t()` calls.

**Evidence (all re-run on the final tree):** `npm run typecheck` **0 errors**,
`npm run web:typecheck` **0 errors**, `npm run web:build` **exit 0** (`Compiled successfully`,
25 static routes), `npm run guards:check` **PASS** (194 files, G1/G2 findings 0),
`npm run i18n:check` **PASS** (975 key definitions / 975 unique keys, 0 duplicates, 0 mojibake,
0 lossy `?`, 0 undefined keys), `npm test` **31 suites / 320 tests PASS**,
`npm run db:verify` **71/71 PASS**, a compiled-selector runtime harness **17/17**, and a headless-Chrome
role sweep (real login + real API + real PostgreSQL, production build, 4 field roles × 375/768/1440 px
× RO/EN) **68/68 checks, 0 console errors, 0 failed requests** — the sweep observed exactly one plan
request family per role (`my-tasks` for worker/technician, `?projectId=&date=` for
team_leader/foreman). Residual legacy task source on `/pontaj` recorded as **ISSUE-055**;
`site_manager`/PM/manager/admin browser accounts do not exist in the dev seed and are therefore not
claimed. See `VERIFICATION.md` → *UX-R1A C3*.

Files: `web/src/features/planning/{fieldWork.ts (new),api.ts,index.ts}`,
`web/src/components/{WorkerTodayTasks,WorkerMyDay,WorkerDashboard}.tsx`,
`shared/src/translations.ts`, `web/src/app/{utilizatori,cheltuieli,rapoarte,stocuri}/page.tsx`,
`Mobile/src/screens/ReceiptScanFlow.tsx`.

### 2026-09-29 - CI pipeline GREEN (GitHub Actions, commit `6bd45b7`)

**Configuration-only fix - no product code changed** (`ci.yml` +9 lines, `package.json` 3 lines,
`package-lock.json` 12 case-only key lines). Two defects: (1) `typecheck` and `test` ran before
`@solar/shared` was built, and `shared/dist` is gitignored, so a clean Linux checkout could not
resolve the package - both jobs now run `npm run build --workspace=shared` first (the typecheck
job also runs `prisma generate`, which the backend `tsc` needs); (2) the root workspace and the
mobile scripts used the casing `mobile` while the directory is `Mobile`, which npm cannot resolve
on a case-sensitive filesystem - the workspace declaration, both scripts, the `package-lock.json`
workspace keys and the workspace link target now all use `Mobile`.

**Evidence:** GitHub Actions run **36606409946** on commit **`6bd45b7`** (`event=push`,
`conclusion=success`, 162 s) - **Tests ✅ / Typecheck ✅ / Build ✅**, every step success; the
Build job previously never ran. The only annotations are the pre-existing environment notices
(Node 20 deprecation, `ubuntu-latest` → Ubuntu 26). Local pre-push, in CI order: `npm ci` 0,
`prisma generate` 0, shared build 0, `npm run typecheck` 0 (all four workspaces incl.
`@solar/mobile`), **31 suites / 320 tests PASS**, `npm run build` 0 (web 26/26 static pages), root
`db:verify` 41/41 PASS. See `VERIFICATION.md` -> CI (end of file).

### 2026-09-29 - Phase 4.4 Daily Report Finalization (DRAFT -> SUBMITTED) GREEN

**Verified end-to-end (browser + API + DB), no new product code was needed for the phase itself:**
- `POST /api/daily-reports/:id/submit` finalizes a DRAFT exactly once. The confirmation dialog guards
  it on both entry points (`/rapoarte` row action and the form's Review section): the first click only
  asks, cancel sends nothing, confirm sends exactly one request.
- Finalization writes, in one transaction: status `SUBMITTED` + `revision_number`, one immutable
  revision snapshot, one consumption movement per material, and one audit row. A DRAFT create
  consumes nothing.
- After finalization the UI is read-only: the form freezes (disabled fieldset, no Save/Submit, banner
  + revision badge) and the Review section shows the frozen state with its revision at 375px.
- Replays are idempotent (web + Mobile), PATCH on a SUBMITTED report is refused with 400, and
  insufficient stock is refused with an aggregated 400 that leaves the report a clean DRAFT.

**Service change made during this verification (audit vocabulary):** `create()` audited a **DRAFT
create** under `DAILY_REPORT_SUBMITTED` - the same action the finalization writes - so a draft plus
its later submission produced two identical action rows for two different events. The DRAFT-create
audit is now `DAILY_REPORT_CREATED` (rename + comment at the call site); `DAILY_REPORT_SUBMITTED` now
means exactly one thing: DRAFT -> SUBMITTED. The backend suite was re-run after the rename.

**Harness fixes (gate only, no product change):** the `submitCalls` counter no longer counts CORS
pre-flights (they are OPTIONS), the revision-snapshot assertion now reads the real key names
(`stockConsumption`, not `consumption`), and the Review-tab check matches the rendered
`Revision: 1` label. The gate is repeatable: it provisions its own `(project, material)` stock fixture
through the real APIs and deletes every report/audit/movement it created, restoring the balance.

**Evidence:** verified during the Phase 4.4 browser/API/DB gate plus the supporting backend test,
`db:verify` and typecheck runs (31 suites / 320 tests, `db:verify` 71/71, typecheck exit 0). The gate
output, the 375px screenshots, the Jest / db-verify results and the three typecheck logs are local,
git-ignored artifacts and are not part of the repository; the evidence is summarized here and in
`VERIFICATION.md` -> Phase 4.4 (end of file).

### 2026-09-29 — Phase 3 Planning Gates P3-G / P3-H GREEN

**Completed (harness-only fixes — no product code changed):**
- `gate-p3-lib.js` — `EX_EMPTY_STATE` made null-safe (guards `document.body` + try/catch) and its regex rewritten with `^….*/m`: the old `[^\n]*` inside a JS string literal became a real newline at runtime → `SyntaxError: Invalid regular expression: missing /` in the browser.
- `gate-p3-lib.js` — `EX_DATE_BTNS` regex now matches the RO `Azi` label (`planning.today` = `"Azi"`, not `"Astăzi"`), so the date bar is fully counted.
- `gate-p3-lib.js` — new `evalSettle(client, expr, predicate)` retry helper exported (guards mid-navigation transient CDP states; returns last value so a check FAILs instead of crashing the gate).
- `gate-p3-h.js` — H08 clicks the `Azi` button (was `Astăzi`); H05/H07/H09 use `evalSettle`; H07/H09 re-select the project after `Page.navigate` so the for-date empty state renders.

**Verification:**
- `gate-p3-h.js` → 10/10 PASS (H05 44px date bar incl. `Azi`=64px; H07 `Nu există planuri pentru 15 ianuarie 2020…`; H08 `Azi` = local today; H09 `No plans for January 15, 2020…`), consoleErrors=0, networkErrors=0.
- `gate-p3-g.js` → 7/7 PASS (worker/TL/admin matrix + RO/EN), consoleErrors=0, networkErrors=0.

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

### 2026-09-26 — Phase 1-3 Foundation Repair (Frontend Audit Fixes)

**Completed:**
- **Phase 1 — Critical Dead-Button & Non-Functional UI Fixes:**
  - **Santiere page**: "Modifica Parametri" dead button now opens an edit modal for GPS coordinates and geofence radius. Saves via `apiClient.updateProject()` with validation.
  - **Profil page**: Language selector now functional (calls `setLocale` immediately). Name and phone fields editable with "Salveaza Profil" button. Email remains read-only. Uses `apiClient.updateProfile()` for persistence.
- **Phase 2 — RoleGuard Hardening:**
  - Added `RoleGuard` to 4 previously unguarded pages:
    - `/avize` — allowed for all authenticated roles
    - `/cheltuieli` — allowed for worker+ roles
    - `/pontaj` — allowed for all authenticated roles
    - `/rapoarte` — allowed for all authenticated roles
- **Phase 3 — UI Refresh & Missing UX:**
  - Added manual refresh buttons (with `RefreshCw` icon + loading spinner) to:
    - `/pontaj` — header refresh button
    - `/cheltuieli` — header refresh button
    - `/rapoarte` — header refresh button
  - Extracted `loadData` as `useCallback` in cheltuieli, pontaj, and rapoarte pages for reusable refresh
  - Fixed rapoarte photos placeholder text (mojibake repair)
  - Fixed pontaj page `exportAttendance` function (restored truncated CSV export)

**Verification:**
- Web build: 23 routes, 0 errors — PASS
- All typechecks pass (shared, web)

**Files Modified (7):**
| File | Change |
|------|--------|
| `web/src/app/santiere/page.tsx` | Added edit modal for GPS/geofence params |
| `web/src/app/profil/page.tsx` | Editable fields, functional language selector, save button |
| `web/src/app/avize/page.tsx` | Added RoleGuard wrapper |
| `web/src/app/cheltuieli/page.tsx` | Added RoleGuard + refresh button + useCallback loadData |
| `web/src/app/pontaj/page.tsx` | Added RoleGuard + refresh button + useCallback loadData |
| `web/src/app/rapoarte/page.tsx` | Added RoleGuard + refresh button + useCallback loadData + fixed placeholder text |

---

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

## Current Entry (2026-09-26) — Project List Page JSX Repair + Detail Page Completion

### Completed (Detail Page)
- **Fixed `page.tsx` structural issues:**
  - Removed duplicate `type TabKey` declaration
  - Added `status` and `isActive` derived variables from project object
  - Removed dead `successMsg` block, old `loadUsers` handlers, duplicate `MEMBER_ROLES`/`MEMBER_ROLE_LABELS` declarations
  - Added `formatDecimal` import, `PageTutorial` import, `users` state with `loadUsers`
  - Added `loadUsers` call in `useEffect`
- **Added Settings tab:**
  - Project info display grid (name, code, status, active status)
  - "Edit Project" button (visible to users with manage permission)
- **Added Edit Project modal (11 fields):**
  - Denumire (name), Cod (code) — required
  - Adresa (address), Latitudine, Longitudine
  - Raza Geofence (geofence radius in meters)
  - Capacitate (installed capacity MWp)
  - Buget Total, Moneda (RON/EUR/USD)
  - Data Inceput (start date), Data Finalizare Tinta (target end date)
  - Validation, save/cancel with loading state
- **Member management tab:** Working with role change, add member, remove member with confirmation
- **All tabs functional:** overview, members, teams, activity, settings
- **TypeScript fixes:** `useState<any[]>` for users, typed handler params, removed duplicate `status`/`isActive` declarations, `client` type assertions for `cui`/`contact_person`

### Completed (List Page — `projects/page.tsx`)
- **Fixed broken JSX structure:**
  - Closed unclosed `<EmptyState>` component (was missing `description`, `action` props and closing `/>)}`)
  - Closed unclosed table block (was missing `)}` after the table's closing `</div>`)
  - Completed `renderWizardStep2`'s `case 5:` (review step) with the orphaned review content (name, code, address, coordinates, capacity, dates, budget summary + amber warning)
  - Removed orphaned duplicate JSX fragments (24 lines) dangling after `export default function ProjectsPage()`
- **Fixed prop type mismatches:**
  - `ErrorState`: `action={{ label, onClick }}` → `onRetry={loadProjects}` (ErrorState has no `action` prop, uses `onRetry`)
  - `EmptyState`: `action={{ label, onClick }}` object → `<Button>` component (EmptyState's `action` prop expects `React.ReactNode`, not an object)

### Verification
- **Web typecheck: 0 errors** (`tsc --noEmit` passes)
- Detail page (`projects/[id]/page.tsx`): **0 TypeScript errors** (was 17)
- List page (`projects/page.tsx`): **0 TypeScript errors** (was 33+)

---

### 2026-09-27 — UI Component Library Upgrade (Phase 12)

**Completed:**
- **Created `web/src/hooks/useFocusTrap.ts`** — Focus trap hook that traps Tab/Shift+Tab focus inside a DOM element. Restores focus to the previously active element on deactivation. WCAG 2.4.3 (Focus Order) compliant.
- **Upgraded `web/src/components/ui/Modal.tsx`** — Added:
  - Focus trap via `useFocusTrap` hook
  - Stronger backdrop (`bg-black/60` + `backdrop-blur-sm`)
  - `tabIndex={-1}` on dialog panel for programmatic focus
  - `focus:outline-none focus:ring-2` on close button
  - `e.preventDefault()` + `e.stopPropagation()` on Escape handler
  - `{ capture: true }` event listener option for Escape handling
  - `ref={dialogRef}` on panel for focus trap ref
- **Created `web/src/components/ui/ConfirmDialog.tsx`** — New component modeled after OpenConstructionERP `ConfirmDialog`:
  - `role="alertdialog"` with `aria-describedby` for accessibility
  - `danger` (red) and `warning` (amber) variants with corresponding icons (Trash2 / AlertTriangle)
  - `loading` state with spinner on confirm button
  - Focus trap + Escape key + backdrop click to dismiss
  - Auto-focuses confirm button on open
  - `title`, `message`, `confirmLabel`, `cancelLabel` props
  - Smooth entrance animation (`animate-in fade-in zoom-in-95`)
- **Upgraded `web/src/components/ui/Button.tsx`** — Added:
  - `forwardRef` support for ref forwarding
  - `iconPosition` prop (`'left' | 'right'`) for icon placement
  - `hover:scale-[1.02] active:scale-[0.98]` hover/active scale effects on `primary`/`danger` variants
  - `transform-gpu will-change-transform` for GPU-accelerated animations
  - `disabled:scale-100` to prevent scale on disabled buttons
  - Loading spinner now keeps children visible alongside it (instead of hiding them)
  - `rounded-md`/`rounded-lg`/`rounded-xl` per size variant
- **Upgraded `web/src/components/ui/EmptyState.tsx`** — Added:
  - `EmptyStateAction` interface export (`{ label, onClick }`)
  - `action` prop now accepts both `ReactNode` and `EmptyStateAction` objects
  - When an object is passed, renders a styled `<button>` with the label text
- **Updated `web/src/components/ui/index.ts`** — Added exports for `ConfirmDialog`, `ConfirmDialogProps`, `EmptyStateAction`

**Patterns adopted from OpenConstructionERP:**
- Modal focus trap and keyboard handling
- Confirm dialog with `danger`/`warning` variants, loading state, icon
- Button `forwardRef`, `iconPosition`, hover scale effects
- EmptyState dual-type action prop

**Verification:**
- All 5 new/modified files verified via content readback
- Imports use correct relative paths (`../../hooks/useFocusTrap`)
- Barrel export correctly exposes `ConfirmDialog`, `ConfirmDialogProps`, `EmptyStateAction`

**Live verification:** TypeScript typecheck passes cleanly; both `/projects` and `/projects/[id]` return HTTP 200.

---

### ✅ Phase D — Design System Foundation (COMPLETE 2026-09-27)

**Sub-track of CLINE_MASTER_ROADMAP PHASE 0.** Decisions documentation, design tokens alignment, and redesigned app shell.

| Block | What | Files |
|-------|------|-------|
| **D0** | Decisions + Design System docs | `DECISIONS.md` (DEC-011), `DESIGN_SYSTEM.md` (new), `ISSUES.md` (ISSUE-036/037), `PROGRESS.md`, `HANDOFF.md`, `VERIFICATION.md` |
| **D3.1** | ToastProvider P0 fix | `AppShell.tsx` — mount `<ToastProvider>` inside `<AuthGuard>` |
| **D1** | Design tokens | `tailwind.config.js` — semantic color aliases, zIndex ladder, boxShadow.focus, maxWidth.page, transition duration; `globals.css` — AA contrast fix (hii-500→hii-600), shell tokens, reduced-motion guard, `.hii-skeleton`, `.hii-scrollbar-thin`, shell utilities |
| **D3.2** | Navigation config | `web/src/config/navigation.ts` (new) — single source of truth for nav groups, items, icons, roles, i18n keys |
| **D3.3** | Sidebar rewrite | `Sidebar.tsx` — shared NavList renderer, collapsible, i18n'd, proper z-index tokens, `aria-current="page"`, `hii-scrollbar-thin` |
| **D3.4** | Header rewrite | `Header.tsx` — `Button variant="ghost" size="icon"`, `DropdownMenu` for user, i18n'd strings, breadcrumb slot |
| **D3.5** | New components | `DropdownMenu.tsx`, `Breadcrumbs.tsx`, `useClickOutside.ts`, `useMediaQuery.ts` |
| **D3.6** | Button icon size | `Button.tsx` — `size='icon'` variant (backwards-compatible); barrel export updated |
| **i18n** | Nav + header keys | `shared/src/translations.ts` — 23 new `nav.*` keys, 7 new `header.*` keys, 3 `sidebar.*` keys |

**Verification:**
- `npm run typecheck` — ALL PASS (shared, web, mobile, backend)
- `npm run build --workspace=web` — 25 routes, 0 errors
- `/projects` page no longer throws ToastProvider error (P0 fix)
- AA contrast fixed: `.hii-btn-primary` now uses `hii-600` (6.15:1 ratio)
- Shell a11y: `aria-current="page"`, skip link, Escape closes drawer, `prefers-reduced-motion` guard

---

## Operational Vertical Slices (role-aware, wired to real backend)

Built as **real vertical slices** (not visual redesigns): every action hits a live NestJS endpoint, shows loading/error/success states, and reflects in the UI. OpenConstructionERP used only as UX reference (no source copied).

### ✅ Slice 1 — Projects (`/projects`, `/projects/[id]`) — COMPLETE 2026-09-27

| Flow step | Implementation | Backend endpoint |
|-----------|----------------|------------------|
| List projects | search + status filter, loading/error/empty states | `GET /api/projects` |
| Create project | 7-step wizard with per-step validation, member add, success toast | `POST /api/projects`, `POST /api/projects/:id/members` |
| Project detail | overview incl. client info | `GET /api/projects/:id` |
| Edit settings | status/dates/budget/currency/active | `PATCH /api/projects/:id` |
| Manage members | add / change role / remove (ConfirmDialog) | `POST/PATCH/DELETE /api/projects/:id/members/...` |
| Manage stages | list + create stages | `GET/POST /api/projects/:id/stages` |

Files: `web/src/features/projects/{types,api}.ts`, `web/src/app/projects/page.tsx`, `web/src/app/projects/[id]/page.tsx`, `ProjectSettingsPanel.tsx`, `ProjectStagesPanel.tsx`, `web/src/lib/auth-guard.tsx` (role-based).

### ✅ Slice 2 — Pontaj / Field Time (`/pontaj`) — COMPLETE 2026-09-27

| Experience | Flow step | Implementation | Backend endpoint |
|------------|-----------|----------------|------------------|
| Worker | today's shift → project → check-in → active shift → assigned work → check-out → hours → result | shift-card state machine with live elapsed timer + GPS distance, assigned-work panel (tasks filtered to me) | `GET /api/attendance/my-logs`, `POST /api/attendance/check-in`, `POST /api/attendance/check-out`, `GET /api/tasks?projectId=` |
| Supervisor | team attendance → missing attendance → current workers → hours → corrections | `GET /api/attendance/today` stat cards, active-on-site list, role-aware missing-attendance (needs user directory — see ISSUE-039), daily register + monthly matrix, CSV export, corrections gap note (ISSUE-038) | `GET /api/attendance/today`, `GET /api/attendance`, `GET /api/users` (ADMIN/MANAGER/PM only) |

Files: `web/src/features/attendance/{types,api}.ts`, `web/src/components/WorkerAttendanceView.tsx`, `web/src/app/pontaj/page.tsx`, `web/src/lib/api/attendance.ts` (forwards to feature adapter).

**Backend gaps documented (not simulated):** ISSUE-038 (no corrections endpoint), ISSUE-039 (`GET /api/users` limited to ADMIN/MANAGER/PM).

### ✅ Slice 3 — Tasks (`/tasks`) — COMPLETE 2026-09-27

| Flow step | Implementation | Backend endpoint |
|-----------|----------------|------------------|
| List tasks | search + status tabs (with live counts) + "only my tasks" filter, loading/error/empty states | `GET /api/tasks?projectId=` |
| Task card | status badge, code, work package, planned dates, assignee chips, quantity-derived progress bar | — |
| Create task | modal (title + code required), work-package/zone picker, planned dates, planned quantity + UoM | `POST /api/tasks` |
| Update status | frontend workflow map `TASK_WORKFLOW_NEXT` (PLANNED → READY/IN_PROGRESS/BLOCKED/CANCELLED → COMPLETED → VERIFIED); auto-fills `actualStart` / `actualEnd` | `PATCH /api/tasks/:id` |
| Progress | **derived from `actual_quantity / planned_quantity`** — there is no `progress` field in the schema | `PATCH /api/tasks/:id` (`actualQuantity`) |
| Assign | modal listing real project members, hides already-assigned users | `POST /api/tasks/:id/assign`, `GET /api/projects/:id/members` |
| Dependencies | read-only prerequisites / dependents chips from the task relations | `GET /api/tasks/:id` (relations) |

Files: `web/src/features/tasks/{types,api}.ts`, `web/src/app/tasks/page.tsx`, `web/src/lib/api/tasks.ts` + `web/src/types/task.ts` (legacy barrels forwarding to the canonical feature module).

**Stale contract removed:** the previous `/tasks` page invented `priority`, `progress`, `assigned_to_id` and `due_date` fields and used non-existent statuses (`TODO`, `DONE`, `REVIEW`, `ON_HOLD`). All of these were deleted; the page now mirrors the Prisma `Task` model and the real `TaskStatusEnum` only. `TasksController` exposes **no DELETE route**, so no delete action is offered.

---

### ✅ Phase 3 — Gate F Follow-up: Planning Progress Permission Parity (COMPLETE 2026-09-28)

The Gate F audit found the `/planning` UI enabling a DailyPlanTask progress edit that the backend
rejects with 403 for users outside the assignment/team scope (test admin). Fixed frontend-only;
backend, `ProjectAccessGuard`, API contracts, shared UI, `/tasks` and Worker My Day untouched.

| Change | Detail | Status |
|--------|--------|--------|
| `canUpdateTaskProgress` (types.ts) | Now the role-eligibility layer only; worker/technician assignment check preserved verbatim | ✅ UPDATED |
| Backend scope signal | New `collectEditablePlanTaskIds` reads the existing `GET /api/daily-plans/my-tasks?date=` (the backend's own assignee/plan-team rule for PUBLISHED plans); no new backend endpoint | ✅ ADDED |
| Full decision | New `canEditPlanTaskProgress` = role eligibility + PUBLISHED + backend scope; fail-closed (unknown/failed scope → read-only) | ✅ ADDED |
| UI wiring | `PlanTaskRow` renders read-only (disabled input + toggle, no save path) unless the plan task is in scope; `PlanCard` + `/planning` page pass the scope set; `my-tasks` fetched in parallel, failure → read-only | ✅ UPDATED |
| Verification | Shared + web typecheck PASS; production build PASS (25 routes); 11/11 CDP checks on prod build — non-member admin read-only + cannot PATCH, assigned TL save → PATCH 200 persisted, unchanged → no PATCH | ✅ PASS |

Files: `web/src/features/planning/{types,api,index}.ts`, `components/PlanTaskRow.tsx`, `components/PlanCard.tsx`, `web/src/app/planning/page.tsx`. See ISSUE-041 and VERIFICATION.md → Phase 3 Gate F Follow-up.

## Next Actions

1. **Vertical Slice 4 — Planning** (`/planning`) — audit DailyPlan controller/service before building.
2. Continue slices in order: Teams/Workers → Stock & Deliveries (`/stocuri`, `/avize`) → Documents → Reports/Dashboard.
3. D4 — page-level adoption of design tokens/components (align colors with semantic tokens, add `aria-current` etc.)
4. R2.6 Audit — implement remaining audit recommendations
5. Authorization refinements — `actorId` propagation from auth context; deeper per-action UI gating for SITE_MANAGER/FOREMAN
6. DTO validation — class-validator decorators (e.g. `PATCH /api/tasks/:id` returns 500 instead of 400 for a non-numeric `actualQuantity`)
7. Resolve ISSUE-038 (attendance corrections endpoint) and ISSUE-039 (field-supervisor user directory)
8. **ISSUE-051 - Mobile daily report screen** - `taskId` is sent as free text (a truncated task
   description) so the API answers 404 "Task ... not found" for any report that has a task, and the
   AsyncStorage draft is deleted *before* the API/queue call, so a failed submit loses the draft.
   The Mobile app was not part of the P4.4 browser verification - fix both before calling the Mobile
   daily report verified.
9. **ISSUE-059 (opened by R1B.1)** - `PageTutorial` defaults `locale` to `'ro'` and none of its 16 call
   sites passes it, so every page introduction card renders Romanian in the EN locale. Thread the
   active locale (`useLocale()` from `shared/src/i18n.ts`) into all 16 call sites and add an assertion
   so a card cannot silently fall back to RO.

See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) and [HANDOFF.md](HANDOFF.md) for detailed planning.
