# AI Handoff

> Primary continuation point for the next AI assistant.

Last Updated: 2026-09-23 (R2.5 Notifications E2E VERIFIED: backend + web + mobile integration live-verified on PostgreSQL 18)

## Current Status
**Status:** STABLE — **SUPABASE-FREE REPOSITORY** (Web + Mobile -> NestJS -> Prisma -> PostgreSQL 18 is the only runtime path; R2.5 Notifications ✅ E2E VERIFIED; next: R2.3 Stock + Avize)

## Current Task
**R2.5 Notifications ✅ E2E VERIFIED.** Backend: `NotificationsService` + `NotificationsController` with audit logging (`AuditService`), pagination (`skip`/`take`/`page`/`pageSize`), `send()` (internal, no public endpoint), `markAsRead` (ownership-enforced via `updateMany` with `{id, user_id}`), `markAllAsRead`. 13 unit tests all pass. Web: `NotifItem` interface fixed (`message_ro`/`message_en` instead of `body_ro`/`body_en`), locale-aware rendering (`title_ro`/`title_en`/`message_ro`/`message_en`). Mobile: real API calls with correct field names. Live E2E verified on PostgreSQL 18: login, own notifications, pagination, mark all read, unread filter, unauthenticated blocked (401), field validation, audit endpoint accessible.
**Next: R2.3 Stock + Avize** as PostgreSQL-authoritative module.

> **⚠️ ARCHITECTURE DECISION (2026-09-23) — read before continuing:** Legacy `legacy.*` dual-write is a **temporary compatibility artifact only**, NOT a required pattern. PostgreSQL/NestJS is authoritative; there is no live Supabase project/keys and no `legacy.*` schema in dev. **Do NOT add legacy dual-write to R2.3 Stock or any other module.** The existing R2.2/R2.4 legacy helpers were **REMOVED on 2026-09-23** (ahead of the R7 cut-over) after live-DB verification. The orphan `public.time_logs` table was **DROPPED on 2026-09-23** (D-012). The `supabase/` directory was **ARCHIVED on 2026-09-23** (D-015). R2.5 Notifications is **✅ E2E VERIFIED** as PostgreSQL-authoritative module. Next: R2.3 Stock + Avize as **PostgreSQL-authoritative** module (verify invariants + live E2E), with no legacy mirroring. See `PROGRESS.md` → Architecture Decision and `IMPLEMENTATION_ROADMAP.md` Milestone R7.

> ✅ Superseded 2026-09-23: the dev database has **no `legacy` schema**, and the legacy field-mapping code has now been **deleted**, so that limitation is moot. ISSUE-012 (orphan `public.time_logs`) and ISSUE-015 (`supabase/` retention) are now **RESOLVED** — the table was dropped and the directory was archived. Remaining Supabase-removal follow-ups were tracked as ISSUE-013 (no server-side blob storage) and ISSUE-014 (`/api/upload` route missing) — both **IMPLEMENTED + VERIFIED**.
>
> 📦 `hiieko-final/` (frozen legacy reference repo) was **moved out of the active tree** to `C:\Users\Lenovo\Desktop\HIIEKO_ARCHIVE\hiieko-final` — preserved intact, NOT deleted.

# What Was Completed
- [x] **🏆 Supabase Runtime Removal — Phases 1-6 COMPLETE (2026-09-23)**
# What Was Completed
- [x] **🏆 D-012/D-015 Final Audit COMPLETE (2026-09-23)**
  - **Mobile:** `NotificationCenterScreen.tsx` -> `GET /api/notifications` + `POST /api/notifications/:id/read` + `POST /api/notifications/read-all`; `services/ocr.ts` -> `POST /api/ocr/process`; `services/expenseDocuments.ts` -> `POST /api/expenses` + `POST /api/ocr/jobs`; offline path -> SQLite `enqueueOperation('expense','create',…)`. Deleted `Mobile/src/services/supabase.ts` + `supabaseApiClient.ts`. Added `Mobile/src/services/expenseMapping.ts` (UI values -> Prisma enums). Added `markAllNotificationsRead()`, `processOcr()`, `createOcrJob()` to `NestMobileApiClient`.
  - **Web:** deleted `lib/supabase.ts`, `lib/supabase-api-client.ts`, `lib/useSupabaseQuery.ts`; removed `@supabase/supabase-js` (npm pruned 12 packages; lockfile has 0 Supabase refs); cleaned both web env files.
  - **Backend:** removed unused `supabaseToken` (LoginDto), Supabase-only `app_metadata` (JwtPayload), and the **Supabase token fallback in `JwtAuthGuard`** (unknown/inactive users now get 401).
  - **Edge Function:** deleted `supabase/functions/` (`ocr-extract`).
  - **Legacy shims:** removed `upsertLegacyTimeLog()` and `upsertLegacyDailyReport()` plus their shim-only support code (`attendance.service.ts` 405->268 lines, `daily-reports.service.ts` 410->173 lines).
  - **Env:** root `.env.example` rewritten — zero Supabase variables remain in the active tree.
  - **🐛 Real bug fixed:** `POST /api/ocr/process` was returning HTTP 500 `form_data_1.default is not a constructor` (`import FormData from 'form-data'` without `esModuleInterop`). Changed to `import * as FormData from 'form-data'`. OCR was non-functional before this fix.
  - **Verification:** monorepo typecheck exit 0; `nest build` exit 0; web build exit 0 (16 routes); jest 9/9 suites + 35/35 tests; **live smoke test 10/10 PASS** (login, notifications, read-all, expense with mapped enums, OCR job link, OCR process error path, ghost-token 401, check-in, `time_logs` frozen 3->3, `attendance_records` 3->4).
- [x] **NestJS Backend Foundation** in `backend/` workspace with modular domain modules, OpenAPI Swagger at `/api/docs`, JWT auth, RBAC, and Project Access guards.
- [x] **PostgreSQL Master Schema** defined in Prisma (`backend/prisma/schema.prisma`) with 66 domain entities matching the Master Product Specification.
- [x] **Company Control Tower Module** (`backend/src/modules/control-tower/`):
  - `control-tower.interface.ts`: 19 DTOs and interfaces for 7 operational domains + drill-down pagination.
  - `control-tower.service.ts`: Cross-functional real data aggregation (Projects, Workforce, Production, Materials, Finance, Quality, Documentation) + rule-based Red Flags Engine with WHY, WHO, WHEN, and SEVERITY.
  - `control-tower.controller.ts`: REST endpoints with Swagger documentation, JWT and RBAC guards (`/api/control-tower/overview`, `/api/control-tower/drilldown`, `/api/control-tower/red-flags`).
  - `control-tower.module.ts`: Wired and registered in `backend/src/app.module.ts`.
- [x] **Management Control Tower UI** (`web/` workspace):
  - `api-client.ts`: Typed Control Tower client methods.
  - `web/src/app/page.tsx`: Complete Management Control Tower dashboard with 7 domain cards, project selector, and real data integration.
  - `web/src/app/control-tower/page.tsx`: Dedicated route for Turn de Control.
  - `ControlTowerDrilldownDrawer.tsx`: Accessible slide-over drawer with search and filtering.
  - `ControlTowerRedFlagsCard.tsx`: Prioritized operational exception alerts table with severity filters.
  - `Sidebar.tsx`: Navigation updated to highlight Turn de Control.
- [x] Resolved `ISSUE-001` (dashboard querying nonexistent `attendance_records`).
- [x] Central `AuditService` implemented with structured before/after diff tracking.
- [x] **Core business invariants**:
  - Zero negative stock (atomic database checks)
  - Strict prevention of self-approval for expenses
  - Server-side GPS geofencing distance validation & automatic overtime calculation
  - Cycle detection & prerequisite task validation
  - Project boundary access enforcement
- [x] **8 Jest test suites (29 tests)** implemented and passing with 100% success rate.
- [x] Backend typecheck and build passing cleanly with 0 errors.
- [x] Web build passing cleanly with 18 static-prerendered routes.
- [x] All web pages migrated to real API calls with live PostgreSQL integration (14/14 endpoints verified HTTP 200).
- [x] Dev seed user (ADMIN) created and authentication flow verified.
- [x] **ISSUE-013 + ISSUE-014 IMPLEMENTED + VERIFIED (2026-09-23)** — server-side receipt/blob persistence and `/api/upload`:
  - `backend/src/common/storage/` — `StorageService` abstraction + `LocalStorageService` (path-traversal-safe keys, MIME allowlist, 10 MB cap, SHA-256 checksum) + global `StorageModule` (`STORAGE_DRIVER`/`STORAGE_ROOT` env).
  - `backend/src/modules/upload/` — `POST /api/upload` (JWT + expense ownership, multipart, MIME allowlist, 10 MB, `Document`+`DocumentVersion`+`Attachment`, structured `documentId` response, standard error envelope) and authenticated `GET /api/upload/:documentId` (StreamableFile; `@SkipEnvelope`).
  - `Mobile/src/services/apiClient.ts` `uploadFile()` extended; `Mobile/src/services/expenseDocuments.ts` `submitReceiptDraft` now uploads the receipt binary and links `OCRJob.document_id`.
  - Tests: backend **11 suites / 52 tests**, typecheck 0, build 0; Mobile typecheck 0; live E2E against PostgreSQL 18 (unauth 401, login, expense, upload 201, blob on disk, byte-identical retrieval, bad MIME 400).

# What Remains
- [ ] Apply the R0 milestone from `IMPLEMENTATION_ROADMAP.md` (stabilize): fix ISSUE-002 (mobile login), ISSUE-005 (real persistence + sync), ISSUE-003/004 (OCR cleanup), ISSUE-006/008/009 (hygiene).
- [ ] Initialize git + CI (typecheck + tests + build) — no VCS exists in the checkout.
- [ ] ~~Deploy OCR function to Supabase; obtain real Supabase project keys and apply `supabase/full_setup.sql`.~~ **SUPERSEDED (2026-09-23):** PostgreSQL/NestJS is authoritative; Supabase is a legacy compatibility artifact to be decommissioned at R7. OCR is handled by the backend `ocr` module + PaddleOCR service (see R5), not a Supabase Edge Function deploy.
- [ ] Mobile app: wire real login flow, implement offline queue sync.
- [ ] OCR pipeline: complete PaddleOCR service deployment, fix documentation drift (ISSUE-003/004).

# What Is Blocked
- Live Supabase integration/E2E, mobile device runs, and PaddleOCR inference cannot be exercised here (no project/keys, no emulator/device, no model runtime).
- Migration implementation should not start before R0 stabilization decisions are approved (see `IMPLEMENTATION_ROADMAP.md`).

# Last Known Working State
- Verified working in this environment (2026-09-18/19): shared build + all unit suites, web production build (14 routes), root typecheck (0 errors), web dev server HTTP 200 on 14 routes.
- The OCR chain (schema ↔ Edge Function ↔ OCR service) is internally consistent apart from documented drift (Google Vision leftovers, dead `extract.ts`).
- Live project behavior (RLS, Edge Function, Storage, PaddleOCR inference) remains UNVERIFIED — no keys/deployment.

# Verification
| Check | Result | Notes |
|---|---|---|
| Build | PASS | shared + web (14 routes), 2026-09-18/19 |
| Unit tests | PASS | shared suites + Edge `extract.test.ts` (36) + OCR `pytest` (6) |
| Integration tests | NOT RUN | requires live Supabase project |
| E2E tests | NOT RUN | no deployed web/mobile/function/OCR service |
| Type checking | PASS | `npm run typecheck` 0 errors (shared+web+mobile) |
| Lint | NOT RUN | `next lint` not executed |
| App startup | PASS | web dev server live; mobile not started |

# Files Changed
- `backend/src/modules/control-tower/interfaces/control-tower.interface.ts`
- `backend/src/modules/control-tower/control-tower.service.ts`
- `backend/src/modules/control-tower/control-tower.controller.ts`
- `backend/src/modules/control-tower/control-tower.module.ts`
- `backend/src/app.module.ts`
- `backend/test/control-tower.service.spec.ts`
- `backend/test/*.spec.ts` (8 suites, 29 tests)
- `web/src/lib/api-client.ts`
- `web/src/components/ControlTowerDrilldownDrawer.tsx`
- `web/src/components/ControlTowerRedFlagsCard.tsx`
- `web/src/components/Sidebar.tsx`
- `web/src/app/page.tsx`
- `web/src/app/control-tower/page.tsx`
- `Project workflow/VERIFICATION.md`
- `Project workflow/PROGRESS.md`
- `Project workflow/ISSUES.md`
- `Project workflow/HANDOFF.md` (this file)
- `web/src/app/cheltuieli/page.tsx` (sample data fix)
- `web/src/app/aprobare/page.tsx` (sample data fix)
- `web/src/app/avize/page.tsx` (sample data fix)
- `web/src/app/pontaj/page.tsx` (sample data fix)
- `web/src/app/notificari/page.tsx` (sample data fix)

# Important Files To Continue With
- `HOW_TO_RUN.md` — runbook.
- `web/src/app/page.tsx` — dashboard (ISSUE-001).
- ~~`supabase/functions/ocr-extract/index.ts` + `extract.ts` — OCR edge (ISSUE-003/004).~~ **DELETED 2026-09-23** — OCR now runs through `backend/src/modules/ocr/` (`POST /api/ocr/process` -> self-hosted PaddleOCR).
- `Mobile/src/services/apiClient.ts`, `Mobile/src/services/ocr.ts`, `Mobile/src/services/expenseDocuments.ts`, `Mobile/src/services/expenseMapping.ts` — the migrated Mobile runtime paths.
- `backend/src/modules/ocr/providers/paddleocr.provider.ts` — OCR provider client (FormData import fixed).
- `Mobile/App.tsx`, `Mobile/src/screens/LoginScreen.tsx` — auth wiring (ISSUE-002).
- `Mobile/src/screens/WorkerExpenseScreen.tsx`, `DeliveryIntakeScreen.tsx`, `Mobile/src/services/storage.ts` — offline queue (ISSUE-005).
- `ocr-service/app/main.py` — OCR service entrypoint.

# Important Decisions
See DECISIONS.md. Key: monorepo workspaces, **NestJS + Prisma + PostgreSQL 18 backend (Supabase fully removed from runtime on 2026-09-23 — RLS-era Supabase is superseded)**, self-hosted PaddleOCR (supersedes Google Vision), Romanian-first i18n, offline queue, DB-enforced stock integrity, validation-first OCR review loop.

# Assumptions
- Web + mobile + OCR service are all maintained in this repo.
- No production credentials are available in this environment; deployment cannot be exercised here.
- The 2026-09-18 status report is the current ground truth (any disagreement → update docs + report).

# Known Problems
- Full list in ISSUES.md (ISSUE-001 .. 009).
- Summary: dashboard queries a nonexistent table; mobile auth bypass; OCR doc/code drift; dead parser; offline sync gaps; repo hygiene (gitignore, missing pytest, SQL header); mojibake.

# Next Action
The next AI should:
1. **Phase 4: Authorization & project scoping** — ensure `actorId` propagated from auth context.
2. **Phase 5: DTO validation** — add class-validator decorators to DTOs.
3. **Phase 6: Read APIs** — add pagination/filters to `getMovements` and `listAllBalances`.
4. **Phase 7: Web `/stocuri` rewrite** — handle new TRANSFER_IN/TRANSFER_OUT types.
5. **Phase 8: Web `/avize` rewrite** — add create form using new `createAviz`.
6. **Phase 9: Mobile delivery intake fixes** — verify mobile creates avize correctly.
7. **Phase 10: Integration/E2E tests** — concurrent consume/transfer, aviz→stock flow.
8. **Phase 11: Documentation updates** — PROGRESS.md, ISSUES.md, IMPLEMENTATION_ROADMAP.md, VERIFICATION.md.
9. **Missing endpoint:** Add `GET /api/procurement/avize/:id` route to controller.

# Context For The Next AI
- R2.3 is fully verified: 30/30 live E2E tests pass against real PostgreSQL 18.
- Four-layer stock defense: service pre-check → FOR UPDATE row lock → atomic conditional write → DB CHECK constraint.
- Transfer produces two movement rows (TRANSFER_OUT/TRANSFER_IN) for audit trail.
- Aviz creation atomically posts stock in a single transaction.
- Per-project aviz number scoping — same number allowed on different projects.
- `StockMovementTypeEnum` now includes TRANSFER_IN and TRANSFER_OUT (added via ALTER TYPE).
- Backend tests: 12 suites / 69 tests passing.
- All quality gates green: shared/backend/web typecheck, backend build, web build.

# Context For The Next AI
- This is a monorepo with npm workspaces; `shared/dist` must be built before web/mobile.
- The mobile app currently runs on a hardcoded demo user; real login is implemented but unwired.
- The OCR pipeline now runs entirely server-side: `POST /api/ocr/process` -> `PaddleOcrProvider` -> self-hosted PaddleOCR (`PADDLEOCR_URL`). The Edge Function is gone. In dev the PaddleOCR service is not running, so the endpoint correctly returns 502 `PaddleOCR service is unavailable` and `GET /api/ocr/health` reports `unavailable`.
- The Mobile receipt flow now uploads the receipt binary to the server blob store (`POST /api/upload`, ISSUE-013/014) at submit time; local copies are retained until a confirmed upload, and the offline SQLite queue still only replays the expense. Document + DocumentVersion rows are materialized for every confirmed upload.
- `/pontaj`, `/rapoarte`, `/stocuri` are mock pages; the dashboard was fixed (Control Tower).
- `/notificari` page is fully functional with real API, locale-aware rendering (`title_ro`/`title_en`/`message_ro`/`message_en`), and pagination.
- All `Project workflow/` docs were regenerated from a static audit; verification columns are intentionally NOT RUN/UNVERIFIED rather than guessed.

# Handoff Checklist
- [x] Current task documented
- [x] Completed work documented
- [x] Remaining work documented
- [x] Blockers documented
- [x] Verification documented
- [x] Files identified
- [x] Next action documented
