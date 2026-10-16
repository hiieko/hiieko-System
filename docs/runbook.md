# HIIEKO — Runbook

Day-to-day operations: checking health, restarting, deploying, migrations, logs,
scaling. For emergencies see `docs/incident-response.md`; for data loss
`docs/restore.md`; for the hosting setup `docs/deploy.md`.

---

## 1. Health check

Two endpoints, served by the backend before any application auth (from `backend/src/main.ts`):

| Endpoint | Healthy response | What it means |
| --- | --- | --- |
| `GET /health/live` | `200 { "status": "ok", "service": "hiieko-api" }` | The process is up. Does **not** touch the database. |
| `GET /health/ready` | `200 { "status": "ready", "service": "hiieko-api", "database": "ok" }` | The process is up **and** the database answers a `SELECT 1`. |

A `503 { "status": "not_ready", ..., "database": "unavailable" }` from `/health/ready`
means: process fine, database not answering — start with the database, not the app.

Use `/health/live` as the hosting health check (per `docs/deploy.md`) so a database blip
does not recycle an otherwise healthy process. A fully healthy system answers `200` on both.

---

## 2. Restart the backend

**On the hosting platform (production):** open the backend service in the Render
dashboard → restart / redeploy the service. **TODO — confirm with the hosting provider**
(exact button names and whether a restart re-reads environment variables on this plan).

Rules of thumb: a restart is safe; if the service restarts *and immediately dies again*,
the build or a recent change is the problem — roll back the last deploy instead of
restarting in a loop.

**Locally (development):** from the repository root run `npm run backend:dev`
(the backend in watch mode). Production-like local run: build, then
`npm run start:prod --workspace=backend`.

---

## 3. Deploy a new version

Follow **`docs/deploy.md`**. Short version: push to `master`, the backend service builds
with `npm ci && npm run build --workspace=backend` and starts `backend/dist/main.js`;
the frontend builds on Netlify. After deploying, hit `/health/live` and `/health/ready`,
and check the first page loads against the new API.

---

## 4. Run a database migration

From the repository root:

- Apply committed migrations: `npm run migrate:deploy --workspace=backend`
  (runs `prisma migrate deploy` — applies pending migrations only, never generates new ones).
- Verify: `npx prisma migrate status` — confirm nothing is pending.

**Never** run `migrate dev`, `db push`, or the seed script against production: they can
reset, force-push or fixture-write live data. New migrations must be generated in
development and committed to the repository first.

---

## 5. Find logs

- **Production:** the hosting provider's dashboard for the backend service (Render →
  service → Logs). The application logs to stdout/stderr, so everything the process
  prints lands there. **TODO — confirm with the hosting provider** (log retention window,
  and whether logs can be exported).
- **What you are looking for:**
  - structured access lines — JSON with `requestId`, `method`, `path`, `status`,
    `durationMs`. Match a user's `x-request-id` response header to find their exact request.
  - `[ResponseSize] <method> <path> — <n> bytes` — a response over 1 MB (warning only,
    investigate pagination/filtering on that endpoint).
  - `[SESSION] revoked session=... reason=...` — session revocations (logout, role change,
    password change, suspension).
- **Locally:** plain terminal output from `npm run backend:dev`.

---

## 6. Check database size and connections

- **Simplest:** the database provider's dashboard (Render Postgres or Neon) — metrics for
  storage size, connections, CPU. **TODO — confirm with the hosting provider** (dashboard
  links and where the connection limit is shown).
- **Directly:** connect with your SQL client using `DATABASE_URL` and check
  `pg_database_size(current_database())` for size and `pg_stat_activity` for active
  connections.
- Watch for: size creeping up (mostly audit/attachment metadata), or connections near the
  provider's limit (usually caused by too many app instances or a connection leak).

---

## 7. Scale up (if needed)

1. **Vertical first:** increase the backend service's instance size on the hosting
   platform — one switch, no code change.
2. **Horizontal if still needed:** run more backend instances behind the provider's
   routing. This is safe for rate limiting — the limiter is stored in PostgreSQL, so
   instances share the same counters. Watch the database connection count: each instance
   opens its own Prisma pool. **TODO — confirm** the connection limit and recommended
   pool sizing with the hosting provider.
3. **Frontend:** Netlify scales on its own; nothing to do.
4. **Database:** move to a bigger plan before upgrading the app — the database is almost
   always the real ceiling.

---

## 8. Backups

Backups and step-by-step restores (database **and** uploaded files) are covered in
**`docs/restore.md`** — including the monthly test-restore schedule. Do not wait for an
incident to discover your backup does not work.

---

## 9. Common failures and fixes

- **`/health/ready` → 503** — database unreachable: check the provider status/dashboard
  and `DATABASE_URL`.
- **Backend won't start with a `JWT_SECRET` error** — set a long random `JWT_SECRET` env
  var (production refuses to start on a missing/weak secret).
- **Everyone signed out at once** — `JWT_SECRET` was rotated or changed; expected, tell
  users to log in again.
- **Frontend calls fail with CORS errors** — the exact frontend URL is missing from
  `CORS_ORIGIN`; add it and restart the backend.
- **HTTP 429 Too Many Requests** — rate limits (30 writes/min, 100 reads/min per user/IP);
  confirm it is a genuine burst, not abuse.
- **Pending migrations after a deploy** — run `npm run migrate:deploy --workspace=backend`,
  recheck `prisma migrate status`.
- **Uploaded files 404** — the disk under `STORAGE_ROOT` was lost or replaced; restore
  files per `docs/restore.md`.
- **New user cannot log in** — account is still `PENDING`; an admin must activate it.
- **Oversized responses / slow list pages** — `[ResponseSize]` warnings in the logs;
  that endpoint needs pagination or filtering.
- **Slow everything** — check database connections and size (§6) before touching the app.
