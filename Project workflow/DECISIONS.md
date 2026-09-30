# Architecture & Technical Decisions

Last Updated: 2026-09-30 (DEC-012 added)

Record decisions that future developers and AI assistants need to understand.
Unless noted, decisions below are inferred from repository contents (code + docs) on 2026-09-18.

# DEC-001 — Monorepo with npm workspaces
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Share the domain model across web, mobile, and server-side tests without copy-paste or version skew.

## Decision
Use npm workspaces (`shared`, `web`, `Mobile`) with `@solar/shared` as the single domain/types/i18n package; `shared` is compiled to `dist` and consumed by both clients.

## Reason
One source of truth for types/calculations; easier cross-client consistency; trivial `npm install`-driven setup.

## Alternatives Considered
- A published private package — rejected: no registry needed for a private project.
- Duplicated logic per client — rejected: type drift.

## Consequences
### Positive
Single domain model; i18n and tutorials reused across web + mobile.
### Negative
`shared/dist` must exist before web/mobile builds; forgetting the build step breaks clients.

## Affected Areas
`shared/`, `web/`, `Mobile/`, all builds.

# DEC-002 — Supabase as the backend (Postgres + RLS + Edge Functions)
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Need auth, Postgres integrity, authorization, storage, and server-side code without running a custom backend.

## Decision
Use Supabase: schema + RLS in `supabase/migrations/*.sql` (plus `full_setup.sql`), Supabase Auth, a private storage bucket for expense documents, and Deno Edge Functions for the OCR proxy.

## Reason
Policy enforcement in the database (RLS + triggers) beats trusting clients; fast time-to-market.

## Alternatives Considered
- Self-hosted Postgres + custom API — rejected: more ops for a small team.
- Firebase — rejected: weaker SQL/joins and reporting.

## Consequences
### Positive
RLS enforces authorization server-side; triggers guarantee stock integrity and notifications.
### Negative
Client-heavy architecture; several web pages carry SQL-shaped logic in TSX; Supabase upgrades need care.

## Affected Areas
Every workspace; deployment (see CONFIGURATION.md).

# DEC-003 — Self-hosted PaddleOCR instead of Google Cloud Vision
**Date:** (as evidenced) 2026
**Status:** ACCEPTED (migration complete in code; docs cleanup pending — ISSUE-003/004)

## Context
Receipt/invoice OCR must handle Romanian documents, run privately, and avoid per-call cloud fees/latency and data-export concerns.

## Decision
Run a private FastAPI service (`ocr-service/`) with PaddleOCR 3.x (PP-OCRv6) and a Romanian/e-Factura-focused parser + validation; the Supabase Edge Function `ocr-extract` proxies authenticated uploads.

## Reason
Full control over parsing quality; private processing; supersedes the earlier Google Cloud Vision design still referenced in `Mobile/.env.example` and `extract.ts`.

## Alternatives Considered
- Google Cloud Vision (original design; `extract.ts`) — superseded.
- Cloud OCR APIs (Azure/ABBYY) — rejected: cost + data residency concerns.

## Consequences
### Positive
Low marginal cost; Romanian-specific normalization; XML (e-Factura) support.
### Negative
Ops burden of running Paddle (GPU/CPU tuning); Windows install fragility; leftover legacy references to clean up.

## Affected Areas
`supabase/functions/ocr-extract/`, `ocr-service/`, `Mobile/.env.example`, expense screens.

# DEC-004 — Romanian-first UI with an EN fallback
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Primary users are Romanian site teams; supervisors/management may prefer English.

## Decision
Default `'ro'` locale with `en` fallback via `@solar/shared` `translations.ts`/`i18n.ts` (contextual i18n); UI copy written in Romanian.

## Reason
Market reality + minimal cost of a second language through the shared layer.

## Consequences
### Positive
Consistent copy across web/mobile.
### Negative
New strings must be added in two languages.

## Affected Areas
`shared/src/translations.ts`, `shared/src/i18n.ts`, all screens/pages.

# DEC-005 — Offline-first mobile with an idempotency-keyed queue
**Date:** (as evidenced) 2026
**Status:** ACCEPTED (partial implementation — see ISSUE-005)

## Context
Sites are often in low-connectivity areas.

## Decision
Mobile persists an offline action queue (`Mobile/src/services/storage.ts`) keyed by generated UUIDs; `syncOfflineQueue()` replays pending actions when online.

## Reason
Required for realistic field use.

## Consequences
### Positive
Attendance remains usable offline.
### Negative
Two flows (expense/delivery) currently simulate success without real persistence — see ISSUE-005.

## Affected Areas
`Mobile/src/services/storage.ts`, `Mobile/src/screens/*`.

# DEC-006 — Notification center with per-user settings
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Many business events (reports, deliveries, stock, applications) need role-based visibility.

## Decision
Generic `notifications` + `notification_settings` tables populated by `create_notification()` calls and DB triggers; unread/read state; per-user opt-in settings.

## Consequences
### Positive
One mechanism for every event type.
### Negative
Trigger SQL must stay in sync with business rules.

## Affected Areas
`supabase/migrations/05*`, web `/notificari`, mobile notification center.

# DEC-007 — Database-enforced stock integrity
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Stock must never go negative, and stock writes must be auditable.

## Decision
Reject negative `site_stock.quantity` at the DB level (integrity trigger), record every change in `stock_movements`, and raise low-stock alerts via trigger.

## Consequences
### Positive
Correctness guaranteed regardless of client.
### Negative
Additional SQL surface to test.

## Affected Areas
`supabase/migrations/01*`, `supabase/migrations/04*`, `web/src/app/stocuri`.

# DEC-008 — Security by design (RLS + private bucket + no client secrets)
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Multi-role system handling expenses and documents.

## Decision
All tables RLS-protected with shared predicates (`public.is_manager_or_admin()`, etc.); expense documents live in a private storage bucket; OCR runs server-side; clients hold only anon/publishable keys; `ocr-extract` verifies the caller JWT.

## Consequences
### Positive
Authorization enforced in the DB; no service-role keys in clients.
### Negative
RLS misconfigurations surface at runtime, not compile time — needs a live audit (NFR-002).

## Affected Areas
All migrations, web supabase client, Edge Function.

# DEC-009 — Web client-heavy (Next.js + Supabase SDK)
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
Fast delivery; a dedicated API layer was not desired.

## Decision
Next.js App Router pages query Supabase directly through the SDK, with RLS as the safety net.

## Consequences
### Positive
Rapid development; reuse of `shared` types.
### Negative
Business queries live in TSX (e.g., dashboard aggregates) — spot for drift (see ISSUE-001).

## Affected Areas
`web/src/app/*`.

# DEC-010 — Validation-first OCR review loop
**Date:** (as evidenced) 2026
**Status:** ACCEPTED

## Context
OCR output must be trustworthy before it becomes an expense.

## Decision
Pipeline = recognize → normalize (RO rules, CUI checksum, amount/date parsing) → validate totals → flag low-confidence fields → human review (`review_required`, `document_state: needs_review`) → confirm → post.

## Consequences
### Positive
Guards against OCR errors before money moves.
### Negative
Every scan needs at least a confirmation step.

## Affected Areas
`ocr-service/app/*`, Edge Function, `/cheltuieli` review flow.

# DEC-011 — OpenConstructionERP as UI/UX pattern reference only
**Date:** 2026-09-27
**Status:** ACCEPTED

## Context
The HIIEKO UI needs design-system cohesion. The project `datadrivenconstruction/OpenConstructionERP` (AGPL-3.0) has been cited as a visual/structure reference in earlier work (ConfirmDialog, Modal, Button patterns). We must adopt its interaction and layout patterns without importing its AGPL-3.0 code.

## Decision
Use OpenConstructionERP as a **pattern reference only**:
- Visual language, component APIs, interaction/a11y patterns, shell layout (sidebar + header + page shell) may be **re-implemented in HIIEKO-owned components**.
- **No source files from OpenConstructionERP may be copied verbatim** into the HIIEKO tree.
- AGPL-3.0 does not contaminate patterns / APIs / layouts re-implemented independently — these are not derivative works of the original.

## Reason
Pattern re-implementation is the only legally safe path without a commercial licence. HIIEKO's brand (`hii-*` green palette, Inter font, `@solar/shared` i18n) is already distinct and must be preserved per the roadmap.

## Alternatives Considered
- Buy commercial licence from OpenConstructionERP — rejected: no procurement process in place; also unnecessary if we only re-implement patterns.
- In-house-only design — rejected: OCE provides a battle-tested reference that reduces design churn.

## Consequences
### Positive
- Legally safe; brand stays HIIEKO.
- Re-implemented components are smaller, simpler, and match our stack (Next.js App Router vs Vite + react-router).
- `DESIGN_SYSTEM.md` captures the mapping so the team knows what is "inspired by OCE" vs "HIIEKO-original".

### Negative
- No direct CSS or component copy-paste from OCE — each pattern costs 10–60 minutes to re-implement.
- Some OCE design patterns (ag-Grid, Three.js maps) are out of scope for HIIEKO's stack.

## Affected Areas
`web/src/components/ui/*`, `web/tailwind.config.js`, `web/src/app/globals.css`, `Project workflow/DESIGN_SYSTEM.md`.

---

# DEC-012 — Fixed dark chrome + accent/positive palette (Phase 1 shell + Worker "My Day")
**Date:** 2026-09-30
**Status:** ACCEPTED

## Context
The approved Phase 1 visual direction (`HIIEKO_FRONTEND_MASTER_SPEC.md` + the three Figma exports) paints
the navigation shell dark navy with an amber accent and a green-mint "positive" state, while
`DESIGN_SYSTEM.md` still described a light shell with the brand green as the product primary
(`bg-slate-900` sidebar, `h-16` white header, `hii-500` primary). A reader of the design system would
conclude the chrome must stay light while the emitted UI is navy + amber — the doc/UI drift recorded as
**ISSUE-060**. A decision record is required so future work can tell a deliberate fixed palette from a
theme that a user (or an OS setting) may switch.

## Decision
1. **The dark chrome is fixed branding, not a theme.** Tailwind `darkMode` stays `off`, **no `dark:`
   utility exists anywhere in `web/src`**, there is no `prefers-color-scheme` rule, no user-facing theme
   toggle and no per-role/per-page chrome variant. The palette is reached exclusively through explicit
   tokens (`--hii-chrome*`, `--hii-accent*`, `--hii-positive*`, `--hii-shell-content-bg`) exposed as
   semantic Tailwind aliases (`bg-chrome`, `text-chrome-text`, `bg-accent`, `bg-positive`, …). A rollback
   to a light chrome is therefore a token/class change, never a theme switch.
2. **Shell chrome = `#111827` navy** (`--hii-chrome`, Tailwind `chrome`); elevated surface `#374151`
   (`--hii-chrome-elevated`, the `< lg` project band); hover `#1F2937`; border `#1F2937`; text `#F9FAFB`;
   muted text `#9CA3AF`.
3. **HIIEKO accent = `#F59E0B`** (`--hii-accent`), the shell **and** Worker "My Day" accent: active nav
   pill, primary/check-in action, the `IN_PROGRESS` 4 px status bar, the progress fill below 100 %, and
   the focus ring on dark chrome. Hover/darker text `#D97706` (`--hii-accent-hover`, AA on white),
   soft/tile `#FEF3C7` / `#FEF9E3`, ink on an accent fill `#111827` (`--hii-accent-text`).
4. **Positive/success on the new surfaces = `#49C89E`** (`--hii-positive`, soft `#DAF8E9`): completed
   state — a 100 % progress fill and the `COMPLETED` / `VERIFIED` status bar.
5. **Brand green and the semantic status palette are unchanged.** `hii-500/600` stays the content
   primary and `--hii-success #16A34A` / `--hii-warning #D97706` / `--hii-critical #DC2626` /
   `--hii-info #2563EB` keep their §1 rows and their badge mappings on data surfaces; the accent/positive
   pair does not replace them outside the shell chrome and the My Day surface.
6. **Scope = Phase 1 only:** the shell (`AppShell`, `Header`, `Sidebar`, `components/shell/*`) and the
   worker "My Day" surface (`WorkerMyDay`, `components/worker/*`). Every other page keeps its current
   light content layout and its existing tokens; no other role's surface is re-tinted. Page-by-page
   adoption continues to be tracked in `DESIGN_SYSTEM.md` §8.

## Reason
The chrome is a brand frame, not a user preference: it must look identical for every role, on every page,
regardless of OS settings, and it must not imply that a second full palette exists. Writing the rule down
closes ISSUE-060 (design-system text contradicting the emitted UI) without rewriting the verified
content-surface palette.

## Alternatives Considered
- **Implement the chrome as Tailwind dark mode** — rejected: it implies a user-selectable theme, would
  require a `dark:` variant sweep over 25 routes plus a second palette layer (and a new a11y contrast
  pass) for a frame that is never user-switchable.
- **Keep `DESIGN_SYSTEM.md` light and treat the chrome as an undocumented exception** — rejected: that is
  exactly ISSUE-060; the next contributor would re-derive the wrong rule.
- **Replace brand green with the amber accent everywhere** — rejected: content surfaces are verified
  against the green primary, and `#F59E0B` fails AA as text on white (the darker `#D97706` exists for
  that). Two roles ⇒ two token families, each with its documented surface.

## Consequences
### Positive
- Documentation matches the emitted UI; ISSUE-060 can be closed instead of re-opened by the next reader.
- The chrome/adoption contract is explicit: a future dark or light re-tint is a token edit plus a new DEC,
  and "no dark mode" can no longer be mistaken for an oversight.
- The accent-on-chrome focus ring keeps keyboard focus visible on the dark surfaces (a11y).
### Negative
- Two palettes coexist on screen (green content primary; navy + amber chrome), so every new page must
  state which one it uses — the adoption tracker is now load-bearing, not decorative.
- `DESIGN_SYSTEM.md` §1/§3 values changed (the pre-Phase-1 values are kept in the §3 history note).

## Affected Areas
`web/src/app/globals.css`, `web/tailwind.config.js`, `web/src/components/{AppShell,Header,Sidebar}.tsx`,
`web/src/components/shell/*`, `web/src/components/worker/*`, `web/src/components/WorkerMyDay.tsx`,
`Project workflow/DESIGN_SYSTEM.md`, `Project workflow/ISSUES.md` (ISSUE-060).

---

# Superseded Decisions
Never silently delete old decisions. Mark them SUPERSEDED.

| Old Decision | Replaced By | Date |
|---|---|---|
| Google Cloud Vision as OCR provider (in `extract.ts`, `Mobile/.env.example`) | DEC-003 (PaddleOCR) | 2026 (code); docs cleanup pending |
