# HIIEKO — Secrets Rotation Policy

Owner: backend / platform. Review cadence: quarterly.

## Known committed credentials (history only)

A local dev Postgres password (`postgresql://postgres:199877@localhost:5433/hiieko`)
appears in git history in older revisions of `Project workflow/HANDOFF.md` and in
some stash-like commits (`backend/e2e-verify.js`, `backend/e2e/stock-avize.js`).

- **Assessment:** local-only (`localhost:5433`), low severity. Not reachable
  remotely, not a production or cloud credential.
- **Status:** not rotated, not removed from history. Left in history intentionally
  per the workflow rule against force-push/history rewrite.
- **Follow-up (operator, manual):** changing the local Postgres password on the dev
  machine makes the leaked value useless. Do this outside the repo; no code or
  script changes it.

**Policy going forward:** never commit real credentials, even for local
development. Any connection string that contains a password belongs in
`backend/.env` (gitignored), never in tracked files. Only `.env.example` with
placeholder values is committed.

## What must never be committed

- `JWT_SECRET`
- `DATABASE_URL` (when it contains a password)
- Email API keys
- `PADDLEOCR_TOKEN`
- Any `.env` / `.env.local` / `.env.*.local`

`.gitignore` covers `.env`, `.env.local`, and `.env.*.local` at every level, and
keeps only `.env.example` templates.

## Rotation schedule

| Secret | Interval |
|---|---|
| `JWT_SECRET` | every 90 days |
| Database password | every 90 days |
| Email API key | every 90 days |

## Procedures

### JWT_SECRET

1. Generate a new random value of at least 32 bytes, e.g.
   `openssl rand -base64 48`.
2. Set it as `JWT_SECRET` in the production host's environment (Render) — never in
   the repo.
3. Redeploy the backend (`main.ts` refuses to boot in production unless the secret
   has at least 32 bytes and is not a known development placeholder).
4. Note: rotating `JWT_SECRET` invalidates every outstanding access token; all
   users must sign in again. Schedule during low traffic.

### Database password

1. Change the password on the PostgreSQL instance (host console), preferring a
   long random value.
2. Update the password inside `DATABASE_URL` in the host's environment.
3. Redeploy the backend and confirm `/health/ready` returns `200`.
4. Verify no other service still uses the old password before revoking it.

### Email API key

1. Create a new API key in the email provider's console.
2. Set it in the host's environment variables.
3. Redeploy the backend and send a test email.
4. Revoke the previous key once delivery is confirmed.

## Verification

- `git log --all -p | grep -iE "secret|token|password"` — history scan; the only
  known hit is the local dev DB password documented above.
- Confirm `.env` variants are not tracked: `git ls-files -- "*.env" "*.env.*"`
  should list only `*.env.example`.
- Backend refuses to start in production with a weak or placeholder `JWT_SECRET`.
