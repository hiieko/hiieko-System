# AI Handoff

> Primary continuation point for the next AI assistant.

Last Updated: 2026-09-29 (CI GREEN - GitHub Actions run 36606409946 on commit `6bd45b7`: Tests ✅ / Typecheck ✅ / Build ✅; P4.4 COMPLETE - Daily Report finalization DRAFT -> SUBMITTED verified end-to-end: `POST /api/daily-reports/:id/submit` + the Mobile status-less one-call contract, one immutable revision, one stock consumption, one `DAILY_REPORT_SUBMITTED` audit row (a DRAFT create now audits as `DAILY_REPORT_CREATED`), idempotent replay, PATCH-after-submit 400, insufficient stock -> clean DRAFT, read-only UI after submit at 375px; browser gate `gate-p44-finalize.js` 25/25 / 0 console errors, backend 31 suites / 320 tests, db:verify 71/71, backend/shared/web typecheck 0 errors; Mobile app E2E NOT run - ISSUE-051 opened: free-text `taskId` + draft deleted before a successful submit; earlier the same day: ISSUE-048 RESOLVED - daily report "Proposed Work" persists in its own `daily_reports.proposed_work` column, 30 suites / 295 tests, db:verify 66/66, gate-issue048-browser.js 23/23; dev team accounts / teams / projects / tasks seeded as REAL PostgreSQL rows, gate-seed-teams.js 8/8; ISSUE-049 open: two concurrent next dev servers corrupt web/.next)


## SLICE 3 — COMPANY TIMEZONE / DAY-BOUNDARY IMPLEMENTED + VERIFIED — **UNCOMMITTED, NOT PUSHED** (2026-10-01)
## SLICE 6 — TASK LIFECYCLE + VERIFICATION IMPLEMENTED + VERIFIED — **UNCOMMITTED, NOT PUSHED** (2026-10-02)

**Roadmap:** `REMEDIATION_ROADMAP.md` Slice 6 (Decision F — K‑6 / K‑7 effective; **K‑8 deferred**).
**Baseline:** HEAD `ceeb8b0` (Slice 5 committed + deployed; Slice 5 `db:verify` 82/82).

### What was done
- **Backend-authoritative Task.status FSM:** `TASK_STATUS_TRANSITIONS` in
  `backend/src/modules/tasks/tasks.service.ts` — illegal jumps rejected with 400;
  `Task.status` is the single source of truth.
- **K‑7 reopen transitions** (server-enforced + audited): `VERIFIED → IN_PROGRESS` =
  ADMIN/OWNER/PM; `CANCELLED → PLANNED` = ADMIN/OWNER. Added to the web FSM
  (`TASK_WORKFLOW_NEXT`) so the UI can offer them; the backend remains the authority.
- **Server-controlled `actual_start`/`actual_end`:** client-supplied values ignored; server
  stamps on IN_PROGRESS/COMPLETED; reopen clears `actual_end`, preserves `actual_start`.
  Web Tasks page auto-fill removed.
- **Verification (K‑6):** new additive fields `tasks.verified_by` / `tasks.verified_at`;
  VERIFIED allowed only for ADMIN/OWNER (global bypass) or project-membership
  PM/SITE_MANAGER/QA_QC; **assignees can never self-verify** (checked first, role-independent).
  Stamped on VERIFIED, cleared on reopen.
- **PLAN-001:** `daily-plans.complete()` inspected — never writes `Task.status`; **no daily-plans
  production change**; regression test added protecting `Task.status` authority.
- **Not done / out of scope:** no BLOCKED reason (K‑8 deferred), no dependency gating,
  Mobile frozen, history not rewritten, no new governance decision number.

### Verification state
- **RUN + PASS:** `prisma generate` · `prisma validate` · backend Jest **35 suites / 473 tests**
  (30 new Slice 6 cases) · `nest build` · web `tsc --noEmit` · web `next build` · `git diff --check`.
- **Pre-existing, NOT a Slice 6 regression:** root `tsc -p backend/tsconfig.json` TS2769 in
  `backend/src/modules/ocr/providers/paddleocr.provider.ts:100`.
- **NOT run / NOT claimed:** migration `20261002000000_add_task_verification_fields` is
  **created but NOT deployed**; `prisma migrate deploy`, `db:verify`, and browser E2E are the
  remaining steps before/with the Slice 6 commit. **Do not claim DB verification has passed.**

### Next steps for the next assistant
1. In a controlled step: `npx prisma migrate deploy` (backend), then run `db:verify`
   and update `VERIFICATION.md` with the real result.
2. Update browser/E2E evidence if desired (tasks page lifecycle + verify-role matrix).
3. Commit the Slice 6 change set (files list in `PROGRESS.md` → Slice 6 section) — do **not**
   stage the unrelated untracked files (`.hiiEko/`, `BonFis/`, `Project workflow/design/`,
   `Start-/Stop-HIIEKO.ps1`, `database/archive/*.sql`).



**Roadmap:** `REMEDIATION_ROADMAP.md` §9 (close-out addendum). **Decision record:** DEC-015 (Decision C /
K‑9 effective). **Baseline:** HEAD still `53a1632` (Slice 2 checkpoint); Slice 1 `3183c4f` untouched.

### What was done
- **One canonical company day = `Europe/Bucharest`** (env: backend `COMPANY_TZ`, web
  `NEXT_PUBLIC_COMPANY_TZ`; blank → default). New `backend/src/common/datetime/company-time.ts` and
  `web/src/lib/company-time.ts`; the company date is resolved through `Intl` with the IANA zone, so DST is
  handled by construction (no hand-rolled offsets).
- UTC-day derivation replaced: attendance (check-in day + active-session lookup, today-summary,
  find-my-logs, range filter), daily-plan day defaults + `plan_date`, Control Tower workforce "today", and
  the web "today" call sites (planning date bar, worker dashboard / My Day, daily-report defaults +
  comparisons, expense-date default).
- `@db.Date` encodings of `CostEntry.entry_date`, `Expense.expense_date` and `Aviz.delivery_date` now use
  one `companyDay()` helper (**same UTC-midnight shape**). **No schema change, no migration, no data
  rewrite; instant TIMESTAMP columns untouched.** Broader same-class normalization excluded (G‑3).
- Web helper rename `todayLocalIso` → `todayCompanyIso`, `shiftLocalDate` → `shiftCompanyDate` (old names
  deleted, no alias); the dead `checkOut todayDate` variable removed; `Mobile/**` untouched.
- **Daily-reports backend service unchanged:** `backend/src/modules/daily-reports/` (service, DTOs) is
  **not** touched — the daily-report defect was at the **date-input / frontend boundary** (the web "today"
  the reports UI sends), fixed by the web date helper alone; no backend daily-reports change was made and
  none should be invented.

### Verification (all green except one pre-existing item)
- `prisma migrate diff` → **no difference detected** · backend Jest **35 suites / 413 tests** (new
  `company-time.spec.ts` + extended attendance/control-tower boundary tests) · `npm run backend:build`
  exit 0 · web `next build` exit 0 (25/25 static pages) · web/shared/Mobile `tsc --noEmit` exit 0 ·
  `db:verify` **41/41 PASS** (DB read-only / pristine) · `git diff --check` clean · live `dist` DST smoke
  6/6.
- **Pre-existing, unrelated:** the standalone root `tsc -p backend/tsconfig.json` fails `TS2769` in
  `backend/src/modules/ocr/providers/paddleocr.provider.ts:100` (`Buffer` not assignable to `BodyInit`) —
  reproduced with the Slice 3 edits stashed (pristine backend), so it is not caused by this slice.

### Not done (deliberate)
**No commit, no push.** Outstanding step for the next session: commit Slice 3 (helpers + backend/web edits
+ tests + env templates + docs) as one checkpoint, then continue with the next slice
(Slice 4 — Project Scope & Ownership Phase 1).

## SLICE 2 — SESSION / REFRESH / REVOCATION IMPLEMENTED + VERIFIED — **UNCOMMITTED, NOT PUSHED** (2026-10-01)

**Baseline:** `3183c4f83cdb5dc8db446141a83a5b8fa1f79ee5` (Slice 1). `git log` HEAD is still `3183c4f`.
**Roadmap:** `REMEDIATION_ROADMAP.md` §4 (scope) + §8 (close-out addendum). **Decision record:** DEC-014.

### What was done
Decision **B** implemented — **K-4 (15-minute access token)** and **K-5 (refresh rotation / reuse
detection / revocation)** are effective; **SEC-004 is closed**.

- **Schema:** two additive tables, `sessions` (revocation unit; `id` is the access-token `sid`) and
  `refresh_tokens` (rotation ledger, `replaced_by_id` successor chain). Migration
  `20261001130000_add_sessions_refresh_tokens` (14 migrations total). Slice 1 migration untouched, no
  backfill, no forced logout — pre-Slice-2 sid-less tokens are **grandfathered** and expire naturally.
- **Token model:** opaque 256-bit CSPRNG refresh token; **only its SHA-256 hex** is stored; the raw value
  lives solely in the httpOnly `hiieko_rt` cookie (`Path=/api/auth`, `SameSite=Lax`, `Secure` only in
  production). Web login → **900 s** access token + cookie + `expiresIn: 900`; legacy login (no/other
  `client`) → unchanged Slice 1 body `{ user, accessToken }`, **7-day** token, **no** cookie, **no**
  refresh token — but still a session row, so revocation/suspension stay enforceable.
- **Endpoints:** `POST /api/auth/login` (optional `client`) · `POST /api/auth/refresh` (cookie only,
  60/60 s per-IP rate limit) · `POST /api/auth/logout` (public, cookie preferred over Bearer `sid`,
  idempotent, works after the access token expires). `GET /api/auth/me` unchanged.
- **Rotation is concurrency-safe:** consumption is a conditional
  `UPDATE … WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`, so exactly one concurrent caller
  can win. Every competitor is a reuse → **whole session family revoked** + `REFRESH_REUSE_DETECTED`.
- **Guard:** a token with `sid` requires a live session (not revoked, not past `expires_at`, same user);
  a token without `sid` is grandfathered.
- **Suspension:** `PATCH /api/users/:id/status {SUSPENDED}` revokes all active sessions
  (`SESSION_REVOKED`); reactivation does **not** restore them.
- **CORS:** `origin: '*'` → explicit `CORS_ORIGIN` allowlist + `credentials: true`.
- **Web:** one file changed, `web/src/lib/api-client.ts` — `client:'web'` + `credentials:'include'` on
  login, a single-flight one-shot 401 → refresh → retry, `POST /api/auth/logout` on logout, and
  `TOO_MANY_REQUESTS` added to the local envelope-code union. No other web file touched.

### Verification (all green)
`prisma validate` clean · `prisma migrate deploy` applied · `prisma migrate diff` **no drift** · root
typecheck **0 errors** · Jest **34 suites / 393 tests** (~356 baseline + 37 new) · `db:verify` **82/82**
(+11 new session/refresh integrity checks) · `git diff --check` clean · 39-check live `curl` smoke
(legacy vs web TTLs, cookie attributes, rotation, replay → family revocation, logout, suspension, CORS).
DB left pristine: 21 users all `ACTIVE`, `sessions = 0`, `refresh_tokens = 0`. `Mobile/**` unchanged.

### Not done (deliberate)
**No commit, no push.** Slice 1 history is untouched. Outstanding step for the next session: commit the
Slice 2 change set (new migration + backend + web + tests + docs) as a single checkpoint, then continue
with the next slice.

### Known limitation to carry forward
Any caller omitting `client: 'web'` gets the legacy 7-day access-token path (frozen `Mobile/**` sends no
client discriminator). Accepted + documented (L17); do **not** paper over it with User-Agent sniffing.
Operationally, a new browser origin (e.g. a LAN tablet URL) must be added to `CORS_ORIGIN` in
`backend/.env` before credentialed requests from it are accepted (non-browser clients are unaffected).

## DAILY PLANNING + TAILWIND `content` GLOBS VERIFIED + COMMITTED - CHECKPOINTS `fe23a7d` / `37c7e63` (2026-09-30)

**Working tree:** clean - no tracked uncommitted change; `HEAD` = **`37c7e63`**
(*fix(web): include feature sources in Tailwind content globs (ISSUE-063)*) on top of **`fe23a7d`**
(*feat(web): daily planning supervisor day surface (DEC-013, ISSUE-062)*). **Nothing was pushed** -
`master` is 13 commits ahead of `origin/master`. The `UNCOMMITTED` wording these two slices carried while
they were written is **historical** (pre-commit state); it was reconciled to the two checkpoints by the
docs-only commit *docs: record checkpoint commit 37c7e63* - no implementation or verification fact
changed.

**`fe23a7d` - Daily Planning supervisor day surface `/planning`** (frontend only, **DEC-013**): counters
band, one table section per plan, exclusive task filters, supervisor-only readiness / attention rail,
footer summary and a day action cluster, built only on the existing daily-plan/task contracts (new
`web/src/features/planning/{dayDerivations,readinessReads}.ts` + 6 components; modified
`web/src/app/planning/page.tsx`, `web/src/features/planning/index.ts`, `shared/src/translations.ts`, 52
additive keys). Harness `cdp-planning-day.js` **231/231 checks PASS** over 7 scenarios (RO/EN x 375/1440 px,
a plan-less day, worker role isolation), every counter/row value asserted against the API payloads, 0
horizontal overflow, 0 JS exceptions, 0 failed requests, worker sessions issue **0** project-wide
requests; gates typecheck / `web:typecheck` / `web:build` (25/25) / `i18n:check` (1121/1121) /
`guards:check` / `npm test` (31 suites / 320 tests) all exit 0. **ISSUE-062 stays OPEN** (the My-work card
prints the raw `plan_date` timestamp - pre-existing, one-line fix, outside that slice's file list).

**`37c7e63` - Tailwind `content` globs (ISSUE-063)** (one line of configuration): the globs named
`pages` / `components` / `app` only, so `web/src/features/**` (and `src/lib/**`, `src/contexts/**`) were
never scanned and feature-only utilities were never emitted - which is why the 1440 px `/planning` table
rendered its 375 px classes. `content` is now `./src/**/*.{js,ts,jsx,tsx,mdx}`; the served
`/_next/static/css/app/layout.css` went 70,182 B / 704 class tokens -> 75,037 B / **776 tokens (+72, 0
removals, a pure superset)**. 12 CDP route scenarios: `/planning` 1440 RO 1 grid track per row + a
`display: none` header + visible mobile labels + 348 px rows -> **6 tracks / `grid` header / 102 px rows /
labels hidden**, 375 px stays the intended mobile layout, and `/tasks`, `/solar-configurator`,
`/rapoarte/form` and worker **My Day** are byte-identical before -> after; `cdp-planning-day.js` 231/231
unchanged; the same five gates exit 0; `git diff --stat backend/ prisma/ database/` empty (**no** backend,
Prisma, schema/migration, API-contract, shell, navigation or Worker My Day change, and no `/planning`
visual refinement). 5 files, +224/-6. Post-commit live re-check: 776 class tokens emitted, ports 3000/4000
listening (exactly one dev server).

**Not re-runnable as-is (data precondition, not a regression):** `cdp-phase1-final.js` pins *today* and
its first assertion waits for the worker's 2026-09-29 task row, while
`GET /api/daily-plans/my-tasks?date=2026-09-30` returns `planCount 0 / taskCount 0` (the seeded PUBLISHED
plan is for 2026-09-29), so it aborts on a row that cannot exist today; My Day parity for the glob change
was established with the route harness (byte-identical evidence) instead. The `next dev` / `web/.next`
gotcha stands (**ISSUE-049**): `npm run web:build` needs the dev server stopped, and exactly one server
was restarted afterwards.

**Next:** the ISSUE-062 one-line fix when a slice touches `MyWorkList`, then the remaining R1B copy pass
ISSUE-059 `FIXED`, ISSUE-055 untouched, ISSUE-056 deferred) and the visual redesign - still PENDING. Full
detail: `VERIFICATION.md` -> *Daily Planning - supervisor day surface* and *Tailwind `content` globs -
feature-only utilities were never emitted*; `ISSUES.md` -> ISSUE-062, ISSUE-063.

## PHASE 1 VERIFIED + COMMITTED - CHECKPOINT `0ec084a` (2026-09-30)

**Working tree:** the Phase-1 paths were committed as **`0ec084a`** - `feat(web): phase 1 worker my day
surface, shell and chrome tokens (ISSUE-061, DEC-012)` - 32 files, +2700/-416 (11 new:
`web/src/components/shell/*`, `web/src/components/worker/*`); the tracked working tree is clean and
**nothing was pushed** (`master` is ahead of `origin/master`). The verification below was captured while
the tree was still uncommitted, with `HEAD` at `e9864d1` (*docs: record ux-r1b.2 checkpoint commit
9e6a503 (ISSUE-059)*), so its `UNCOMMITTED` wording is **historical** - no implementation or verification
fact changed. Only **one** production file was edited by the whole Phase-1 review:
`web/src/features/planning/fieldWork.ts` (the ISSUE-061 fix).
This final pass changed **documentation only** — `Project workflow/{DECISIONS,DESIGN_SYSTEM,ISSUES,VERIFICATION,PROGRESS,HANDOFF}.md`.
The harness (`cdp-phase1-final.js`, `cdp-phase1-capture.js`) and `task-screenshots/` are gitignored.

**Verified on the live stack** (PostgreSQL **:5433**, NestJS **:4000**, `next dev` **:3000**, real Chrome
154 over CDP, worker `daniel.georgescu@hiieko.local`, project Parc Solar Cluj **CJ-003**, real PUBLISHED
plan `837ef189-1832-474c-ae4e-510be703dd56` for 2026-09-30 — no mock data): **67/67 harness checks PASS**
— 375 px RO 22/22, 375 px EN 22/22, 1440 px EN 23/23. Every rendered value is asserted against the
payload of `GET /api/daily-plans/my-tasks?date=` (the card's only source): `buc 46 / 61 buc` and
`m 0 / 40 m` in **RO and EN**, `CJ-003-T02` `45/60 buc` (*În lucru* / *In progress*, `aria-valuenow 75`),
`CJ-003-T03` `0/40 m` (*Planificat* / *Planned*, `aria-valuenow 0`), `33 %`,
`1 din 3 sarcini finalizate` / `1 of 3 tasks completed`, `2 sarcini încă nefinalizate` /
`2 tasks still open`, the completed `CJ-003-T04` absent from the open list, one volume row per unit and
no cross-unit total, locale probes present in the active language and absent from the other
(`html lang` `ro`/`en`; `septembrie 2026` vs `September 2026`). Layout/runtime: no horizontal overflow at
375 px (document `scrollWidth 375 = clientWidth 375`; `<main>` `360 = 360`, the day scrolls inside
`<main>` — `1777/711` RO / `1809/711` EN) or at 1440 px (`1440 = 1440`; `<main>` `1184 = 1184`); compact
chrome = 101 px `<header>` (56 px navy `#111827` bar + 44 px `#374151` band, no rail) vs. rail + 72 px
header at `≥ lg`; **0 JS exceptions, 0 failed requests**, the only HTTP error is the pre-existing
`/favicon.ico` 404.

**Closed in the same pass:** **ISSUE-061** (fixed + re-verified in both languages), **ISSUE-060**
(`DESIGN_SYSTEM.md` contradicted the emitted chrome → **DEC-012** *Fixed dark chrome + accent/positive
palette (Phase 1 shell + Worker "My Day")* + `DESIGN_SYSTEM.md` §1.1 tokens, §2.1.1 component inventory,
§3 measured shell contract with the pre-Phase-1 values kept as history, §4 status-bar note, §7 chrome
Do-Nots), and the **temporary review fixture** (plan + 3 `DailyPlanTask` + 2 `TaskAssignment` + 6 audit
rows deleted in one transaction: `daily_plans` 10→9 on CJ-003, `daily_plan_tasks` 24→21,
`task_assignments` 33→31, `audit_logs` 370→364; seeded `tasks` and the 4 pre-existing CJ-003 fixtures
untouched; `my-tasks` now returns 0 plans for the day).

**Gates on the frozen tree:** `npm run typecheck`, `npm run web:typecheck`, `npm run web:build` (25/25
pages), `npm run i18n:check` (205 files, 1069/1069 keys), `npm run guards:check`, `npm test`
(31 suites / 320 tests) — all **exit 0**. `web:build` was run with the dev server stopped and `web/.next`
cleared: two earlier attempts failed while a `next dev` compiled into the same directory
(`Failed to collect page data for /avize`; then `Cannot find module for page: /_document` + 11 export
errors — the ISSUE-049 class, **not** a code regression). **One `npm run web:dev` was restarted
afterwards** (single instance on `:3000`, `/login` 200, `/` 200, worker login 200); the launcher's
`-Watch` loop does not restart services, so do not start a second dev server (ISSUE-049).

**Next:** Phase 1 is committed (`0ec084a`) and **not pushed** - `master` is ahead of
`origin/master`; no Phase-1 work is outstanding (the visual redesign remains PENDING per `PROGRESS.md`).
Full detail:
`VERIFICATION.md` → *Phase 1 final verification — RO/EN × 375/1440 px + fixture cleanup + ISSUE-060 doc
closure*.

## R1B.2 CHECKPOINT COMMITTED — `9e6a503` (2026-09-30)

The R1B.2 tree was reviewed and committed as **`9e6a503`** — `fix(web): ux-r1b.2 tutorial locale
propagation (ISSUE-059)` — 5 files, +242/−15: `web/src/components/PageTutorial.tsx` (+11/−1, blob
`c033e2d`, byte-identical to the file that was built and browser-swept) plus
`Project workflow/{ISSUES,VERIFICATION,PROGRESS,HANDOFF}.md`. The untracked local artifacts
(`.hiiEko/`, `BonFis/`, `Start-HIIEKO.ps1`, `Stop-HIIEKO.ps1`,
`database/archive/pre_migration_backup_20260929_093849.sql`) were **not** touched and **not** staged.
**Nothing was pushed** — `master` is ahead 8 of `origin/master` (`e0c1caf` = R1B.1, `9e6a503` = R1B.2).

Pre-commit checks were clean (`git diff --check` empty, exactly the 5 intended tracked paths, nothing
staged) and every gate was re-run on the committed tree: `i18n:check` **PASS** (194 files, 1009/1009
keys), `guards:check` **PASS** (194 files), `typecheck` / `web:typecheck` / `web:build` **exit 0**
(25/25 static pages), `npm test` **exit 0 — 31 suites / 320 tests**; the R1B.2 `db:verify` results
(41/41 root, 71/71 backend) are unchanged, no database artifact was touched.

The `UNCOMMITTED` wording in the R1B.2 and R1B.1 sections below is **historical** - it records the state
when each section was written (R1B.1 = `e0c1caf`, R1B.2 = `9e6a503`); the Phase-1 top section was
reconciled the same way (Phase 1 = `0ec084a`, see *PHASE 1 VERIFIED + COMMITTED* above). **Next:** continue the R1B copy
pass (ISSUE-055 untouched, ISSUE-056 still deferred) and then the visual redesign.

## R1B.2 DONE — ISSUE-059 fixed, UNCOMMITTED (2026-09-30) — HEAD = `e0c1caf`

**Working tree:** exactly 1 tracked source modification + 4 workflow documents, **no commit and no
push** — `web/src/components/PageTutorial.tsx` (+11/−1, CRLF preserved, blob `c033e2d`) and
`Project workflow/{ISSUES,VERIFICATION,PROGRESS,HANDOFF}.md`. The untracked items (`.hiiEko/`,
`BonFis/`, `Start-HIIEKO.ps1`, `Stop-HIIEKO.ps1`,
`database/archive/pre_migration_backup_20260929_093849.sql`) predate R1B.2. **R1B.1 is committed as
`e0c1caf`** — the section below was written before that commit, so its "UNCOMMITTED" wording is
historical.

**ISSUE-059 (FIXED)** — `PageTutorial` no longer defaults `locale` to `'ro'`; it reads the active
locale from the existing `LocaleContext` (`const { locale: activeLocale } = useLocale(); const locale
= localeProp ?? activeLocale;`) and keeps the prop as an explicit override. 17 call sites in 16 files
(the original count of 16 missed `ControlTowerSurface.tsx`) — **none changed, deliberately**: the
context read cannot be forgotten by a future call site, unlike a prop threaded through 16 unrelated
pages (3 of which import no locale hook).

**Verified:** FAIL-first on `HEAD` = 34 records / 17 PASS / 17 FAIL (every EN record rendered RO);
after = **46 records / 46 PASS** (375 px × 17 tutorial routes × RO+EN plus 768/1440 px ×
{planning, teams, workforce} × RO+EN), `documentElement.lang` 46/46, 0 raw `tutorial.*` keys in text
and aria, 0 RO-only strings in EN, RO copy asserted equal to the dictionary values. Gates:
`i18n:check` PASS (1009/1009), `guards:check` PASS, `typecheck` / `web:typecheck` / `web:build`
exit 0, `npm test` 31 suites / 320 tests, root `db:verify` 41/41, `db:verify --workspace=backend`
TOTAL 71 / FAILED 0. Full detail: `VERIFICATION.md` → *R1B.2*.

**Environment gotcha (cost most of this session):** the `next start` on `:3000` was serving a `.next`
that a later `next build` had overwritten — dev-style chunk URLs (`main-app.js?v=…`) 404 against
production artifacts, so React never hydrated and every page looked dead. Browser evidence must be
taken on a fresh build served by its own `next start` (here `:3100`). `.next` is gitignored.

**Observed, not fixed (out of scope):** `/pontaj` at 375 px has `main 405/375` (RO) / `378/375` (EN) —
pre-existing at `HEAD`, an inner scroller (`documentElement.scrollWidth` 375 = `innerWidth`), not
ISSUE-058 (the Control Tower surfaces stay `375/375`).

**Next:** commit `PageTutorial.tsx` + the 4 documents once approved, then continue the R1B copy pass
(ISSUE-055 / ISSUE-056 still deferred) and the visual redesign.

## R1B.1 DONE — ISSUE-057 + ISSUE-058 fixed, UNCOMMITTED (2026-09-30)

**Working tree:** exactly 3 tracked modifications, **no commit and no push** —
`scripts/check-i18n.mjs` (+51/−1), `shared/src/translations.ts` (+22),
`web/src/components/ControlTowerSurface.tsx` (+6/−2). The untracked items (`.hiiEko/`, `BonFis/`,
`Start-HIIEKO.ps1`, `Stop-HIIEKO.ps1`, `database/archive/pre_migration_backup_20260929_093849.sql`)
predate R1B.1.

**ISSUE-057 (FIXED)** — the 21 `tutorial.{planning,teams,workforce}.*` keys now exist in
`shared/src/translations.ts` (table 988 → 1009 keys) and `scripts/check-i18n.mjs` resolves the
template-built tutorial keys so the defect class cannot regress silently. FAIL-first evidence: the
checker listed exactly those 21 keys *before* the copy fix; after it the check is PASS.

**ISSUE-058 (FIXED, measured)** — the C5 suspect was wrong: the red-flags table lives inside
`overflow-x-auto` and clips. The real cause was the `ControlTowerSurface` global filter row
(`flex items-center space-x-3`, `flex-wrap: nowrap`, 301 px box / 392 px content) whose
`Actualizează` button ended at x = 429 = `main.scrollWidth`. Fixed with 2 class changes (stack below
`sm`, `w-full sm:w-auto` select): `main 429/375` → `375/375`, ≥ 640 px unchanged.

**Verified:** `i18n:check` PASS (1009/1009), `guards:check` PASS, `typecheck` exit 0 (4 workspaces),
`web:typecheck` exit 0, `web:build` exit 0, `npm test` 31 suites / 320 tests, root `db:verify` 41/41
(with `DATABASE_URL` from `backend/.env`), `db:verify --workspace=backend` 71/71, browser sweep
30/30 clean (5 routes × 375/768/1440 × RO/EN, 0 raw keys in text + aria). Full detail:
`VERIFICATION.md` → *R1B.1*.

**Opened: ISSUE-059** — `PageTutorial` defaults `locale` to `'ro'` and 0 of its 16 call sites passes
it, so every introduction card stays Romanian even in EN. Deliberately not fixed here (16 call sites).

**Next:** commit the 3 files once approved, then continue the R1B copy pass (ISSUE-059 first) and the
visual redesign.

## Current Status
**Status:** STABLE - **SUPABASE-FREE REPOSITORY** (Web + Mobile -> NestJS -> Prisma -> PostgreSQL 18 is the only runtime path; Solar Configurator INTEGRATED; P4.4 daily-report finalization verified end-to-end; 31 suites / 320 tests, db:verify 71/71 (`--workspace=backend` → `backend/scripts/db-verify.ts`; the root `npm run db:verify` runs `database/scripts/verify_migration.ts` = 41/41 - two scripts, both PASS: `VERIFICATION.md` → *db:verify denominators*), all quality gates PASS)

## UX-R1A checkpoints — latest: **C5 DONE - UX-R1A COMPLETE** (2026-09-29)

**UPDATE 2026-09-29 (UX-R1A C5 done): C0-C5 are COMPLETE. The C5 close-out block is at the end of this
section (browser sweep results, CI wiring, remaining deferred items). R1B (full RO prose/translation
pass) and the visual redesign are PENDING. The older "C4 is current" / "C5 not started" notes below are
kept as history.**

**C0-C3 are complete. C4 (terminology + role-label normalization, documentation corrections) and C5
(consolidated evidence capture, CI wiring) are NOT started.** C3 changed the field task sources
frontend-only: `worker` / `technician` → `GET /api/daily-plans/my-tasks?date=` (backend-computed
personal scope, no project needed); `team_leader` / `foreman` / `site_manager` →
`GET /api/daily-plans?projectId=&date=` (a project must be selected, exactly as the attendance actions
already required). New pure module `web/src/features/planning/fieldWork.ts`
(`taskSourceForRole`, `selectMyWorkTasks`, `selectPlannedTasks`); `WorkerTodayTasks` now takes
`rows: FieldTaskRow[]` and renders canonical `TaskStatusEnum` labels with `ui/Badge` variants. The
legacy panel contract (`GET /api/tasks` + `assigned_to_id` + `'DONE'`) is gone from those surfaces.

- **Green on the final tree:** `npm run typecheck` 0 errors (all four workspaces), `web:typecheck` 0,
  `web:build` exit 0 (25 static routes), `guards:check` PASS (194 files, 0 findings), `i18n:check`
  PASS (975/975 keys), `npm test` **31 suites / 320 tests PASS**, `db:verify` **71/71 PASS**, compiled
  selector harness **17/17**, headless-Chrome role sweep **68/68** (4 field roles × 375/768/1440 px ×
  RO/EN, 0 console errors, 0 failed requests). Full detail: `VERIFICATION.md` → *UX-R1A C3*;
  summary: `PROGRESS.md` → Recent Work 2026-09-29.
- **Deliberately NOT done in C3:** no backend / Prisma / CI change, no new endpoint, no visual
  redesign, `/pontaj` untouched — `WorkerAttendanceView.tsx` still reads the legacy project-task
  source plus a client-side assignee filter → **ISSUE-055**; no `site_manager` / PM / manager / admin
  browser pass (those dev-seed accounts do not exist, so it is not claimed).
- **Environment notes for the next session:** the dev database is PostgreSQL on **port 5433** (PG14;
  the PG18 instance on 5432 was stopped) — run `db:verify` with
  `DATABASE_URL=postgresql://postgres:199877@localhost:5433/hiieko?schema=public`. Dev seed logins:
  `wor1@hiieko.com` / `work3@hiieko.com` `worker123`, `tech1-3@hiieko.com` `tech123`,
  `chef1-3@hiieko.com` `chef123`, `fore1-3@hiieko.com` `foreman123`. Heads-up: build with
  `git status` clean of stray servers — `next build` and `next dev` must not share `web/.next`
  (ISSUE-049).

### UX-R1A C4 - terminology normalization (DONE 2026-09-29) - **current checkpoint**

Copy/vocabulary only: no redesign, no semantic or logic change, no backend / Prisma / database / CI /
route-architecture change, no new endpoint, no dependency. Approved RO wording: Task → `Task-uri`,
Workforce → `Forță de Muncă`, Control Tower → `Turn de Control` (the `Personal` sidebar group was NOT
renamed and `Task-uri` was NOT rewritten to `Sarcini`).

- **Control Tower key:** `nav.control_tower` (`Turn de Control` / `Control Tower`) replaces the
  temporary `nav.statistici` on the `/control-tower` sidebar item; `nav.statistici` is referenced
  nowhere now (definition kept on purpose). Zero code references verified by grep.
- **One role vocabulary:** `role.*` in `shared/src/translations.ts` is the complete 16-role set;
  `getRoleLabel()` in `shared/src/permissions.ts` resolves it with `tPrefix('role.', …)` and accepts
  any casing. The four duplicated maps (`workforce`, `utilizatori`, `projects/[id]`) were deleted -
  they carried `'Maistru'`, `'Sef Echipa'`, `'Sef Santier'`, `'Vizualizare'`, `'Admin'`,
  `'Director Intretinere'`.
- **Vocabulary + copy:** `Procurement / Avize` → `Livrări & Avize`; label-level `Sarcini` →
  `Task-uri`; legacy `nav.attendance` / `nav.notifications` on worker surfaces → `nav.pontaj` /
  `nav.notificari`; 175 of 181 measured RO diacritic defects fixed across 24 files; `/workforce`,
  `/utilizatori`, `/notificari`, `/pontaj`, `/issues` titles now resolve through their keys so EN
  users stop seeing RO titles.
- **New report-only guard row:** `scripts/check-frontend-guards.mjs` → *Romanian copy missing
  diacritics* (`RO_DIACRITIC_DEBT`); ignores comments/paths/identifiers and never fails CI. After C4 it
  reports **6** rows, all deliberately deferred: `WorkerAttendanceView.tsx` (4, ISSUE-055) and
  `WorkerDashboard.tsx:101/151` (2, the `includes('Selecteaza')` banner-colour coupling).
- **Green on the final tree:** `i18n:check` PASS (988/988 keys), `guards:check` PASS, `typecheck` exit 0
  (4 workspaces), `web:build` exit 0 (25 routes), `npm test` 31 suites / 320 tests PASS, `db:verify`
  41/41 PASS (**root** `database/scripts/verify_migration.ts`; the C4 review re-ran
  `npm run db:verify --workspace=backend` → `backend/scripts/db-verify.ts` on the same database and got
  **71 PASS / 0 FAIL**. The two denominators are two different scripts, not a regression - explained in
  `VERIFICATION.md` → C4 *db:verify denominators - 41 (root) vs 71 (backend workspace)*),
  `getRoleLabel` runtime smoke test PASS, `Turn de Control` present in the built chunks.
  Full detail: `VERIFICATION.md` → *UX-R1A C4*; summary: `PROGRESS.md` → Recent Work 2026-09-29.
- **Deliberately NOT done in C4:** `WorkerAttendanceView.tsx` and `WorkerDashboard.tsx:101/151`
  (ISSUE-055), `ControlTowerSurface` copy, Mobile `SettingsScreen.formatRole()`, established copy
  (`Materiale & Stoc`, `Cheltuieli Companie`, prose `sarcini`), and the R1B prose sweep → **ISSUE-056**.
  No browser pass was run (no driver in this environment) and no `site_manager` / PM / manager / admin
  account exists, so that coverage is not claimed.
  **Statement of record:** *C4 automated/static verification complete; browser RO/EN content sweep
  deferred to C5.*

### UX-R1A C5 - final verification, browser sweep, CI guardrails (DONE 2026-09-29) - **UX-R1A COMPLETE**

Verification / close-out only: no product behaviour, no redesign, no backend / Prisma / database change.
The single source file changed is `.github/workflows/ci.yml` - two steps in the existing `test` job
(`npm run i18n:check`, `npm run guards:check`) placed after the shared build and before `npm run test`,
which closes the C1 deliberate deviation. YAML validated with `yaml.safe_load`; the job list is
unchanged; **not pushed, so no GitHub Actions run is claimed**.

- **Real browser, real accounts, real backend:** headless Chrome `Chrome/154.0.8037.58` over the
  **Chrome DevTools Protocol** (raw websocket, no new dependency), driving the C5 production build
  (`next start` on `:3100`), the real NestJS API (`:4000`) and PostgreSQL (`:5433`). **130 records** =
  4 roles x {375, 768, 1440} px x {RO, EN} -> **93 PASS / 37 FAIL**, all failures itemised. Every
  account authenticated through the **real login form** (`mode=ui-form`): `dev@hiieko.local` (admin),
  `ion.munteanu@hiieko.local` (team_leader), `fore1@hiieko.com` (foreman), `wor1@hiieko.com` (worker).
- **Verified correct:** locale ↔ `documentElement.lang` 130/130; **RO → EN through the real switcher
  followed by a real reload** keeps `lang="en"`, `solar:locale="en"` and renders `Tasks`; 0 sidebar
  label mismatches; the sidebar never advertises a route the role may not use and never hides a
  permitted one (C2 contract); `Turn de Control` / `Control Tower` correct on all 38 pages whose role
  may use it; `Task-uri`, `Forță de Muncă`, and `Șef de Echipă` (Team Leader, distinct from
  `Șef de Șantier` / Site Manager) vocabulary; 0 mojibake, 0 legacy misspellings, 0 C4-attributable
  console errors; the mobile drawer opens via the real header button (12-20 visible links at 375/768).
- **New open items found (neither a C4 nor a C5 regression):** **ISSUE-057** - `/planning`, `/teams` and
  `/workforce` render raw `tutorial.<section>.title` / `.short` keys in RO and EN (19 records; those
  keys were never defined in `shared/src/translations.ts` and were already missing at C3, and the shared
  `tutorials.test.ts` that would catch it is dormant - it cannot even be loaded by plain `node --test`);
  **ISSUE-058** - 375 px `main` overflow on the Control Tower surfaces (`main` 429 vs 375, suspect
  `ControlTowerRedFlagsCard.tsx` and its `whitespace-nowrap` table). One earlier transient (a refused
  API connection during the auth bootstrap ended the session for 10 records) did **not** reproduce on
  an isolated re-run and is recorded as an environment transient, not a defect. The 13 pre-existing
  `403 /api/users` console entries on field/supervisor pages belong to ISSUE-039 / ISSUE-053.
- **Green on the C5 tree:** `i18n:check` PASS (988/988 keys), `guards:check` PASS, `typecheck` exit 0
  (all four workspaces), `web:typecheck` exit 0, `web:build` exit 0 (25/25 static pages), `npm test`
  31 suites / 320 tests PASS, root `npm run db:verify` **41/41**
  (`database/scripts/verify_migration.ts`), `npm run db:verify --workspace=backend` **71/71**
  (`backend/scripts/db-verify.ts`) - two scripts, two inventories, both green and both explained in
  `VERIFICATION.md` → C4 *db:verify denominators*. Full detail: `VERIFICATION.md` → *UX-R1A C5*.
- **Environment after C5:** `next dev` is running on `:3000` again (`npm run web:dev`; HTTP 200 and all
  10 dev assets referenced by `/login` resolve again) and the temporary `next start -p 3100` server used
  for the sweep was stopped, so exactly one process writes `web/.next` (ISSUE-049 was re-confirmed live:
  before the restart, all 10 dev assets referenced by `/` returned 404 after the C4 build). The browser
  harness (`%TEMP%\c5_sweep.cjs`) and its result JSON are temp-only by design and are not committed.
- **NOT claimed:** no `site_manager` / PM / manager / owner browser coverage (no such account exists in
  this database), no visual/design review, no remote CI execution.
- **Next:** R1B first (ISSUE-057 keys, ISSUE-056 copy debt and the full RO prose sweep), then the
  visual redesign. ISSUE-055, ISSUE-058 and the authorization reconciliation (ISSUE-052/053/054) stay
  open.

## Current Task

**Phase 1 - Shell Chrome + Worker "My Day" is FINAL VERIFICATION PASSED and COMMITTED as `0ec084a`
(not pushed)** (see the top of this file; 67/67 live checks, ISSUE-061 fixed, ISSUE-060 closed by
DEC-012, review fixture removed). The P4.4 summary below is the previous task and stays as history.

**P4.4 COMPLETE — Daily Report finalization (DRAFT → SUBMITTED) is E2E verified (2026-09-29):**
- **Delivered (code from the earlier P4.x sessions, verified end-to-end this session):** one trusted finalization core, `DailyReportsService.finalizeWithin()`, shared by `POST /api/daily-reports/:id/submit` (web DRAFT → SUBMITTED) and by `create()` when the persisted status is already `SUBMITTED` (Mobile's status-less POST + `Idempotency-Key`), so the offline queue needed no second endpoint. One transaction writes: status `SUBMITTED`, `revision_number` 1, the immutable revision snapshot (`schema: 'daily-report-revision@1'`, snapshot `report`/`schema`/`submittedAt`/`submittedById`/`revisionNumber`/`stockReference`/`stockConsumption`), one `CONSUMPTION` movement per reported material (`stock_movements.reference_type = 'daily_report'`, key `daily_report:<reportId>:rev<N>:material:<materialId>`) and the `DAILY_REPORT_SUBMITTED` audit row. A DRAFT create consumes nothing — no stock, no revision.
- **Browser gate `gate-p44-finalize.js`: 25/25 PASS, 0 console errors** (375px). Verified during the Phase 4.4 browser/API/DB gate; the captured gate output and the 375px screenshots are local, git-ignored artifacts and are not part of the repository - the evidence is summarized in this section. Proves: the list's "Submit for approval" opens a confirmation dialog and sends NOTHING on the first click and nothing on cancel; confirming sends exactly ONE `POST …/submit` (200) + toast; the list stops offering Submit; status `SUBMITTED` + `revision_number` 1; exactly ONE revision; exactly ONE movement; balance 6 → 4; exactly ONE `DAILY_REPORT_SUBMITTED` audit row **plus** exactly ONE `DAILY_REPORT_CREATED` row; the form freezes (disabled fieldset, 0 write controls, submitted banner, revision badge); the Review section is read-only and shows "Revision: 1" with no 375px overflow; a replayed submit is idempotent (1 revision, 1 movement, balance unchanged, `DAILY_REPORT_SUBMIT_REPLAYED` audited); PATCH on a SUBMITTED report → 400 and nothing changes; the Mobile contract finalizes in ONE call (201 `SUBMITTED`, revision 1, balance −1) and its replay creates no second report; insufficient stock → aggregated 400 with the report left a clean DRAFT; every fixture is deleted and the touched balance restored. The gate is repeatable (it provisions its own material/stock fixture through the real APIs).
- **Service change made while verifying (audit vocabulary):** `create()` audited a **DRAFT create** under `DAILY_REPORT_SUBMITTED` — the same action the finalization writes — so a draft plus its later submission produced two identical action rows describing two different events (the first gate run read that as a "duplicate finalization"). The DRAFT-create audit is now `DAILY_REPORT_CREATED` (rename + explanatory comment at the call site); `DAILY_REPORT_SUBMITTED` now means exactly one thing: DRAFT → SUBMITTED. The backend suite was re-run after the rename. Three gate assertions were also wrong and are fixed (CORS pre-flight counted as a submit call, snapshot key name, Review-tab label).
- **Supporting gates (same session):** backend **31 suites / 320 tests PASS**; `npm run db:verify --workspace=backend` **71 PASS / 0 FAIL**; `npx tsc --noEmit` in backend / shared / web → all exit 0. Those run logs are local, git-ignored artifacts and are not part of the repository.
- **NOT verified:** the Mobile app was never run on a device/emulator — only the Mobile HTTP contract. Two real defects in `Mobile/src/screens/TeamLeaderDailyReportScreen.tsx` are recorded as **ISSUE-051** (free-text `taskId` → 404 "Task … not found" for any report with a task; the AsyncStorage draft is deleted before the API/queue call, so a failed submit loses it). Approval/rejection (`daily_report_approvals`) and notification triggers remain future work.

**ISSUE-048 RESOLVED - Daily Report "Proposed Work" is a separate persisted field (2026-09-29):**
- **Defect:** the Work section's "Proposed Work" textarea and the Execution section's "General notes" textarea both wrote into the single `daily_reports.general_notes` column while `formStateFromReport()` hard-coded `proposedWork: ''` - so after save → reload the Proposed Work textarea was empty while the text reappeared under General Notes, and a later edit of General Notes could be overwritten by the stale `state.proposedWork || state.generalNotes` fallback.
- **Fix:** new nullable column `daily_reports.proposed_work` (migration `20260929170000_add_daily_report_proposed_work`, additive / non-destructive, no other field touched) + `proposedWork` on the create interface, `CreateDailyReportDto` and the decorated `UpdateDailyReportDto`; `create()` writes it and normalises `''` → NULL (like `start_time`); `update()` writes `proposed_work` and `general_notes` **independently** (each only when present in the DTO, so an omitted field keeps its stored value and editing one can never clear the other); `shared/src/types.ts` exposes `DailyReport.proposed_work`; web `formStateFromReport()` reads `report.proposed_work` and `toCreateDto()` / `toUpdateDto()` map each textarea to its own field (no aliasing, no frontend-only adapter).
- **Verification (all run this session):** `prisma validate` exit 0; `prisma generate` **exit 0** (dev server stopped first - the Windows DLL-lock EPERM is gone); `prisma migrate deploy` applied the migration and `prisma migrate status` reports "Database schema is up to date" (12 migrations); shared build OK; shared/backend/web typecheck 0 errors; backend **30 suites / 295 tests** PASS (new `backend/test/daily-reports.proposed-work.spec.ts`, 16 tests); `db:verify` **66/66** PASS (new check 8j verifies the column exists); web build exit 0 (26 routes); browser gate `gate-issue048-browser.js` **23/23 PASS / 0 console errors** at 375px in EN + RO (evidence `gate-issue048-browser.out.json`) - create → save → reload keeps "Install mounting structures" in the Proposed Work field and "Access road muddy after rain" in the Execution notes field, the DB stores two distinct columns, an API PATCH of one field leaves the other untouched, and UI edits of each field in turn survive reload.
- **Data compatibility:** no historical text was migrated or guessed - the 6 dev rows keep their `general_notes` and get `proposed_work = NULL`; the 2 non-null note values (`smoke-mobile-submit`, `Nader guesmi`) are scratch/test text, not Proposed Work.
- **Environment notes:** the backend now runs as ONE `npm run backend:dev` chain (log `backend-dev.log`) - two duplicate `nest start --watch` chains were stopped so `prisma generate` could take the engine DLL; the web dev server was restarted after `next build` so only one writer touches `web/.next` (ISSUE-049). `gate-issue048-browser.js` / `gate-issue048-browser.out.json` are git-ignored, `.cdp-issue048-profile/` was added to `.gitignore`.
- **STOP:** P4.4 is settled - the DRAFT -> SUBMITTED finalization (revision, stock consumption, audit, replay, read-only UI) is verified end-to-end and documented above and in VERIFICATION.md. Do NOT start the approval/rejection workflow (`daily_report_approvals`) or notification triggers - P4.4 did not touch them; they need their own plan first. The Mobile daily-report screen stays UNVERIFIED until ISSUE-051 is fixed.

**Dev field-team data seeded into PostgreSQL (2026-09-29, COMPLETE — 12 accounts / 3 teams / 12 tasks, browser-verified):**
- **Request:** real accounts written straight into the database (no JSON, no mock/frontend-only data), one team per project with a team leader + foreman + workers, every leader on their own team/project, tasks for each member, and the credential list.
- **Delivered** as a new ops script `backend/scripts/seed-hiieko-teams.ts` (new npm script `seed:teams`, same conventions as `backfill-project-members.ts` / `db-verify.ts`: `dotenv` from `backend/.env`, `bcryptjs` 10 rounds, idempotent upserts on natural keys, refuses to run with `NODE_ENV=production`).
- **Rows written (all REAL PostgreSQL, on the 3 EXISTING projects matched by code — no duplicate projects):** 12 `users` + `user_profiles` + `employees`; 12 `project_members` (**mandatory** — `/api/projects|teams|tasks|daily-plans` are membership-scoped by `ProjectAccessGuard` + `buildScopedProjectWhere`, so a non-global role sees nothing without them); 3 `teams` (`leader_id` + 4-member `TeamMember` roster); 9 `project_stages` + 9 `work_packages` + 3 `location_zones`; 12 `tasks` + 24 `task_assignments`; 3 `daily_plans` (status `PUBLISHED`, `plan_date` = today) + 12 `daily_plan_tasks`.
- **Teams:** `AR-E1` "Echipa Montaj Arad 1" (AR-001) / `TM-E1` "Echipa Montaj Timisoara 1" (TM-002) / `CJ-E1` "Echipa Montaj Cluj 1" (CJ-003). Tasks per project: `-T01` structure `COMPLETED`, `-T02` module mounting `IN_PROGRESS`, `-T03` DC wiring `READY`/`PLANNED`, `-T04` testing + commissioning `PLANNED`.
- **Accounts (DEVELOPMENT ONLY):** `chef1-3@hiieko.com` / `chef123` (`TEAM_LEADER`), `fore1-3@hiieko.com` / `foreman123` (`FOREMAN`), `wor1@hiieko.com`, `wor2@hiieko.com`, `work3@hiieko.com` / `worker123` (`WORKER`), `tech1-3@hiieko.com` / `tech123` (`TECHNICIAN`). Mapping: chef1/fore1/wor1/tech1 → AR-001, chef2/fore2/wor2/tech2 → TM-002, chef3/fore3/work3/tech3 → CJ-003.
- **Verification:** `npm run db:verify --workspace=backend` **65/65 PASS** (0 FAILED / 0 SKIPPED — the number previously claimed without captured output is now reproduced); 8 account logins each see exactly their own project/team/tasks; `chef1` `GET /api/daily-plans?projectId=<AR-001>&date=2026-09-29` → 1 `PUBLISHED` plan with 4 tasks (targets 120, 24, 2, 1); `wor1` `GET /api/daily-plans/my-tasks` → 4; ADMIN `GET /api/employees` → 12 new rows; NEW browser gate `gate-seed-teams.js` → **8/8 page checks, 5 accounts, 0 console errors** (evidence `gate-seed-teams.out.json`): team card + "4 membri" roster, `/tasks` AR-001-T01..T04 with status counts, `Etape`/`Membri` tabs of `/projects/<AR-001 id>`, worker `/teams` → "Acces Interzis" (RoleGuard), worker/technician only-mine filtering, and cross-project isolation proven by negative assertions.
- **Environment note (ISSUE-049):** TWO `next dev` servers were running against the same `web/.next` (one from 16:13, a second from 16:33) which corrupted the dev build — every route 404 (`ENOENT … .next\server\app\rapoarte\form\page.js`). Fixed by killing both process chains, deleting `web/.next`, and starting exactly ONE `npm run web:dev` (log `%TEMP%\hiieko-web-dev3.log`, single listener on `:3000`); `/login` back to 200. Keep only one dev server.
- **Deliberately NOT done:** no project/team/task deletions, the 4 pre-existing verification fixtures (`SMOKE-40926`, `PH2-VER-01`, `P3-GATE-T1/T2` on CJ-003) were kept (now tracked as ISSUE-050), no attendance/pontaj backfill, no schema/migration/API change, `prisma/seed.ts` untouched, no Supabase.

**Daily Report PERSISTENCE — start/end time + OHS/SSM (2026-09-29, COMPLETE, P4.3.1, verified end-to-end):**
- **Symptom:** the Team Leader form saved a DRAFT, but Start Time / End Time and the OHS/SSM risk checklist were frontend-only — reopening the draft brought back every other section and left those two empty.
- **Root cause:** no persistence layer existed for them: `daily_reports` had no time columns, there was no child table for the checklist, and the form state was never mapped into the POST/PATCH payloads or back out of the GET response.
- **Fix (minimum appropriate — no new workflow, no scoring/severity/matrix):**
  - Prisma: `DailyReport.start_time` / `end_time` (nullable `HH:mm` TEXT) + enum `OhsRiskType` (ppe, adverse_weather, procedures, electrical, tools_machinery, fall_height, other_risks) + model `DailyReportOhsItem` (`risk_type`, `notes`, cascade FK). Migration `20260929105838_add_daily_report_time_and_ohs`; already applied — `prisma migrate status` → "Database schema is up to date" (11 migrations).
  - API: `CreateDailyReportDto` / `UpdateDailyReportDto` accept `startTime`, `endTime`, `ohsItems[]`; `GET /:id` and the list include `ohs_items`; PATCH replaces the OHS collection atomically when `ohsItems` is present and preserves it when the key is omitted (repeated saves never duplicate); times update normally, `''` normalises to NULL.
  - Guards (same pattern as the P4.3.1 status contract, needed because POST bypasses the global ValidationPipe): unknown `riskType` → 400 listing the 7 allowed categories; malformed time → 400 from the service / 422 `VALIDATION_ERROR` from the DTO `@Matches` — instead of the raw Prisma 500.
  - Web: `helpers.ts` maps times + checked OHS items (with notes) in both directions so a reopen shows exactly what was saved; `useDailyReportForm` keeps a created draft's id in the URL (`/rapoarte/form?id=…`) so a reload reopens the SAME draft — this also stops a second save from POSTing a duplicate draft.
- **Verification:** shared/backend/web typecheck 0 errors; backend **29 suites / 279 tests** PASS (new `backend/test/daily-reports.persistence.spec.ts`, 20 tests); `db:verify` **65/65** PASS; web build exit 0; HTTP gate `gate-p431-persistence.js` **23/23**; browser gate `gate-p431-browser.js` **24/24** at 375px in RO+EN with 0 console errors. Evidence: `gate-p431-persistence.out.json`, `gate-p431-browser.out.json`.
- **Caveat (environment only):** `prisma generate` exits 1 with `EPERM … rename query_engine-windows.dll.node` while a `nest start --watch` dev server is running (Windows lock on the engine DLL). Not a schema error — `prisma validate` exits 0 and the existing generated client already contains `DailyReportOhsItem`, `OhsRiskType` and `start_time`/`end_time` (verified in `node_modules/.prisma/client/index.d.ts` and by both live gates). Re-run `npm run prisma:generate --workspace=backend` with the dev server stopped to confirm.
- **Deliberately NOT done:** final submission, stock consumption/movements, approval/rejection, revision snapshots, notifications, Mobile changes (status-less POST is still `SUBMITTED`), proxy/CORS/dependency changes.
- **Carried-over prior-session edits: KEEP.** `backend/prisma/schema.prisma`, `shared/src/types.ts`, `daily-reports.{service,controller}.ts`, `create-daily-report.dto.ts`, `backend/scripts/db-verify.ts` and `web/src/features/daily-reports/*` are exactly this slice and are now verified.
- **Open (non-blocking): ISSUE-048** — the Work section's "Proposed Work" textarea and the Execution section's "General notes" field both write to the single `general_notes` column, so after a reload the textarea is empty while the text appears under General notes (and editing General notes alone can be overwritten by a stale proposed-work value). Out of scope here; needs a product decision (single field or a split column).
- **STOP:** do not start final submission / stock / approval / notification work. Dev DB still holds the two older smoke rows (`DRAFT 6d3002f2-…`, `SUBMITTED 9fd320ae-…`); both new gates clean up after themselves (0 OHS rows left behind).

**Phase 2 - Tasks Operational Experience COMPLETE (2026-09-28).**
- 8 new components in web/src/features/tasks/components/ (+ barrel index.ts): TaskProgressBar, TaskDependencyChips, TaskStatusWorkflow, TaskQuantityEditor, TaskAssignModal, TaskFilters, TaskCreateModal, TaskCard.
- web/src/app/tasks/page.tsx fully replaced: ProjectContext-driven fetch, role gates (canCreateTasks / canUpdateTaskStatus / canUpdateTaskQuantity / canAssignTask), workers+technicians default to only-mine, status Tabs with live counts, search, skeleton/empty/error states with retry, toasts on every mutation.
- Data honesty kept: no delete/unassign/priority/due-date/percent UI; progress derives only from actual_quantity / planned_quantity.
- i18n additions in shared/src/translations.ts: general.save, task.expand_details, task.collapse_details (fixed a hardcoded aria-label in TaskCard and a missing general.save key used by TaskQuantityEditor).
- Verified: web tsc --noEmit exit 0; npm run build 25 routes / 0 errors (/tasks 9.25 kB); Gate E CDP browser run 21/21 checks + screenshots in task-screenshots/final-*.png (create PH2-VER-01 -> appears in list; PLANNED->READY transition; quantity save 'Realizat: 5'; cancel-confirm open+dismiss without mutation; error state via blocked /api/tasks + recovery after unblock; RO/EN toggle; 375px overflow 0; keyboard Enter toggles card).
- **ISSUE-042 (OPEN, non-blocking):** backend TasksService.update() performs no status-transition validation - frontend TASK_WORKFLOW_NEXT is the sole guard. Do not fix inside frontend phases; fold into ISSUE-040 DTO work.

**Next:** Per IMPLEMENTATION_ROADMAP - D4 page-level adoption of design tokens/components for remaining pages, or R2.6 Audit resume. Backend: ISSUE-040 DTO validation (+ ISSUE-042 transition validation opportunity).

**Dev / LAN access — tablet & phone on the same Wi-Fi (2026-09-29, COMPLETE, ISSUE-047 RESOLVED):**
- Symptom: opening `http://<laptop-ip>:3000` on a tablet rendered the app but every API call failed (`Failed to fetch`, login included). Cause: `web/src/lib/api-client.ts` baked `NEXT_PUBLIC_API_URL` (`http://localhost:4000` from `web/.env.local`) into the browser bundle, so the tablet called *itself*. The backend was never at fault — `main.ts` already binds `0.0.0.0:4000` with `origin:'*'` CORS and the Next dev server already binds all interfaces.
- Fix: new `resolveApiBaseUrl()` — server render / loopback-hosted pages keep the configured value (local dev unchanged); a page served from a LAN host with a loopback-configured API reuses the configured port on the page's hostname (`http://192.168.1.130:4000`); an explicitly remote URL is always respected; relative/same-origin config is returned untouched. `web/.env.local` intentionally left as `http://localhost:4000` so a DHCP address change needs no edit. No backend change, no proxy, no CORS change, no new dependency.
- Evidence: `gate-lan-tablet.js` (NEW, headless Chrome on port 9333, drives the real login form, blocks `localhost:4000` in-browser to simulate the tablet) → before: `localhost:4000` blocked + `Failed to fetch`; after: 13/13 calls to `192.168.1.130:4000` (login/me/projects/control-tower 200), token stored, redirect to `/`, 0 console errors → PASS; localhost regression run PASS; `npm run typecheck --workspace=web` exit 0. Result JSON: `gate-lan-tablet.out.json`.
- Docs: `HOW_TO_RUN.md` gained "Run the dev stack on a tablet / phone (same Wi-Fi)" (steps, the two URLs to check, Windows Firewall rule for TCP 3000/4000, trusted-network warning, and the note that **Mobile** still needs `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000` in `Mobile/.env` because React Native has no `window`); `web/.env.example` and `.env.example` now explain the loopback behaviour.

**P4.3.1 Daily Report status contract + PATCH body integrity (2026-09-29, COMPLETE - STOP here, do not start the next Phase 4 slice without review):**
- Contract now enforced: `POST /api/daily-reports` is the only entry point that may choose a status — omitted ⇒ DB default `SUBMITTED` (Mobile + offline queue unaffected), explicit `'DRAFT'` or `'SUBMITTED'` accepted, anything else ⇒ 400 `status must be one of ['DRAFT', 'SUBMITTED']`. Web `helpers.ts toCreateDto()` sends `status: 'DRAFT'` so draft create → PATCH edit works. DRAFT = editable web draft, SUBMITTED = formal submission; approval/rejection statuses stay future work (ISSUE-045).
- `UpdateDailyReportDto` is now decorated (+ nested entry classes with `@ValidateNested({ each: true }) @Type(...)`) because the global `ValidationPipe({ whitelist: true })` was silently stripping the whole PATCH body to `{}` — draft edits persisted nothing while the 15 service-level tests stayed green (ISSUE-046).
- Evidence: `backend/test/daily-reports.status-contract.spec.ts` (NEW, 10 tests incl. HTTP-level body preservation), backend 28 suites/259 tests PASS, shared/backend/web typecheck 0 errors, web build 26 routes exit 0, db:verify 64/64, live HTTP smoke 15/15 PASS on real PostgreSQL. No Prisma migration, no enum, no CHECK constraint, no stock/revisions/notifications.
- Smoke test created 2 dev-DB rows for today's date (project `f32399f8-1256-44f0-8003-458661a35f51`): DRAFT `6d3002f2-4f88-4156-89b0-22216a80aeb0`, SUBMITTED `9fd320ae-96a7-4574-a0cd-ac3162ba8728` — delete manually if the reports list should be clean.

**Phase 3 planning gates GREEN (2026-09-29):** `gate-p3-g.js` 7/7 + `gate-p3-h.js` 10/10 CDP browser checks on dev build, 0 console / 0 network errors. Harness-only fixes (no product code): `gate-p3-lib.js` — `EX_EMPTY_STATE` null-safe + regex rewritten `^….*/m` (removed a literal-newline-in-regex `SyntaxError`), `EX_DATE_BTNS` matches RO `Azi`, new `evalSettle` retry helper; `gate-p3-h.js` — H08 clicks `Azi`, H05/H07/H09 use `evalSettle`, H07/H09 re-select project before probing the for-date empty state. Evidence: `gate-p3-g.out.json`, `gate-p3-h.out.json`, `planning-screenshots/p3-*.png`. See VERIFICATION.md → Phase 3 Planning Gates P3-G / P3-H.

> **?? ARCHITECTURE DECISION (2026-09-23) � read before continuing:** Legacy `legacy.*` dual-write is a **temporary compatibility artifact only**, NOT a required pattern. PostgreSQL/NestJS is authoritative; there is no live Supabase project/keys and no `legacy.*` schema in dev. **Do NOT add legacy dual-write to R2.3 Stock or any other module.** The existing R2.2/R2.4 legacy helpers were **REMOVED on 2026-09-23** (ahead of the R7 cut-over) after live-DB verification. The orphan `public.time_logs` table was **DROPPED on 2026-09-23** (D-012). The `supabase/` directory was **ARCHIVED on 2026-09-23** (D-015). R2.5 Notifications is **? E2E VERIFIED** as PostgreSQL-authoritative module. Next: R2.3 Stock + Avize as **PostgreSQL-authoritative** module (verify invariants + live E2E), with no legacy mirroring. See `PROGRESS.md` ? Architecture Decision and `IMPLEMENTATION_ROADMAP.md` Milestone R7.

> ? Superseded 2026-09-23: the dev database has **no `legacy` schema**, and the legacy field-mapping code has now been **deleted**, so that limitation is moot. ISSUE-012 (orphan `public.time_logs`) and ISSUE-015 (`supabase/` retention) are now **RESOLVED** � the table was dropped and the directory was archived. Remaining Supabase-removal follow-ups were tracked as ISSUE-013 (no server-side blob storage) and ISSUE-014 (`/api/upload` route missing) � both **IMPLEMENTED + VERIFIED**.
>
> ?? `hiieko-final/` (frozen legacy reference repo) was **moved out of the active tree** to `C:\Users\Lenovo\Desktop\HIIEKO_ARCHIVE\hiieko-final` � preserved intact, NOT deleted.

# What Was Completed
- [x] **?? Supabase Runtime Removal � Phases 1-6 COMPLETE (2026-09-23)**
# What Was Completed
- [x] **?? D-012/D-015 Final Audit COMPLETE (2026-09-23)**
- [x] **?? Phase 10 � Solar Configurator Integration COMPLETE (2026-09-26)**
  - origin/feature/solar-configurator merged into origin/master at 73d78e8
  - Integration branch integrate/solar-configuration created, conflicts resolved (Sidebar.tsx only genuine conflict)
  - Full verification: backend 25/202 tests, web 22 routes, all typechecks and builds PASS
  - Documentation updated in all workflow docs
  - **Mobile:** `NotificationCenterScreen.tsx` -> `GET /api/notifications` + `POST /api/notifications/:id/read` + `POST /api/notifications/read-all`; `services/ocr.ts` -> `POST /api/ocr/process`; `services/expenseDocuments.ts` -> `POST /api/expenses` + `POST /api/ocr/jobs`; offline path -> SQLite `enqueueOperation('expense','create',�)`. Deleted `Mobile/src/services/supabase.ts` + `supabaseApiClient.ts`. Added `Mobile/src/services/expenseMapping.ts` (UI values -> Prisma enums). Added `markAllNotificationsRead()`, `processOcr()`, `createOcrJob()` to `NestMobileApiClient`.
  - **Web:** deleted `lib/supabase.ts`, `lib/supabase-api-client.ts`, `lib/useSupabaseQuery.ts`; removed `@supabase/supabase-js` (npm pruned 12 packages; lockfile has 0 Supabase refs); cleaned both web env files.
  - **Backend:** removed unused `supabaseToken` (LoginDto), Supabase-only `app_metadata` (JwtPayload), and the **Supabase token fallback in `JwtAuthGuard`** (unknown/inactive users now get 401).
  - **Edge Function:** deleted `supabase/functions/` (`ocr-extract`).
  - **Legacy shims:** removed `upsertLegacyTimeLog()` and `upsertLegacyDailyReport()` plus their shim-only support code (`attendance.service.ts` 405->268 lines, `daily-reports.service.ts` 410->173 lines).
  - **Env:** root `.env.example` rewritten � zero Supabase variables remain in the active tree.
  - **?? Real bug fixed:** `POST /api/ocr/process` was returning HTTP 500 `form_data_1.default is not a constructor` (`import FormData from 'form-data'` without `esModuleInterop`). Changed to `import * as FormData from 'form-data'`. OCR was non-functional before this fix.
  - **Verification:** monorepo typecheck exit 0; `nest build` exit 0; web build exit 0 (16 routes); jest 9/9 suites + 35/35 tests; **live smoke test 10/10 PASS** (login, notifications, read-all, expense with mapped enums, OCR job link, OCR process error path, ghost-token 401, check-in, `time_logs` frozen 3->3, `attendance_records` 3->4).
- [x] **NestJS Backend Foundation** in `backend/` workspace with modular domain modules, OpenAPI Swagger at `/api/docs`, JWT auth, RBAC, and Project Access guards.
- [x] **PostgreSQL Master Schema** defined in Prisma (`backend/prisma/schema.prisma`) with 66 domain entities matching the Master Product Specification.
- [x] **Company Control Tower Module** (`backend/src/modules/control-tower/`):
  - `control-tower.interface.ts`: 19 DTOs and interfaces for 7 operational domains + drill-down pagination.
  - `control-tower.service.ts`: Cross-functional real data aggregation (Projects, Workforce, Production, Materials, Finance, Quality, Documentation) + rule-based Red Flags Engine with WHY, WHO, WHEN, and SEVERITY.
  - `control-tower.controller.ts`: REST endpoints with Swagger documentation, JWT and RBAC guards (`/api/control-tower/overview`, `/api/control-tower/drilldown`, `/api/control-tower/red-flags`).
  - `control-tower.module.ts`: Wired and registered in `backend/src/app.module.ts`.
- [x] **Management Control Tower UI** (`web/` workspace):
  - `api-client.ts`: Typed Control Tower client methods.
  - `web/src/app/page.tsx`: Complete Management Control Tower dashboard with 7 domain cards, project selector, and real data integration.
  - `web/src/app/control-tower/page.tsx`: Dedicated route for Turn de Control.
  - `ControlTowerDrilldownDrawer.tsx`: Accessible slide-over drawer with search and filtering.
  - `ControlTowerRedFlagsCard.tsx`: Prioritized operational exception alerts table with severity filters.
  - `Sidebar.tsx`: Navigation updated to highlight Turn de Control.
- [x] Resolved `ISSUE-001` (dashboard querying nonexistent `attendance_records`).
- [x] Central `AuditService` implemented with structured before/after diff tracking.
- [x] **Core business invariants**:
  - Zero negative stock (atomic database checks)
  - Strict prevention of self-approval for expenses
  - Server-side GPS geofencing distance validation & automatic overtime calculation
  - Cycle detection & prerequisite task validation
  - Project boundary access enforcement
- [x] **8 Jest test suites (29 tests)** implemented and passing with 100% success rate.
- [x] Backend typecheck and build passing cleanly with 0 errors.
- [x] Web build passing cleanly with 18 static-prerendered routes.
- [x] All web pages migrated to real API calls with live PostgreSQL integration (14/14 endpoints verified HTTP 200).
- [x] Dev seed user (ADMIN) created and authentication flow verified.
- [x] **ISSUE-013 + ISSUE-014 IMPLEMENTED + VERIFIED (2026-09-23)** � server-side receipt/blob persistence and `/api/upload`:
  - `backend/src/common/storage/` � `StorageService` abstraction + `LocalStorageService` (path-traversal-safe keys, MIME allowlist, 10 MB cap, SHA-256 checksum) + global `StorageModule` (`STORAGE_DRIVER`/`STORAGE_ROOT` env).
  - `backend/src/modules/upload/` � `POST /api/upload` (JWT + expense ownership, multipart, MIME allowlist, 10 MB, `Document`+`DocumentVersion`+`Attachment`, structured `documentId` response, standard error envelope) and authenticated `GET /api/upload/:documentId` (StreamableFile; `@SkipEnvelope`).
  - `Mobile/src/services/apiClient.ts` `uploadFile()` extended; `Mobile/src/services/expenseDocuments.ts` `submitReceiptDraft` now uploads the receipt binary and links `OCRJob.document_id`.
  - Tests: backend **11 suites / 52 tests**, typecheck 0, build 0; Mobile typecheck 0; live E2E against PostgreSQL 18 (unauth 401, login, expense, upload 201, blob on disk, byte-identical retrieval, bad MIME 400).

# What Remains
- [ ] Apply the R0 milestone from `IMPLEMENTATION_ROADMAP.md` (stabilize): fix ISSUE-002 (mobile login), ISSUE-005 (real persistence + sync), ISSUE-003/004 (OCR cleanup), ISSUE-006/008/009 (hygiene).
- [x] **DONE (2026-09-29):** git + CI exist and are green - GitHub Actions `ci.yml` (install + typecheck + tests + build) passed on commit `6bd45b7` (run 36606409946: Tests ✅ / Typecheck ✅ / Build ✅). Kept for history: the 2026-09-18 note "no VCS exists in the checkout".
- [ ] ~~Deploy OCR function to Supabase; obtain real Supabase project keys and apply `supabase/full_setup.sql`.~~ **SUPERSEDED (2026-09-23):** PostgreSQL/NestJS is authoritative; Supabase is a legacy compatibility artifact to be decommissioned at R7. OCR is handled by the backend `ocr` module + PaddleOCR service (see R5), not a Supabase Edge Function deploy.
- [ ] Mobile app: wire real login flow, implement offline queue sync.
- [ ] OCR pipeline: complete PaddleOCR service deployment, fix documentation drift (ISSUE-003/004).

# What Is Blocked
- Live Supabase integration/E2E, mobile device runs, and PaddleOCR inference cannot be exercised here (no project/keys, no emulator/device, no model runtime).
- Migration implementation should not start before R0 stabilization decisions are approved (see `IMPLEMENTATION_ROADMAP.md`).

# Last Known Working State
- Verified working in this environment (2026-09-18/19): shared build + all unit suites, web production build (14 routes), root typecheck (0 errors), web dev server HTTP 200 on 14 routes.
- The OCR chain (schema ? Edge Function ? OCR service) is internally consistent apart from documented drift (Google Vision leftovers, dead `extract.ts`).
- Live project behavior (RLS, Edge Function, Storage, PaddleOCR inference) remains UNVERIFIED � no keys/deployment.

# Verification
| Check | Result | Notes |
|---|---|---|
| CI (GitHub Actions) | PASS | 2026-09-29 - run 36606409946 on commit `6bd45b7`: Tests ✅ / Typecheck ✅ / Build ✅ (3/3 jobs, every step success) |
| Build | PASS | shared + web (14 routes), 2026-09-18/19 |
| Unit tests | PASS | shared suites + Edge `extract.test.ts` (36) + OCR `pytest` (6) |
| Integration tests | NOT RUN | requires live Supabase project |
| E2E tests | NOT RUN | no deployed web/mobile/function/OCR service |
| Type checking | PASS | `npm run typecheck` 0 errors (shared+web+mobile) |
| Lint | NOT RUN | `next lint` not executed |
| App startup | PASS | web dev server live; mobile not started |

# Files Changed
- `backend/src/modules/control-tower/interfaces/control-tower.interface.ts`
- `backend/src/modules/control-tower/control-tower.service.ts`
- `backend/src/modules/control-tower/control-tower.controller.ts`
- `backend/src/modules/control-tower/control-tower.module.ts`
- `backend/src/app.module.ts`
- `backend/test/control-tower.service.spec.ts`
- `backend/test/*.spec.ts` (8 suites, 29 tests)
- `web/src/lib/api-client.ts`
- `web/src/components/ControlTowerDrilldownDrawer.tsx`
- `web/src/components/ControlTowerRedFlagsCard.tsx`
- `web/src/components/Sidebar.tsx`
- `web/src/app/page.tsx`
- `web/src/app/control-tower/page.tsx`
- `Project workflow/VERIFICATION.md`
- `Project workflow/PROGRESS.md`
- `Project workflow/ISSUES.md`
- `Project workflow/HANDOFF.md` (this file)
- `web/src/app/cheltuieli/page.tsx` (sample data fix)
- `web/src/app/aprobare/page.tsx` (sample data fix)
- `web/src/app/avize/page.tsx` (sample data fix)
- `web/src/app/pontaj/page.tsx` (sample data fix)
- `web/src/app/notificari/page.tsx` (sample data fix)

# Important Files To Continue With
- `Project workflow/DESIGN_SYSTEM.md` — tokens map, component inventory, shell/layout contract, a11y/i18n rules, 23-route adoption tracker, OCE pattern adoption log.
- `web/src/config/navigation.ts` — single source of truth for sidebar navigation (groups, items, icons, roles, i18n keys).
- `web/src/app/page.tsx` � dashboard (ISSUE-001).
- ~~`supabase/functions/ocr-extract/index.ts` + `extract.ts` � OCR edge (ISSUE-003/004).~~ **DELETED 2026-09-23** � OCR now runs through `backend/src/modules/ocr/` (`POST /api/ocr/process` -> self-hosted PaddleOCR).
- `Mobile/src/services/apiClient.ts`, `Mobile/src/services/ocr.ts`, `Mobile/src/services/expenseDocuments.ts`, `Mobile/src/services/expenseMapping.ts` � the migrated Mobile runtime paths.
- `backend/src/modules/ocr/providers/paddleocr.provider.ts` � OCR provider client (FormData import fixed).
- `Mobile/App.tsx`, `Mobile/src/screens/LoginScreen.tsx` � auth wiring (ISSUE-002).
- `Mobile/src/screens/WorkerExpenseScreen.tsx`, `DeliveryIntakeScreen.tsx`, `Mobile/src/services/storage.ts` � offline queue (ISSUE-005).
- `ocr-service/app/main.py` � OCR service entrypoint.

# Important Decisions
See DECISIONS.md. Key: monorepo workspaces, **NestJS + Prisma + PostgreSQL 18 backend (Supabase fully removed from runtime on 2026-09-23 � RLS-era Supabase is superseded)**, self-hosted PaddleOCR (supersedes Google Vision), Romanian-first i18n, offline queue, DB-enforced stock integrity, validation-first OCR review loop.

# Assumptions
- Web + mobile + OCR service are all maintained in this repo.
- No production credentials are available in this environment; deployment cannot be exercised here.
- The 2026-09-18 status report is the current ground truth (any disagreement ? update docs + report).

# Known Problems
- Full list in ISSUES.md (ISSUE-001 .. 035).
- Summary: dashboard queries a nonexistent table; mobile auth bypass; OCR doc/code drift; dead parser; offline sync gaps; repo hygiene (gitignore, missing pytest, SQL header); mojibake.

# Next Action
The next AI should:
1. **Verify solar-configurator route** � confirm the route works in dev environment
2. **Apply Prisma migration** �
px prisma migrate deploy to production
3. **R2.6 Audit** � implement remaining audit recommendations (add tests for untested modules, fix missing routes, activate PermissionsGuard)
2. **Phase 4: Authorization & project scoping** � ensure `actorId` propagated from auth context.
3. **Phase 5: DTO validation** � add class-validator decorators to DTOs.
4. **Phase 6: Read APIs** � add pagination/filters to `getMovements` and `listAllBalances`.
5. **Phase 7: Web `/stocuri` rewrite** � handle new TRANSFER_IN/TRANSFER_OUT types.
6. **Phase 8: Web `/avize` rewrite** � add create form using new `createAviz`.
7. **Phase 9: Mobile delivery intake fixes** � verify mobile creates avize correctly.
8. **Phase 10: Integration/E2E tests** � concurrent consume/transfer, aviz?stock flow.
- [x] Completed work documented
- [x] Remaining work documented
- [x] Blockers documented
- [x] Verification documented
- [x] Files identified
- [x] Next action documented
