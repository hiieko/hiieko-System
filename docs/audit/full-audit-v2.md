# HIIEKO — Full-Stack Audit v2

**Generated:** 2026-10-16
**Scope:** web (Next.js) × backend (NestJS) × Prisma/PostgreSQL — all in-scope routes under `web/src/app/**`.
**Method:** read-only static analysis of route sources (`page.tsx`), shared UI primitives under
`web/src/components`, the design-system tokens in `web/tailwind.config.js` / `src/app/globals.css`,
and the shell (`AppShell`, `PageContainer`). No source file was modified and no process was started.
**Sessions:** Session 1 of 4 (Sections 1–2). Sections 3–10 are appended in later sessions.

---

## Section 1 — Regression Check

**Status: COMPLETE (Session 2, 2026-10-16)**

Re-ran `scripts/audit-functional.ts` (GET-only, read-only: one `POST /api/auth/login` per user, then
GET probes) against the live backend on `http://localhost:4000` and diffed the result against the
2026-10-14 baseline `docs/audit/functional-results.json`.

- Baseline — `generatedAt 2026-10-14T21:16:17.476Z`, `baseUrl http://127.0.0.1:4000`, 25 endpoints × 18 users.
- After — `docs/audit/functional-results-after-quality-pass.json`, `generatedAt 2026-10-16T13:59:41.806Z`,
  `baseUrl http://localhost:4000`.
- Health — `GET /health/live` → 200, `GET /health/ready` → 200.

### Result

| Signal | Baseline | After | Verdict |
| --- | --- | --- | --- |
| Logins OK | 18/18 | 17/18 | 1 new failure (`dev`) |
| Probes with matching HTTP status | 450/450 | 425/450 | 25 mismatches — all `dev` (see below) |
| Probes with matching row-count / shape | — | 389/425 | 36 row-count changes (all +1…+3) — new demo data |

**The only login deviation is the `dev` account.** `dev@hiieko.local` (ADMIN) logged in with HTTP 200
at baseline; on the re-run it returns **401**. Because the harness skips every probe for a user whose
login failed (it records `status: null`), this single login failure accounts for **all 25 status
mismatches** (`25 endpoints × 1 user`). The remaining non-200 probes are the same role-based **403**s
recorded at baseline (e.g. `/api/employees` is 403 for the 12 non-privileged roles), so the
**authorization matrix is unchanged**.

### Root cause of the `dev` 401 — credential/DB drift, not a code regression

Read-only DB probe of `dev@hiieko.local`:

```
status = ACTIVE, is_active = true, password_hash = present
bcrypt.compare('DevPassword123!', password_hash) -> false
```

The account is enabled and has a password hash, but the stored hash **does not match** the seeded
`DevPassword123!` held in `scripts/audit-functional.json`. `login()`
(`backend/src/modules/auth/auth.service.ts`) requires both a valid bcrypt compare **and**
`status === ACTIVE`, and returns a generic 401 on any failure — exactly the observed behaviour.

This is **not** attributable to the quality pass: the four preceding commits changed only `web/**`
and `shared/src/translations.ts`. No backend, auth or seed file was touched and no migration was
applied. The stored hash for this local database simply no longer matches the fixture credential
(most plausibly the password was changed through the app or the account was seeded with a different
value). **Recommended fix:** re-seed/refresh the `dev` password (or update
`scripts/audit-functional.json` to the current value) and re-run.

### Row-count differences (new data, not regressions)

Six list endpoints returned more rows than baseline (+1 to +3), consistently across every user who
can read them — the signature of **additional demo records** seeded by `backend/prisma/seed-demo.ts`
after the baseline was captured, not a behavioural change:

| Endpoint | Example (owner) | Δ |
| --- | --- | --- |
| `/api/documents` | 10 → 13 | +3 |
| `/api/tasks` | 30 → 32 | +2 |
| `/api/attendance` | 31 → 32 | +1 |
| `/api/daily-reports` | 8 → 9 | +1 |
| `/api/issues` | 12 → 13 | +1 |
| `/api/attendance/my-logs` | 0 → 1 (pm) | +1 |

### Verdict

**No functional regression was introduced by the accessibility quality pass.** Every probe that is
not the stale `dev` credential matches the baseline status matrix (403s included), and the 36 shape
changes are additive demo data. After refreshing the `dev` credential the suite is expected to return
18/18 logins and 450/450 matching statuses.

---

## Section 2 — Route & UI Consistency Audit

### 2.1 Methodology & limitations

- **Population:** every `page.tsx` under `web/src/app/**`, excluding the three `design-review`
  routes (a visual scratch pad, not a product surface). **31 routes in scope.**
- Evidence is **static only** — no headless browser is installed, so the 375/768/1280 columns are
  derived from the responsive classes present in each route (grid/flex/`sm:`/`md:`/`lg:`/`xl:`
  utilities, fixed widths, `min-w-[…]`, `overflow-x-auto`). A cell is only marked **RISK** when a
  static signal exists; this is an approximation, not a rendered measurement.
- **Design-system baselines** (read from source, authoritative):
  - `Card` default padding = `p-6` (`components/ui/Card.tsx`). Overridable via `padding={false}` +
    `className`.
  - `Button` sizes: `sm` = `px-3 py-1.5 text-xs`, `md` = `px-4 py-2 text-sm`, `lg` = `px-6 py-3 text-base`,
    `icon` = `w-9 h-9` (36 px).
  - `Badge` sizes: `sm` = `text-[10px]`, `md` = `text-xs`; tones map to `success|warning|danger|info|neutral`.
  - `PageHeader` title = `text-xl`, root `mb-6`.
  - `PageContainer` = `mx-auto w-full max-w-7xl space-y-6`.
  - `AppShell` owns the outer padding via `.hii-page` (`pb-24 lg:pb-8`), defined in `globals.css:96`.
  - Color tokens: brand `hii-*`; semantic `success` / `warning` / `danger` (alias `critical`) / `info`,
    each with `DEFAULT`, `soft`, `foreground`. Custom surface tokens: `surface-*`, `content-*`,
    `chrome-*`, `accent-*`, `positive-*`.

### 2.2 Per-route conformance

Legend — **Uses system?**: whether the route composes the shared `PageHeader`/`Card`/`Button`/`Badge`
primitives. **375 / 768 / 1280**: `OK` (static signal that the layout adapts) or `RISK`
(static signal of overflow/cramping). **Inconsistencies**: deviations from 2.3.

| Route | Layout | Uses system? | 375 | 768 | 1280 | Inconsistencies |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | AppShell, role-branched | Partial (Card); raw buttons | RISK | OK | OK | Hand-rolled cards + raw `<button>`; red-flags `<table>` in `overflow-x-auto` with **no card fallback** |
| `/login` | Standalone (no shell) | Partial (Button) | OK | OK | OK | No `PageHeader` (expected for auth); raw `h-[30px] w-[30px]` arbitrary size; raw `<button>` |
| `/signup` | Standalone (no shell) | Partial (Button) | OK | OK | OK | No `PageHeader`; raw `<button>` |
| `/forgot-password` | Standalone (no shell) | Partial (Button) | OK | OK | OK | No `PageHeader`; raw `<button>` |
| `/forgot-password/reset` | Standalone (no shell) | Partial (Button) | OK | OK | OK | No `PageHeader`; raw `<button>` |
| `/profil` | AppShell | Yes | OK | OK | OK | `Card padding={false} className="p-4 sm:p-6"` (2×) instead of default `p-6`; raw `<button>` |
| `/activity` | AppShell | Yes | OK | OK | OK | `text-[11px]` arbitrary font size; raw `<button>` |
| `/notificari` | AppShell, sticky header | Yes | OK | OK | OK | Fixed fetch of 50/page-1 — no pagination control; raw `<button>` |
| `/projects` | AppShell | Yes | RISK | OK | OK | Hand-rolled modal (`fixed inset-0 bg-black/50 … max-h-[90vh]`); wizard `flex gap-2` + `w-40` select, no wrap; `CardContent p-5`; page root `p-4 sm:p-6` doubles shell padding; 10 raw `<button>` |
| `/projects/[id]` | AppShell | Partial (no `PageHeader` token detected) | RISK | OK | OK | Hand-rolled modal; members list fixed 20/page with no mobile adaptation; 12 raw `<button>` |
| `/santiere` | AppShell | Yes | OK | OK | OK | 4 raw `<button>` |
| `/teams` | AppShell | Yes | OK | OK | OK | `Card hover padding={false} className="p-5 h-full"` ≠ default `p-6`; 12 raw `<button>` |
| `/planning` | AppShell | Partial | OK | OK | OK | Uses custom theme tokens (`bg-surface`, `text-content`, `shadow-card`) vs the slate palette; `min-h-[44px]` arbitrary; 7 raw `<button>` |
| `/tasks` | AppShell, sticky header | Yes | OK | OK | OK | `Card padding={false} className="p-4"` ≠ default `p-6`; 2 raw `<button>` |
| `/issues` | AppShell, sticky header | Yes | OK | OK | OK | `min-h-[40px]` arbitrary; `Card className="p-12 text-center"`; `Card … className="p-4"`; 5 raw `<button>` |
| `/control-tower` | AppShell → `ControlTowerSurface` | No page tokens (UI in component) | OK | OK | OK | UI lives in `ControlTowerSurface.tsx`; component itself uses the undefined `bg-warning-soft0` class (see 2.3 #1) |
| `/workforce` | AppShell, sticky header | Yes | OK | OK | RISK | `xl:block` table + `xl:hidden` cards; table `hii-table min-w-[1050px]`; `Card padding={false} className="p-4"`; summary `grid grid-cols-3 gap-3`; 11 raw `<button>` |
| `/utilizatori` | AppShell | Yes | OK | OK | OK | `<table>` with `overflow-x-auto` only — **no card fallback**; 1 raw `<button>` |
| `/pontaj` | AppShell, sticky header | Yes | OK | OK | OK | Arbitrary widths `min-w-[200px]/[32px]/[90px]/[100px]`; `Card padding={false} className="p-4"` (4×); pagination 15/25 (not the 10/20 standard); 3 raw `<button>` |
| `/rapoarte` | AppShell, sticky header | Yes | OK | OK | OK | `Card … className="p-4"`; 9 raw `<button>` |
| `/rapoarte/form` | AppShell | Unknown (no tokens detected) | ? | ? | ? | Static analysis inconclusive — see 2.5 |
| `/aprobare` | AppShell | Yes | OK | OK | OK | 5 raw `<button>` |
| `/cheltuieli` | AppShell, sticky header | Yes | OK | OK | OK | `min-w-[200px]` arbitrary; `Card padding={false} className="p-4"` (3× incl. `p-4 bg-slate-50`) ≠ default `p-6`; 10 raw `<button>` |
| `/qa-qc` | Server redirect → `/qa` (no JSX) | n/a | — | — | — | Not statically auditable — `redirect('/qa')` |
| `/qa` | AppShell, sticky header | Yes | OK | OK | OK | 1 raw `<button>` |
| `/stocuri` | AppShell, sticky header | Yes | OK | OK | OK | `<table>` with `overflow-x-auto` only — **no card fallback**; 6 raw `<button>` |
| `/depozite` | AppShell | Yes | OK | OK | OK | `<table hidden md:block>` + `md:hidden` cards (has fallback); 2 raw `<button>` |
| `/furnizori` | AppShell | Yes | OK | OK | OK | `<table hidden md:block>` + `md:hidden` cards (has fallback); 2 raw `<button>` |
| `/avize` | AppShell | Yes | OK | OK | OK | `<table>` with `overflow-x-auto` only — **no card fallback**; 2 raw `<button>` |
| `/documente` | AppShell, sticky header | Yes | OK | OK | OK | `<table>`; 4 raw `<button>` |
| `/solar-configurator` | AppShell | Yes | OK | OK | OK | `max-w-[1600px]`, `h-[280px]`, `h-[320px]` arbitrary values; 4 raw `<button>` |

### 2.3 Cross-cutting inconsistencies

1. **Undefined color utility `-soft0` (HIGH).** 27 usages of `bg-warning-soft0` / `bg-success-soft0` /
   `bg-danger-soft0` render with **no background**. `tailwind.config.js` defines only
   `success.soft` / `warning.soft` / `danger.soft` (no `0`) and declares no `safelist`, so Tailwind
   never emits these classes. Affected surfaces include `/control-tower`
   (`ControlTowerSurface.tsx`, `ControlTowerRedFlagsCard.tsx`, `ControlTowerDrilldownDrawer.tsx`),
   the shell (`ShellNotificationsButton.tsx`, `Toast.tsx`), `WorkerAttendanceView.tsx`,
   `PageTutorial.tsx`, and several `features/*` components. The correct tokens (`-soft`) are used
   elsewhere (e.g. `src/types/project.ts`, `lib/formatters.ts`, `features/projects/types.ts`),
   pointing to a broken `soft → soft0` find-and-replace.
2. **Card padding is not uniform.** The design system default is `p-6`, but 16 call sites override it
   to `p-4`/`p-5`/`p-12` via `Card … className="p-…"` (many with `padding={false}`). The Section 2
   spec calls for `p-4 md:p-6`; the system ships `p-6` and pages hand-roll the rest. Routes affected:
   cheltuieli, issues, pontaj, profil, projects, rapoarte, tasks, teams, workforce.
3. **Raw `<button>` bypasses the `Button` primitive** across 27 routes (~170 occurrences). Highest:
   `/teams` (12), `/projects/[id]` (12), `/workforce` (11), `/projects` (10), `/cheltuieli` (10),
   `/rapoarte` (9). This defeats uniform sizes (`sm/md/lg/icon`) and hover/focus states.
4. **Table → card fallback is inconsistent.** `depozite` and `furnizori` use `hidden md:block` +
   `md:hidden` cards and `workforce` uses `xl:block` + `xl:hidden` cards, but `avize`, `pontaj`,
   `stocuri`, `utilizatori` (and the `/` red-flags table) rely on `overflow-x-auto` only, so phone
   users must scroll a wide table horizontally.
5. **Pagination size diverges.** The running standard is 10 mobile / 20 desktop via
   `useMediaQuery('(max-width: 639px)')`. `/pontaj` uses **15 / 25**, `/projects/[id]` members use a
   fixed **20** (no mobile adaptation), and `/notificari` fetches a fixed 50/page-1 with no control.
6. **Icon sizes are off the allowed set.** Allowed {16, 20, 24, 32, 48}. Largest off-set cluster is
   **14 px** (56 usages), then 12 px (19), 36 px (12), 40 px (3), 56 px (4), 64 px (3), 28 px (2),
   18 px (5), 8 px (2), 6 px (6). 16 px (164) is the modal value.
7. **Arbitrary-value Tailwind classes** appear in 13 routes/route files (21 matches): `cheltuieli`
   `min-w-[200px]`; `activity` `text-[11px]`; `issues` `min-h-[40px]`; `login` `h-[30px] w-[30px]`;
   `planning` `min-h-[44px]`; `pontaj` `min-w-[200px]/[32px]/[90px]/[100px]`;
   `solar-configurator` `max-w-[1600px]`, `h-[280px]`, `h-[320px]`; `projects` `max-h-[90vh]`;
   `workforce` `min-w-[1050px]`; `error.tsx`/`not-found.tsx` `min-h-[60vh]`. These bypass the token
   scale and drift from the design system.
8. **PageHeader is missing** on several in-shell routes where a title header would be expected:
   `/depozite`, `/furnizori`, `/projects/[id]`, `/solar-configurator`, `/control-tower`,
   `/rapoarte/form`. (Auth routes `/login`, `/signup`, `/forgot-password*` are intentionally
   header-less.)
9. **Duplicate page shells / doubled padding.** `/projects` renders its own root `p-4 sm:p-6` inside
   the `AppShell`, which already applies `.hii-page` padding — content is inset twice.
10. **Custom theme tokens mixed with the slate palette.** `/planning` uses `bg-surface`,
    `text-content`, `shadow-card` alongside `slate-*` classes; `/workforce` and `/depozite` mix
    `slate-*` with semantic tokens. This is a mid-migration inconsistency, not a defect, but it
    breaks visual uniformity across pages.

### 2.4 Design-system conformance summary

| Primitive | Adoption | Notes |
| --- | --- | --- |
| `PageHeader` | ~20 / 31 routes | Missing on 6 in-shell routes + 4 auth routes |
| `Card` | Broadly used | Padding overridden at 16 call sites (see 2.3 #2) |
| `Button` | Partial | ~170 raw `<button>` elements bypass it across 27 routes |
| `Badge` | Good | Uses `sm/md` sizes and semantic tones consistently |
| `PageContainer` | Good | `max-w-7xl space-y-6` used consistently in-shell |
| Icon sizing | Weak | 14 px is the 2nd-most-common size; see 2.3 #6 |
| Color tokens | Weak | `-soft0` undefined utility (2.3 #1); `slate-*` mixed with semantic tokens |

### 2.5 Routes where static analysis is inconclusive

- **`/qa-qc`** — `page.tsx` is a server `redirect('/qa')` with no JSX; not statically auditable
  (covered by the `/qa` row).
- **`/rapoarte/form`** — no `PageHeader`/`Card`/`Button` token matches and no responsive-class signal
  was detected; needs a rendered/manual check. Treated as Unknown across 375/768/1280.
- **`/control-tower`** — all UI is in `ControlTowerSurface.tsx`; page-level tokens are absent by design.
- **`/projects` modal & wizard at 375 px** — the overflow judgement (`max-h-[90vh]`, unwrapped
  `flex gap-2` + `w-40`) is a static estimate; confirm with a real viewport.
- **`/projects/[id]` PageHeader** — token grep did not detect a `PageHeader`; confirm whether the
  detail header is hand-rolled.

---

## Section 3 — Performance & Bundle

### 3.1 Runtime / query-plan profiling

**Status: COMPLETE (Session 2, 2026-10-16)** — measured against the live backend on
`http://localhost:4000` backed by PostgreSQL 18.6. Latency is wall-clock per request, taken from the
`ms` field of `docs/audit/functional-results-after-quality-pass.json` and aggregated per endpoint
across all probes that returned 200. The `dev` user is excluded (login 401, no probes).

### Per-endpoint latency (after quality pass)

Sorted by p95; `n` = number of 200-returning probes. All values in ms.

| Endpoint | n | min | p50 | p95 | max |
| --- | --- | --- | --- | --- | --- |
| `/api/daily-reports` | 17 | 14 | 32 | 110 | 110 |
| `/api/control-tower/overview` | 8 | 45 | 56 | 67 | 67 |
| `/api/control-tower/red-flags` | 8 | 46 | 53 | 64 | 64 |
| `/api/procurement/delivery-notes` | 17 | 7 | 13 | 47 | 47 |
| `/api/attendance` | 17 | 9 | 21 | 36 | 36 |
| `/api/inventory/stock` | 17 | 7 | 11 | 35 | 35 |
| `/api/projects` | 17 | 11 | 17 | 34 | 34 |
| `/api/qa-qc/inspections` | 17 | 15 | 19 | 34 | 34 |
| `/api/procurement/purchase-orders` | 17 | 9 | 18 | 32 | 32 |
| `/api/warehouses` | 17 | 9 | 13 | 32 | 32 |
| `/api/teams` | 17 | 9 | 13 | 30 | 30 |
| `/api/inventory/movements` | 17 | 10 | 18 | 28 | 28 |
| `/api/tasks` | 15 | 7 | 19 | 28 | 28 |
| `/api/expenses` | 17 | 8 | 13 | 26 | 26 |
| `/api/notifications` | 17 | 7 | 11 | 26 | 26 |
| `/api/suppliers` | 17 | 10 | 16 | 25 | 25 |
| `/api/users` | 8 | 10 | 13 | 21 | 21 |
| `/api/documents` | 17 | 7 | 12 | 20 | 20 |
| `/api/materials` | 17 | 9 | 14 | 18 | 18 |
| `/api/issues` | 17 | 8 | 12 | 18 | 18 |
| `/api/employees` | 4 | 11 | 12 | 17 | 17 |
| `/api/daily-plans` | 17 | 9 | 11 | 17 | 17 |
| `/api/auth/me` | 17 | 6 | 9 | 16 | 16 |
| `/api/attendance/my-logs` | 17 | 7 | 9 | 16 | 16 |
| `/api/users/profile` | 17 | 7 | 10 | 14 | 14 |

Reduced `n` reflects role-based 403s, not latency: `/api/employees` is readable by only 4 roles;
`/api/users` and the two `/api/control-tower/*` endpoints by 8.

**Login latency.** All 17 successful logins are p50 ≈ 126 ms (range 100–145 ms). The baseline `dev`
login was 543 ms (cold first request); excluding it, baseline logins ranged 80–93 ms vs 100–145 ms
now — within normal bcrypt/cold-start variance.

**Health.** `GET /health/live` and `GET /health/ready` both 200.

### Observations

1. **Absolute latency is low.** Every endpoint p50 ≤ 56 ms and the slowest p95 is 110 ms.
2. **`/api/daily-reports` is the outlier** (p50 32 / p95 110). Its `findAll` uses a 10-relation
   `include` under Prisma's default **`query`** relation strategy, which fans out to **17 SQL
   statements per request** (see §3.5). The cost is round-trip count, not scan time.
3. **`/api/control-tower/*`** are next (p50 ≈ 53–56 ms): `getOverview` issues ~10 aggregate
   `findMany` calls; `red-flags` re-runs the full overview and filters in memory.
4. Stable read-one / scoped endpoints (`/api/auth/me`, `/api/attendance/my-logs`,
   `/api/users/profile`) sit at p95 ≤ 16 ms.

**Verdict:** runtime latency is healthy on the current dataset; the ranking tracks per-request
**query count** (broad `include`s and the control-tower fan-out), not expensive query plans.

### 3.2 N+1 query patterns (static)

Method: walked every `*.service.ts` under `backend/src/modules/**` for loops (`for`/`while`/`.map`)
whose body issues a Prisma/`$queryRaw` call. A pattern is **High** only when the loop iterates a list
endpoint's result set; otherwise **Medium**. Four genuine N+1 sites were found — all **Medium**
(transactional write paths, bounded by the size of a single request payload, no High-severity list
endpoint N+1):

| # | Location | Loop | Per-iteration query | Severity |
| --- | --- | --- | --- | --- |
| 1 | `backend/src/modules/daily-reports/daily-reports.service.ts:932` | `for (const line of lines)` | `inventoryService.consumeStockWithin(tx, …)` → `findFirst` + `UPDATE … FOR UPDATE` + update/create | Medium |
| 2 | `backend/src/modules/inventory/inventory.service.ts:407` | `for (const line of lines)` (`assertConsumableStock`) | `tx.stockBalance.findFirst` + `tx.$queryRawUnsafe(… FOR UPDATE)` | Medium |
| 3 | `backend/src/modules/procurement/procurement.service.ts:169` | `for (const item of dto.items)` (`createAviz`) | `tx.stockBalance.findFirst` + update/create + `tx.stockMovement.create` | Medium |
| 4 | `backend/src/modules/task-dependencies/task-dependencies.service.ts:65` | `while (queue.length > 0)` (`detectCycle`) | `this.prisma.taskDependency.findMany` per visited node | Medium |

Confirmed **not** N+1 (single query then in-memory loop): `daily-reports.service.ts:240`/`:440`;
all of `control-tower.service.ts` (`:255`, `:379`, `:413`, `:492`, `:629`, `:739`, `:820`, `:861`, `:937` —
in-memory over `include`d relations); `solar.service.ts:296` (in-memory + batched `createMany`);
`demo.service.ts:90` (in-memory); `attendance.service.ts:356` (whitelist loop). Good pattern:
`activity.service.ts:210` uses `Promise.all` of six batched `findMany` calls.

### 3.3 Production bundle

`npm run build --workspace=web` compiled successfully — **36/36 static pages generated**. No route
exceeds 200 KB First Load JS. Largest product route is `/` at **198 kB**.

| Route | First Load JS |
| --- | --- |
| `/` | 198 kB |
| `/design-review/architecture` | 182 kB *(excluded scratch route)* |
| `/planning` | 178 kB |
| `/rapoarte` | 174 kB |
| `/pontaj` | 168 kB |
| `/projects/[id]` | 168 kB |
| `/rapoarte/form` | 168 kB |
| `/tasks` | 167 kB |
| `/activity` | 165 kB |
| `/cheltuieli` | 165 kB |
| `/avize`, `/stocuri`, `/teams` | 163 kB |
| `/solar-configurator` | 149 kB |

**Top 10 performance concerns (bundle):**
1. `/` — 198 kB First Load JS (heaviest product route; role-branched dashboard).
2. `/planning` — 178 kB.
3. `/rapoarte` — 174 kB.
4. `/pontaj` — 168 kB.
5. `/projects/[id]` — 168 kB.
6. `/rapoarte/form` — 168 kB.
7. `/tasks` — 167 kB.
8. `/activity` — 165 kB.
9. `/cheltuieli` — 165 kB.
10. `/avize` / `/stocuri` / `/teams` — 163 kB each.

No route crossed the 200 KB budget line, so the concern is consolidation (shared chunks), not a
hard breach.

### 3.4 Heavy imports

Only one heavy third-party dependency tree was found: `three` (+ `@react-three/fiber`,
`@react-three/drei`) in `web/src/features/solar-configurator/viewer3d/SolarScene.tsx:4-6`. It is
**lazy-loaded** via `next/dynamic({ ssr: false })` at `web/src/app/solar-configurator/page.tsx:57-61`,
which is confirmed by the route's 149 kB First Load JS (the 3D engine is excluded from the initial
bundle). All other declared deps (`date-fns`, `lucide-react`, `clsx`, `tailwind-merge`) are light
and tree-shakeable; no charting, PDF, canvas, date-picker or rich-text library exists in the app.

| Dependency | Where | Heavy? | Mitigation |
| --- | --- | --- | --- |
| `three`, `@react-three/fiber`, `@react-three/drei` | `features/solar-configurator/viewer3d/SolarScene.tsx:4-6` | Yes | `next/dynamic({ ssr: false })` (`app/solar-configurator/page.tsx:57-61`) |
| `date-fns` | `lib/formatters.ts` et al. | No | Named imports, tree-shakeable |
| `lucide-react` | components/routes | No | Per-icon ESM imports |
| `clsx`, `tailwind-merge` | `lib/utils` | No | Tiny helpers |

### 3.5 Database performance (indexes, pool, slow queries)

**Status: COMPLETE (Session 2, 2026-10-16)** — read-only introspection of the live PostgreSQL 18.6
instance backing the audit (`DATABASE_URL` read from `backend/.env`; never modified). The
`pg_stat_statements` extension is **not installed** (only `plpgsql` is present), so "slow queries"
are characterised by `EXPLAIN (ANALYZE, BUFFERS)` of the representative statements emitted by the
five slowest endpoints from §3.1, captured via Prisma query-event logging.

### Instance & connection pool

| Metric | Value |
| --- | --- |
| Server version | PostgreSQL 18.6 |
| Database | `hiieko` (14 MB total) |
| `max_connections` (server) | 100 |
| Prisma pool size | **33** (default `num_physical_cpus × 2 + 1`; `DATABASE_URL` sets no `connection_limit`; no PgBouncer) |
| Sessions (this DB) | 8 total — 1 active, 7 idle, 0 idle-in-transaction |
| Sessions (all DBs) | 16 |

**Pool is not a bottleneck.** A 33-connection Prisma pool sits well under the server's
`max_connections = 100`, and only 8 sessions are in use.

### Index coverage

Every **foreign-key / relation column on the read paths is indexed** — confirmed by the
`Bitmap Index Scan` / `Index Scan` nodes on all relation lookups in the plans below
(`projects_pkey`, `users_pkey`, `user_profiles_user_id_key`, `materials_pkey`,
`aviz_items_aviz_id_idx`, `daily_report_approvals_daily_report_id_idx`,
`project_stages_project_id_stage_order_key`). List-endpoint filter/sort coverage:

| Endpoint / query | Filter / sort columns | Supporting index | Status |
| --- | --- | --- | --- |
| `/api/daily-reports` | `project_id`, `ORDER BY report_date DESC` | `daily_reports_project_id_report_date_idx` | OK |
| `/api/attendance` | `project_id` / `user_id` + `date` range | `attendance_records_project_id_date_idx`, `attendance_records_user_id_date_idx` | OK |
| `/api/procurement/delivery-notes` (avize) | `project_id` | `avize_project_id_aviz_number_key` (prefix) | OK (filter) |
| control-tower tasks | `project_id` | `tasks_project_id_code_key`, `tasks_project_id_is_archived_idx` | OK |
| control-tower project_members | `project_id` | `project_members_project_id_user_id_key` (prefix) | OK |
| control-tower stock_balances | `project_id` | `stock_balances_project_id_idx` | OK |
| control-tower attendance | `project_id` | `attendance_records_project_id_date_idx` | OK |

**Unindexed `project_id` filters (scale risk only).** The control-tower overview also filters these
child tables by `project_id`, but their models declare **no index** on that column:

| Model / table | Predicate | Index | Current plan |
| --- | --- | --- | --- |
| `CostEntry` / `cost_entries` | `project_id IN (…)` | none (pkey only) | seq scan |
| `Expense` / `expenses` | `project_id IN (…)`, `status = 'APPROVED'` | `expenses_submitted_by_id_status_idx` (wrong leading column) | seq scan |
| `Inspection` / `inspections` | `project_id IN (…)` | none | seq scan |
| `Document` / `documents` | `project_id IN (…)` | none | seq scan |
| `NCR` / `ncrs` | via nested `inspection.project_id IN (…)` | none on either side | join + seq scan |

Two **sort** columns likewise lack a supporting index: `avize.delivery_date` and
`attendance_records.check_in_time` (the `take: 200` ordering). Neither matters at current volume.

### EXPLAIN plans (5 slowest endpoints)

Prisma emits one statement per relation under the default `query` strategy. Representative plans —
the data is tiny, so the planner correctly prefers sequential scans:

| Endpoint | Primary statement | Rows | Plan | Execution |
| --- | --- | --- | --- | --- |
| `/api/daily-reports` | `Seq Scan on daily_reports` (11 includes → **17 statements total**) | 9 | Seq Scan | 0.07 ms |
| `/api/control-tower/overview` | `Seq Scan on projects` (+ attendance / cost / expense / … sub-queries) | 2 | Seq Scan | 0.04 ms |
| `/api/control-tower/red-flags` | same overview fan-out, then in-memory filter | — | — | — |
| `/api/procurement/delivery-notes` | `Seq Scan on avize` | 5 | Seq Scan | 0.12 ms |
| `/api/attendance` | `Seq Scan on attendance_records` | 32 | Seq Scan | 0.16 ms |

All relation lookups within those plans use indexes; **every statement executes in < 0.2 ms**. No
statement qualifies as a "slow query" — the tables hold between 2 and 461 rows (largest:
`rate_limit_buckets` 461, `audit_logs` 144; `daily_reports` 9).

**Verdict.** No slow queries exist at current volume (sub-millisecond plans over < 500-row tables),
and the connection pool is not a bottleneck (33 of 100 connections; 8 in use). Index coverage is
complete for the hot list filters and all FK/relation joins. The residual risk is **scale**: if
`cost_entries`, `expenses`, `inspections`, `documents` or `ncrs` grow large, the control-tower
overview's `project_id` filters — and the `avize.delivery_date` / `attendance.check_in_time` sorts —
would degrade to full scans. Adding `@@index([project_id])` to those four models and a composite
`[project_id, delivery_date]` to `avize` is the recommended future hardening, but is **not** required
by current data volumes.

---

## Section 4 — Accessibility

### 4.1 Color contrast (computed)

Computed WCAG 2.1 relative-luminance ratios from the token values in `web/src/app/globals.css`
(`:root`) and `web/tailwind.config.js`. Threshold: **4.5:1** normal text, **3:1** large text / UI
components.

| Foreground / background | Ratio | Normal text | Verdict |
| --- | --- | --- | --- |
| success badge pair | 6.78 | Pass | PASS |
| warning badge pair | 8.15 | Pass | PASS |
| danger badge pair | 6.80 | Pass | PASS |
| info badge pair | 7.15 | Pass | PASS |
| slate-900 on white | 17.85 | Pass | PASS |
| slate-800 on white | 14.63 | Pass | PASS |
| slate-700 on white | 10.35 | Pass | PASS |
| slate-600 on white | 7.58 | Pass | PASS |
| slate-500 on white | 4.76 | Pass | PASS |
| slate-500 on slate-50 | 4.55 | Pass | PASS |
| `hii-text` on surface-muted | 17.06 | Pass | PASS |
| chrome-text on chrome | 16.98 | Pass | PASS |
| sidebar-text on sidebar-bg | 12.02 | Pass | PASS |
| white on `hii-600` | 6.15 | Pass | PASS |
| white on red-600 | 4.83 | Pass | PASS |
| white on `hii-info` | 5.17 | Pass | PASS |
| slate-950 on warning-soft | 18.12 | Pass | PASS |
| slate-500 on slate-100 | 4.34 | **Fail** | FAIL |
| chrome-text-muted on chrome-elevated | 4.06 | **Fail** | FAIL |
| sidebar-text-muted on sidebar-bg | 3.75 | **Fail** | FAIL |
| white on `hii-500` (active tab) | 4.28 | **Fail** | FAIL |
| `text-hii-500` on white | 4.28 | **Fail** | FAIL |
| `text-success` on white | 3.30 | **Fail** | FAIL |
| `text-warning` on white | 3.19 | **Fail** | FAIL |
| slate-400 on white (placeholder/kpi-label/section-title) | 2.56 | **Fail** | FAIL (also <3 UI) |
| slate-400 on slate-50 | 2.45 | **Fail** | FAIL |
| slate-400 on slate-100 | 2.34 | **Fail** | FAIL |
| slate-300 on white (decorative) | 1.48 | **Fail** | FAIL (<3 UI) |
| border `#e2e8f0` on white | 1.23 | Fail | FAIL (<3 UI) |
| slate-300 border on white | 1.48 | Fail | FAIL (<3 UI) |
| white on accent `#f59e0b` | 2.15 | **Fail** | FAIL (<3 UI) |

Primary systemic issue: the **slate-400** family is used for placeholder text, KPI labels and section
titles (2.34–2.56) and the muted shell tokens (chrome-text-muted 4.06, sidebar-text-muted 3.75) fall
just short of 4.5. Semantic `text-success`/`text-warning` used as text on white also fail.

### 4.2 Keyboard navigation & focus management

| Surface | Focus trap | Escape closes | Initial focus | Verdict |
| --- | --- | --- | --- | --- |
| `ui/Modal.tsx` (`useFocusTrap` `:42`, capture-phase keydown `:44-65`) | Yes | Yes | First focusable | PASS |
| `ui/Drawer.tsx` | Yes | Yes | First focusable | PASS |
| `ui/ConfirmDialog.tsx` | Yes | Yes | Confirms button | PASS |
| `features/.../ControlTowerDrilldownDrawer.tsx` (wraps Drawer) | Yes | Yes | First focusable | PASS |
| `components/MoreSheet.tsx` | Yes | Yes | First focusable | PASS |
| `components/Sidebar.tsx` mobile nav | Yes | Yes | First focusable | PASS |
| `ui/DropdownMenu.tsx` | n/a (non-modal) | Yes (Escape `:42-46`) | Trigger stays | PASS (items are real `<button role="menuitem">`) |
| `ui/PhotoUpload.tsx` full-size lightbox `:270-298` (`role="dialog" aria-modal="true"` `:273-275`) | **No** | **No** | **No ref-focus** | **FAIL** |

**Violation:** the `PhotoUpload` lightbox declares `aria-modal="true"` but installs no focus trap, no
ref-focus and no Escape handler — keyboard users can Tab out of the "modal" and cannot dismiss it
with Escape.

### 4.3 Screen reader / ARIA

**a) Control labeling.** Many inputs/selects rely on a *sibling* `.hii-label` element with no
`htmlFor` and no wrapping `<label>`, so they have **no accessible name**:

| Route / element | Root cause |
| --- | --- |
| `cheltuieli/page.tsx:348-388` (7 controls) | sibling `.hii-label`, no `htmlFor` |
| `teams/page.tsx:312-323`, `:405-411` | sibling `.hii-label`, no `htmlFor` |
| `issues/page.tsx:360,366,372` | sibling `.hii-label` (labels at `:359,365,371`), no `htmlFor` |
| `stocuri/page.tsx:353,360,365,373` | sibling `.hii-label` (labels at `:352,359,364,372`), no `htmlFor` |
| `projects/page.tsx` wizard (14 controls) | sibling `labelCls` labels, no `htmlFor` |
| `projects/page.tsx:420` search input | no label / `aria-label` (placeholder only) |
| `projects/page.tsx:432` status filter `<select>` | no label / `aria-label` |
| `depozite/page.tsx:101` search input | no label / `aria-label` (placeholder only) |
| `furnizori/page.tsx:102` search input | no label / `aria-label` (placeholder only) |
| `pontaj/page.tsx:395` (and `:537`) month inputs | no label / `aria-label` |
| `rapoarte/page.tsx:227` status filter `<select>` | no label / `aria-label` (search input `:225` is fine) |
| `utilizatori/page.tsx:173-188` | wrapping `<label>` contains only an icon → empty name; selects `:179,183,222,234` unlabeled |

**Good** (have `htmlFor`): activity, aprobare, documente, profil, signup. **Good** (`aria-label`
present): `avize/page.tsx:142`; `aprobare/page.tsx:142,213`; `projects/[id]/page.tsx:333,338,372`;
`teams/page.tsx:329,331`; `GlobalQuickSearch.tsx:54,85`; `ThemeContext.tsx:78`;
`workforce/page.tsx:186,311-378`; `stocuri/page.tsx:200,284`; `rapoarte/page.tsx:225`;
`tasks/page.tsx:471`.

**b) Icon-only buttons without an accessible name:**

| Location | Element |
| --- | --- |
| `components/ui/Toast.tsx:102-107` | close button (`p-0.5`), no `aria-label` |
| `projects/page.tsx:341` | X remove member, no `aria-label` |
| `projects/page.tsx:427` | X clear search, no `aria-label` |
| `projects/page.tsx:521` | X wizard close, no `aria-label` |

`Modal.tsx:99-105` close (`aria-label="Inchide"`) and the `workforce`/`teams`/`aprobar`/`documente`
icon buttons carry labels and are **not** violations.

**c) Images.** Two `<img>` in `PhotoUpload.tsx` (`:239`, `:288`) and one in `activity/page.tsx:369`
all carry `alt` — **PASS**.

**d) Live regions.** The `Toast` container (`Toast.tsx:85-110`) has **no** `role="status"` /
`aria-live`, so toast text is not announced. Elsewhere live regions exist (`WorkerDashboard.tsx:156`,
`qa/page.tsx:102,122`, `tasks/page.tsx:478`, `QualityWorkspace.tsx:118`,
`AttendanceSessionDrawer.tsx:146`) and form errors use `role="alert"` consistently
(`Input.tsx:47`, `IssueCreateModal.tsx:86`, `AvizCreateModal.tsx:146`, etc.).

### 4.4 Semantic structure / headings

| Component | Element | Verdict |
| --- | --- | --- |
| `ui/PageHeader.tsx:64` | `<h1>` | PASS |
| `PageTutorial.tsx:50` | `<h2>` | PASS |
| `ui/EmptyState.tsx:68` | `<h3>` | PASS |
| `ui/ErrorState.tsx:43` | `<h3>` | PASS |

Heading primitives are semantically correct and ordered.

### 4.5 Touch targets

WCAG 2.5.5 target is **44×44 px** (`h-11`/`w-11` = 44 px, `h-10` = 40 px). Elements that visually
render below 44 px based on their classes:

| Element | Rendered size | Verdict |
| --- | --- | --- |
| `Toast.tsx:102` close (`p-0.5` + 16 px icon) | ≈17 px | FAIL |
| `projects/page.tsx:341` X remove member (`p-1` + 14 px) | ≈22 px | FAIL |
| `projects/page.tsx:427` X clear search (16 px icon, no padding) | ≈16 px | FAIL |
| `projects/page.tsx:521` X wizard close (`p-1` + 20 px) | ≈28 px | FAIL |
| `PhotoUpload.tsx:258` delete (`h-7 w-7`) | 28 px | FAIL |
| `Button` size `sm` (`px-3 py-1.5 text-xs`) | ≈30 px tall | FAIL |
| `Button` size `icon` (`w-9 h-9`) | 36 px | FAIL |
| `Modal.tsx:99` close (`p-1.5` + 20 px) | 32 px | FAIL |
| `DropdownMenu` items (`px-3 py-2 text-sm`) | ≈36 px tall | FAIL |
| `Pagination.tsx:57-82` Prev/Next (`size="sm"`) | ≈30 px tall | FAIL |
| `Header.tsx:166-182` camera / bell / avatar (`h-10 w-10`) | 40 px | Borderline FAIL |
| `projects/[id]/page.tsx:381` remove (`min-h-10 min-w-10`) | 40 px | Borderline FAIL |

Primitives that **meet** 44 px: `quality`/`QualityWorkspace` action buttons (`min-h-11`),
`projects/[id]` add-member controls (`min-h-10` = 40 px, still short). See §4.3 for the missing
accessible names on the same icon buttons.

### Accessibility blockers (top 10)

1. `PhotoUpload` lightbox is `aria-modal="true"` with **no focus trap, no ref-focus, no Escape** (`PhotoUpload.tsx:270-298`).
2. Dozens of inputs/selects have **no accessible name** — sibling `.hii-label` without `htmlFor` (cheltuieli, teams, issues, stocuri, projects wizard).
3. Search inputs on `projects:420`, `depozite:101`, `furnizori:102` and month inputs on `pontaj:395,537` are unlabeled.
4. `utilizatori:173-188` wrapping label contains only an icon → empty accessible name; several selects unlabeled.
5. `Toast` container has **no `aria-live`/`role="status"`** (`Toast.tsx:85-110`) — toasts are silent to screen readers.
6. `Toast` close button has **no `aria-label`** and is ≈17 px (`Toast.tsx:102-107`).
7. Icon-only close/clear/remove buttons lack `aria-label` (`projects:341,427,521`).
8. Low-contrast muted tokens: slate-400 placeholder/label text (2.34–2.56), chrome-text-muted (4.06), sidebar-text-muted (3.75).
9. Interactive targets below 44 px across `Button` `sm`/`icon`, `Modal` close, `DropdownMenu` items, `Pagination`, `PhotoUpload` delete.
10. `text-success` (3.30) and `text-warning` (3.19) used as body/status text on white fail 4.5:1.

### Section 4 inconclusive notes

- Contrast ratios are **computed from token hex values**, not sampled from a rendered page; gradient
  or opacity-composited surfaces (`accent`, overlay chips) may differ.
- Touch-target sizes are derived from Tailwind classes (`h-*`/`w-*`/`p-*`); real rendered heights
  depend on line-height and font metrics and should be confirmed in a browser.
- This section covers the shared primitives and the routes cited in Section 2; a full per-route
  axe-core run was not possible (no headless browser installed).
