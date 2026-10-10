# HIIEKO — Phase 0.5 Security Priority 1

## When to run it

After Phase 0 (auth cleanup). Before Phase 1 (routes and roles).
One session. About 2-3 hours.

## Goal

Close the three security holes that matter most before any real user
touches the app:

1. Rate limiting on every endpoint
2. Secrets management hardened
3. HTTPS and security headers verified

This is not the full security work. RLS, RBAC audit, session
hardening, backups, and monitoring are Phase 6. This is the minimum
to be safe with real users.

## What this phase is not

- Not RLS
- Not a full RBAC audit
- Not monitoring or alerting
- Not backup configuration
- Not a redesign

Those are Phase 6. This phase is the three critical items.

## Work on master

No branch. One commit per item. Build before each commit. Push at the
end. No PR.

---

## Item 1 — Rate limiting

### Why

Right now, anyone can hammer `/api/auth/login` with thousands of
requests. That enables brute-force password attacks and API abuse.

### What to build

Install @nestjs/throttler:

```
npm install @nestjs/throttler --workspace=backend
```

Apply the ThrottlerGuard globally in `backend/src/app.module.ts`.

Then apply stricter limits to specific endpoints:

| Endpoint type | Limit |
|---|---|
| POST /api/auth/login | 5 per 15 min per email + 20 per 15 min per IP |
| POST /api/auth/register | 3 per hour per IP |
| POST /api/auth/forgot-password (Phase 3) | 3 per hour per email |
| POST /api/ocr/* | 10 per hour per user |
| POST /api/upload | 10 per hour per user |
| POST/PATCH/DELETE (all writes) | 30 per minute per user |
| GET (all reads) | 100 per minute per user |

### Where the buckets live

The audit found a `rate_limit_buckets` table already exists in
Prisma. Use it. Do not use in-memory storage — it breaks with multiple
backend instances.

If the table schema does not match what NestJS Throttler expects,
either:
- Adapt Throttler to use the existing table
- Or add a new table `throttle_buckets` with its own migration

Do not use in-memory. Confirm with the agent before proceeding.

### Test

- Send 6 wrong logins within 15 min. Expect: 429 on the 6th.
- Send 200 GETs in one minute. Expect: 429 after 100.

### Commit

`Phase 0.5: add rate limiting to all endpoints`

---

## Item 2 — Secrets management

### Why

Secrets (JWT_SECRET, DATABASE_URL, email API keys) must never be in
code, git history, or logs.

### What to do

1. Audit the codebase:
   - `grep -rn "JWT_SECRET" web/ backend/` — should find only env
     reads, no hardcoded values
   - `grep -rn "DATABASE_URL" web/ backend/` — same
   - `grep -rn "sk-\|api_key\|apiKey\|secret" web/src backend/src` —
     look for hardcoded keys

2. Audit git history:
   - `git log --all -p | grep -iE "secret|token|password" | head -50`
   - If any secret was committed, rotate it. Removing from code is not
     enough.

3. Confirm `.gitignore` includes:
   - `.env`
   - `.env.local`
   - `.env.*.local`
   - Any other `.env` variant

4. Confirm Render (or your host) stores:
   - JWT_SECRET (32+ bytes random, not a dev value)
   - DATABASE_URL
   - All other `.env.example` keys

5. Add to `backend/src/main.ts` a startup check:
   - If `NODE_ENV === 'production'` and `JWT_SECRET` is shorter than 32
     bytes, refuse to boot
   - If `NODE_ENV === 'production'` and `JWT_SECRET` matches a
     development value, refuse to boot

6. Document rotation policy in `docs/security/rotation.md`:
   - JWT_SECRET: every 90 days
   - DB password: every 90 days
   - Email API key: every 90 days
   - How to rotate each (procedure)

### Test

- `git log --all -p | grep -i "secret"` — no live secrets
- The backend refuses to start in production with a weak JWT_SECRET

### Commit

`Phase 0.5: harden secrets management`

---

## Item 3 — HTTPS and security headers

### Why

Right now the app works over HTTPS (Netlify and Render handle this by
default), but it may not send the security headers that protect against
common attacks.

### What to do

1. Confirm HTTPS is enforced:
   - Netlify: Site settings → Domain management → HTTPS → "Force
     HTTPS" enabled
   - Render: auto-enforced

2. Install helmet:
   ```
   npm install helmet --workspace=backend
   ```

3. Apply in `backend/src/main.ts` with these headers:
   - Content-Security-Policy: default-src 'self'
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Strict-Transport-Security: max-age=31536000; includeSubDomains
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(self), geolocation=(self),
     microphone=()

4. Configure CORS in `main.ts` (already exists per the audit). Confirm
   the allowlist is exactly the Netlify URL, not a wildcard.

5. Add CSP allowances for:
   - Google Fonts (fonts.googleapis.com)
   - The backend API URL
   - Any external images (Netlify CDN)

6. Verify with a scanner. Options:
   - securityheaders.com — free, one-shot check
   - Mozilla Observatory — free
   - OWASP ZAP — for a full scan later (Phase 6)

Target: A or B grade. Do not chase A+ — it breaks things for minor
gain.

### Test

- Open the app. Dev tools → Network → check response headers include
  the above
- securityheaders.com reports A or B

### Commit

`Phase 0.5: add security headers via helmet`

---

## Order of execution

1. Item 1 (rate limiting) — most urgent, hardest
2. Item 2 (secrets) — mostly auditing and cleanup
3. Item 3 (headers) — smallest, fastest

Each is a separate commit. Build after each. Push at the end.

## What NOT to do in Phase 0.5

- Do not add RLS
- Do not add input validation everywhere (some exists, more is Phase 6)
- Do not add monitoring or alerting
- Do not add backups
- Do not change authentication flow
- Do not change authorization
- Do not touch pages or UI
- Do not touch the redesign

Phase 0.5 is exactly these three items.

## Done criteria

- Rate limiting works (verified by test)
- No secrets in code or git history
- Rotation policy documented
- Security headers present (verified by scanner)
- Build passes
- All three commits pushed to master

## What comes after Phase 0.5

Phase 1 — Routes and roles.
File: docs/plan/03-phase1-routes-roles.md