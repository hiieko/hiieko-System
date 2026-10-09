# HIIEKO Design System

> Single source of truth for the HIIEKO web UI.
> **Not a parallel roadmap or PM document.** This file records tokens, component contracts, layout rules, a11y rules, and the page-adoption tracker.
>
> Design reference: **OpenConstructionERP** (`datadrivenconstruction/OpenConstructionERP`) — pattern re-implementation only (see DEC-011).
>
> Fixed dark chrome (navy `#111827`), the `#F59E0B` accent and the `#49C89E` positive state are a
> **product decision, not a theme** — Tailwind `darkMode` stays `off`, no `dark:` utility exists and there
> is no user-facing theme switch (see **DEC-012**).

---

## 1. Token Reference

| Category | OCE concept | HIIEKO token | CSS variable / Tailwind class | Notes |
|---|---|---|---|---|
| Primary | brand green | `hii-500` | `--hii-brand: #188C51` | WCAG AA fail on white (4.28:1); use `hii-600` for text-on-white |
| Primary hover | — | `hii-600` | `--hii-brand-hover: #0f7040` | WCAG AA pass on white (6.15:1) |
| Surface | card bg | `surface` | `--hii-surface: #fff` | |
| Surface muted | page bg | `surface-muted` | `--hii-surface-muted: #f8fafc` | |
| Surface alt | hover rows | `surface-alt` | `--hii-surface-alt: #f1f5f9` | |
| Border | — | `border` | `--hii-border: #e2e8f0` | |
| Border light | — | `border-light` | `--hii-border-light: #f1f5f9` | |
| Text primary | — | `text` | `--hii-text: #0f172a` | |
| Text secondary | — | `text-secondary` | `--hii-text-secondary: #475569` | |
| Text muted | — | `text-muted` | `--hii-text-muted: #94a3b8` | |
| Success | green | `success` | `--hii-success: #16a34a` | badge soft: `emerald-100/800` |
| Warning | amber | `warning` | `--hii-warning: #d97706` | badge soft: `amber-100/800` |
| Critical | red | `critical` | `--hii-critical: #dc2626` | badge soft: `red-100/800` |
| Info | blue | `info` | `--hii-info: #2563eb` | badge soft: `blue-100/800` |
| Neutral | — | `neutral` | `--hii-text-muted` | badge soft: `slate-100/700` |

### 1.1 Chrome / accent / positive — Phase 1 shell + Worker "My Day" (DEC-012)

*Fixed branding, **not** a theme: `darkMode` stays `off`, no `dark:` utility exists, and these values are
reached only through the semantic aliases below — never through a media query, a user toggle or a
per-role/per-page variant. A re-tint is a token/class change plus a new DEC.*

| Role | HIIEKO token | CSS variable | Value | Used for |
|---|---|---|---|---|
| Shell chrome | `chrome` | `--hii-chrome` | `#111827` navy | `≥ lg` rail, `< lg` 56 px top bar |
| Chrome elevated | `chrome-elevated` | `--hii-chrome-elevated` | `#374151` | `< lg` 44 px project band |
| Chrome hover | `chrome-hover` | `--hii-chrome-hover` | `#1F2937` | nav / user-menu / icon hover on chrome |
| Chrome border | `chrome-line` | `--hii-chrome-border` | `#1F2937` | hairline between bar and band, rail edge |
| Chrome text | `chrome-text` | `--hii-chrome-text` | `#F9FAFB` | primary text + icons on chrome |
| Chrome text muted | `chrome-muted` | `--hii-chrome-text-muted` | `#9CA3AF` | secondary text + icons on chrome |
| Accent (shell + My Day) | `accent` | `--hii-accent` | `#F59E0B` | active nav pill, primary/check-in action, `IN_PROGRESS` status bar, progress fill `< 100 %`, focus ring on chrome |
| Accent hover | `accent-hover` | `--hii-accent-hover` | `#D97706` | hover + dark accent glyph/text on white (AA) |
| Accent soft / tile | `accent-soft`, `accent-tile` | `--hii-accent-soft` `#FEF3C7`, `--hii-accent-tile` `#FEF9E3` | — | hover wash / icon tile behind an accent glyph |
| Accent ink | `accent-ink` | `--hii-accent-text` | `#111827` | text on an accent-filled surface |
| Positive | `positive` | `--hii-positive` | `#49C89E` | completed state on the new surfaces (`100 %` progress fill, `COMPLETED`/`VERIFIED` status bar) |
| Positive soft | `positive-soft` | `--hii-positive-soft` | `#DAF8E9` | soft background of the completed state |
| Content canvas | `hii-shell-canvas` | `--hii-shell-content-bg` | `#F3F4F6` | page background behind the shell chrome |

**Green stays the content primary.** `hii-500`/`hii-600` and the semantic status palette
(`--hii-success` `#16A34A`, `--hii-warning` `#D97706`, `--hii-critical` `#DC2626`, `--hii-info` `#2563EB`)
keep their rows above and stay the colours of content surfaces and badges; the accent/positive pair is
scoped to the shell chrome and the worker "My Day" surface (DEC-012 §3–§6).

### Fonts
- **UI:** `Inter` (400/500/600/700/800/900) via Google Fonts import
- **Mono:** `JetBrains Mono`, `Fira Code`, system fallbacks

### Spacing
- CSS vars: `--hii-space-{1,2,3,4,5,6,8,10,12}` (0.25rem – 3rem)
- Extended: `18` (4.5rem), `88` (22rem)

### Radius
- `xs: 0.25rem`, `sm: 0.375rem`, `md: 0.5rem`, `lg: 0.625rem`, `xl: 0.75rem`, `2xl: 1rem`

### Shadows
- `card: 0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)`
- `card-hover: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 2px 6px -1px rgb(0 0 0 / 0.08)`
- `elevated: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.1)`

### Z-index ladder
| Layer | Value | Components |
|---|---|---|
| base | auto | page content |
| sticky | 10 | sticky headers |
| sidebar | 30 | Sidebar |
| header | 40 | Header |
| backdrop | 50 | modal/drawer backdrops |
| drawer | 60 | mobile drawer, DropdownMenu |
| modal | 70 | Modal, ConfirmDialog |
| toast | 80 | Toast notifications |

---

## 2. Component Inventory

### 2.1 Present (13 components in `web/src/components/ui/`)

| Component | Status | Import path | Notes |
|---|---|---|---|
| `Button` | ✅ Stable | `@/components/ui` | `primary/secondary/danger/ghost/outline`, `sm/md/lg/icon`, `loading`, `iconPosition` |
| `Card` + subcomponents | ✅ Stable | `@/components/ui` | `CardHeader/CardContent/CardFooter` |
| `Badge` | ✅ Stable | `@/components/ui` | `default/success/warning/danger/info/neutral`, `sm/md`, `dot` |
| `Skeleton` | ✅ Stable | `@/components/ui` | includes `TableRowSkeleton` |
| `EmptyState` | ✅ Stable | `@/components/ui` | single/dual action |
| `ErrorState` | ✅ Stable | `@/components/ui` | retry callback |
| `PageHeader` | ✅ Stable | `@/components/ui` | `eyebrow/icon/title/subtitle/backHref/onBack/onRefresh/refreshing/actions` |
| `ToastProvider` / `useToast` | ⚠️ NOT MOUNTED | `@/components/ui` | **P0:** must be mounted in AppShell; see ISSUE-036 |
| `Modal` | ✅ Stable | `@/components/ui` | `sm/md/lg/xl/full`, focus trap, Escape close |
| `LoadingSpinner` | ✅ Stable | `@/components/ui` | |
| `Tabs` | ✅ Stable | `@/components/ui` | |
| `ConfirmDialog` | ✅ Stable | `@/components/ui` | `danger/warning/info`, `ConfirmDialogProps` exported |

#### 2.1.1 Phase 1 shell + Worker "My Day" surfaces (2026-09-30)

| Component | Status | Import path | Notes |
|---|---|---|---|
| `ShellBrand` | ✅ Added | `@/components/shell` | brand lockup, `rail` / `compact` sizes (the `< lg` bar and the drawer both link home) |
| `ProjectContextChip` | ✅ Added | `@/components/shell` | `header` (white bar, `Current project` block) and `band` (`#374151` 44 px band) variants; real selected project only |
| `ShellNotificationsButton` | ✅ Added | `@/components/shell` | real unread `total`, session-memoised so the two breakpoint mounts issue one request |
| `PageContainer` | ✅ Added | `@/components/shell` | `.hii-page` wrapper used by every page shell |
| `WorkerTaskCard` | ✅ Added | `@/components/worker` | 4 px status bar (accent / critical / positive, §4), real `actual/target unit`, per-task `%`, completion checkbox only when the backend write is accepted |
| `WorkerMyDayTasks` | ✅ Added | `@/components/worker` | open plan tasks of the day; `{done}/{total} completed` subtitle |
| `WorkerProgressCard` | ✅ Added | `@/components/worker` | `%` + `{done} of {total} tasks completed` + one *Reported quantity* row **per unit of measure** (never a cross-unit total) |
| `WorkerActionsRequired` | ✅ Added | `@/components/worker` | real open/blocked counts + today's site daily report state; `no access` / unavailable states are fail-closed |
| `WorkerBlockerList` | ✅ Added | `@/components/worker` | real open issues of the selected project (capped), plus role/unavailable states |

#### 2.1.2 Phase 3 — Daily Planning supervisor day surface (2026-09-30)

`/planning` "Plans" view only. Visual reference: `design/figma/daily-planning.png`; contract rules:
**DEC-013**. No new dependency, no token change — these components compose the existing library (11 files
of the route's implementation now import from `@/components/ui`).

| Component | Status | Import path | Notes |
|---|---|---|---|
| `PlanningCounters` | ✅ Added | `@/features/planning` | 5 independent, non-exclusive counters (`PLANNED` / `ASSIGNED` / `IN PROGRESS` / `COMPLETED` / `BLOCKED`), each with its exact predicate in `aria-label` + `title`; non-interactive (facts, not filters); the band states that the counts overlap |
| `PlanTaskTable` | ✅ Added | `@/features/planning` | one section per plan (plan-aware), ARIA table semantics on a responsive CSS grid (stacked `< sm`, 6 columns `≥ sm` → no horizontal overflow at 375 px), expandable rows that reuse `PlanTaskRow` |
| `PlanTaskFilters` | ✅ Added | `@/features/planning` | exclusive task filters + search, separate from `PlanningStatusChips` (which keeps filtering **plans**); 44 px targets |
| `SiteReadinessCard` | ✅ Added | `@/features/planning` | real `attendance` / `stock` / `issues` reads, per-row "Unavailable" on failure, no score; states that attendance+stock are live (today) figures when another date is shown |
| `AttentionRequiredCard` | ✅ Added | `@/features/planning` | blocked plan tasks, active blocker issues, unassigned tasks — real rows only, capped with a real "+N more" |
| `PlanningFooterSummary` | ✅ Added | `@/features/planning` | planned / assigned / blocked counts (same predicates as the band) + the date the table belongs to |
| `dayDerivations.ts` | ✅ Added | `@/features/planning` | pure day model: counters, filters, row content, attention items, `formatPlanDate` (normalizes the ISO `plan_date`) |
| `readinessReads.ts` | ✅ Added | `@/features/planning` | role-gated, fail-closed reads for the rail + the Control Tower low-stock rule |

### 2.2 Planned (Phase D4)

*To be populated as components are adopted into the UI library.*

---

## 3. Shell / Layout Contract

| Rule | Value |
|---|---|
| Sidebar desktop width | `w-[var(--hii-sidebar-width)]` = 16rem |
| Sidebar collapsed width | (future: 4.5rem, icon-only) |
| Shell chrome background | `hii-shell-chrome` → `--hii-chrome` `#111827` navy (rail + `< lg` bar; DEC-012) |
| Active nav item | accent pill (`bg-accent`, `text-accent-ink`) — brand green is content-only now |
| Project band (`< lg`) | `hii-shell-band` → `--hii-chrome-elevated` `#374151`, 44 px (`h-11`), inside the same `<header>` as the 56 px (`h-14`) navy bar → 101 px measured |
| Header height | `--hii-header-height` = 4.5rem (**72 px**), measured 72 px at 1440 px |
| Header background | `bg-white`, `border-b border-slate-200`, `sticky top-0 z-header` (40) |
| Content canvas | `hii-shell-canvas` → `--hii-shell-content-bg` `#F3F4F6` on body + shell + `<main>` |
| Page container | `.hii-page` → `max-w-7xl mx-auto px-4/6/8 py-6/8` |
| Mobile drawer | `w-72`, `z-drawer` (60), backdrop `z-backdrop` (50), transform slide; the **closed** drawer stays in the DOM off-canvas (`-translate-x-full`) — same behaviour as before Phase 1 |
| Toast mount | AppShell (inside AuthGuard, above `<main>`) |
| Skip link | `#main-content` target, hidden until focused, `bg-accent text-accent-ink` on the chrome |

**Phase 1 history for this table (2026-09-30):** before Phase 1 the rail was `bg-slate-900`, the header
was `h-16` / `bg-white` / `z-30`, the mobile drawer was `z-50`, and the page background came from each
page. Those values are superseded for the shell and the worker "My Day" surface by DEC-012 §2–§6; every
other page keeps its own (unchanged) light content layout. Measured on the live stack at 375 / 768 /
1440 px: `scrollWidth === innerWidth`, `<main>` `scrollWidth === clientWidth`, navy `#111827`,
band `#374151` 44 px, 72 px header at `≥ lg`, rail visible only at `≥ lg`.

---

## 4. Status → Semantic Mapping

| Domain | Status | Badge variant | CSS token |
|---|---|---|---|
| Project | `DRAFT` | `neutral` | `--hii-text-muted` |
| Project | `PUBLISHED` / `ACTIVE` | `success` | `--hii-success` |
| Project | `CANCELLED` | `danger` | `--hii-critical` |
| Project | `COMPLETED` | `info` | `--hii-info` |
| Approval | `SUBMITTED` | `warning` | `--hii-warning` |
| Approval | `APPROVED` | `success` | `--hii-success` |
| Approval | `REJECTED` | `danger` | `--hii-critical` |
| Task | `TODO` / `OPEN` | `neutral` | `--hii-text-muted` |
| Task | `IN_PROGRESS` | `warning` | `--hii-warning` |
| Task | `COMPLETED` | `success` | `--hii-success` |
| Severity | `LOW` | `neutral` | `--hii-text-muted` |
| Severity | `MEDIUM` | `warning` | `--hii-warning` |
| Severity | `HIGH` / `CRITICAL` | `danger` | `--hii-critical` |

**Task statuses follow `TASK_STATUS_BADGE`** (`web/src/features/tasks/types.ts`): `PLANNED` → `neutral`,
`READY` → `info`, `IN_PROGRESS` → `warning`, `BLOCKED` → `danger`, `COMPLETED`/`VERIFIED` → `success`,
`CANCELLED` → `default`. On the Worker "My Day" task cards the same status additionally drives the 4 px
left status bar: `IN_PROGRESS` → **accent** (`#F59E0B`), `BLOCKED` → **critical**, `COMPLETED`/`VERIFIED`
→ **positive** (`#49C89E`), anything else → transparent (DEC-012 §3–§4). Badges keep the semantic
variants above — the amber badge (`warning`) and the amber status bar (`accent`) are two tokens, not one.

---

## 5. A11y Rules

- **Focus ring:** `outline: 2px solid var(--hii-brand); outline-offset: 2px` on `:focus-visible` (global).
- **Buttons:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hii-500` per component.
- **Escape:** All modals, drawers, and dropdowns close on `Escape` keydown (capture phase).
- **`aria-current="page"`:** Applied to the active nav link in Sidebar.
- **`aria-live`:** Used for loading state changes and toast notifications.
- **`prefers-reduced-motion`:** `scale` and `fade` animations should be suppressed when the user prefers reduced motion.
- **Skip link:** A visually-hidden "Skip to content" link must be the first focusable element in `AppShell`.
- **Contrast:** All text-on-surface combinations must meet WCAG AA (4.5:1 for normal, 3:1 for large). `hii-500` on white fails; `hii-600` on white passes.

---

## 6. i18n Rules

- **DEC-004:** Romanian-first, English fallback.
- Shell nav items, header strings, and breadcrumbs must use `@solar/shared` i18n keys (not hardcoded RO).
- Component labels (aria-label, placeholder, loading text) should accept a prop or use locale context; inline RO strings are allowed as a temporary default but must have a corresponding `t()` path.

### Canonical business vocabulary (UX-R1A C4, RO / EN)

One term per concept, in `shared/src/translations.ts`. Use these labels (or their `t()` key) on every
surface; do not invent a second name for the same route or role.

| Concept | RO | EN | Key(s) |
|---|---|---|---|
| Control Tower | Turn de Control | Control Tower | `nav.control_tower` (never `nav.statistici` — `/statistici` is a C2 redirect) |
| Tasks (concept) | Task-uri | Tasks | `nav.tasks`, `nav.my_tasks`, `task.page_title`, `reports.tasks`, `planning.form_tasks` |
| Daily Plan | Plan Zilnic | Daily Plan | `nav.planning`, `planning.page_title` |
| Attendance | Pontaj & Ore | Attendance | `nav.pontaj`, `attendance.title` |
| Daily Reports | Rapoarte Zilnice | Daily Reports | `nav.rapoarte` |
| Deliveries | Livrări & Avize | Deliveries | `nav.avize` |
| Stock | Materiale & Stoc | Materials & Stock | `nav.stocuri` |
| Expenses | Cheltuieli | Expenses | `nav.cheltuieli` (page title `expenses.title` stays `Cheltuieli Companie`) |
| Approvals | Aprobări | Approvals | `nav.aprobare` |
| Projects | Proiecte | Projects | `nav.projects`, `projects.title` |
| Teams | Echipe | Teams | `nav.teams`, `teams.title` |
| Workforce | Forță de Muncă | Workforce | `nav.workforce`, `workforce.title` (the `Personal` group name is unrelated and unchanged) |
| Issues | Probleme & Blocaje | Issues & Blockers | `nav.issues`, `issues.title` |
| Notifications | Notificări | Notifications | `nav.notificari`, `notifications.title` |
| Users | Utilizatori | Users | `nav.utilizatori`, `users.title` |
| Profile | Profil | Profile | `nav.profil` |

**Roles are vocabulary too (C4):** `role.admin|owner|manager|pm|site_manager|team_leader|foreman|technician|procurement|finance|qa_qc|worker|viewer|site_logistics|maintenance_director|technical_director`
are the only role labels in the repository. Never hardcode a role map in a page/component — call
`getRoleLabel(role, locale)` from `@solar/shared` (it resolves `role.*` through `tPrefix('role.', …)`
and accepts `'TEAM_LEADER'` or `'team_leader'`). Canonical RO examples: `Șef de Echipă`,
`Șef de Șantier`, `Cap de Șantier`, `Vizualizator`, `Proprietar`.

**Diacritics are part of the vocabulary.** `npm run guards:check` reports (report-only) Romanian copy
that is missing them; the list is the R1B work queue. Tokens inside comments, paths and identifiers are
ignored by design.

---

## 7. Do-Not List

- **Do not** import OpenConstructionERP source files into the tree (AGPL-3.0; see DEC-011).
- **Do not** add Radix UI, Headless UI, or any component library dependency — dual-author from OCE patterns.
- **Do not** enable Tailwind dark mode or add any `dark:` utility/`prefers-color-scheme` rule: the navy chrome is **fixed branding, not a theme** (DEC-012). The token layer already has one palette; a second one needs a new decision.
- **Do not** re-tint the shell per page, per role or per user, and do not swap the `#F59E0B` accent or the `#49C89E` positive state for another hue without a new DEC — every page's chrome must look identical.
- **Do not** use the chrome accent/positive tokens as the content primary or as status badge colours: content surfaces keep `hii-500/600` and the semantic `success`/`warning`/`critical`/`info` tokens (DEC-012 §5).
- **Do not** renumber roadmap phases; use `DESIGN_SYSTEM.md` for design-phase labeling, not `PROGRESS.md`.
- **Do not** narrow the Tailwind `content` globs back to a per-folder list (`pages` / `components` /
  `app`): a route's classes do **not** all live beside the route. Feature UI lives in
  `web/src/features/**` (and `src/lib/**`, `src/contexts/**`), and a utility used only there is dropped
  from the emitted stylesheet, so the surface silently renders its base (mobile) classes at `sm`/`lg`
  (ISSUE-063, 2026-09-30). The contract is `./src/**/*.{js,ts,jsx,tsx,mdx}`.

---

## 8. Page Adoption Tracker

*Updated as pages are migrated to use `components/ui` components and semantic tokens.*

| Route | Raw `<button>` | `ui/*` imports | Accents | Phase D assigned | Status |
|---|---|---|---|---|---|
| `/` (dashboard) | 15 | 0 | amber-30, slate-138 | — | ⬜ |
| `/teams` | 19 | 0 | slate-86, hii-25 | — | ⬜ |
| `/workforce` | 13 | 0 | slate-67, hii-19 | — | ⬜ |
| `/cheltuieli` | 7 | 0 | amber-17, slate-62 | — | ⬜ |
| `/planning` | 14 | 11 | slate-179, hii-30, amber-7, emerald-11, red-18 | — | ◐ day surface (2026-09-30) |
| `/aprobare` | 6 | 0 | amber-6 | — | ⬜ |
| `/issues` | 6 | 0 | amber-5, hii-7 | — | ⬜ |
| `/santiere` | 5 | 0 | amber-8, hii-5 | — | ⬜ |
| `/utilizatori` | 5 | 0 | amber-8 | — | ⬜ |
| `/pontaj` | 4 | 0 | amber-16 | — | ⬜ |
| `/tasks` | 4 | 0 | slate-36, hii-9 | — | ⬜ |
| `/rapoarte` | 2 | 0 | amber-8 | — | ⬜ |
| `/projects` | 3 | 9 | hii-20 ✅ | — | ✅ **reference** |
| `/projects/[id]` | 3 | 9 | hii-20 ✅ | — | ✅ **reference** |
| remaining 9 routes | 0–3 | 0 | mostly slate | — | ⬜ |

Legend: `⬜` not adopted · `◐` partially adopted on the surface named in the Status cell · `✅` adopted.
The `/planning` row was re-measured 2026-09-30 across the route's implementation
(`web/src/app/planning/page.tsx` + `web/src/features/planning/**`, .ts and .tsx); the earlier `7 / 0` row
counted the page file alone, so the two numbers are not directly comparable. The day-surface slice
(DEC-013) introduced no new token and no new dependency.

**Emitted-utility contract (fixed 2026-09-30, ISSUE-063).** These rows are measured from source, so they
were unaffected by it — but no design check is trustworthy while the stylesheet never scanned the feature
tree. Until that date `web/tailwind.config.js` listed `./src/pages/**`, `./src/components/**` and
`./src/app/**` only, so `/planning` rendered its **mobile** classes at 1440 px (1 grid track per row, a
`display: none` table header, visible mobile per-cell labels, a 3 + 2 counter band). `content` is now
`./src/**/*.{js,ts,jsx,tsx,mdx}`; the served stylesheet grew by 72 class tokens with **0 removals**.

---

## 9. OCE Pattern Adoption Log

| Pattern | HIIEKO file | OCE inspiration | Date |
|---|---|---|---|
| `ConfirmDialog` | `web/src/components/ui/ConfirmDialog.tsx` | `frontend/src/shared/ui/ConfirmDialog.tsx` | pre-2026-09-27 |
| `Button` forwardRef | `web/src/components/ui/Button.tsx` | `frontend/src/shared/ui/Button.tsx` | pre-2026-09-27 |
| `Modal` focus trap | `web/src/components/ui/Modal.tsx` | `frontend/src/shared/ui/Modal.tsx` | pre-2026-09-27 |
| `EmptyState` dual-action | `web/src/components/ui/EmptyState.tsx` | `frontend/src/shared/ui/EmptyState.tsx` | pre-2026-09-27 |

