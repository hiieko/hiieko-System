# HIIEKO — Full-Stack Audit v2

**Generated:** 2026-10-16
**Scope:** web (Next.js) × backend (NestJS) × Prisma/PostgreSQL — all in-scope routes under `web/src/app/**`.
**Method:** read-only static analysis of route sources (`page.tsx`), shared UI primitives under
`web/src/components`, the design-system tokens in `web/tailwind.config.js` / `src/app/globals.css`,
and the shell (`AppShell`, `PageContainer`). No source file was modified and no process was started.
**Sessions:** Session 1 of 4 (Sections 1–2). Sections 3–10 are appended in later sessions.

---

## Section 1 — Regression Check

**Status: PENDING (requires running backend)**

The regression check re-runs `scripts/audit-functional.ts` against a live backend on
`http://127.0.0.1:4000` and diffs the output against `docs/audit/functional-results.json`
(2026-10-14 baseline) into `docs/audit/functional-results-after-quality-pass.json`.

At the time of Session 1 the backend was **not running** (verified: `Test-NetConnection 127.0.0.1 -Port 4000` → `False`;
`GET /health/live` → connection refused). This section is therefore deferred to a later session.
**No regressions are reported or ruled out here.**

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

**Status: PENDING (requires running backend)**

Profiling p50/p95 latency, slow-query logs and connection-pool behaviour requires a live backend
and database. By session directive no backend process was started (`Test-NetConnection 127.0.0.1 -Port 4000`
→ `False`). Deferred to a later session.

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

**Status: PENDING (requires DB access)**

Index coverage, connection-pool saturation and `EXPLAIN` plans require a live PostgreSQL instance
and `DATABASE_URL` access, which is out of scope for this session by directive. Deferred.

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
