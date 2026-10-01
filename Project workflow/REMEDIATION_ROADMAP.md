# HIIEKO — Remediation Roadmap

> **Status: PLANNING ONLY.** This document makes no code, schema, database, migration, or
> configuration change.
> **Additive to `IMPLEMENTATION_ROADMAP.md` — it does NOT replace it** and introduces no
> competing roadmap structure.
> Decisions **A–G approved**; open questions **K‑1…K‑10 resolved**. Canonical Slice **1–9**
> numbering.
> Baseline when authored: branch `master`, HEAD `9e0c483`.

**Last Updated:** 2026-10-01 (§9 appended — Slice 3 company timezone / day boundary implemented and
verified; §8 = Slice 1 committed + Slice 2 implemented/verified)

---

## 1. Canonical A–G decision mapping (restored, authoritative)

| ID | Decision | Scope | Resolved by |
|----|----------|-------|-------------|
| **A** | **Authentication policy** | Credential rules + account lifecycle/state | K‑1, K‑2, K‑3 |
| **B** | **Session model** | Access/refresh tokens, TTL, rotation, revocation | K‑4, K‑5 |
| **C** | **Timezone policy** | Company timezone / day boundary | K‑9 |
| **D** | **Project ownership / handover** | Ownership terminology + handover (Phase 1 in remediation) | K‑10 |
| **E** | **Attendance model** | Session integrity + corrections | (attendance findings) |
| **F** | **Task verification authority** | Who may verify; allowed transitions | K‑6, K‑7; K‑8 deferred |
| **G** | **Platform target** | PostgreSQL + Prisma + NestJS; Supabase not reintroduced; Mobile/Expo frozen | (platform constraint) |

Letters are **not** renamed or remapped anywhere in this roadmap.

### K‑1…K‑10 resolutions → Decision crosswalk

| K | Resolution | Decision |
|---|-----------|----------|
| K‑1 | Verify first; valid hash ⇒ ACTIVE; NULL hash never password-less | A |
| K‑2 | Activation by ADMIN/OWNER only | A |
| K‑3 | `PENDING → ACTIVE → SUSPENDED`; status authoritative | A |
| K‑4 | Access-token TTL target = **15 min** (**effective in Slice 2**) | B |
| K‑5 | Refresh in httpOnly cookie; rotation / reuse detection / revocation; Mobile frozen | B |
| K‑6 | VERIFIED roles = ADMIN, OWNER, PM, SITE_MANAGER, QA_QC; no self-verify | F |
| K‑7 | `VERIFIED→IN_PROGRESS` = ADMIN/OWNER/PM; `CANCELLED→PLANNED` = ADMIN/OWNER; audited | F |
| K‑8 | Defer BLOCKED reason field | F (deferred) |
| K‑9 | `COMPANY_TZ`, default `Europe/Bucharest` | C |
| K‑10 | Phase‑2 ownership terminology + `handover_at`; record only, no schema yet | D |

---

## 2. Canonical Slice 1–9 numbering (restored, authoritative)

| # | Slice | Decision(s) | Depends on |
|---|-------|-------------|-----------|
| **1** | **Auth Foundation** | A (K‑1, K‑2, K‑3) | — |
| **2** | **Session / Refresh / Revocation** | B (K‑4, K‑5) | 1 |
| **3** | **Company Timezone / Day‑Boundary** | C (K‑9) | 1 |
| **4** | **Project Scope & Ownership Phase 1** | D (K‑10), G | 1 |
| **5** | **Attendance Sessions + Corrections** | E | 1, 3 |
| **6** | **Task Lifecycle + Verification** | F (K‑6, K‑7; K‑8 deferred) | 1 |
| **7** | **Ops Hardening / Observability** | G + SEC/CORS | 2 |
| **8** | **Testing / CI Enforcement** | cross‑cutting | gates all |
| **9** | **Frontend Contract Alignment** | cross‑cutting (web) | 1, 2, 6 |

This canonical numbering **replaces** any earlier interim numbering (Attendance = 3 /
Tasks = 4 / Data migration = 5). **Data migration is a workstream inside the relevant slice**,
never a standalone slice.

### Dependency graph

```
1 ─► 2 ─► 7
1 ─► 3 ─► 5
1 ─► 4
1 ─► 6
(1, 2, 6) ─► 9
8 ─► gates all
```

### Data migration safety rules (workstream inside Slices 3/5; never destructive)

- 21 existing users: all `ACTIVE`, `0` NULL `password_hash` (live-verified) — safe additive
  backfill.
- Attendance `2026-09-30`: **1 canonical + 2 superseded** rows — audited, **never deleted**.
- **2 open** attendance sessions — closed against an **explicit session target** (Slice 5).
- No retro‑validation of the 16 existing tasks.
- Migrations **additive only** (DEFAULT-based backfill); no destructive drops.
- Old 7‑day tokens **expire naturally**; no forced mass logout; **Mobile untouched**.

---

## 3. Corrected Slice 1 scope — Auth Foundation (no TTL change)

**Slice 1 closes: SEC‑001, SEC‑002, SEC‑003, and account lifecycle/status.**

In scope:
- **Mandatory password** on login.
- **Password-less login blocked** (SEC‑001 — `auth.service.ts:115`
  `if (dto.password && user.password_hash)` allows login when the password is omitted).
- **PENDING / ACTIVE / SUSPENDED account state**; status authoritative (`is_active` kept as
  compatibility).
- **PENDING accounts cannot authenticate.**
- **ADMIN/OWNER activation** (`PATCH /api/users/:id/status`, `@Roles(ADMIN, OWNER)`, audited)
  — K‑2.
- **Remove hardcoded JWT fallback** (`'hiieko-solar-secret-key-change-in-prod'` in
  `auth.module.ts` + `jwt-auth.guard.ts`) → **`JWT_SECRET` required, fail-fast** (SEC‑002).
- **Public-registration hardening** (SEC‑003): self-registration → `PENDING`, returns **no
  access token**.
- **Failed-login auditing.**
- **Rate limiting (L‑2)** on `POST /api/auth/login` and `POST /api/auth/register`: login
  per‑IP **20 / 60 s** **and** per‑normalized‑email **10 / 60 s** (reject when **either** is
  exceeded); registration per‑IP **5 / 60 s**. Fixed 60 s window, `req.ip` as‑is
  (`X‑Forwarded‑For` ignored), dependency‑free in‑memory `Map`; over‑limit → **429**
  `TOO_MANY_REQUESTS` (L‑3). Multi‑instance / shared limiting is deferred to **Slice 7**.

**Explicitly out of scope for Slice 1:** the 15‑minute global TTL, refresh tokens, session
table, revocation, httpOnly cookie, CORS `credentials`, Mobile, and any schema beyond the
status field/enum.

### 3.1 Exact Slice 1 files expected to change

**Backend — production**
1. `backend/prisma/schema.prisma` — add `enum UserStatusEnum { PENDING ACTIVE SUSPENDED }`;
   add `status UserStatusEnum @default(ACTIVE)` + `@@index([status])` to `model User`
   (keep `is_active`).
2. `backend/prisma/migrations/<ts>_add_user_status/migration.sql` — `CREATE TYPE
   "UserStatusEnum"`; `ALTER TABLE "users" ADD COLUMN "status" ... DEFAULT 'ACTIVE' NOT NULL`;
   index. Backfill is implicit via the `ACTIVE` default (all 21 rows stay ACTIVE).
3. `backend/src/modules/auth/auth.service.ts` — `register()`: write `status: PENDING`, return
   **no** `accessToken`; `login()`: require password, reject `password_hash = null`, reject
   `status !== ACTIVE`; failed-login audit; audit `USER_ACTIVATED` / `USER_STATUS_CHANGED`.
4. `backend/src/modules/auth/auth.controller.ts` — `register` contract (201, PENDING, no
   token).
5. `backend/src/modules/auth/auth.module.ts` — secret from env only (required, fail-fast);
   **TTL left at the current value** (no `15m` here).
6. `backend/src/common/auth/guards/jwt-auth.guard.ts` — remove fallback secret (SEC‑002);
   reject non-`ACTIVE` status.
7. `backend/src/modules/users/users.controller.ts` — add `PATCH /api/users/:id/status`
   `@Roles(ADMIN, OWNER)`.
8. `backend/src/modules/users/users.service.ts` — add `updateStatus()` (audited); include
   `status` in `findAll`/`findOne` selects.
9. `backend/src/common/auth/auth.types.ts` — add `status` to
   `AuthenticatedUser`/`JwtPayload` if referenced.

**Backend — config (documentation only in this planning step)**
10. `backend/.env` and `backend/.env.example` — document `JWT_SECRET` as **required** (no
    default); **`JWT_EXPIRES_IN` unchanged** — the 15‑minute TTL is **not** introduced in
    Slice 1.

**Backend — tests**
11. `backend/test/auth-registration.spec.ts` — update for the `PENDING` + no-token contract.
12. `backend/test/jwt-auth.guard.spec.ts` — replace the fallback-secret test at **line 111**
    with fail-fast / missing-secret behavior.
13. `backend/test/account-status.spec.ts` — **NEW** (PENDING/ACTIVE/SUSPENDED + activation
    authorization).
14. `shared/src/error-envelope.ts` — add `TOO_MANY_REQUESTS` to `ERROR_CODES`, the `ErrorCode`
    union, and the `ErrorEnvelope.code` union; map `429` in `statusToErrorCode` (L‑3).
15. `backend/src/common/auth/decorators/rate-limit.decorator.ts` — **NEW** `@RateLimit(...)` +
    `RATE_LIMIT_KEY` metadata (`{ scope: 'ip' | 'email'; limit; windowMs }`).
16. `backend/src/common/auth/guards/rate-limit.guard.ts` — **NEW** dependency‑free in‑memory
    fixed‑window guard (per‑IP + per‑normalized‑email).
17. `backend/test/auth-rate-limit.spec.ts` — **NEW** (login IP 20/60 s, login email 10/60 s,
    register IP 5/60 s, 429 envelope, fixed‑window reset).
18. `backend/test/error-envelope.spec.ts` — add the **429 `TOO_MANY_REQUESTS`** envelope case.

**Not changed:** `Mobile/**` (frozen) and `web/**` remain untouched — `web/src/lib/api-client.ts:683`
`updateUserStatus({ isActive })` is preserved by the dual‑body status contract (L‑1), so the
frontend needs no edit; the broader self‑registration / contract sweep is still confirmed in
Slice 9. Supabase, OCR, and the solar schema are also unchanged.

### 3.2 Slice 1 acceptance tests

1. **Existing-user regression (live):** ADMIN, WORKER, TEAM_LEADER log in with current
   credentials → `200` + access token; wrong password → `401`.
2. **SEC‑001 — password-less login blocked:** `POST /api/auth/login` with `{email}` only →
   **401**.
3. **SEC‑001 — NULL `password_hash` blocked:** NULL-hash user login → **401**.
4. **SEC‑003 — self-registration → PENDING:** `POST /api/auth/register` → `201`,
   `status=PENDING`, **no** `accessToken`; subsequent login → **`401`** until activated
   (executable coverage: `backend/test/account-status.spec.ts`).
5. **K‑2 — activation:** `PATCH /api/users/:id/status {status:'ACTIVE'}` as ADMIN/OWNER →
   `200` + audit row `USER_ACTIVATED`; then login → `200`.
6. **K‑2 — activation authorization:** WORKER/TEAM_LEADER calling the activation endpoint →
   **403**.
7. **K‑3 — SUSPENDED enforcement:** SUSPENDED user login → `401`; an existing JWT for a
   now-SUSPENDED user → `JwtAuthGuard` returns `401`.
8. **SEC‑002 — secret hardening:** with `JWT_SECRET` unset, the backend **fails fast at
   boot** (no fallback); guard spec updated accordingly.
9. **Failed-login auditing:** a failed attempt writes an audit row.
10. **Rate limiting (L‑2):** executable coverage lives in
    `backend/test/auth-rate-limit.spec.ts` — the **21st** login from one IP within a fixed 60 s
    window → **429**; the **11th** login for one normalized email within 60 s → **429** (reject
    when **either** login limit is exceeded); the **6th** `/api/auth/register` from one IP within
    60 s → **429**; every attempt counts and the 429 envelope carries
    `code = TOO_MANY_REQUESTS` (never `INTERNAL_ERROR`).
11. **Migration integrity:** post-migration `SELECT count(*) FROM users WHERE status <>
    'ACTIVE'` = **0**; re-verify `password_hash IS NULL` count = **0**.
12. **TTL guard (negative assertion):** the issued token's `exp − iat` **still equals the
    current baseline value, NOT 900** — Slice 1 must not change the TTL.
13. **Gates:** `npx prisma validate` clean; backend **typecheck 0 errors**; unit suites
    green; `db:verify` green.
14. **Status contract (L‑1):** `PATCH /api/users/:id/status` accepts `{ status }` (authoritative)
    **and** the legacy `{ isActive }` body — `true → ACTIVE`, `false → SUSPENDED`; `status` wins
    when both are present; an invalid or absent body → **422 `VALIDATION_ERROR`** (never a silent
    no‑op); `web/src/lib/api-client.ts:683` `updateUserStatus({ isActive })` keeps working with
    **no** frontend edit.
15. **Rate‑limit internals (L‑2/L‑3):** the limiter is an in‑memory, dependency‑free `Map` on a
    fixed 60 s window keyed by `req.ip` (as‑is, `X‑Forwarded‑For` ignored) and by normalized
    email; over‑limit responses are **429** with `code = TOO_MANY_REQUESTS`; multi‑instance /
    shared limiting is deferred to **Slice 7**.

---

## 4. Corrected Slice 2 scope — Session / Refresh / Revocation (TTL becomes effective here)

**Slice 2 closes: SEC‑004.**

In scope:
- **Refresh / session table.**
- **Short-lived access token = 15 minutes** (K‑4 becomes effective **here**).
- **Refresh token rotation.**
- **Reuse detection.**
- **Revocation.**
- **Web httpOnly refresh cookie.**
- **Preserve Bearer access-token transport.**

Out of scope: Mobile/Expo (frozen), and any behavior that would impose the 15‑minute TTL on
the Mobile login path.

---

## 5. Mobile frozen constraint

- **Mobile/Expo is frozen** for this entire remediation; no Mobile file is modified in any
  slice.
- Decision **G (Platform target)** records Mobile as frozen; it is listed in the roadmap's
  "Do not touch yet" set below.
- The 15‑minute TTL is **not** applied globally in Slice 1, precisely so the frozen Mobile
  client (single long-lived Bearer in AsyncStorage, no refresh flow) is not broken.

### Do not touch yet
- Mobile (frozen); Supabase (no reintroduction); OCR; solar-configurator schema; the BLOCKED
  reason field (K‑8); the Phase‑2 ownership schema (K‑10).

---

## 6. K‑4 = 15 minutes stays approved; effective only in Slice 2

- **K‑4 (access-token TTL target = 15 minutes) remains an APPROVED decision** under Decision
  **B (Session model)**.
- Its **effective point is Slice 2**, where it lands **together with refresh support**
  (rotation, reuse detection, revocation, httpOnly cookie + preserved Bearer transport).
- **Slice 1 does not claim the 15‑minute TTL is implemented** — Slice 1's scope, file list,
  and acceptance tests explicitly exclude it, and acceptance test #12 asserts the TTL is
  unchanged in Slice 1.

---

## 7. Traceability

Single roadmap — no competing structure. This document preserves:

- Decision **A–G** mapping from the approved Decision Pack (§1).
- **K‑1…K‑10** resolutions and the crosswalk (§1).
- Canonical **Slice 1–9** numbering (§2) — no alternate numbering.
- **Dependency graph** (§2).
- **Data migration safety rules** (§2).
- **Exact Slice 1 scope** (§3) and **exact Slice 1 acceptance tests** (§3.2).
- **Corrected Slice 2 scope** (§4).
- **Mobile frozen** constraint (§5) and **K‑4 effective only in Slice 2** (§6).

**STOP — this document is planning only.** Nothing has been implemented, migrated,
configured, committed, or pushed. Slice 1 is **not** implemented; schema, backend, frontend,
migrations, `.env`, and database data are all untouched.

---

## 8. Close-out addendum — Slice 1 committed, Slice 2 implemented (2026-10-01)

> The paragraph above describes the **planning phase** and is preserved verbatim. It is no longer the
> current status: Slice 1 was committed as `3183c4f`, and Slice 2 is implemented and verified (see §8.1).
> No section above was renumbered, renamed, or removed.

### 8.1 Slice 2 — Session / Refresh / Revocation (Decision B; K-4, K-5 effective; closes SEC-004)

**Baseline:** `3183c4f83cdb5dc8db446141a83a5b8fa1f79ee5` (Slice 1 history untouched; no push).

**Implemented**
- `sessions` + `refresh_tokens` — **additive** migration `20261001130000_add_sessions_refresh_tokens`;
  no Slice 1 migration touched, no backfill, no forced logout.
- Access token now carries a `sid` claim. **Web** sessions get a **900 s** token (K-4);
  the **legacy** path keeps the 7-day token for the frozen Mobile client (L2 / L17).
- Opaque 256-bit refresh token, **SHA-256 hex only** in the database, delivered exclusively through the
  httpOnly `hiieko_rt` cookie (`Path=/api/auth`, `SameSite=Lax`).
- Rotation with an **atomic compare-and-set** (L15) plus **reuse detection** that revokes the session
  family (L10) and audits `REFRESH_REUSE_DETECTED`.
- Logout (L7) — cookie preferred over Bearer `sid`, idempotent, works after the access token expires,
  audits `USER_LOGOUT` only on a real revocation.
- `JwtAuthGuard` enforces `sid`-backed sessions (L5) and **grandfathers** sid-less pre-Slice-2 tokens.
- Suspension (L13) revokes every active session (`SESSION_REVOKED`); reactivation requires a new login.
- CORS (L4) switched to the explicit `CORS_ORIGIN` allowlist with `credentials: true`.
- `POST /api/auth/refresh` rate limited **60 / 60 s per IP**; `GET /api/auth/me` unchanged.

**Decisions recorded:** L1–L17 (see `DECISIONS.md` → DEC-014 for the consolidated record).

**Accepted compatibility limitation (L17, deferred hardening):** the frozen `Mobile/**` client sends no
client discriminator, so any caller that omits `client: 'web'` receives the legacy 7-day access-token
path. This is deliberate and documented, not something to fix with User-Agent sniffing.

**Verification:** see `VERIFICATION.md` → *SLICE 2 — Session / Refresh / Revocation*. Summary —
`prisma validate` clean, `prisma migrate deploy` applied (14 migrations), `prisma migrate diff` reports
**no drift**, root typecheck 0 errors, Jest **34 suites / 393 tests green**, `db:verify` **82/82**,
and a 39-check `curl`-driven live smoke (legacy vs web TTLs, cookie attributes, rotation, replay →
family revocation, logout, suspension, CORS) all green.

---

## 9. Close-out addendum — Slice 3 Company Timezone / Day-Boundary (Decision C; K‑9 effective) (2026-10-01)

**Status:** implemented + verified, **UNCOMMITTED / NOT PUSHED**. No section above was renumbered,
renamed, or removed; Slice 1 (`3183c4f`) and the uncommitted Slice 2 change set are untouched.

**Implemented**
- One canonical company day = **`Europe/Bucharest`** by default (backend `COMPANY_TZ`, web
  `NEXT_PUBLIC_COMPANY_TZ`). New `backend/src/common/datetime/company-time.ts` +
  `web/src/lib/company-time.ts` derive the company calendar date through `Intl` with the IANA zone
  (DST-correct by construction).
- Replaced UTC-day derivation in attendance (check-in day + active-session lookup, today-summary,
  find-my-logs, range filter), daily-plan day defaults + `plan_date` encoding, Control Tower workforce
  "today", and every web "today" call site (planning date bar, worker dashboard / My Day, daily-report
  defaults + comparisons, expense-date default).
- `@db.Date` encodings of `CostEntry.entry_date`, `Expense.expense_date` and `Aviz.delivery_date` now go
  through the single `companyDay()` helper (**same UTC-midnight shape**). **No schema change, no Prisma
  migration, no data rewrite; instant TIMESTAMP columns untouched.**
- Web helper rename: `todayLocalIso` → `todayCompanyIso`, `shiftLocalDate` → `shiftCompanyDate`
  (old names **deleted**, no alias). Removed the dead `checkOut todayDate` variable. `Mobile/**` untouched.

**Excluded on purpose (G‑3):** broader same-class normalization (Issue, Invoice, Receipt and other
date-only columns) — only the planned costs / expenses / procurement paths changed.

**Daily-reports backend service unchanged:** `backend/src/modules/daily-reports/` (service, DTOs) is not
touched — the daily-report defect was at the **date-input / frontend boundary** (the web "today" the
reports UI sends), fixed by the web date helper alone; no backend daily-reports change was made, and none
is to be invented.

**Verification:** see `VERIFICATION.md` → *SLICE 3 — Company Timezone / Day-Boundary*. Summary —
`prisma migrate diff` → **no difference detected**; backend Jest **35 suites / 413 tests green**
(new `backend/test/company-time.spec.ts` + extended attendance/control-tower boundary tests);
`npm run backend:build` (nest, `tsconfig.build.json`) exit 0; web `next build` exit 0 (25/25 static
pages); web + shared + Mobile `tsc --noEmit` exit 0; `db:verify` **41/41 PASS** (target tables 24/24)
with the database read-only / pristine; `git diff --check` clean; a live `dist` DST smoke 6/6.
**Pre-existing and unrelated:** the standalone root `tsc -p backend/tsconfig.json` (which includes
`test/**`) fails `TS2769` in `backend/src/modules/ocr/providers/paddleocr.provider.ts:100` (`Buffer` not
assignable to `BodyInit`); proved pre-existing by stashing the Slice 3 edits (same error) — not caused by
this slice.