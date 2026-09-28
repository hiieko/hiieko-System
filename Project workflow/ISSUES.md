# Issues

Last Updated: 2026-09-27 (Operational Vertical Slices: Projects + Pontaj + Tasks; ISSUE-040 added for the missing DTO validation found during the Tasks live smoke test)

## Status Legend
- `OPEN`
- `IN PROGRESS`
- `BLOCKED`
- `RESOLVED`
- `WONT FIX`

# Open Issues

---

## ISSUE-035 — Tasks controller missing @Roles on all endpoints
**Status:** ✅ `RESOLVED` (2026-09-25 — R2.1 P5 authorization sweep)

### Description
The tasks controller had missing or incomplete `@Roles()` decorators on its endpoints, leaving them accessible to roles that should not have access.

### Resolution
All 4 task endpoints now have explicit `@Roles()` decorators matching the authorization matrix. Verified via code inspection.

---

## ISSUE-034 — Registration allows any role to be self-assigned
**Status:** ✅ `FIXED` (2026-09-25 — Phase 3.2 security hardening)

### Description
The public `POST /api/auth/register` endpoint allowed any role to be specified in the request body, enabling self-elevation to privileged roles.

### Resolution
Registration now whitelists only WORKER and VIEWER roles. All privileged roles (ADMIN, OWNER, MANAGER, PM, SITE_MANAGER, etc.) must be assigned by an ADMIN via the admin panel. Verified via `auth-registration.spec.ts` test.

---

## ISSUE-033 — Project-scope query filtering not applied in all controllers
**Status:** ✅ `FIXED` (2026-09-25 — Phase 3.2 authorization sweep)

### Description
After implementing `buildScopedProjectWhere()` in ProjectAccessGuard, some controller/service pairs were not passing the scoped project filter into their Prisma queries, allowing cross-project data access.

### Resolution
All 13 controller/service pairs that handle project-scoped entities now correctly pass the `buildScopedProjectWhere()` result into their Prisma `findMany`/`findFirst`/etc. queries. Verified via `project-scope.controller.spec.ts` test.

---

## ISSUE-016 — Backend Jest has pre-existing Babel/ts-jest configuration issue
**Status:** ✅ `RESOLVED` (2026-09-23 — R2.1 P2 checkpoint)

### Description
Running `npm run test --workspace=backend` previously triggered a Jest configuration
error. As of the R2.1 P2 checkpoint, the issue has been resolved: `npm run test`
(which runs `jest --config jest.config.json`) passes all 12 test suites and 69 tests
with exit 0.

### Resolution
The configuration issue was resolved naturally during the R2.1 P2 implementation
and Supabase runtime removal. The exact project command (`npm run test`) now
reports:
- **Test Suites:** 12 passed, 12 total
- **Tests:** 69 passed, 69 total
- **Exit code:** 0

---

## ISSUE-015 — `supabase/` directory retained as the data-migration DDL source of truth
**Status:** ✅ `RESOLVED` (D-015 — archived 2026-09-23)

### Description
After the Supabase runtime removal (2026-09-23) the `supabase/` directory had **zero runtime references**, but it was still required by the data-migration path:
- `database/migrations/002_migrate_supabase_data.sql` (line 17) stated: *"SOURCE OF TRUTH for legacy columns: `supabase/full_setup.sql` (migrations 01-08)."*
- That migration implements a two-schema ETL (`legacy.*` -> `public.*`) whose column names were verified against `supabase/full_setup.sql`.
- `database/scripts/run_migration.ts` instructs the operator to stage a dump by applying `supabase/full_setup.sql` with `search_path=legacy`.

### Resolution (2026-09-23)
Archived `supabase/` to `database/archive/supabase-migrations/`. Updated references in `002_migrate_supabase_data.sql` and `run_migration.ts` to point to the archive path. The ETL migration continues to work; the active runtime tree is now Supabase-free.

---

## ISSUE-014 — `apiClient.uploadFile()` targets a non-existent `/api/upload` route
**Status:** ✅ `IMPLEMENTED + VERIFIED` (2026-09-23)

### Description
`Mobile/src/services/apiClient.ts` -> `uploadFile()` POSTs to `/api/upload`, but the backend had no upload controller. Any caller would receive a 404.

### Impact
Latent only. The receipt scan flow did not use it (it used `POST /api/ocr/process` and `POST /api/ocr/jobs`).

### Resolution
**Implemented (2026-09-23):** `POST /api/upload` exists (`backend/src/modules/upload/`) with JWT auth, multipart handling, MIME allowlist, 10 MB cap, safe server-generated object keys, `Document` + `DocumentVersion` metadata, and authenticated retrieval at `GET /api/upload/:documentId`. `apiClient.uploadFile()` was extended and is now called by the receipt flow.

---

## ISSUE-013 — No server-side document blob storage (receipt images stay on the device)
**Status:** ✅ `IMPLEMENTED + VERIFIED` (2026-09-23)

### Description
The PostgreSQL/Prisma schema models the receipt<->expense relationship as `Document` / `DocumentVersion` (`storage_path`) plus `OCRJob(expense_id, raw_payload)`, but there was **no** binary storage service in the backend.

### Impact
Receipt images remained only on the device. The OCR extraction and all expense fields were fully persisted in PostgreSQL. Offline behaviour was unchanged (SQLite sync queue).

### Resolution
**Implemented (2026-09-23):** Server-side blob storage added via `StorageService` abstraction (local-disk driver). `POST /api/upload` accepts multipart receipt images, stores them under `storage/uploads/receipts/<yyyy>/<mm>/<uuid>.ext`, creates `Document` + `DocumentVersion` rows with `storage_path` + `checksum` (SHA-256) + `file_size`. Authenticated `GET /api/upload/:documentId` streams the binary back. **Verified live** — 10/10 smoke tests.

---

## ISSUE-012 — Orphan `public.time_logs` table (3 frozen rows, no runtime readers)
**Status:** ✅ `RESOLVED` (D-012 — dropped 2026-09-23)

### Description
`public.time_logs` is a non-Prand-managed table containing 3 legacy rows from the Supabase era. After `upsertLegacyTimeLog()` was removed, no code reads it. It has no FK children, no triggers, no RLS policies, no grants.

### Audit Findings (2026-09-23)
- 3 rows, all matched to `attendance_records` by ID
- 0 FK references, 0 triggers, 0 RLS policies, 0 grants
- 0 active code references in `backend/src`, `backend/test`, `web/src`, `Mobile/src`, `shared/src`
- Not Prisma-managed

### Resolution (2026-09-23)
- Backed up the 3 rows to `database/archive/backup_time_logs.sql`
- Created Prisma migration `20260923140000_drop_time_logs`
- Applied migration successfully
- Verified table no longer exists
- All 11 backend test suites (52 tests) pass
- Backend typecheck + build pass
- Shared + Web typecheck + build pass

---

## ISSUE-006 — `.gitignore` file needs cleanup
**Status:** ✅ `RESOLVED` (2026-09-22)

**Changes:**
- Consolidated duplicate `node_modules/` patterns
- Added `storage/uploads/`
- Added `.supabase/`
- Removed redundant OS-specific entries

---

## ISSUE-005 — Mobile submits missing
**Status:** ✅ `RESOLVED` (2026-09-22)

**Changes:**
- All 4 submit screens now call NestJS APIs with JWT auth
- Offline queuing via SQLite sync queue
- Tested live against PostgreSQL 18

---

## ISSUE-001/002/003/004/007/008/009
**Status:** ✅ All `RESOLVED` — see earlier entries in this document for details.

---

## ISSUE-036 — ToastProvider never mounted → `/projects` page runtime crash
**Status:** 🚨 OPEN (P0)

## Context
`web/src/components/ui/Toast.tsx` exports `ToastProvider` and `useToast()`. The `useToast()` hook (line 118) **throws** `useToast must be used within a ToastProvider` when called outside the provider tree. `projects/page.tsx:45` calls `useToast()`, but **no component mounts `ToastProvider`**.

## Evidence
- `AppShell.tsx`: wraps children in `AuthGuard → ProjectProvider → div → Sidebar/Header/main` — no ToastProvider.
- `layout.tsx`: wraps in `LocaleProviderClient → AuthProvider → AppShell` — no ToastProvider.
- `grep -r 'ToastProvider' web/src/` → only in `ui/index.ts` barrel and `Toast.tsx` itself.

## Impact
- `/projects` page throws immediately on render; the toast error itself is uncatchable by React error boundaries without custom handling.
- All pages that will call `useToast()` in the future would hit the same error.

## Resolution
- Fixed on 2026-09-27: `AppShell.tsx` wraps content in `<ToastProvider>` inside `<AuthGuard>` (available to all authenticated routes; `/login` and `/signup` are excluded by the early return).

## ISSUE-037 — `.hii-btn-primary` AA contrast failure
**Status:** 🚨 OPEN

## Context
CSS class `.hii-btn-primary` in `globals.css:139` uses `bg-hii-500 text-white` (green `#188C51` on white). WCAG AA ratio ≈ **4.28:1**, below the 4.5:1 threshold for normal-sized text (14px/15px buttons). The `Button` component (`Button.tsx:21`) correctly uses `bg-hii-600` (6.15:1).

## Impact
- Any page using the raw CSS class (not the component) renders inaccessible buttons.
- Users with low vision may not distinguish button text from background.

## Resolution
- CSS class `.hii-btn-primary` updated to `bg-hii-600 hover:bg-hii-700 active:bg-hii-800` (matching `Button` component).

---

## ISSUE-038 — No attendance corrections endpoint (supervisor hours correction)
**Status:** 🟡 `OPEN` — documented backend gap (Pontaj slice, 2026-09-27)

### Description
The Pontaj supervisor experience needs a corrections path ("hours → corrections where backend authorization allows"). The backend has **no PATCH/POST endpoint to adjust an `attendance_record`** (hours, check-in/check-out times, or overtime) — `AttendanceController` only exposes: `GET /api/attendance`, `POST /api/attendance/check-in`, `POST /api/attendance/check-out`, `GET /api/attendance/today`, `GET /api/attendance/my-logs`.

### Impact
- The `/pontaj` page shows an honest note instead of simulating corrections.
- A supervisor cannot correct a mis-stamped check-in/check-out through the UI until the backend ships the endpoint.

### Resolution
Not started — requires a backend `PATCH /api/attendance/:id` (roles: ADMIN, OWNER, MANAGER, PM) with audit trail, plus a UI dialog in `/pontaj`.

---

## ISSUE-039 — `GET /api/users` restricted to ADMIN/MANAGER/PM blocks field-supervisor panels
**Status:** 🟡 `OPEN` — documented backend gap (Pontaj slice, 2026-09-27)

### Description
`UsersController.findAll` (`GET /api/users`) is `@Roles(ADMIN, MANAGER, PM)` (plus OWNER bypass). SITE_MANAGER, FOREMAN and TEAM_LEADER receive **403**. The Pontaj supervisor panels (missing-attendance list, monthly matrix roster) need the org user directory to compute "who did not check in" and to render a full monthly grid.

### Impact
- `/pontaj` shows a clear note for these roles instead of the missing-attendance list.
- The monthly matrix renders only rows derivable from attendance records.

### Resolution
Not started — either widen `GET /api/users` to field-supervisor roles (with org-scoping) or add a purpose-built `GET /api/attendance/roster` endpoint returning only field users.

---

## ISSUE-040 — Task write endpoints lack DTO validation → HTTP 500 instead of 400
**Status:** 🟡 `OPEN` — documented backend gap (Tasks slice, 2026-09-27)

### Description
`POST /api/tasks` and `PATCH /api/tasks/:id` accept the request body without `class-validator` DTOs. During the Tasks slice live smoke test, sending `{ "actualQuantity": "not-a-number" }` to `PATCH /api/tasks/:id` returned **HTTP 500** (unhandled Prisma `Decimal` conversion error) instead of a client error (400/422).

### Impact
- Malformed input surfaces as a server error, polluting error monitoring and giving clients no actionable message.
- The `/tasks` UI does **not** trigger this (the quantity editor guards with `Number(value)` + `Number.isFinite`), so the slice is not blocked.
- The same pattern likely affects other controllers that lack DTOs.

### Resolution
Not started — add `class-validator` DTOs (`CreateTaskDto`, `UpdateTaskDto`) with `@IsEnum(TaskStatusEnum)`, `@IsNumber()`, `@IsISO8601()` and enable a global `ValidationPipe` so invalid bodies return 400. Tracked in `PROGRESS.md` → Next Actions → DTO validation.

---

## ISSUE-041 — Planning progress UI enabled edits the backend rejects (UI/backend permission mismatch)
**Status:** ✅ `FIXED` — frontend-only parity fix (2026-09-28, Gate F follow-up)

### Description
`canUpdateTaskProgress` (`web/src/features/planning/types.ts`) granted `site_manager+` and
`team_leader`/`foreman` edit rights on DailyPlanTask progress based on **role alone**. The backend
applies two additional, role-independent gates on `PATCH /api/daily-plans/tasks/:id/progress`:
- `ProjectAccessGuard` — global-scope roles (ADMIN/OWNER/PM/MANAGER) bypass; other roles require project membership;
- `DailyPlansService.updateTaskProgress` — plan must be PUBLISHED **and** the user must be a task assignee OR a member of the plan's team (**no role bypass** → 403 "You are not assigned to this task or its team").

Found by Gate F check 18: the test admin's PATCH returned 403 while the UI had enabled the input.
(The actual 403 came from the service-level assignment/team check; the guard passed for ADMIN as a
global-scope role.)

### Impact
- The UI offered an editable quantity control that the backend rejected with 403 (misleading error toast).

### Resolution
FIXED (frontend only — backend, ProjectAccessGuard, API contracts, shared UI, `/tasks`, Worker My
Day untouched; no new backend endpoint):
- `canUpdateTaskProgress` is now the role-eligibility layer only (docblock corrected; worker/technician assignment check preserved verbatim).
- New `collectEditablePlanTaskIds` derives the backend scope from the existing `GET /api/daily-plans/my-tasks` endpoint (the backend's own assignee/team rule for PUBLISHED plans).
- New `canEditPlanTaskProgress` = role eligibility + PUBLISHED + backend scope, **fail-closed** (unknown scope → read-only).
- `PlanTaskRow`/`PlanCard`/`/planning` render read-only progress (disabled input + toggle, no save path) unless the plan task is in the backend scope signal; `my-tasks` failure → read-only.
- Verified on the production build: 11/11 checks (`verify-parity.js`) — non-member admin read-only and unable to PATCH; assigned TL save → single PATCH 200 persisted; unchanged value → no PATCH. See `VERIFICATION.md` → Phase 3 Gate F Follow-up.

---

## ISSUE-042 — Tasks backend performs no status-transition validation (frontend `TASK_WORKFLOW_NEXT` is the sole guard)
**Status:** 🟡 `OPEN` — documented backend gap (Phase 2 tasks experience, 2026-09-28); **do NOT fix inside a frontend phase**

### Description
`TasksService.update()` (backend/src/modules/tasks/tasks.service.ts) passes `dto.status` straight to Prisma. There is no server-side enforcement of the workflow map, so any role with `PATCH` rights can set any status in any order (e.g. `VERIFIED → PLANNED`, or straight to `CANCELLED`).

### Impact
- The frontend enforces the canonical workflow (`TASK_WORKFLOW_NEXT` in `web/src/features/tasks/types.ts`): `PLANNED → READY/IN_PROGRESS/BLOCKED/CANCELLED`, `READY → IN_PROGRESS/BLOCKED/CANCELLED`, `IN_PROGRESS → COMPLETED/BLOCKED/CANCELLED`, `BLOCKED → READY/IN_PROGRESS/CANCELLED`, `COMPLETED → VERIFIED`, `VERIFIED`/`CANCELLED` terminal. Every frontend-offered transition succeeds; none is rejected.
- API-level clients (scripts, mobile, direct HTTP) can bypass the workflow. Data-honesty impact is limited to status ordering; no field is corrupted.
- Related but distinct: ISSUE-040 (missing DTO validation → 500 on malformed bodies). A proper `UpdateTaskDto` (ISSUE-040) is the natural place to also add transition validation.

### Resolution
Not started — backend change, out of Phase 2 scope. Add transition validation in `TasksService.update()` (reject illegal `current → next` pairs with 400/409) or a dedicated state-machine guard, plus unit tests. Frontend must remain the UX-level guard regardless.

---

# Known Limitations (not blocking)

- **Mobile `WorkerAttendanceScreen.tsx`** — The `TimeLog` type in `shared/src/types.ts` and the local AsyncStorage-based `activeTimeLog` mechanism are the mobile app's offline attendance state tracking (not the PostgreSQL table, which is now dropped). This is correct and stays.
- **`HOW_TO_RUN.md` and `Project workflow/CONFIGURATION.md`** — These documentation files still reference Supabase setup steps. They are outdated but harmless (no runtime impact). Should be updated as part of a documentation pass.
- **`MOBILE_MIGRATION_PROGRESS.md` and other migration docs** — Historical migration documents that reference Supabase. These are archival/planning docs, not runtime dependencies.
- **`ocr-service/README.md`** — References Supabase as part of the historical architecture description. This is a standalone OCR service, not an active runtime dependency.
- **`PermissionsGuard` not activated** — The `PermissionsGuard` exists but is not wired into any controller. Permission tables are unseeded. Deferred from P5.
- **`GET /api/procurement/avize/:id` route missing** — The procurement controller lacks this single-aviz retrieval endpoint. Documented in HANDOFF.md.
- **RoleGuard on 12 pages** — Client-side route guard blocks direct URL access for unauthorized roles on: projects, project detail, teams, workforce, santiere, statistici, aprobare, utilizatori, avize, cheltuieli, pontaj, rapoarte pages.
- **ISSUE-033/034/035 FIXED** — Project-scope query filtering, registration role whitelist, and tasks controller @Roles all resolved during Phase 3.2.
- **Santiere page**: "Modifica Parametri" button now opens functional edit modal (FIXED 2026-09-26).
- **Profil page**: Language selector now functional, name/phone editable (FIXED 2026-09-26).
- **Missing refresh buttons**: Added to pontaj, cheltuieli, rapoarte pages (FIXED 2026-09-26).
