# HIIEKO Design System

> Single source of truth for the HIIEKO web UI.
> **Not a parallel roadmap or PM document.** This file records tokens, component contracts, layout rules, a11y rules, and the page-adoption tracker.
>
> Design reference: **OpenConstructionERP** (`datadrivenconstruction/OpenConstructionERP`) — pattern re-implementation only (see DEC-011).

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
| `PageHeader` | ✅ Stable | `@/components/ui` | `title/subtitle/backHref/onBack/onRefresh/refreshing/actions` |
| `ToastProvider` / `useToast` | ⚠️ NOT MOUNTED | `@/components/ui` | **P0:** must be mounted in AppShell; see ISSUE-036 |
| `Modal` | ✅ Stable | `@/components/ui` | `sm/md/lg/xl/full`, focus trap, Escape close |
| `LoadingSpinner` | ✅ Stable | `@/components/ui` | |
| `Tabs` | ✅ Stable | `@/components/ui` | |
| `ConfirmDialog` | ✅ Stable | `@/components/ui` | `danger/warning/info`, `ConfirmDialogProps` exported |

### 2.2 Planned (Phase D4)

*To be populated as components are adopted into the UI library.*

---

## 3. Shell / Layout Contract

| Rule | Value |
|---|---|
| Sidebar desktop width | `w-64` (16rem) |
| Sidebar collapsed width | (future: 4.5rem, icon-only) |
| Sidebar background | `bg-slate-900` |
| Header height | `h-16` (4rem) |
| Header background | `bg-white`, `border-b border-slate-200`, `sticky top-0 z-30` |
| Page container | `.hii-page` → `max-w-7xl mx-auto px-4/6/8 py-6/8` |
| Mobile sidebar | `w-72`, overlay with backdrop, transform slide, `z-50` |
| Toast mount | AppShell (inside AuthGuard, above `<main>`) |
| Skip link | `#main-content` target, visually hidden until focused |

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
- **Do not** enable Tailwind dark mode without explicit product decision (token layer would need dark palette).
- **Do not** renumber roadmap phases; use `DESIGN_SYSTEM.md` for design-phase labeling, not `PROGRESS.md`.

---

## 8. Page Adoption Tracker

*Updated as pages are migrated to use `components/ui` components and semantic tokens.*

| Route | Raw `<button>` | `ui/*` imports | Accents | Phase D assigned | Status |
|---|---|---|---|---|---|
| `/` (dashboard) | 15 | 0 | amber-30, slate-138 | — | ⬜ |
| `/teams` | 19 | 0 | slate-86, hii-25 | — | ⬜ |
| `/workforce` | 13 | 0 | slate-67, hii-19 | — | ⬜ |
| `/cheltuieli` | 7 | 0 | amber-17, slate-62 | — | ⬜ |
| `/planning` | 7 | 0 | slate-59, hii-5, blue-6 | — | ⬜ |
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

---

## 9. OCE Pattern Adoption Log

| Pattern | HIIEKO file | OCE inspiration | Date |
|---|---|---|---|
| `ConfirmDialog` | `web/src/components/ui/ConfirmDialog.tsx` | `frontend/src/shared/ui/ConfirmDialog.tsx` | pre-2026-09-27 |
| `Button` forwardRef | `web/src/components/ui/Button.tsx` | `frontend/src/shared/ui/Button.tsx` | pre-2026-09-27 |
| `Modal` focus trap | `web/src/components/ui/Modal.tsx` | `frontend/src/shared/ui/Modal.tsx` | pre-2026-09-27 |
| `EmptyState` dual-action | `web/src/components/ui/EmptyState.tsx` | `frontend/src/shared/ui/EmptyState.tsx` | pre-2026-09-27 |

