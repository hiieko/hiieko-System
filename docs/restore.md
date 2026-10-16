# HIIEKO — Restore Runbook

How to restore HIIEKO from a backup, and how to prove the restore worked.
Companion documents: `docs/deploy.md` (deploying), `docs/runbook.md` (day-to-day ops).

---

## 1. What is backed up

**Production database (PostgreSQL).** Everything the system knows lives here:
organizations, users, projects, tasks, attendance, expenses, stock movements,
documents metadata, sessions and the audit trail. It is reached through the
`DATABASE_URL` environment variable on the backend service.

**Uploaded files.** Receipts, invoices, photos and attachment documents are stored
as files on the backend host's disk, under `STORAGE_ROOT` (default `storage/uploads`),
selected by `STORAGE_DRIVER=local`. The database only holds the metadata and points to
those files (for example attachments resolve to `/api/upload/<documentId>`).

A restore therefore has two halves: the database **and** the files. Restoring only one
of them leaves the system inconsistent (metadata without files, or files nobody can find).

---

## 2. Where backups live

| Data | Backup mechanism | Notes |
| --- | --- | --- |
| Database | The hosting provider's managed backup (Render Postgres or Neon) | Retention and point-in-time window are provider settings |
| Uploaded files | The storage layer on the backend host (disk/volume snapshots) | Files are **not** in a separate cloud bucket today |

**TODO — confirm with the hosting provider:** which provider runs production, the backup
retention period, whether point-in-time recovery is enabled, and — importantly — whether
the disk holding `STORAGE_ROOT` is included in snapshots. Until that is confirmed,
uploaded files should be treated as an open risk: a host rebuilt from a database backup
alone will come up with missing files.

---

## 3. How to restore from a backup

### Database

1. **Stop writes first.** Stop (or scale down) the backend service so nothing writes
   during the restore. **TODO — confirm with the hosting provider** (the exact maintenance
   or pause mechanism for this account).
2. **Restore the snapshot.** In the database provider's dashboard, choose your instance →
   restore → pick the timestamp just before the problem. **TODO — confirm with the
   hosting provider** (exact menu names, and whether a restore returns a *new* host/branch).
3. **Update `DATABASE_URL`** on the backend service if the provider hands out a new
   connection string (Neon restores typically create a new branch). Never edit the value
   by hand in the repository — environment variables live on the hosting platform only.
4. **Bring the schema up to the current code.** A snapshot may predate recent migrations;
   run the committed migrations (`npm run migrate:deploy --workspace=backend`, i.e.
   `prisma migrate deploy`), then check status with `prisma migrate status`.
   Never run `migrate dev`, `db push`, or the seed script against production — they can
   reset or write fixture data into live tables.
5. **Restart the backend** and verify (section 4).

### Files

1. **Restore the disk/volume snapshot** taken at (or before) the database backup time.
   **TODO — confirm with the hosting provider** — how file-level restore works for this
   account, and where restored files land.
2. Confirm the service still points at the restored location: `STORAGE_DRIVER=local`
   and `STORAGE_ROOT` unchanged (default `storage/uploads`).
3. **Restart the backend** and verify (section 4).

> Rule of thumb: restore files from a snapshot taken **no later than** the database
> snapshot, so no file referenced by the database is missing.

---

## 4. How to verify a restore succeeded

- **Health:** `GET /health/live` returns `200 { "status": "ok" }` (process up) and
  `GET /health/ready` returns `200 { "status": "ready", ..., "database": "ok" }`
  (a `503` with `"database": "unavailable"` means the restore did not land).
- **Migrations:** `prisma migrate status` reports no pending migrations.
- **Login:** sign in with a known test account; the organization and its projects load.
- **Spot-check data:** confirm recent records exist that match the backup time —
  for example the latest audit entries and last week's attendance.
- **Spot-check files:** open one recent uploaded receipt/document in the app and make
  sure the file actually renders (not a 404).
- **Audit:** the audit trail shows normal activity after the restore, and note the
  restore itself as an operational event.

Write down what you checked — this is the evidence the test succeeded.

---

## 5. Verification schedule

**Test a restore once per month, on staging, not production.**

- Restore the latest production backup into a staging environment, run the checks in
  section 4, and record the date, who ran it, and anything that failed.
- An untested backup is a guess; the monthly test is what makes this document true.

---

## 6. Who can perform a restore

**TODO — confirm with the hosting provider / company** (name the two people who hold
admin access to the hosting platform and the database provider).

Practically, a restore needs two capabilities: admin access to the hosting/database
dashboards, and the ability to redeploy or restart the backend. Treat a production
restore as a two-person action — one to operate, one to verify (section 4).
**TODO — confirm** whether an approval step is required before touching production.
