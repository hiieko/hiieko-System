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
