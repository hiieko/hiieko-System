# Issues

Last Updated: 2026-09-23 (Repository hygiene checkpoint — R2.1 P2 Mobile screens complete: typecheck PASS)

## Status Legend
- `OPEN`
- `IN PROGRESS`
- `BLOCKED`
- `RESOLVED`
- `WONT FIX`

# Open Issues

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

# Known Limitations (not blocking)

- **Mobile `WorkerAttendanceScreen.tsx`** — The `TimeLog` type in `shared/src/types.ts` and the local AsyncStorage-based `activeTimeLog` mechanism are the mobile app's offline attendance state tracking (not the PostgreSQL table, which is now dropped). This is correct and stays.
- **`HOW_TO_RUN.md` and `Project workflow/CONFIGURATION.md`** — These documentation files still reference Supabase setup steps. They are outdated but harmless (no runtime impact). Should be updated as part of a documentation pass.
- **`MOBILE_MIGRATION_PROGRESS.md` and other migration docs** — Historical migration documents that reference Supabase. These are archival/planning docs, not runtime dependencies.
- **`ocr-service/README.md`** — References Supabase as part of the historical architecture description. This is a standalone OCR service, not an active runtime dependency.
