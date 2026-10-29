# HIIEKO Production Deployment

Operational runbook for deploying the HIIEKO system to production.

Stack:

- **Backend:** NestJS on **Render** (Node web service)
- **Frontend:** Next.js on **Netlify**
- **Database:** PostgreSQL (Render or Neon) via Prisma

> This document describes the deployment. It does **not** deploy anything by itself.

---

## 1. Render backend service setup

Create a **Web Service** on Render pointing at this repository.

| Setting | Value |
| --- | --- |
| Root directory | `/` |
| Build command | `npm ci && npm run build --workspace=backend` |
| Start command | `node backend/dist/main.js` |
| Health check path | `/health/live` |

- `npm ci` runs at the repository root so the npm workspace (`backend`, `shared`, `web`, ...) is
  installed consistently from `package-lock.json`.
- The build compiles the backend with Nest CLI to `backend/dist`; the entrypoint is
  `backend/dist/main.js` (it binds `0.0.0.0`, see `backend/src/main.ts:165`).
- **Health check path is `/health/live`** — a lightweight process liveness probe that does not
  touch the database. Use it for Render's health check.
  - `/health/live` → `200 { status: "ok" }` (process is up)
  - `/health/ready` → `200` when the database answers `SELECT 1`, `503` otherwise. Use this for
    readiness/monitoring, **not** as the Render health check (a DB blip would otherwise recycle a
    healthy process).

### Environment variables

Set these in Render → your service → **Environment**. Values are placeholders only — never commit
real secrets. Names mirror `backend/.env.example`.

| Variable | Placeholder / notes |
| --- | --- |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` (production DB, see §2) |
| `JWT_SECRET` | long random value (backend refuses to start if unset/weak) |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `3001` (Render may inject its own `PORT`; the app reads `process.env.PORT`) |
| `NODE_ENV` | `production` |
| `COMPANY_TZ` | `Europe/Bucharest` |
| `PADDLEOCR_URL` | `https://<paddleocr-host>` |
| `PADDLEOCR_TOKEN` | `<paddleocr-token>` |
| `PADDLEOCR_TIMEOUT` | `60000` |
| `CORS_ORIGIN` | `https://<netlify-site-url>` (see §4) |
| `MAX_FILE_SIZE` | `10485760` |
| `RESEND_API_KEY` | `re_<key>` |
| `RESEND_FROM` | `HIIEKO <noreply@hiieko.app>` |
| `PUBLIC_APP_URL` | `https://<netlify-site-url>` |
| `STORAGE_DRIVER` | `local` (default) or `r2` (see §5) |
| `STORAGE_ROOT` | `storage/uploads` (only meaningful when `STORAGE_DRIVER=local`) |
| `R2_ACCOUNT_ID` | only when `STORAGE_DRIVER=r2` (Cloudflare account ID) |
| `R2_BUCKET` | only when `STORAGE_DRIVER=r2` (private bucket name) |
| `R2_ACCESS_KEY_ID` | only when `STORAGE_DRIVER=r2` (R2 S3 API token access key id) |
| `R2_SECRET_ACCESS_KEY` | only when `STORAGE_DRIVER=r2` (R2 S3 API token secret) |
| `R2_ENDPOINT` | optional; defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_REGION` | optional; defaults to `auto` (the region R2 documents for its S3 API) |

---

## 5. Blob storage (receipts / documents)

Binary uploads (receipts, invoices, document versions) are persisted through the
`StorageService` abstraction (`backend/src/common/storage/`). Two drivers exist:

- **`local` (default)** — writes under `STORAGE_ROOT` on the backend host's disk.
  Suitable for development/demo. Files live and die with the host disk: on an
  ephemeral filesystem (Render's default) they are lost on restart or redeploy.
- **`r2`** — Cloudflare R2 through its S3-compatible API, using the official AWS
  SDK v3 S3 client (`@aws-sdk/client-s3`).

**R2 is not enabled until an operator explicitly sets `STORAGE_DRIVER=r2`.** The
default stays `local`, so existing deployments keep booting unchanged.

### Configure local storage

```
STORAGE_DRIVER=local
STORAGE_ROOT=storage/uploads
```

### Configure R2 (explicit operator decision)

1. In the Cloudflare dashboard, create a **private** bucket (R2 → **Create
   bucket**). Do **not** enable public access or a custom public domain — the
   bucket is read only through the backend.
2. Create an **S3 API token** scoped to that bucket (R2 → **Manage R2 API
   Tokens** → **Create API token** → *Object Read & Write*, bucket-scoped to the
   one bucket — least privilege). This yields the access key id and secret.
3. Set these on the backend service (Render → environment; local → `backend/.env`).
   Variable **names** mirror `backend/.env.example` — never commit real values:

```
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_BUCKET=<private-bucket-name>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
# R2_ENDPOINT=            # optional; derived from R2_ACCOUNT_ID when omitted
# R2_REGION=auto          # optional; "auto" is R2's documented S3 region
```

If `STORAGE_DRIVER=r2` is set but any required variable is missing or invalid,
the backend **refuses to start** (clearly, naming only the missing variables —
never their values). It also **fails fast on `@aws-sdk` errors** instead of
silently falling back to another driver.

### Access path and authorization (unchanged)

The bucket remains private. Uploads return the server-generated object key
(stored as `Document.storage_path`), and clients still download through the
authenticated `GET /api/upload/:documentId` route. No public object URLs are
generated, and authorization continues to run in the service/controller layer —
the storage driver never makes access decisions.

### Verify upload and download persistence

1. Upload a receipt through the app (or `POST /api/upload` with a valid file).
   A `201` response returns `documentId` and `url: /api/upload/<documentId>`.
2. Download the same `documentId` (`GET /api/upload/<documentId>`) and confirm the
   bytes are byte-identical to the upload.
3. Restart/redeploy the backend and repeat step 2. With R2 the file still
   resolves; with `local` on an ephemeral disk it will 404 — this is the release
   blocker R2 removes.

### Do not deploy files blindly

Before switching any environment that already holds real uploads from `local` to
`r2`, complete the file inventory + migration procedure in
`docs/R2_STORAGE_MIGRATION.md`. Migrating the database metadata without copying
the referenced objects leaves every historical download broken. **No production
deployment or data migration has been performed by this implementation.**

---

## 2. Production Postgres

Use a managed PostgreSQL instance — either **Render Postgres** or **Neon**.

### Create the database

- **Render:** Dashboard → **New +** → **Postgres**. Choose a name, region, and plan, then create.
  Copy the **Internal Database URL** (same-region service) or **External Database URL**.
- **Neon:** Create a project → branch/database, then copy the **pooled** connection string.

### Set `DATABASE_URL`

Add the connection string to the Render backend service environment as `DATABASE_URL` (see §1).
It has the shape:

```
postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
```

### Run migrations

Apply the committed migrations (never `migrate dev`, which can reset/prompt) from the repo root:

```
npm run migrate:deploy --workspace=backend
```

This runs `prisma migrate deploy`, which applies pending migrations without generating new ones.

### Verify

```
npx prisma migrate status
```

Run it from the `backend` workspace (or with `--schema backend/prisma/schema.prisma`). Confirm there
are no pending migrations and the schema is up to date.

> **WARNING:** do **not** run `prisma db seed` (or `npm run seed`) against production. The seed
> script is for local/demo data only and would write fixture records into the live database.

---

## 3. Netlify frontend config

1. Create the site from this repository; set the base directory / build settings so the `web`
   workspace is built (e.g. base `web`, build `npm run build`, publish `.next` / the configured
   output).
2. **Site settings → Environment variables**
   - Add `NEXT_PUBLIC_API_URL = https://<render-service-url>`
3. **Redeploy after setting the env var.** `NEXT_PUBLIC_*` values are inlined at build time, so the
   site must be rebuilt once the variable exists.
4. **Site settings → General → Site URL** — set this to the canonical Netlify URL. This is the value
   that must be whitelisted as `CORS_ORIGIN` on Render (§4).
5. Confirm the **deploy branch is `master`** (Site settings → Build & deploy → Branches).

---

## 4. CORS

`CORS_ORIGIN` on Render must include the **Netlify site URL** (comma-separated allowlist). With
`credentials: true`, a wildcard origin is illegal, so the exact frontend origin must be listed.

Example:

```
CORS_ORIGIN=https://<netlify-site>.netlify.app
```

After changing `CORS_ORIGIN`, redeploy/restart the Render service so the new allowlist is applied.
