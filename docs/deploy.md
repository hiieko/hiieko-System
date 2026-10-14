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
| `STORAGE_DRIVER` | `local` |
| `STORAGE_ROOT` | `storage/uploads` |

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
