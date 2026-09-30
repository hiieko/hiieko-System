# Issues

Last Updated: 2026-09-29 (ISSUE-048 RESOLVED - Daily Report "Proposed Work" now persists in its own `daily_reports.proposed_work` column (migration `20260929170000_add_daily_report_proposed_work`), independent of `general_notes`; backend + shared + web changes and a 375px EN/RO browser gate are green. Earlier the same day: dev field-team data seeded and browser-verified (12 accounts / 3 teams / 12 tasks / 3 published daily plans), ISSUE-049 opened OPEN (two concurrent `next dev` servers corrupting web/.next), P4.3.1 daily report PERSISTENCE VERIFIED, ISSUE-047 RESOLVED)

> **2026-09-30 (Daily Planning supervisor day surface, UNCOMMITTED):** **ISSUE-062 opened** — the My-work
> card prints the raw `plan_date` timestamp (pre-existing; the surface is outside the approved Daily
> Planning file list, so it was recorded rather than changed). Nothing was closed or reopened by the
> slice: ISSUE-041 fail-closed progress editing, the worker/technician data scope and the plan lifecycle
> were re-verified unchanged on the live stack.

## Status Legend
- `OPEN`
- `IN PROGRESS`
- `BLOCKED`
- `RESOLVED`
- `WONT FIX`

# Open Issues

## ISSUE-062 — My-work card prints the raw `plan_date` timestamp instead of a localized date
**Status:** 🟡 `OPEN` (opened 2026-09-30 during the Daily Planning day-surface verification; **pre-existing**, not a regression of that slice)

### Description
`DailyPlan.plan_date` is a Prisma `DateTime`, and the API serialises it as a full ISO timestamp
(`2026-09-29T00:00:00.000Z`). `formatDateLong()` (`web/src/features/planning/summary.ts`) parses a
`YYYY-MM-DD` string with `split('-')` + `Number()`; for the ISO value `Number('29T00:00:00.000Z')` is
`NaN`, so the helper returns its input unchanged and the card heading prints the raw timestamp.

Measured surfaces (2026-09-29, CJ-003, real stack): `MyWorkList` — the worker/technician "My work" view
of `/planning` — rendered 1 raw-ISO occurrence; the identical call exists in `PlanCard`, which the
supervisor view no longer renders after the day-surface change.

### Impact
User-visible cosmetics only (the card heading reads `2026-09-29T00:00:00.000Z` instead of
`29 septembrie 2026` / `September 29, 2026`). No data or permission risk.

### Fix (deliberately NOT applied — outside the approved Daily Planning file list)
The day table already ships the normalizing helper: `formatPlanDate(plan.plan_date, locale)`
(`web/src/features/planning/dayDerivations.ts`) extracts the `YYYY-MM-DD` part before delegating to
`formatDateLong`. Replacing the `formatDateLong(plan.plan_date, locale)` call in `MyWorkList` (and in
`PlanCard`, should it be rendered again) with that helper closes the issue.

### Evidence
`VERIFICATION.md` → *Daily Planning — supervisor day surface `/planning`*: the supervisor surface asserts
**0** matches of `/\d{4}-\d{2}-\d{2}T\d{2}:/`, while the worker scenario measured **1**.

## ISSUE-044 — Backend missing PATCH endpoint for draft daily report editing
**Status:** ✅ `RESOLVED` (2026-09-29 — P4.3 backend slice)

### Description
The backend had only `GET /api/daily-reports`, `GET /api/daily-reports/:id`, and `POST /api/daily-reports`. There was no way to update an existing `DRAFT` report — each `POST` always created a new report. Draft editing was impossible without this endpoint.

### Resolution
Added `PATCH /api/daily-reports/:id` with:
- `UpdateDailyReportDto` (all fields optional)
- `DailyReportsService.update()` — DRAFT-only, owner-or-ADMIN authorization, cross-project task integrity validation, atomic delete+create for child collections
- Controller endpoint with `@RequireEntityProjectAccess` and `@Roles` (same as POST)
- 9 new tests (15/15 pass); typecheck 0 errors; no migration required

### Security
- Only DRAFT reports can be updated
- Only report owner (team_leader_id) or ADMIN/OWNER can edit
- Project access enforced via `RequireEntityProjectAccess`
- Cross-project task integrity validated
- No stock deduction, no approval, no revision creation

### Files Changed
- `backend/src/modules/daily-reports/dto/update-daily-report.dto.ts` (NEW)
- `backend/src/modules/daily-reports/daily-reports.service.ts` (+ import, + update() method)
- `backend/src/modules/daily-reports/daily-reports.controller.ts` (+ import, + Patch endpoint)
- `backend/test/daily-reports.service.spec.ts` (+ import, + 9 tests)

---

---

## ISSUE-045 — Daily report status contract drift: web draft create produced SUBMITTED (hence uneditable)
**Status:** ✅ `RESOLVED` (2026-09-29 — P4.3.1 status contract)

### Description
`daily_reports.status` is a plain `TEXT NOT NULL DEFAULT 'SUBMITTED'` column (init migration `20260922102428`, line 358) — there is no enum type and no CHECK constraint. The 5-value set (`DRAFT | SUBMITTED | APPROVED | REJECTED | CANCELLED`) exists only in `shared/src/types.ts`, `backend/scripts/db-verify.ts` and the workflow docs.
`POST /api/daily-reports` therefore always produced `SUBMITTED` (web `toCreateDto()` and Mobile both omitted `status`), while `PATCH /api/daily-reports/:id` is DRAFT-only — so the documented "draft create via POST, draft edit via PATCH" flow (PROGRESS.md — Phase 4.3 Frontend Daily Report Form) could not work end to end: the first save produced a locked report.
Verified live before the fix: allowed vocabulary actually used in dev DB was `SUBMITTED` only.

### Resolution
- Create contract: `status` stays optional — omitted ⇒ DB default `SUBMITTED` (Mobile + offline queue unchanged); explicit `'DRAFT'` or `'SUBMITTED'` accepted; anything else ⇒ 400 `status must be one of ['DRAFT', 'SUBMITTED']`.
- `DailyReportsService.create()` enforces that whitelist at runtime (POST is not covered by the global ValidationPipe because the controller's body type is a TypeScript interface → metatype `Object`) and now writes `status: dto.status`.
- `dto/create-daily-report.dto.ts` mirrors the optional field for Swagger/contract parity.
- Web `web/src/features/daily-reports/helpers.ts` → `toCreateDto()` sends `status: 'DRAFT'`, so create → edit works.
- Approval/rejection statuses are NOT transitionable yet — they belong to the later review workflow. No submit/approve/reject endpoint, no stock, no revisions, no notifications.
- No Prisma schema change, no migration, no enum, no CHECK constraint.

### Files Changed
- `backend/src/modules/daily-reports/daily-reports.service.ts` (status whitelist in `create()`, `status: dto.status`)
- `backend/src/modules/daily-reports/dto/create-daily-report.dto.ts` (mirrored optional `status`)
- `web/src/features/daily-reports/helpers.ts` (`toCreateDto()` → `status: 'DRAFT'`)
- `backend/test/daily-reports.status-contract.spec.ts` (NEW — 4 service tests)

---

## ISSUE-046 — Global ValidationPipe silently emptied the daily report PATCH body (draft edits persisted nothing)
**Status:** ✅ `RESOLVED` (2026-09-29 — P4.3.1)

### Description
`backend/src/main.ts` registers `new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false, ... })` globally, and Nest 10.4.22 forces `forbidUnknownValues: false`. `UpdateDailyReportDto` was a decorator-less class, and `whitelist: true` deletes every property that carries no validation decorator — nested array-element properties included. Every `PATCH /api/daily-reports/:id` therefore reached the service as an empty object: the DRAFT/owner gates ran, no field was ever persisted, yet an audit row was still written. The 15 existing unit tests call the service directly and bypass the HTTP pipe, so the endpoint looked green while being effectively a no-op.
Live proof (throwaway Nest app, the real DTO + the exact `main.ts` pipe options): `@Body() dto: UpdateDailyReportDto` ⇒ `HTTP 201 {"keys":[],"dto":{}}`; an interface-typed body (the POST case) ⇒ body preserved because the pipe is skipped for metatype `Object`.

### Resolution
- `UpdateDailyReportDto` now carries `class-validator`/`class-transformer` decorators on every field, plus dedicated nested entry classes (`DailyReportWorkerEntryDto`, `DailyReportTaskEntryDto`, `DailyReportMaterialEntryDto`, `DailyReportProductionEntryDto`, `DailyReportOhsItemEntryDto`) using `@IsArray() @ValidateNested({ each: true }) @Type(...)`.
- `status` is deliberately absent from the PATCH DTO — PATCH is DRAFT-only and never transitions status.
- Guarded by a new HTTP-level suite that mounts the real controller with `main.ts`'s exact pipe configuration.

### Files Changed
- `backend/src/modules/daily-reports/dto/update-daily-report.dto.ts` (decorators + nested entry classes)
- `backend/test/daily-reports.status-contract.spec.ts` (NEW — 6 HTTP tests)

---

## ISSUE-047 — Web app opened from a tablet/phone on the LAN rendered but every API call failed (`localhost:4000` baked into the bundle)
**Status:** ✅ `RESOLVED` (2026-09-29 — dev/LAN access)

### Description
`web/src/lib/api-client.ts` built its base URL as
`process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'`. Next.js inlines
`NEXT_PUBLIC_*` values into the client bundle at build time, and `web/.env.local`
ships `NEXT_PUBLIC_API_URL=http://localhost:4000`, so every browser session — no
matter which device opened the page — called `http://localhost:4000/api/...`.
On a tablet opened at `http://<laptop-ip>:3000` that resolves to the tablet
itself: the shell rendered (the page comes from the laptop), while every API call
failed with `Failed to fetch` (login included). It looked like "the frontend works
but the backend is down".

The backend was never the problem: `backend/src/main.ts` already listens on
`0.0.0.0:4000` with `origin: '*'` CORS, and the Next.js dev server already binds
all interfaces — verified live (`http://192.168.1.130:4000/api/docs` → 200).
Only the client-side URL was wrong.

### Resolution
- `resolveApiBaseUrl()` added next to the export in `web/src/lib/api-client.ts`:
  server-side render and loopback-hosted pages keep the configured value (local
  development unchanged); a page served from another host (LAN IP) with a
  loopback-configured API reuses that configured port on the page's hostname
  (`http://192.168.1.130:4000`); an explicitly remote configured URL is always
  respected; relative/same-origin configuration is returned untouched.
- `web/.env.local` is deliberately unchanged (still `http://localhost:4000`), so
  nothing has to be edited when the laptop's DHCP address changes.
- Documented in `HOW_TO_RUN.md` (new "Run the dev stack on a tablet / phone"
  section incl. the firewall check) and in `web/.env.example` / `.env.example`.
- No backend change, no new dependency, no CORS/proxy layer. Mobile still needs
  `EXPO_PUBLIC_API_URL` set to the LAN IP explicitly (React Native has no `window`).

### Verification
CDP gate `gate-lan-tablet.js` (Chrome, real login form, loopback API blocked
in-browser to simulate the tablet): before → page at `http://192.168.1.130:3000`
called `localhost:4000`, blocked, `Failed to fetch`; after → all 13 API requests
to `192.168.1.130:4000` (`/api/auth/login` 200, `/api/auth/me` 200,
`/api/projects` 200, `/api/control-tower/overview` 200), 0 loopback calls,
0 console errors, login token stored and redirect to `/` (PASS). Localhost
regression run unchanged (all calls to `localhost:4000` → 200, PASS). Web
typecheck 0 errors. Evidence: `gate-lan-tablet.out.json`.

### Files Changed
- `web/src/lib/api-client.ts` (`resolveApiBaseUrl()` + `API_BASE_URL`)
- `HOW_TO_RUN.md` (LAN section), `web/.env.example`, `.env.example` (comments)
- `gate-lan-tablet.js` (NEW — verification harness; git-ignored like the other gates)

---

## ISSUE-048 — "Proposed Work" and "General notes" both write to the single `general_notes` column
**Status:** ✅ `RESOLVED` (2026-09-29 — ISSUE-048 fix: dedicated `daily_reports.proposed_work` column; verified by `gate-issue048-browser.js` 23/23 at 375px in RO + EN)

### Description
The P4.3 daily report form exposes two text fields that persist to the same backend column:
- `DailyReportWorkSection` → "Proposed Work" (`daily_report.section_work`) → `form.proposedWork`
- `DailyReportExecutionSection` → "General notes" (`daily_report.general_notes`) → `form.generalNotes`

Both are written by `toCreateDto()` / `toUpdateDto()` as
`generalNotes: state.proposedWork || state.generalNotes || undefined`, while
`formStateFromReport()` only populates `generalNotes` (leaving `proposedWork` empty).

### Impact
- After a reload/reopen, the "Proposed Work" textarea is empty even though its text was stored — the value only shows under "General notes" in the Execution section and the review summary. It looks like data loss during the required create → save → reopen → reload cycle.
- If the Team Leader edits "General notes" in the Execution section while the (empty-on-reload) Proposed Work field is untouched, the PATCH sends an empty/`undefined` `proposedWork` fallback, so the edited general notes can be silently dropped.
- No schema/API change is required to fix it — this is a frontend state-modelling defect over an existing single column.

### Required Action
Decide the intended model first (one field for the whole report vs. two distinct persisted values with a real second column), then map it 1:1 in `formStateFromReport()`/`toCreateDto()`/`toUpdateDto()`. Do not fix by silently duplicating text into both fields — that recreates the overwrite path. Out of scope for the P4.3.1 persistence slice (which was scoped to start/end time + OHS/SSM).

---

### Resolution
`daily_reports.proposed_work` (nullable `TEXT`) is now the dedicated column for Proposed Work — migration `20260929170000_add_daily_report_proposed_work` (`ALTER TABLE "daily_reports" ADD COLUMN "proposed_work" TEXT;`), additive and non-destructive; no other Daily Report field was touched.

- **Backend:** `CreateDailyReportDto` (service interface + mirrored DTO class) and `UpdateDailyReportDto` accept `proposedWork`; `create()` writes `proposed_work` (`''` normalises to NULL, like `start_time`); `update()` writes `proposed_work` and `general_notes` **independently** (`if (dto.x !== undefined)`), so a PATCH carrying one field can never clear the other and an omitted field keeps its stored value. `GET` (list + `/:id`) already returns every scalar column, so both fields come back side by side.
- **Shared:** `shared/src/types.ts` exposes `DailyReport.proposed_work?: string | null` next to `general_notes` (shared dist rebuilt) — no frontend-only adapter hides the API distinction.
- **Web:** `formStateFromReport()` populates `proposedWork` from `report.proposed_work` (it was hard-coded `''` → the visible "data loss"); `toCreateDto()` / `toUpdateDto()` map the Work section textarea to `proposedWork` and the Execution section textarea to `generalNotes`; the `state.proposedWork || state.generalNotes` fallback is gone.
- **Data compatibility (STEP 6):** nothing was migrated or guessed. The 6 rows in the dev DB keep their `general_notes` values and get `proposed_work = NULL`; 5 had `general_notes = NULL` and the 2 non-null values (`smoke-mobile-submit`, `Nader guesmi`) are scratch/test text, not Proposed Work, so no historical content is redistributed automatically.
- **Deliberately unchanged:** status workflow, stock consumption, approval/rejection, revisions, notifications, Mobile (its `generalNotes` payload still writes `general_notes`).

### Verification
- `prisma validate` exit 0; `prisma generate` **exit 0** (run with the dev server stopped, avoiding the Windows DLL lock); `prisma migrate deploy` applied `20260929170000_add_daily_report_proposed_work`; `prisma migrate status` → "Database schema is up to date" (12 migrations).
- shared build + shared/backend/web typecheck → 0 errors; backend tests **30 suites / 295 tests PASS** (new `backend/test/daily-reports.proposed-work.spec.ts`, 16 tests); `db:verify` **66/66 PASS** (new check 8j: `daily_reports.proposed_work` exists, distinct from `general_notes`); web build exit 0 (26 routes).
- Browser gate `gate-issue048-browser.js` **23/23 PASS, 0 console errors** (headless Chrome, 375x812, EN then RO; real form + real API + real PostgreSQL): create → save → reload keeps "Install mounting structures" in the Proposed Work textarea and "Access road muddy after rain" in the Execution General Notes field (previously the textarea came back empty); the DB shows the two texts in two columns; an API `PATCH { proposedWork }` alone leaves `general_notes` untouched and vice versa; editing Proposed Work only and then General Notes only leaves the other field unchanged after reload; RO renders Lucrari Propuse / Observatii Generale with the same values; 0 failed API requests; no horizontal overflow. Evidence: `gate-issue048-browser.out.json`.

### Files Changed
- `backend/prisma/schema.prisma` (`DailyReport.proposed_work String?`)
- `backend/prisma/migrations/20260929170000_add_daily_report_proposed_work/migration.sql` (NEW)
- `backend/src/modules/daily-reports/daily-reports.service.ts` (create + update + DTO interface + contract doc)
- `backend/src/modules/daily-reports/dto/create-daily-report.dto.ts`, `dto/update-daily-report.dto.ts` (`proposedWork`)
- `shared/src/types.ts` (`DailyReport.proposed_work`)
- `web/src/features/daily-reports/helpers.ts` (read + write mapping, no aliasing)
- `backend/test/daily-reports.proposed-work.spec.ts` (NEW — 16 tests)
- `backend/scripts/db-verify.ts` (+ check 8j)
- `gate-issue048-browser.js` (NEW verification harness; git-ignored like the other gates)

## ISSUE-043 — P4.1 migration dropped 8 manually-created indexes (idx_aviz_items_*, idx_stock_balances_*, idx_stock_movements_*)
**Status:** 🔍 `OPEN` (2026-09-29 — recorded during P4.1 verification)

### Description
During P4.1 migration `20260929073840_add_daily_report_approval_revision`, Prisma dropped 8 manually-created indexes that were not declared in `schema.prisma`:
- `idx_aviz_items_*`
- `idx_stock_balances_*`
- `idx_stock_movements_*`

These indexes were created outside Prisma (likely via raw SQL) and are not part of the Prisma-managed schema.

### Impact
Unknown. May degrade query performance on aviz items, stock balances, and stock movements if these indexes were actually used by query paths.

### Required Action
A focused performance/index review must inspect whether these indexes are still required by actual query paths. If needed, they should be declared in `schema.prisma` via `@@index([...])` so Prisma manages them. Do NOT randomly recreate them — verify query plans first.

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

## ISSUE-049 — Two concurrent `next dev` servers share `web/.next` and corrupt the dev build (every route 404)
**Status:** 🔍 `OPEN` (found 2026-09-29 while verifying the seeded team data; mitigated locally, root cause not yet guarded)

### Description
Two `next dev` process chains were running from the repo root at the same time (started 16:13 and 16:33 — every `npm run web:dev` leaves an npm → cmd → next → next-server chain, and Next silently takes port 3001 when 3000 is busy). Both compile into the single `web/.next` directory of this monorepo.

Symptom: after a period of normal use the dev server began returning 404 for **everything** — `/login` 404, `/teams` 404, and every `/_next/static/...` chunk 404 — while the process stayed alive and `/` still briefly answered 200. The dev log showed the cause:
`<w> [webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT: no such file or directory, lstat 'C:\Users\...\web\.next\server\app\rapoarte\form\page.js'`
followed by `Compiled /_error` and permanent 404s.

### Impact
- The web app looks broken (blank/404 pages, no CSS/JS) although no source file changed — it is build/cache state, not application code.
- Browser verification gates report a false negative ("login form never rendered") because `/login` itself 404s.
- Same failure class as the earlier "stale dev servers + a production `.next`" incident in the 2026-09-29 LAN/handoff notes; it can burn a full debugging cycle if the 404s are misread as an app bug.

### Resolution
Operational fix applied and verified: killed both chains, `Remove-Item web\.next -Recurse -Force`, started exactly ONE `npm run web:dev` (single listener on `:3000`) → `/login` 200 immediately; the seed verification gate then ran green (`gate-seed-teams.js` 8/8, 0 console errors).

Remaining (optional guardrail): make `web:dev` fail fast when 3000/3001 is already served or detect a second dev server, and document "one dev server only" in `HOW_TO_RUN.md`. Do **not** "fix" this in application code — no source change is involved.

---

## ISSUE-050 — Pre-existing verification fixture tasks appear in the CJ-003 task list next to the seeded field work
**Status:** 🔍 `OPEN` (recorded 2026-09-29 during the team seed; needs a dev-DB/product decision)

### Description
Project CJ-003 (Parc Solar Cluj) still contains 4 tasks created by earlier verification gates and never cleaned up: `SMOKE-40926` ("Smoke Task (Tasks slice)", `IN_PROGRESS`), `PH2-VER-01` ("Phase2 Verify Task", `READY`), `P3-GATE-T1` ("P3 gate task one", `PLANNED`) and `P3-GATE-T2` ("P3 gate task two", `BLOCKED`). None of them has a `task_assignment` or a `daily_plan_task` row.

The team seed added the real Cluj work (`CJ-003-T01..T04`) beside them, so `/tasks` for Cluj shows 8 tasks (4 real + 4 fixtures) while Arad and Timisoara show 4.

### Impact
- Demo/QA noise: a Cluj team leader sees four test items that look like real work orders.
- They are also **documented evidence**: `VERIFICATION.md` and `HANDOFF.md` reference `SMOKE-40926` (task create-contract evidence, `id=a2df4f25-…`) and `PH2-VER-01` (Phase 2 Tasks gate E browser run: create → transition `PLANNED→READY` → quantity save), so deleting them silently would invalidate those references.

### Required Action
Pick one and stay consistent: (a) keep them and distinguish them as fixtures in the dataset/UI, or (b) delete them **and** annotate the affected `VERIFICATION.md` rows so the evidence trail stays honest. `backend/scripts/seed-hiieko-teams.ts` deliberately does not touch them; if cleanup is chosen, do it as a separate reviewed step (deleting a task cascades to its assignments/plan tasks — there are none here).

---

# ISSUE-051 — Mobile daily report screen sends a free-text `taskId` and deletes its draft before a successful submit
**Status:** 🔍 `OPEN` (found 2026-09-29 while verifying P4.4; the web + API finalization path is verified, the Mobile screen is not)

### Description
Two defects in `Mobile/src/screens/TeamLeaderDailyReportScreen.tsx` `handleSubmit()`:

1. **`taskId` is free text, not a task UUID.** The payload maps each entered task to
   `{ taskId: <first 50 chars of the task description>, quantityDone, notes }` (a `task_<index>`
   fallback when the description is empty). `taskId` is the primary key of `Task`, and the backend
   resolves every referenced task before writing: `DailyReportsService.create()` collects
   `dto.tasks[].taskId`, looks the ids up in `task` and throws `NotFoundException`
   (`Task <value> not found`) for anything that is not a task of the same project (the R3.1
   cross-project task validation, `daily-reports.service.ts`). The screen already refuses to submit
   with zero tasks (alert "Adaugă cel puțin o sarcină executată"), so **every** Mobile report that
   passes that guard carries at least one non-UUID `taskId` and is refused with HTTP 404.
2. **The local draft is deleted before the network call.** `await AsyncStorage.removeItem(DRAFT_KEY)`
   runs *before* the offline branch (`enqueueOperation('daily_report', 'create', ...)`) and before
   `apiClient.createDailyReport(...)`; the `catch` only shows an `Alert`. A failed submit (the 404
   above, no connectivity, a 5xx) therefore destroys the draft the user was working from — exactly the
   data loss the draft exists to prevent.

### Impact
- Mobile daily-report submission is dead-ended as soon as a task is added (404), while the web flow
  and the Mobile *HTTP contract* are verified green (see `VERIFICATION.md` → Phase 4.4).
- On failure, the entered work is unrecoverable on the device: no draft left and no queue entry.
- Neither defect is exercised by the P4.4 gate (which drives the browser and calls the Mobile
  contract over HTTP), so the P4.4 report must not be read as "Mobile verified".

### Required Action
- Send the real task id: choose a `Task` for the selected project (e.g. from `/api/tasks`) instead of
  the description, and keep the description in `notes`.
- Remove the draft only after the API call succeeded or after the payload is durably queued by
  `enqueueOperation()` — the offline branch is the intended "saved on the phone" path.
- Re-run the P4.4 gate plus a device/emulator pass before the Mobile daily report is called verified.

---

## ISSUE-052 — Control Tower API has no `@Roles` at all (the UI is the only boundary)
**Status:** 🔍 `OPEN` (recorded 2026-09-29 at UX-R1A C2; deliberately **not** changed in C2)

### Description
`backend/src/modules/control-tower/control-tower.controller.ts` guards the controller with
`@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)` (line 27) but declares **no** `@Roles(...)`
on `overview` (line 32), `drilldown` (line 57) or `red-flags` (line 108). With no role metadata the
`RolesGuard` admits every authenticated role, so `GET /api/control-tower/overview` returns the full
financial/KPI aggregate to a `worker` token as well.

### Impact
- The "management only" Control Tower contract exists **only** in the frontend
  (`ROUTE_ROLES['/control-tower']` + the `/` role router). Any authenticated client bypasses it.
- Frontend sets in force after C2: `/control-tower` (and `/` for the same roles) is allowed for the
  11 non-field roles; `worker` → `WorkerMyDay`; `technician` / `team_leader` / `foreman` /
  `site_manager` → `WorkerDashboard`.

### Required Action
Decide the intended Control Tower role set, then add `@Roles(...)` to the three endpoints in one
reviewed authorization change and re-align the frontend list against it. C2 must not change backend
authorization.

---

## ISSUE-053 — Navigation vs backend `@Roles` mismatches (front-end kept safe, backend unchanged)
**Status:** 🔍 `OPEN` (recorded 2026-09-29 at UX-R1A C2)

### Description
The C2 canonical map (`web/src/config/route-roles.ts`) records the **front-end** contract. Backend
`@Roles` decorators are not proof of the intended organisational model, so wherever they disagree C2
kept the currently safe (no-403) behaviour and did not touch `@Roles`. Measured on this tree:

| Route | Canonical front-end roles (C2) | Backend contract | Divergence kept |
|---|---|---|---|
| `/workforce` | admin, owner, manager, pm | `GET /api/employees` → `@Roles(ADMIN, MANAGER, PM, FINANCE)` (`employees.controller.ts:19`) | `site_manager` / `foreman` / `team_leader` used to see the link and get **403** — the sidebar no longer advertises it. `owner` passes the page guard but is not in the backend list (403). `finance` may call the API but has no navigation entry. |
| `/aprobare` | admin, owner, manager, pm | `POST /api/expenses/:id/approve` → `@Roles(ADMIN, MANAGER, PM, FINANCE)` (`expenses.controller.ts:61`); `GET /api/expenses` carries no `@Roles` | `owner` can list but gets **403** on approve; `finance` can approve but is outside the page guard. `procurement` access was **not** invented (unverified). |
| `/avize` | operational 9 | `POST /api/procurement/avize` → `@Roles(ADMIN, PROCUREMENT, SITE_MANAGER, TEAM_LEADER)` (`procurement.controller.ts:76`) | The page is named "Procurement / Avize" yet the guard denies `procurement` (and `finance`); the sidebar now mirrors the guard instead of advertising a denied link. |
| `/cheltuieli` | operational 9 | `POST /api/expenses` unrestricted; approve restricted as above | `finance` has no access to the expense page despite owning the financial approval step. |
| `/solar-configurator` | admin, owner, manager, pm, site_manager, foreman, technician | `solar.controller.ts:53…` → `@Roles(ADMIN, OWNER, PM, SITE_MANAGER)` on the write endpoints | Aligned to the advertised navigation contract: `worker` (previously allowed by the page guard but never offered the link) can no longer enter by direct URL. |

### Required Action
Resolve each row as an authorization decision (backend `@Roles` + `ROUTE_ROLES` + business matrix) in
a dedicated authorization change, not inside a navigation checkpoint.

---

## ISSUE-054 — `RoleGuard` admin/owner superset, unguarded routes and sub-route role gaps
**Status:** 🔍 `OPEN` (recorded 2026-09-29 at UX-R1A C2)

### Description
1. **`/utilizatori` owner bypass.** Navigation and page guard are both `['admin']`, but `RoleGuard`
   short-circuits `admin` / `owner` before evaluating `allowedRoles`
   (`web/src/lib/auth-guard.tsx:69`), so an `owner` can still open the page by direct URL. C2 kept
   admin-only in the canonical map and did **not** create owner access; the pre-existing superset is
   now documented instead of implied.
2. **`/tasks` is unguarded.** `ROUTE_ROLES['/tasks']` is the advertised 9-role list, while the page
   computes its own capability matrix (which includes `qa_qc`). Other roles can therefore reach it by
   direct URL by design of the page code; adding a guard would remove working access, so C2 left it
   unguarded and records the divergence.
3. **`/rapoarte/form` role gap.** Guarded with 8 roles (no `worker`) while `/rapoarte` allows 9, so a
   `worker` can open `/rapoarte` from the sidebar and is then denied the form. Unchanged in C2 (it is
   a sub-route with no navigation entry, outside the C2 scope).
4. **Unknown/legacy role strings.** Any role outside the 16 values of `shared/src/types.ts` `UserRole`
   has no field home and lands on the `RoleGuard` "Acces Interzis" panel at `/`. Every role in the
   shared enum is mapped to a home surface.

### Required Action
Decide the intended behaviour for each item (guard the route, extend the role list or accept the
documented divergence) during the authorization phase.

---

## ISSUE-055 — `WorkerAttendanceView` (`/pontaj`) still reads the legacy project-task source with a client-side assignee filter
**Status:** 🔍 `OPEN` (recorded 2026-09-29 at UX-R1A C3; deliberately **not** changed in C3)

### Description
C3 moved the field task panels rendered at `/` onto the role-correct daily-plan contract. The
attendance screen `web/src/components/WorkerAttendanceView.tsx` (rendered by `/pontaj`,
`ROUTE_ROLES['/pontaj']`) still uses the pre-C3 pattern:

- `attendanceApi.getProjectTasks(projectId)` (line 49) — the project-wide task list, **not** the
  backend-computed personal scope;
- the current user's rows are then selected **client-side** with
  `(task.assignments || []).some((a) => a.user_id === user.id)` (lines 51-53);
- terminal work is filtered client-side with three literal status strings
  (`COMPLETED` / `VERIFIED` / `CANCELLED`, line 67);
- the panel only loads when a project is selected (`selectedProject` gate, lines 63-65).

### Impact
- Two different "my tasks" truths remain in the field product: `/` (daily-plan scope, correct after
  C3) and `/pontaj` (project task list + client assignee filter, legacy). A task that reaches the
  worker through the day plan but not through `TaskAssignment` — or the reverse — is counted
  differently by the two screens.
- The legacy path is limited by the task-list API's own ordering/pagination, so a worker with many
  project tasks can lose rows that the daily-plan source would have returned.

### Required Action
Reconcile `/pontaj` onto the same source contract (`GET /api/daily-plans/my-tasks?date=`) during the
dedicated task/workspace pass (UX-R1B or later), leaving the attendance/shift logic untouched. Do not
solve it by adding another client-side filter — the backend scope stays the single source of truth.
C3 deliberately left `WorkerAttendanceView.tsx` unmodified (outside the C3 file set).

### C4 note (2026-09-29)
UX-R1A C4 left this file's four remaining terminology rows untouched on purpose
(`WorkerAttendanceView.tsx:93` `Reimprospateaza`, `:167`/`:217` `Distanta GPS`, `:249` `santier`), and
also left `WorkerDashboard.tsx` lines 101 + 151 alone: `:101` sets
`'Selecteaza un proiect mai intai.'` and `:151` picks the banner colour with
`actionResult.includes('Selecteaza')`, so correcting the spelling without the result-kind refactor
would break the colour logic. Both move with this issue.

---

## ISSUE-056 — Remaining RO copy / role-map debt outside the UX-R1A C4 scope (report-only)
**Status:** 🔍 `OPEN` (recorded 2026-09-29 at UX-R1A C4)

### Description
C4 normalised the shared vocabulary (nav/page titles, the 16-role `role.*` set, 175 diacritic defects).
The following user-visible copy is deliberately still inconsistent and is now *measured* by the
report-only guard row *"Romanian copy missing diacritics"* in `scripts/check-frontend-guards.mjs`:

1. `web/src/components/ControlTowerSurface.tsx` + `ControlTowerDrilldownDrawer.tsx` (20 rows) — the
   Control Tower surface was out of scope in C4 and still uses ASCII-only RO copy (`Sarcini`,
   `Realizat`, `Astazi`…).
2. `Mobile/src/screens/SettingsScreen.tsx` `formatRole()` (lines 185-193) — the last duplicate role
   map (`'Sef Echipa'`, `'Vizualizare'`); it should call `getRoleLabel()` like web does.
3. Full RO prose (long tutorial sentences in `shared/src/translations.ts`, remaining
   `locale === 'en' ? … : …` literals as an artefact of the same copy) — the R1B translation pass.
4. `ROLE_VISIBILITY_MATRIX.md` still stores some labels as literal `\uXXXX` escapes and shows
   mojibake for the legend emoji (encoding debt); the two rows C4 corrected now read as real text.

### Impact
No functional impact (report-only, no CI failure). It is a consistency/translation debt: two surfaces
still look different from the rest of the product, and a future term change could re-introduce a second
role vocabulary on Mobile.

### Required Action
Close 1 and 2 in the C5/UX-R1B pass (same file sets that need their own refactor), and re-encode
`ROLE_VISIBILITY_MATRIX.md` when it is next edited.

---

## ISSUE-057 — `/planning`, `/teams`, `/workforce` render raw `tutorial.*` translation keys (RO + EN)
**Status:** ✅ `FIXED` (2026-09-30, R1B.1 — 21 keys added, fail-first checker rule, verified in a real browser in RO + EN)

### Description
`shared/src/tutorials.ts` defines the sections `planning`, `teams` and `workforce` with keys built from a
template literal (`const K = (id) => tutorial.${id}`), i.e. `tutorial.planning.title`, `.short`,
`.purpose`, `.step1/2` and `.role_*`. `shared/src/translations.ts` defines **no** key for those three
prefixes (0 occurrences of `tutorial.planning`, `tutorial.teams`, `tutorial.workforce`), and `t()`
returns the key when an entry is missing (`const e = d[key]; if (!e) return key;`).

Consequence in a real browser (C5 sweep, RO and EN): `PageTutorial` prints the raw key in the visible
`<h2>` (`tutorial.<section>.title`, CSS-uppercased), in the summary line (`tutorial.<section>.short`) and
in the section `aria-label`; expanding "How it works" would additionally show the missing
`purpose` / `steps` / role-note keys.

### Impact
User-visible raw keys on three pages in both locales. Copy/translation defect only — no crash, no data or
authorization impact. The static gates cannot see it: the keys are dynamic, so `i18n:check`'s
"undefined static keys" rule reports nothing, and `shared/src/tutorials.test.ts` (which asserts that
every tutorial key resolves in both locales) is not executed by any script.

### Evidence
- Browser (C5): 19 of 130 swept records — routes `/planning`, `/teams`, `/workforce`, locales RO + EN,
  roles admin / team_leader / foreman / worker; DOM dump in `VERIFICATION.md` → *UX-R1A C5* → F1.
- Pre-existing: `git show 876c312:shared/src/translations.ts` (C3 tree) has the same missing keys, so it
  is not a C4 regression.
- Dormant test: `shared/package.json` has no `test` script and nothing runs `node --test`; a plain
  `node --test shared/src/tutorials.test.ts` fails with `ERR_MODULE_NOT_FOUND` (extensionless import).

### Fix (2026-09-30, R1B.1)
1. **DONE — copy.** 21 keys added to `shared/src/translations.ts`, 7 per section
   (`title`, `short`, `purpose`, `step1`, `step2` + 2 `role_*` keys used by `TUTORIALS.planning` /
   `.teams` / `.workforce`), inserted directly before the `// --- Daily Report Form (P4.3) ---` marker.
   The table grew **988 → 1009** key definitions.
2. **DONE — recurrence guard (fail-first).** `scripts/check-i18n.mjs` (+51/−1) now resolves the
   template-built keys into concrete keys and fails when one is undefined: `FAILURE_ORDER` gains
   *template-built tutorial keys missing from the translation table* and *template-built translation
   keys not validated*; the check also fails loudly when `shared/src/tutorials.ts` cannot be read or the
   template resolution matches 0 keys (a rule that silently no-ops is worse than no rule).
3. **STILL OPEN — test wiring.** Deciding how to execute `shared/src/*.test.ts` (loader or
   extension-complete imports) and wiring it to CI is unchanged; the new checker rule covers the same
   defect class for the three tutorial sections.

### Verification
- `npm run i18n:check` — **before**: `FAIL (194 source files, 988 key definitions, 988 unique keys)`
  listing exactly the 21 expected keys; **after**: `PASS (194 source files, 1009 key definitions,
  1009 unique keys)`. `node --check scripts/check-i18n.mjs` exit 0.
- `guards:check` PASS; `typecheck` exit 0 (shared + web + Mobile + backend); `web:typecheck` exit 0;
  `web:build` exit 0; `npm test` 31 suites / 320 tests PASS.
- Real browser (headless Chrome `Chrome/154.0.8037.58` over CDP, real login form + real API + real DB),
  30 records = `/`, `/control-tower`, `/planning`, `/teams`, `/workforce` × {375, 768, 1440} px ×
  {RO, EN}: **0** raw `tutorial.*` occurrences in `document.body.innerText` **and 0** in any
  `aria-label`; the three cards render real copy (`Plan Zilnic`, `Echipe`, `Forță de Muncă`,
  `Planificarea zilei de lucru pentru fiecare echipă.`).
- Role wording was fact-checked against the code before it was written: `foreman` / `team_leader` create
  the plan draft and complete a published plan but do **not** publish (`site_manager` only), and they
  work in both the Plans view and My work — so the notes say that instead of claiming a personal-only
  task list (the first RO draft did and was replaced).

---

## ISSUE-058 — 375 px horizontal overflow inside `<main>` on the Control Tower surfaces
**Status:** ✅ `FIXED` (2026-09-30, R1B.1 — measured cause identified with a read-only CDP probe, 2-line local fix, `main 429/375` → `375/375`)

### Description
At 375 px, `admin` gets `main.scrollWidth = 429` against `main.clientWidth = 375` (54 px wider than the
viewport) on `/` and `/control-tower` — both render `ControlTowerSurface`. The page itself does not
overflow (`documentElement.scrollWidth = 375`; the shell is `overflow-hidden`), so the excess is clipped
inside the main scroll container instead of producing a page-level scrollbar.

### Impact
Clipped / cramped rendering of the Control Tower surface on phones. No functional or data impact, and the
other three swept roles show no overflow at 375 px (0 records).

### Evidence
- C5 sweep: 2 of 130 records (`admin`, RO, 375 px, `/` and `/control-tower`), `main 429/375`
  (`VERIFICATION.md` → *UX-R1A C5* → F2).
- Suspect: `web/src/components/ControlTowerRedFlagsCard.tsx` — table cells carry `whitespace-nowrap`
  (lines 156-192), which sets a min-content width wider than 375 px.

### Measured cause (read-only CDP probe, 2026-09-30)
The C5 suspect was **not** the cause. `ControlTowerRedFlagsCard`'s `whitespace-nowrap` table lives inside
`<div className="overflow-x-auto">`, i.e. it clips: measured `table` = 972 px wide with its right edge
614 px past the container, and `main.scrollWidth` stays 375 px — the same pattern appears on `/workforce`
(186 flagged descendants, `main` still `375/375`). The measured culprit is the **global filter row** of
`ControlTowerSurface` (`<div className="flex items-center space-x-3">`): at 375 px its box is 301 px
while its content is 392 px (`flex-wrap: nowrap`, no clipping ancestor), the native `<select>` cannot
shrink below its longest `<option>` text, and the rightmost child — the `Actualizează` refresh `button`
(114 px wide) — ends at x = **429**, i.e. exactly `main.scrollWidth = 429` against
`main.clientWidth = 375`. The 54 px propagates up unchanged through
`card (412) → div.space-y-6.pb-12 (413) → div.hii-page (429) → main (429)`.

### Fix (2026-09-30, R1B.1 — local and measured)
`web/src/components/ControlTowerSurface.tsx`, 2 lines: the filter row stacks below `sm`
(`flex items-center space-x-3` → `flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`) and the
`<select>` fills its container (`w-full sm:w-auto`). No blanket `overflow-x-hidden`, no shell CSS
change, no other part of the component touched, and ≥ 640 px rendering unchanged.

### Verification
- Same probe, same server, same account (admin, RO, 375 px): `/` and `/control-tower`
  `main 429/375` with `rectSpill = 2` / `selfScroll = 4` → **`main 375/375` with
  `rectSpill = 0` / `selfScroll = 0`**.
- Full post-fix sweep (30 records): `main.scrollWidth === main.clientWidth` on **30/30**
  (1440 px: `1184/1184`, the shell sidebar aside) and `documentElement.scrollWidth === innerWidth` on
  30/30, in RO and EN.
- The intentionally scrollable inner tables (`overflow-x-auto`: workforce 277 px, red flags 254 px) stay
  clipped inside their wrappers and no longer propagate to `main`.

---

## ISSUE-059 — `PageTutorial` renders Romanian copy in the EN locale (component-level locale default)
**Status:** ✅ `FIXED` (2026-09-30, R1B.2 — locale resolved from the existing `LocaleContext`, no call-site change; verified in a real browser: 46/46 records, 0 RO-only strings in EN, RO rendering unchanged; committed as `9e6a503`)

### Description
`web/src/components/PageTutorial.tsx` declares `locale?: 'ro' | 'en'` with a `'ro'` default
(`export function PageTutorial({ sectionId, locale = 'ro', role })`, line 25) and resolves every string
through `t(key, locale)` (lines 37, 41, 49, 52, 58, 60, 65, 69). **None of the call sites passes the
prop** (measured: 17 × `<PageTutorial sectionId="…" />`, 0 × with `locale`), while the pages themselves
already use `useLocale()`. The card is therefore always Romanian, even when
`document.documentElement.lang === 'en'` and the rest of the page is English.

### Impact
Localisation defect on all 17 introduction cards (16 files: `dashboard` renders twice, on `/` and
`/control-tower`, through `web/src/components/ControlTowerSurface.tsx` — the site the R1B.1 count of
"16 call sites" missed). A missing EN key would additionally hide behind the RO default. No layout,
data or authorization impact.

### Evidence (measured 2026-09-30, real browser)
- The 15 EN records of the R1B.1 sweep: `document.documentElement.lang === 'en'` and 0 raw `tutorial.*`
  keys, yet `/planning` EN renders `PLAN ZILNIC … Planificarea zilei de lucru pentru fiecare echipă.`
  with `aria-label="Plan Zilnic"` instead of `Daily Plan` / `Planning the working day for each team.`
- Code: `PageTutorial.tsx` line 25 + the 17 call sites, 0 of which pass `locale`.

### Required Action
Resolve the active locale from the existing locale layer (`useLocale()` from `shared/src/i18n.ts`) so
the card can never fall back to RO. Belongs to the R1B copy pass, deliberately **not** part of R1B.1
(which was scoped to the missing keys and the 375 px overflow only).

### Fix (2026-09-30, R1B.2 — one file, +11/−1)
`web/src/components/PageTutorial.tsx`: the hardcoded `= 'ro'` default is gone. The component now reads
the active locale from the existing application locale layer —
`const { locale: activeLocale } = useLocale(); const locale = localeProp ?? activeLocale;` — the same
`shared/src/i18n.ts` context (`LocaleProviderClient` in `web/src/app/layout.tsx`) that every other Web
component already uses. The optional `locale` prop is kept as an explicit override.

**Why the fold-in instead of `locale={locale}` on 17 call sites** (the originally proposed pattern):
all 17 sites already render inside `<LocaleProviderClient>`, so the context is always in scope with the
right value; `PageTutorial` is a `'use client'` component, so a hook is safe; reading the locale from
the context is what the surrounding code does (`PlanCard`, `TaskCard`, `MyWorkList`,
`ControlTowerSurface`, the `DailyReport*` sections all call `useLocale()`), whereas the disappearing
prop chain is the exception; and, decisively, the prop-threading variant needs edits in 16 unrelated
pages — three of which (`/aprobare`, `/santiere`, `/teams`) do not even import `useLocale()` — while
*still* allowing a future call site to forget the prop. The context read makes the defect structurally
impossible to reintroduce. No second locale context, no second translation helper, no page-specific
tutorial logic, no key/copy change.

### Verification (2026-09-30, R1B.2 — real browser, CDP)
- **FAIL-first:** with `PageTutorial.tsx` reverted to `HEAD`, the same probe reported **34 records /
  17 PASS / 17 FAIL** — every EN record landed the ISSUE-059 defect (`lang="en"`, card
  `aria-label="Panou Principal"` / `"Plan Zilnic"`, RO steps, `Cum funcționează?`, 0 raw keys).
- **After the fix: 46/46 PASS**, `langMismatch` 0, `romanianLeaksInEn` 0, `rawKeyRecords` 0.

Full detail: `VERIFICATION.md` → *R1B.2*.

---

## ISSUE-060 — The approved Phase-1 dark shell chrome contradicts `DESIGN_SYSTEM.md` §7 (light, fixed chrome) (RESOLVED 2026-09-30 — DEC-012 + DESIGN_SYSTEM.md)

### Context
The approved Phase-1 visual direction (Figma exports `worker-shell.png`, `worker-my-day-desktop.png`,
`worker-my-day-mobile.png`) makes the shell chrome a fixed dark material: navy `#111827` for the left
rail and the `< lg` top bar, `#374151` for the compact project band, with the orange `#F59E0B` accent as
the single shell emphasis colour and green `#49C89E` restricted to positive/completed states.
`Project workflow/DESIGN_SYSTEM.md` §7 currently describes a light product chrome (and §1/§3/§8 name the
same surfaces), so the implemented shell now documents the opposite of the design-system text.

### Evidence
- `HIIEKO_FRONTEND_MASTER_SPEC.md` (approved visual direction) + the three Figma exports above.
- Implementation: `web/src/app/globals.css` (`--hii-chrome*`, `--hii-accent*`, `--hii-positive*`,
  `--hii-shell-content-bg`), `web/tailwind.config.js` (`chrome`/`accent`/`positive` colours),
  `web/src/components/shell/*`, `web/src/components/{Header,Sidebar,AppShell}.tsx`.
- `VERIFICATION.md` → *Phase 1 — Shell Chrome + Worker "My Day"*.

### Impact
Documentation-level only (no runtime defect): a reader of `DESIGN_SYSTEM.md` would conclude the chrome
must stay light and that green is the product primary, while the emitted UI is navy + orange. This is
**not** a theme switch — Tailwind `darkMode` remains off, no `dark:` utility exists, and the chrome is
applied through explicit tokens/classes, so a light-chrome rollback is a token/class change only.

### Resolution — FIXED 2026-09-30 (documentation follow-up, decision record created)
Add a `DEC-0xx` entry recording the fixed dark chrome as a product decision and update
`DESIGN_SYSTEM.md` §1 (colour roles), §3 (surfaces/typography on dark chrome), §7 (chrome) and §8
(component inventory: `ShellBrand`, `ProjectContextChip`, `ShellNotificationsButton`, `PageContainer`,
`WorkerTaskCard`, `WorkerProgressCard`, `WorkerActionsRequired`, `WorkerBlockerList`). Code change
itself is complete and verified by build/typecheck; the design-system text is deliberately **not**
rewritten unilaterally while Phase 1 is still awaiting review.

**What was actually done (2026-09-30):**
- **`DECISIONS.md` → DEC-012 — Fixed dark chrome + accent/positive palette (Phase 1 shell + Worker
  "My Day")**, ACCEPTED: the chrome is fixed branding and **not** a theme (Tailwind `darkMode` stays
  `off`, no `dark:` utility, no `prefers-color-scheme`, no user toggle, no per-role/per-page variant);
  navy `#111827` (`--hii-chrome`), elevated band `#374151`, accent `#F59E0B` (`--hii-accent`, hover
  `#D97706`), positive `#49C89E` (`--hii-positive`, soft `#DAF8E9`), content canvas `#F3F4F6`; brand
  green and the semantic status palette stay the content-surface colours; scope = shell + Worker
  "My Day" only.
- **`DESIGN_SYSTEM.md`**: §1 gained **1.1 Chrome / accent / positive** (the 13 Phase-1 tokens with their
  surfaces + the "not a theme" statement) and the §1 notes now say green is the content primary; §3
  rewritten to the measured Phase-1 shell contract (navy rail/bar, 44 px `#374151` band inside a 101 px
  compact `<header>`, 72 px `≥ lg` header, `z-header`/`z-drawer` ladder, `hii-shell-canvas`) **with the
  pre-Phase-1 values kept as a history note**; §7 gained three chrome bullets (no `dark:`/dark-mode, no
  per-page/per-role re-tint without a new DEC, chrome tokens are not content primaries); the component
  inventory is **§2.1.1** (the issue text said "§8", which is the page-adoption tracker) and now lists
  all 8 Phase-1 components; §4 documents that the My Day 4 px status bar uses accent/critical/positive
  while badges keep the semantic variants.
- Verified from the implementation, not from the frames: `web/src/app/globals.css` (`--hii-chrome`
  `#111827`, `--hii-chrome-elevated` `#374151`, `--hii-accent` `#F59E0B`, `--hii-positive` `#49C89E`,
  `--hii-shell-content-bg` `#F3F4F6`, `--hii-header-height` 4.5rem, `--hii-sidebar-width` 16rem),
  `web/tailwind.config.js` (`chrome`/`accent`/`positive` aliases, no `darkMode` key), `Sidebar.tsx`
  (rail + drawer classes), `Header.tsx` (compact navy bar + band, white 72 px bar), and the live stack
  measurements at 375/768/1440 px (`VERIFICATION.md` → *Phase 1 final verification — RO/EN × 375/1440*).
- No production code was changed for this issue: the code side was already complete and verified; this
  closure is documentation + decision only (ISSUE-060 remains a doc/decision defect).

---

## ISSUE-061 — Worker "My Day" summary concatenated Decimal quantities instead of summing them (FIXED 2026-09-30)

### Description
The *Cantitate raportată* rows of `WorkerProgressCard` (`/` for the worker/technician role) rendered
concatenated digits instead of a sum for the day used by the Phase-1 review:
`0451 / 0601 buc` and `0 / 040 m`, where the real day is CJ-003-T02 `45/60 buc`, CJ-003-T03 `0/40 m`
and CJ-003-T04 `1/1 buc` (completed). The per-task cards (`45/60 buc`, `0/40 m`) and the completion
ratio (`33 %`, `1 din 3 sarcini finalizate`) were already correct.

### Root cause (measured, not inferred)
`GET /api/daily-plans/my-tasks?date=` serializes `DailyPlanTask.target_quantity` / `actual_quantity`
as JSON **strings**: both columns are Prisma `Decimal` (`DECIMAL(12,3)`) and Prisma serializes
`Decimal` through its `toJSON()`. Captured payload (2026-09-30):
`"target_quantity":"60"` / `"actual_quantity":"45"` / `actual_quantity: null`.
`summarizeMyDay()` in `web/src/features/planning/fieldWork.ts` accumulated those values with `+=`,
so `0 + "45" + "1"` produced the string `"0451"`, which `String(volume.actual)` then rendered.
`web/src/features/planning/types.ts` declares `target_quantity: number`, so `tsc` could not flag it:
the declared type does not hold at runtime.

### Impact
Display-only, worker/technician home, one card (`WorkerProgressCard`), RO + EN. No write path was
affected: progress is written through `PATCH /api/daily-plans/tasks/:id/progress` with numeric bodies
and the backend response already carried the correct values.

### Fix (2026-09-30 — one function, one file)
`web/src/features/planning/fieldWork.ts`: new module-private `toQuantityNumber()` normalises a
quantity before it enters arithmetic (`Number.isFinite`-checked `Number()` for strings, `0` for
`null`/`undefined`/non-numeric input, decimals preserved untruncated, `0`/`"0"` kept as a real zero),
and `summarizeMyDay()` now coerces both fields before the per-unit sum. Unit grouping, the
open/completed counts, `percentComplete` and the per-task rows are unchanged. No backend, Prisma, DB,
API-contract, navigation or styling change; nothing staged or committed.

### Verification (2026-09-30 — real stack, real browser)
PostgreSQL :5433 + NestJS :4000 + `next dev` :3000, real Chrome via CDP, worker
`daniel.georgescu@hiieko.local`, project Parc Solar Cluj (CJ-003): the card now renders
`46 / 61 buc` and `0 / 40 m` (matching the per-unit sums computed independently from the API payload),
per-task cards unchanged (`45/60 buc`, `0/40 m`), `33 %` / `1 din 3 sarcini finalizate` unchanged,
0 uncaught exceptions and 0 failed requests. Gates: `npm run typecheck`, `npm run web:typecheck`,
`npm run web:build` (25/25 pages), `npm run i18n:check`, `npm run guards:check` — all exit 0. Full
detail: `VERIFICATION.md` → *Phase 1 defect fix — ISSUE-061*.

**Final verification (2026-09-30 — RO + EN × 375/1440 px, then fixture cleanup):** re-run against the
same real day with `cdp-phase1-final.js` — **67/67 checks PASS** (375 px RO 22/22, 375 px EN 22/22,
1440 px EN 23/23): `buc 46 / 61 buc` and `m 0 / 40 m` in both languages, `CJ-003-T02` `45/60 buc`
(`În lucru` / `In progress`, `aria-valuenow 75`), `CJ-003-T03` `0/40 m` (`Planificat` / `Planned`,
`aria-valuenow 0`), `33 %`, `1 din 3 sarcini finalizate` / `1 of 3 tasks completed`,
`2 sarcini încă nefinalizate` / `2 tasks still open`, 0 JS exceptions, 0 failed requests (the only HTTP
error is the pre-existing `/favicon.ico` 404). The temporary Phase-1 plan
`837ef189-1832-474c-ae4e-510be703dd56` (and its 3 plan tasks, 2 verification `TaskAssignment` rows and
6 audit rows) was then deleted; the seeded task rows it referenced are untouched. Full detail:
`VERIFICATION.md` → *Phase 1 final verification*.

---

# Known Limitations (not blocking)

- **Mobile `WorkerAttendanceScreen.tsx`** — The `TimeLog` type in `shared/src/types.ts` and the local AsyncStorage-based `activeTimeLog` mechanism are the mobile app's offline attendance state tracking (not the PostgreSQL table, which is now dropped). This is correct and stays.
- **`HOW_TO_RUN.md` and `Project workflow/CONFIGURATION.md`** — These documentation files still reference Supabase setup steps. They are outdated but harmless (no runtime impact). Should be updated as part of a documentation pass.
- **`MOBILE_MIGRATION_PROGRESS.md` and other migration docs** — Historical migration documents that reference Supabase. These are archival/planning docs, not runtime dependencies.
- **`ocr-service/README.md`** — References Supabase as part of the historical architecture description. This is a standalone OCR service, not an active runtime dependency.
- **`PermissionsGuard` not activated** — The `PermissionsGuard` exists but is not wired into any controller. Permission tables are unseeded. Deferred from P5.
- **`GET /api/procurement/avize/:id` route missing** — The procurement controller lacks this single-aviz retrieval endpoint. Documented in HANDOFF.md.
- **RoleGuard on 15 pages (16 with `/rapoarte/form`)** — Client-side route guard blocks direct URL access for unauthorized roles. Since UX-R1A C2 every guard reads its role list from `web/src/config/route-roles.ts` (`ROUTE_ROLES`), i.e. the same source the sidebar uses, so the advertised link set and the guard can no longer drift. `/statistici` no longer exists as a page (307 redirect to `/control-tower`), and `/control-tower` redirects unauthorized roles to `/` instead of rendering them a denial panel.
- **ISSUE-033/034/035 FIXED** — Project-scope query filtering, registration role whitelist, and tasks controller @Roles all resolved during Phase 3.2.
- **Santiere page**: "Modifica Parametri" button now opens functional edit modal (FIXED 2026-09-26).
- **Profil page**: Language selector now functional, name/phone editable (FIXED 2026-09-26).
- **Missing refresh buttons**: Added to pontaj, cheltuieli, rapoarte pages (FIXED 2026-09-26).
