# HIIEKO — Local → Cloudflare R2 Storage Migration Procedure (future, not yet executed)

> **Status: PROCEDURE ONLY — NOT EXECUTED.**
>
> This document does **not** perform a migration, connect to production, or touch
> any real file. It defines the steps required **before** an environment that
> already holds uploaded files may switch `STORAGE_DRIVER` from `local` to `r2`.
> Execution requires explicit operator approval (see §7).
>
> Companion documents: `docs/deploy.md` (§5 blob storage), `docs/restore.md`
> (backups), `backend/src/common/storage/` (the `StorageService` drivers).

---

## 0. Why this exists

The storage driver is behind the `StorageService` abstraction. Object **keys** are
server-generated and provider-neutral (`receipts/<yyyy>/<mm>/<uuid>.<ext>`), so the
same key is valid for both drivers. The database is the source of truth for which
keys exist:

- `Document.storage_path` / `DocumentVersion.storage_path` — the object key.
- `Attachment.storage_url` — **two historical formats coexist**:
  - an **object key** (written by `UploadService.uploadFile`, upload path), and
  - a **relative API URL** `/api/upload/<documentId>` (written by
    `AttachmentsService.create`, link path).

Because both drivers resolve downloads through the same
`GET /api/upload/:documentId` route (which reads `DocumentVersion.storage_path`),
`Attachment.storage_url` has never been the storage read path. **Do not normalize
the two `storage_url` formats as part of a storage migration** — that is a
separate, deliberate data change with its own review.

**Do not assume production is empty.** Before any cutover, inventory exactly which
environments hold real uploads and which database records still reference them.

---

## 1. Inventory and backup (required first)

For each environment (`dev`, `staging`, `production`):

1. **Repository evidence** — record the configured `STORAGE_DRIVER` and
   `STORAGE_ROOT` (never print secret values; only names/driver/root path).
2. **Database inventory (read-only queries):**
   - `SELECT id, storage_path FROM documents;`
   - `SELECT document_id, version, storage_path, file_size, checksum FROM document_versions;`
   - `SELECT id, target_type, storage_url FROM attachments;`
3. **Effective local storage root** per environment (default `storage/uploads`,
   resolved relative to the backend process working directory).
4. **Which `storage_path` values have a matching file** on disk, and which do not
   (missing files are a pre-existing condition — record, do not "fix" silently).
5. **Attachment format census** — count rows whose `storage_url` is an object key
   vs. a `/api/upload/...` URL.
6. **Backups** — confirm a restorable backup of both the database and the disk
   holding `STORAGE_ROOT` exists (see `docs/restore.md`).

Output: an inventory table (environment × record count × missing files) signed off
by the operator before proceeding.

---

## 2. Dry-run mapping (no writes)

Produce a mapping `database key → local source file → proposed R2 key` **without
copying anything**:

1. Enumerate the unique object keys referenced by `documents` and
   `document_versions`.
2. Resolve each key to `<STORAGE_ROOT>/<key>` and record whether the source exists.
3. Verify the target R2 key equals the source key **exactly** (keys are preserved;
   no re-hashing, no renaming).
4. Report: total keys, present, missing, and any keys outside the expected
   `<namespace>/<yyyy>/<mm>/<uuid>.<ext>` shape (flag for manual review).

Do not proceed if the mapping is incomplete or ambiguous.

---

## 3. Copy with checksums (idempotent)

For every present source file:

1. Compute the **SHA-256 of the source bytes**. (Note: `document_versions.checksum`
   was computed by the driver at upload time as SHA-256 of the original buffer; for
   the local driver these should agree. Record any mismatch — do not overwrite the
   database.)
2. Upload to R2 under the **same key**, with the content type derived from the key
   extension (matching `StorageService.read`).
3. Re-download from R2 (or use the object's stored checksum) and compute SHA-256.
   **Abort on any mismatch** and record the key.
4. The copy is **idempotent**: re-running overwrites the same key with identical
   bytes. Source files are **left in place** (never deleted in this phase).

Missing source files are **not** created; they are logged for a decision (accept the
pre-existing gap or recover from backup).

---

## 4. Verification

1. Start one backend instance with `STORAGE_DRIVER=r2` pointed at the copy
   (staging instance only — not production).
2. For a random sample per environment (plus every file that failed pre-checks),
   call `GET /api/upload/:documentId` and confirm the response is **byte-identical**
   to the source file and preserves `Content-Type`.
3. Confirm no route generates a public bucket URL — downloads still flow through the
   authenticated endpoint.
4. Confirm authorization behavior is unchanged (uploader/elevated/project-member
   rules identical to `local`).

---

## 5. Rollback plan

- **Before cutover**, rollback is trivial: the driver is still `local`; nothing has
  changed for end users. The copied R2 objects are inert.
- **Immediately after cutover**, rollback = set `STORAGE_DRIVER=local` and restart.
  Because source files were never deleted, all historical objects resolve as before.
- **After verifying** (later, separately approved cleanup) the local source copies
  may be archived, not deleted, until one full retention window passes.

---

## 6. Cutover (only after explicit approval)

1. Announce the maintenance window; consider pausing writes.
2. Set the R2 variables and `STORAGE_DRIVER=r2` on the target environment.
3. Restart the backend; confirm it boots (a bad R2 config fails fast at startup).
4. Run the §4 verification sample against production downloads.
5. Keep `local` sources intact through the observation window.

---

## 7. Requires operator approval

- Running the inventory (§1) against any environment.
- Copying files (§3) into any R2 bucket.
- Changing `STORAGE_DRIVER` for any environment (§6).
- Any cleanup/deletion of source files (§5).

**No part of this procedure has been executed by the R2 driver implementation.**
