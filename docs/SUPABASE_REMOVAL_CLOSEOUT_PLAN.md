# HIIEKO — Supabase Removal Close-Out Plan

**Document type:** Implementation close-out plan (PLAN ONLY — no code changed yet)
**Date:** 2026-09-23
**Scope:** Close-out of the residual Supabase-removal issues (ISSUE-012, ISSUE-013, ISSUE-014, ISSUE-015) plus the OCR end-to-end trace.
**Runtime removal status:** COMPLETE. Active runtime is `Web + Mobile → NestJS :4000 → Prisma → PostgreSQL 18 :5432`. No `@supabase/*` dependency or runtime import remains in `web/src`, `Mobile/src`, `backend/src`, or `shared/src`.

> **Status update (2026-09-23):** ISSUE-013 and ISSUE-014 are now **IMPLEMENTED + VERIFIED** (see §6). D-013 is resolved (local-disk driver behind the `StorageService` abstraction). D-012 and D-015 remain decision-gated — do not drop `public.time_logs` or delete `supabase/` without approval. R2.3/R2.5 remain paused.

---

## 0. Verified current state (read-only inspection, 2026-09-23)

| Area | Finding |
|---|---|
| Backend OCR | `ocr.controller.ts` exposes `POST /api/ocr/process` (multipart `FileInterceptor('file')`) and `POST /api/ocr/jobs` (JSON). `paddleocr.provider.ts` uses a namespace `form-data` import (runtime fix applied). Provider returns HTTP 503 `OCR_PROVIDER_NOT_CONFIGURED` when PaddleOCR is absent → Mobile falls back to manual entry. |
| Backend documents | `documents.controller.ts` exposes `POST /api/documents` and `POST /api/documents/:id/versions` — JSON only (persist a `storage_path` string). **No binary writer.** |
| Backend upload route | **None.** No `@Controller('api/upload')`. The only `FileInterceptor` in the backend is `ocr.controller.ts:54`. No `multer.diskStorage`, no `ServeStatic`, no `express.static`, no `StreamableFile`/download endpoint. |
| Prisma models | `Document(storage_path)`, `DocumentVersion(storage_path,file_size,checksum,uploaded_by)`, `OCRJob(document_id,expense_id,raw_payload)`, `OCRExtraction`, `Attachment(target_type,target_id,storage_url)`. All exist; none is fed a real binary. |
| Mobile receipt flow | `ReceiptScanFlow.tsx` → capture → `processDocumentImage` (rotate/crop/upscale) → `runOcrExtraction` → review → `submitReceiptDraft` (`POST /api/expenses` + `POST /api/ocr/jobs`; offline → SQLite sync queue). Verified live. |
| Mobile `uploadFile()` | `apiClient.ts:543-564` POSTs multipart to `/api/upload` (fields `file`,`entityType`,`entityId`). Declared on `IMobileApiClient` (L172). **Zero callers** in `Mobile/src`. Route does not exist → would 404. |
| `public.time_logs` | 3 legacy-shaped rows, frozen. **0 references** in `backend/src`, `backend/test` (9 spec files), `web/src`, `Mobile/src`, `shared/src`. Not Prisma-managed. |
| `supabase/` | **0 runtime references.** Two textual references remain: `database/migrations/002_migrate_supabase_data.sql:17` (comment) and `database/scripts/run_migration.ts:74` (console guidance string). |

---

## 1. ISSUE-014 — `/api/upload` route (decision required)

### Decision gate D-014
**Implement a real `/api/upload` endpoint, OR remove `uploadFile()` from `IMobileApiClient` / `NestMobileApiClient`?**
Downstream of ISSUE-013 (D-013, the blob-store choice). Recommended: **implement**, because ISSUE-013 needs an upload mechanism to stop retaining receipt binaries on-device. If D-013 is deferred, the minimal safe action is to **remove the dead `uploadFile()`** (zero callers) so no latent 404 path ships.

### 1.1 Required endpoint (if implemented)
- New `UploadModule` (`backend/src/modules/upload/`): `upload.module.ts`, `upload.controller.ts`, `upload.service.ts`, `dto/upload.dto.ts`.
- Register in `app.module.ts` (append to `imports` next to `DocumentsModule`).
- Route `POST /api/upload` with `@UseInterceptors(FileInterceptor('file', { storage: multer.diskStorage(...), limits, fileFilter }))`.
- Optional read route `GET /api/upload/:key` (authenticated, `StreamableFile`) so clients fetch a stored blob without a public bucket.
- multer is already available transitively via `@nestjs/platform-express` (OCR controller already uses `FileInterceptor`). No new dependency for the local-disk option.

### 1.2 Authentication / authorization
- Guards `JwtAuthGuard` + `RolesGuard` (same pattern as `documents.controller.ts` / `ocr.controller.ts`).
- `@CurrentUser()` supplies `userId` → persisted as `uploaded_by` on the created `DocumentVersion` (and/or `Attachment`).
- Model: any authenticated worker may upload their **own** receipt; managers/officers may upload/read documents for projects they can access. Reads are authenticated (no anonymous/public URL).

### 1.3 Accepted file types (MIME allowlist — match the OCR controller)
`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `application/xml`, `text/xml`. Enforce in `fileFilter` by MIME (not extension); reject others with `400`.

### 1.4 Size limits
`limits.fileSize = 10 * 1024 * 1024` (10 MB — matches legacy `expense_documents.file_size_limit = 10485760`). Oversize → `413`.

### 1.5 Storage location (depends on D-013)
- **Option A (recommended, zero new deps): local disk.** Configurable `UPLOAD_DIR` env (default e.g. `backend/storage/uploads`). Add `uploads/` (or `storage/`) to `.gitignore` — currently absent. Serve via authenticated `GET /api/upload/:key`.
- **Option B: S3-compatible (MinIO/R2).** Needs a new client dependency + bucket credentials; gives durability/HA. Choose only if D-013 selects object storage.

### 1.6 Generated key / returned metadata
- Key: content hash (`sha256`) or `uuid` + original extension; deterministic, collision-safe, **no client-controlled path segments** (prevents traversal).
- Response (wrapped by `TransformInterceptor`): `{ url, storageKey, fileName, mimeType, fileSize, checksum }`.
- On success the service creates `Document` + `DocumentVersion` rows and links to the expense via `OCRJob(expense_id, document_id)` or `Attachment(target_type='expense', target_id)`, so the binary is discoverable from the expense.

### 1.7 Error handling
| Case | HTTP |
|---|---|
| Unsupported MIME | 400 |
| Oversize file | 413 |
| Missing/invalid token | 401 |
| Insufficient role/project access | 403 |
| Disk/object write failure | 500 (standard envelope via `AllExceptionsFilter`) |

### 1.8 Security considerations
- MIME allowlist server-side (not extension trust); hard size cap; stream to `diskStorage` (not `memoryStorage`).
- Sanitize/ignore client filename for the stored key; keep original name only as metadata.
- No path traversal: stored key is server-generated; never join user input into the path.
- Authenticated reads only; no public/anonymous bucket or static mount.
- Log only key + size + uploader (no secrets, no full bodies).

### 1.9 How receipt + document flows should use it
1. `submitReceiptDraft` uploads the **original** capture (optionally the processed copy) to `POST /api/upload`.
2. Backend stores the binary, creates `Document` + `DocumentVersion`, links to the expense.
3. Mobile records `storageKey`/`url` in the OCR job `raw_payload` (replacing device-local `local_files` URIs) and **only then** deletes local `expense-scans/` copies (confirmed-success deletion — resolves ISSUE-013).
4. Offline: upload is queued in the SQLite sync queue and replayed on reconnect (idempotency key preserved); local copies retained until the queued upload succeeds.

---

## 2. OCR end-to-end trace (camera → server storage → review → submit)

Exact steps as implemented today, with the broken/incomplete step called out.

| # | Step | Code | Status |
|---|---|---|---|
| 1 | Camera capture | `ReceiptScanFlow.tsx` (expo-camera + permission) → `saveCapturedImage` copies to durable `expense-scans/` dir | ✅ works |
| 2 | On-device processing | `documentProcessing.ts` `processDocumentImage` → rotation (90° steps) / manual crop / OCR upscale; **original preserved**, new copy written to `expense-scans/` | ✅ works (no auto edge-detect/perspective — needs a native dev build, out of scope) |
| 3 | OCR extraction | `ocr.ts` `runOcrExtraction(b64)` → `apiClient.processOcr` → `POST /api/ocr/process` (multipart) → `ocr.controller.ts` `FileInterceptor('file')` → `ocr.service.ts` → `paddleocr.provider.ts` (namespace `form-data` import). Creates `OCRJob` + `OCRExtraction`. Binary held in memory only — **not persisted server-side**. | ✅ works after the `form-data` fix. When PaddleOCR is absent → 503 → UI falls back to manual entry (not a bug, by design). |
| 4 | Review | `ReceiptScanFlow.tsx` review step: fields populated from OCR; `getLowConfidenceFields()` flags low-confidence fields for manual correction | ✅ works |
| 5 | Submit | `submitReceiptDraft` → `POST /api/expenses` (idempotency key, backend enums) + `POST /api/ocr/jobs` (`raw_payload` carries OCR result + device-local `local_files` URIs). Offline → `enqueueOperation` to SQLite sync queue, replayed on reconnect | ✅ works (verified live 10/10) |
| 6 | **Server-side binary persistence** | **Not implemented.** The image binary never leaves the device except transiently to the OCR provider. No `Document`/`DocumentVersion` rows are created for receipts. `raw_payload.local_files` references device-local URIs the server cannot read. Local copies are therefore **retained** (deleting them would lose the receipt permanently). | ❌ **INCOMPLETE — this is ISSUE-013** |

### Broken / incomplete step
**Step 6** is the single gap. It is ISSUE-013 (no server-side blob store) and is the reason ISSUE-014 (`/api/upload`) exists as a latent route. Steps 1–5 are complete and verified.

### Fix path (ties to §1)
Implement D-013 (blob store) + D-014 (`/api/upload`) → insert a new step **5b** between submit and local-cleanup: upload original (and optional processed) binary, create `Document`+`DocumentVersion`, link via `OCRJob`/`Attachment`, then delete local copies only on confirmed 200. Offline uploads queue and replay; local copies retained until success.

---

## 3. ISSUE-012 — orphan `public.time_logs` (drop decision)

### Decision gate D-012
**May `public.time_logs` (3 legacy-shaped rows) be dropped?** Requires explicit approval — do not drop unilaterally.

### 3.1 What depends on it
| Consumer | Depends on `public.time_logs`? | Evidence |
|---|---|---|
| Backend runtime (`backend/src`) | ❌ No | 0 references. Attendance writes go to Prisma `attendance_records` via `POST /api/attendance/*`. |
| Backend tests (`backend/test`, 9 spec files) | ❌ No | 0 hits for `time_logs`/`TimeLog`. `attendance.service.spec.ts` passes against `attendance_records`. |
| Web (`web/src`) | ❌ No | Only textual hit is `MOCK_TIME_LOGS` in `web/src/lib/mock-data.ts` — unrelated mock data, not the DB table. |
| Mobile (`Mobile/src`) | ❌ No (DB table) | `TimeLog` in `shared/src/types.ts` + `storage.ts` + `WorkerAttendanceScreen.tsx` is a **local AsyncStorage** type (`@solar:active_time_log`), not the PostgreSQL table. |
| Shared (`shared/src`) | ❌ No (DB table) | Same local `TimeLog` type. |
| Reporting / analytics | ❌ No | Control Tower dashboard reads `attendance_records`. |
| Migration tooling | ⚠️ `legacy.time_logs` only | `verify_migration.ts:132` parity pair `["attendance_records","time_logs"]` reads `legacy.time_logs` — **SKIPs when the `legacy` schema is empty**. It never touches `public.time_logs`. |

### 3.2 Is the data represented in `attendance_records`?
**No — not automatically.** `public.time_logs` was created by applying `supabase/full_setup.sql` directly into `public` (not into the `legacy` staging schema), so the 002 `legacy → public` ETL never migrated these 3 rows. Post-removal evidence: a live check-in moved `attendance_records` 3 → 4 while `time_logs` stayed 3 → 3, confirming the 3 rows are pre-existing legacy data **not** present in `attendance_records`.

### 3.3 What must be exported / verified before the drop
1. **Export** the 3 rows: `COPY (SELECT * FROM public.time_logs) TO 'time_logs_backup.csv' CSV HEADER;` (or a JSON dump) — archive outside the repo.
2. **Compare** each row against `attendance_records` (match on user + date) to confirm whether any represents real attendance not already captured.
3. **Confirm** with the team that the 3 rows are not needed (ISSUE-012 resolution).
4. Only then: `DROP TABLE public.time_logs;` and record the drop in `VERIFICATION.md` / `ISSUES.md`.

> Note: the `upsertLegacyTimeLog()` dual-write shim that kept this table alive was already removed; the table is now frozen dead weight.

---

## 4. ISSUE-015 — `supabase/` directory (delete-together decision)

### Decision gate D-015
**Will any production Supabase dump still need importing?** If **no**, `supabase/` and the legacy ETL path can be deleted together. Requires explicit approval.

### 4.1 What still references `supabase/`
| Reference | Kind | Runtime impact |
|---|---|---|
| `database/migrations/002_migrate_supabase_data.sql:17` | Comment: *"SOURCE OF TRUTH for legacy columns: `supabase/full_setup.sql`"* | None (documentation) |
| `database/scripts/run_migration.ts:74` | Console guidance string: *"apply `supabase/full_setup.sql` with `search_path=legacy`"* | None (operator hint) |
| `web/src`, `Mobile/src`, `backend/src`, `shared/src` | **0 references** | None |

### 4.2 Is it needed for the target schema, or only legacy data migration?
**Only legacy data migration.** The authoritative **target** schema is `backend/prisma/schema.prisma` + `database/migrations/001_create_target_schema.sql`. `supabase/` is needed **only** to stage a legacy Supabase dump into the `legacy` schema so `002_migrate_supabase_data.sql` can ETL `legacy.* → public.*`. If no dump will ever be imported, `supabase/` has no remaining purpose.

### 4.3 If deletion is approved — delete together (one coordinated change)
1. `supabase/` (entire directory: `full_setup.sql` + `migrations/01_initial_schema.sql … 08_ocr_document_states.sql`).
2. `database/migrations/002_migrate_supabase_data.sql` (the `legacy → public` ETL).
3. `database/migrations/003_rollback_migration.sql` (rollback undoes 002).
4. Edit `database/scripts/run_migration.ts`: remove the `prepLegacySchema()` legacy-staging step + the `supabase/full_setup.sql` guidance string; drop `"002"`/`"003"` from the `FILES` map and from the default `targets` (leave `001`).
5. Edit `database/scripts/verify_migration.ts`: remove the legacy-parity section (§5, the `legacy.*` pairs incl. `time_logs`).
6. Clean `.gitignore`: remove the `supabase/.temp/` and `supabase/seed/.gitkeep` entries.
7. Update `Project workflow/ISSUES.md`, `PROJECT_AUDIT.md`, and `docs/HIIEKO_MASTER_ROADMAP.md` references to reflect the deletion.

### 4.4 Keep regardless
- `database/migrations/001_create_target_schema.sql` (target schema — stays).
- `hiieko-final/` remains **archived/frozen** (separate decision; do not delete without explicit approval).

---

## 5. Recommended sequencing, verification, and next decision

### 5.1 Dependency order
1. **D-013** (blob store: local disk vs S3-compatible) → unblocks **D-014** (`/api/upload`) → unblocks OCR step 6 (server-side binary persistence).
2. **D-012** (drop `public.time_logs`) — independent; export → compare → approve → drop.
3. **D-015** (delete `supabase/` + legacy ETL) — independent; confirm no dump will be imported → coordinated delete.

### 5.2 Verification after each implementation (never claim completion without evidence)
- Monorepo typecheck (0 errors).
- Backend typecheck + build + Jest suite (currently 9 suites / 35 tests green).
- Web build.
- Runtime smoke test (NestJS :4000 ↔ PostgreSQL 18 :5432).
- For D-014: upload a sample receipt → assert `Document`+`DocumentVersion` rows created, binary retrievable via authenticated read, local copy deleted only on 200.
- For D-012: `verify_migration.ts` still passes; `attendance_records` count unchanged.
- For D-015: `run_migration.ts` (001 only) + `verify_migration.ts` still pass with no `legacy`/`supabase` references.

### 5.3 Documentation updates after completed work
Update `Project workflow/PROGRESS.md`, `VERIFICATION.md`, `ISSUES.md`, and `HANDOFF.md` (preserve history/terminology). Mark ISSUE-012/013/014/015 statuses per the decisions taken.

### 5.4 Constraints carried forward (do not violate)
- Do **not** delete `hiieko-final/` without explicit approval (archived/frozen).
- Do **not** delete `supabase/` until D-015 is approved.
- Do **not** drop `public.time_logs` until D-012 is approved.
- R2.3 Stock + Avize and R2.5 Notifications remain **paused** until the user explicitly approves resuming one.

### 5.5 Next decision point (for the user)
Supabase **runtime** removal is complete. The remaining items are the four close-out decisions above. After they are resolved (or explicitly deferred), the next feature decision is:
- **Resume R2.5 Notifications**, or
- **Resume R2.3 Stock + Avize**.

> No feature work resumes without explicit user approval.

---

## 6. Implementation status — ISSUE-013 + ISSUE-014 (2026-09-23)

Both residual issues are **implemented and verified**. D-013 is closed: a storage
abstraction with a local-disk driver (selectable via `STORAGE_DRIVER` /
`STORAGE_ROOT`) is used for development, isolated behind `StorageService` so a
persistent S3-compatible backend can be added later without rewriting domain
logic. D-014 is closed: `/api/upload` is implemented and wired into the receipt
flow.

| Item | Delivered |
|---|---|
| Storage abstraction | `backend/src/common/storage/` — `StorageService` contract, `LocalStorageService` (path-traversal-safe server-generated keys, MIME allowlist, 10 MB cap, SHA-256 checksum), global `StorageModule` with env-driven driver factory. |
| Upload API | `backend/src/modules/upload/` — `POST /api/upload` (JWT auth + expense-ownership authorization, multipart, MIME allowlist, 10 MB cap, safe unique object keys, original filename as metadata only, `Document` + `DocumentVersion` rows, `Attachment` link, structured response with stable `documentId`, validation errors via the standard error envelope) and `GET /api/upload/:documentId` (authenticated `StreamableFile` retrieval; `@SkipEnvelope` keeps binary responses unwrapped). |
| Mobile wiring | `apiClient.uploadFile()` extended (returns `documentId`/`fileName`/`mimeType`/`size`/`checksum`, optional `documentType`/`title` metadata); `expenseDocuments.submitReceiptDraft` uploads the receipt binary server-side and links `OCRJob.document_id` (+ `server_document_id` / `storage_url` in `raw_payload`). PaddleOCR and OCR flow unchanged. |
| Tests | `backend/test/upload.service.spec.ts` (11 cases) + `backend/test/local-storage.service.spec.ts` (8 cases). Backend suite green **11 suites / 52 tests**, backend typecheck 0, backend build 0, Mobile typecheck 0, shared rebuilt (adds HTTP 413 → `VALIDATION_ERROR`). |
| Live E2E (2026-09-23) | Booted built backend ↔ PostgreSQL 18 :5432: unauth upload → 401 `UNAUTHORIZED` envelope; dev login; expense create; authenticated multipart upload → **201** with `documentId`; blob persisted under `backend/storage/uploads/`; authenticated read returns **byte-identical** `image/jpeg`; document metadata queryable (`BON_FISCAL`, `storage_path`); `text/html` → 400 `VALIDATION_ERROR` envelope. Smoke rows/files cleaned afterward. |

**Intentional ordering note:** the mobile upload runs at *submit* time (after
OCR/review) to keep the verified OCR flow unchanged — the same end-to-end
capabilities (upload → blob → document metadata → OCR → review → expense) are
present, and local copies are retained until a confirmed upload.

**Remaining decision gates (unchanged, require explicit approval):**
- **D-012** — drop orphan `public.time_logs` (do not).
- **D-015** — delete `supabase/` + legacy ETL `002`/`003` (do not).

---
- `backend/src/modules/ocr/ocr.controller.ts`, `ocr.service.ts`, `providers/paddleocr.provider.ts`
- `backend/src/modules/documents/documents.controller.ts`, `documents.service.ts`
- `backend/src/modules/expenses/expenses.controller.ts`, `expenses.service.ts`
- `backend/prisma/schema.prisma` (`Expense`, `Document`, `DocumentVersion`, `OCRJob`, `OCRExtraction`, `Attachment`)
- `backend/src/app.module.ts`, `backend/src/main.ts`
- `Mobile/src/screens/ReceiptScanFlow.tsx`, `Mobile/src/screens/WorkerExpenseScreen.tsx`
- `Mobile/src/services/ocr.ts`, `expenseDocuments.ts`, `documentProcessing.ts`, `storage.ts`, `syncQueue.ts`, `apiClient.ts`
- `shared/src/types.ts`
- `database/scripts/run_migration.ts`, `database/scripts/verify_migration.ts`
- `database/migrations/001_create_target_schema.sql`, `002_migrate_supabase_data.sql`, `003_rollback_migration.sql`
- `supabase/full_setup.sql`, `supabase/migrations/01…08_*.sql`
- `Project workflow/ISSUES.md`, `VERIFICATION.md`, `HANDOFF.md`, `PROJECT_AUDIT.md`

