# Architecture & Technical Decisions

Last Updated: 2026-10-01 (DEC-015 added — Slice 3 company timezone / day boundary, K-9 effective;
DEC-014 added the Slice 2 session/refresh/revocation model, K-4/K-5 effective)

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

# DEC-013 — Daily Planning day surface: supervisor-only frontend enrichment join + independent day counters
**Date:** 2026-09-30
**Status:** ACCEPTED

## Context
The approved Daily Planning design (`design/figma/daily-planning.png`) shows, per plan task of a day, the
responsible people, the work area, the planned start and (sometimes) a description, plus site-level
signals. The verified backend facts are:

- `GET /api/daily-plans?projectId=&date=` (`DailyPlansService.findAll`) selects only
  `{ id, title, code, status, unit_of_measure, planned_quantity }` on `planTask.task` — it carries **no**
  `assignments`, `zone`/`work_package`, `planned_start` or `description`.
- `GET /api/tasks?projectId=` (`TasksService.findAll`) already includes `work_package`, `zone` and
  `assignments.user{ role, profile }` for the whole project and is readable by supervisors.
- `GET /api/attendance/today`, `GET /api/inventory/stock` and `GET /api/issues` are existing project
  reads.
- Several fields in the reference design (crew, priority, blocked reason, equipment, HSE, readiness
  score, "inspections pending") have no column anywhere in the schema.

The daily-plan contract was frozen for this slice, and worker/technician must never read project-wide
data (they use `GET /api/daily-plans/my-tasks` only), so a decision is needed on how the day surface
obtains the missing facts without inventing them.

## Decision
1. **Frontend only.** No backend, Prisma, migration, endpoint, npm dependency or shell change. The
   contract stays as it is.
2. **Enrichment join, supervisor-only.** The missing task facts are joined in the browser by `task_id`
   against the existing `GET /api/tasks?projectId=` list. The join is enrichment: an entry that is absent
   (or a read that failed) degrades to the neutral `—` fallback and never to a guessed value. Field roles
   keep an empty index and never issue that request.
3. **Role-gated project reads.** The join and the readiness reads (`/api/attendance/today`,
   `/api/inventory/stock`, `/api/issues`) are gated by `canReadProjectReadiness` / `isFieldPlanRole`, and
   the readiness rail is not rendered for worker/technician at all.
4. **Counters are independent and non-exclusive**, each labelled with its exact predicate:
   `PLANNED` = `task.status === 'PLANNED'`; `ASSIGNED` = `assignments.length >= 1` (a fact, **never** a
   status); `IN PROGRESS` = `task.status === 'IN_PROGRESS'`; `COMPLETED` = `DailyPlanTask.completed`
   (the day flag, **not** `Task.status`); `BLOCKED` = `task.status === 'BLOCKED'`. The band states that
   the counts overlap, and the exclusive task filters are a separate control.
5. **No mocked fields.** Design fields without a backing column are omitted (crew, priority, blocked
   reason, equipment, HSE, readiness score, inspections pending), and no readiness score/percentage is
   computed because none exists.
6. **Live figures are labelled as such.** Attendance (today-only endpoint) and stock (current balance)
   are presented as live signals and the rail says so whenever the table shows another date.
7. **One low-stock rule.** "Below minimum" reuses the Control Tower predicate
   `current_quantity < (min_stock_threshold || 0)` so the two surfaces cannot disagree.

## Reason
The day surface needs four facts that the day payload deliberately does not carry. Re-deriving them
server-side would change a frozen contract and a verified service; issuing one extra supervisor-only
list read and joining it client-side is provably equivalent (the assertion harness compares every
rendered value with the API payload) and touches no persisted data. Independent counters mirror what the
database actually stores: a plan task can be assigned *and* planned, and "completed" exists twice (the
day flag and the task status), so a partition would be untrue.

## Alternatives Considered
- **Extend `DailyPlansService.findAll` / add a day-summary endpoint** — rejected: frozen contract, and
  the slice is explicitly frontend-only.
- **Fetch `GET /api/tasks/:id` per plan task** — rejected: N requests for one screen.
- **Show only what the plans payload carries** — rejected: the design's core columns (responsible, area,
  planned start) would be blank although the data is one read away.
- **Derive `ASSIGNED` from a task status** — rejected: assignment is not a status; it would fabricate
  work on unassigned tasks.
- **Show the reference design's crew/priority/equipment/HSE/score as static text** — rejected: no column
  exists; that is exactly the "invented data" failure mode this repository forbids.

## Consequences
### Positive
- The supervisor day surface is truthful field-by-field and each value is assertion-checked against the
  API payload it came from.
- Zero schema/API/CI risk: `git diff --stat backend/ prisma/ database/` stays empty.
- The role split is preserved and observable in the network log (worker: my-tasks only, 0 project-wide
  requests).
- Missing enrichment degrades gracefully (`—`) instead of failing the page.

### Negative
- One extra supervisor-only `GET /api/tasks?projectId=` request per day load (parallel, fail-soft), and
  three project reads for the rail.
- Fields the payload does not carry (assignments) appear as `—` for a supervisor whose enrichment read
  fails; the Unassigned filter chip is hidden in that case so it can never claim "0 unassigned".
- The design's omitted fields stay omitted until a schema change is approved separately.

## Affected Areas
- `web/src/features/planning/{dayDerivations,readinessReads}.ts`
- `web/src/features/planning/components/{PlanningCounters,PlanTaskTable,PlanTaskFilters,SiteReadinessCard,AttentionRequiredCard,PlanningFooterSummary}.tsx`
- `web/src/app/planning/page.tsx`, `web/src/features/planning/index.ts`, `shared/src/translations.ts`
- `DESIGN_SYSTEM.md` (§2.1.2 inventory, §8 tracker), `VERIFICATION.md` (evidence), `ISSUES.md` (ISSUE-062)

---

# DEC-014 — Session / refresh / revocation model (Slice 2: K-4 + K-5 become effective)
**Date:** 2026-10-01
**Status:** ACCEPTED

## Context
Slice 1 deliberately kept the 7-day access token, so K-4 (15-minute TTL) and K-5 (refresh rotation /
reuse detection / revocation) were still unimplemented. Closing **SEC-004** required a real session
model that works for a browser (which must survive a 15-minute token) **without** changing the frozen
Mobile client (Decision G), which has no refresh flow at all.

## Decision
- Two additive PostgreSQL tables: **`sessions`** (the revocation unit; its `id` is embedded in the
  access JWT as the `sid` claim) and **`refresh_tokens`** (the rotation ledger).
- The refresh token is **opaque, 256-bit, CSPRNG-generated**; only its **SHA-256 hex** is persisted.
  The raw value exists solely inside the httpOnly `hiieko_rt` cookie (`Path=/api/auth`, `SameSite=Lax`).
- **Web** login (`client: 'web'`) issues a **900 s access token** + one refresh token + the cookie, and
  returns `{ user, accessToken, expiresIn: 900 }`.
- **Legacy** login (no `client`, or any other value) is the **frozen-Mobile compatibility path**: it
  returns the exact Slice 1 body `{ user, accessToken }`, issues a **7-day** access token, sets **no
  cookie** and creates **no** refresh token — but it **does** create a session and embed `sid`, so
  suspension and revocation stay enforceable.
- **Rotation is concurrency-safe by construction**: consumption is a conditional
  `UPDATE … WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`. Exactly one concurrent caller can
  win; every competitor becomes a reuse and revokes the whole session family.
- **Pre-Slice-2 (sid-less) tokens are grandfathered** and simply expire naturally — no forced logout,
  no backfill.
- Revocation points: logout (cookie preferred over Bearer `sid`, idempotent), reuse detection
  (`REFRESH_REUSE_DETECTED`), and **suspension** (`SUSPENDED` revokes every active session; reactivation
  does **not** restore them).
- **CORS** moves from `origin: '*'` to an explicit `CORS_ORIGIN` allowlist with `credentials: true`.
  `SameSite=None` is never introduced in Slice 2.
- All refresh failures answer with one generic **401 `UNAUTHORIZED` / "Session expired or invalid"**.

## Reason
A session row is the smallest unit that makes "log this user out" and "this token leaked" tractable
without a token denylist, and `sid` makes revocation immediate even for an in-flight access token. The
optional `client` discriminator is the only way to give the browser a short TTL while leaving the frozen
Mobile binary byte-for-byte compatible.

## Alternatives Considered
- **Redis / token denylist** — rejected: adds a stateful dependency for data PostgreSQL already models
  (and Slice 7 owns shared/multi-instance hardening).
- **Refresh token in the response body for Mobile too** — rejected: `Mobile/**` is frozen and cannot
  consume it (L17).
- **User-Agent sniffing to detect Mobile** — rejected: fragile and spoofable; an explicit `client`
  field is deterministic (L2).
- **Naive read-then-write rotation** — rejected: two concurrent refreshes would both succeed and
  silently fork the family (L15).
- **Absolute 15-minute TTL for every caller** — rejected: it would break the frozen Mobile client and
  the web client had no refresh (L1/L2).

## Consequences
### Positive
- K-4/K-5 are effective; SEC-004 is closed. Real, auditable logout with immediate effect.
- Reuse of a stolen refresh token revokes the family instead of silently minting a parallel session.
- Zero forced logouts on deploy; the pre-existing 7-day tokens keep working.
- Two new tables are the whole storage cost — no Redis, no Supabase.
### Negative
- **Known limitation (L17):** any caller that omits `client: 'web'` gets the legacy 7-day TTL. This is
  an accepted compatibility constraint created by the frozen Mobile client, not a security control.
- Logout answers 200 even when nothing was revoked (intentional idempotency, L7).
- Single-process rate limiting still applies to `POST /api/auth/refresh` — shared limiting remains
  deferred to Slice 7.
- The CORS allowlist is now explicit, so a new origin (e.g. a LAN tablet) must be added to
  `CORS_ORIGIN` in `backend/.env` before the browser will accept credentialed requests.

## Affected Areas
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261001130000_add_sessions_refresh_tokens/`
- `backend/src/modules/auth/{auth.constants.ts,session.service.ts,auth.service.ts,auth.controller.ts,auth.module.ts}`
- `backend/src/common/auth/{cookies.ts,auth.types.ts,guards/jwt-auth.guard.ts}`
- `backend/src/modules/users/users.service.ts`, `backend/src/main.ts`
- `web/src/lib/api-client.ts`
- `backend/scripts/db-verify.ts`, `backend/test/session-refresh.spec.ts` (+ updated auth specs)
- `REMEDIATION_ROADMAP.md` (§8), `PROGRESS.md`, `VERIFICATION.md`, `ISSUES.md`, `HANDOFF.md`

---

# DEC-015 — Company timezone / day boundary = Europe/Bucharest (Decision C; K‑9 effective) — Slice 3
**Date:** 2026-10-01
**Status:** ACCEPTED (implemented + verified; **UNCOMMITTED, not pushed**)

## Context
Every business calendar day ("today") was derived from the *server/process* UTC clock
(`new Date().toISOString().split('T')[0]`) or from the *browser's device* timezone. Around midnight that
disagrees with the company's working day (Romania, Europe/Bucharest = EET/EEST): attendance check-in/out
could be stamped on the wrong day, `GET /api/attendance/today` could summarise the wrong day, and the
daily-plan day defaults, the Control Tower workforce "today" and the web worker/daily-report/expense date
defaults could silently shift a day for any user east/west of UTC and across both DST transitions.
Decision C (K‑9) fixes one canonical company timezone; Slice 3 makes it effective.

## Decision
1. **One canonical company day.** Company timezone = **`Europe/Bucharest`** by default, overridable by env:
   backend **`COMPANY_TZ`**, web **`NEXT_PUBLIC_COMPANY_TZ`**. Blank/missing → `Europe/Bucharest`.
2. **Single implementation, both layers.** New `backend/src/common/datetime/company-time.ts` and the
   parallel `web/src/lib/company-time.ts` derive the company calendar date through `Intl`
   (`Intl.DateTimeFormat(..., { timeZone }).formatToParts`) — DST is handled by construction, with **no**
   hand-rolled UTC-offset arithmetic.
3. **`@db.Date` encoding keeps its shape.** Date-only columns keep the existing UTC-midnight encoding of
   the calendar date, now produced by one helper: `companyDay(iso) = new Date(`${iso.slice(0,10)}T00:00:00.000Z`)`.
   **No schema change, no Prisma migration, no data rewrite.**
4. **Instant `TIMESTAMP` columns are untouched** (`check_in_time`, `check_out_time`, `created_at`,
   `submitted_at`, …). Only calendar-date derivations move.
5. **Rewrite scope (Decision C + G‑3):** attendance (check-in day + active-session lookup, today-summary,
   find-my-logs, range filter), daily-plan defaults + `plan_date` encoding, Control Tower workforce
   "today", and the date-only encodings of `CostEntry.entry_date`, `Expense.expense_date`,
   `Aviz.delivery_date`, plus every web "today" call site (planning date bar, worker dashboard / My Day,
   daily-report defaults + comparisons, expense-date default). Broader same-class normalization
   (Issue/Invoice/Receipt/… columns) is **excluded on purpose**.
6. **Naming.** Web helpers are `todayCompanyIso()` / `shiftCompanyDate(iso, days)`; the old
   `todayLocalIso` / `shiftLocalDate` names are **deleted** (no alias). The `features/planning` barrel
   re-exports the new names, so consumers keep one import path.
7. **Mobile frozen.** `Mobile/**` is not touched (its own `new Date().toISOString()` expense default is
   out of scope, per Decision G).
8. **Daily-reports backend service unchanged.** `backend/src/modules/daily-reports/` (service, DTOs) is
   **not** touched: the daily-report defect was at the **date-input / frontend boundary** (the web "today"
   the reports UI sends), fixed by the web date helper alone. No backend daily-reports change was made,
   and none should be invented.

## Reason
One DST-correct, configurable source of truth removes a whole class of off-by-one-day defects with **no**
storage change: the `@db.Date` rows already hold correct calendar dates, so only the *derivations* were
wrong.

## Alternatives Considered
- **Global timestamp-type migration (`timestamptz`)** — rejected: heavy, risky, rewrites history, and does
  not fix the calendar-*day* derivation that actually caused the defects.
- **Client-supplied "today"** — rejected: untrusted, and still wrong for a device on another timezone.
- **Hand-rolled `UTC+2`/`UTC+3` offset switching** — rejected: DST rules change; `Intl` is authoritative.
- **Keep `todayLocalIso` device-local, rename only** — rejected: the point is the *company* day.

## Consequences
### Positive
- Attendance day, daily-plan day, Control Tower workforce day and all web "today" defaults agree
  regardless of server/device timezone and across both 2026 DST transitions.
- One helper per layer; DST covered by unit tests (and a live `dist` smoke); no schema/migration/data change.
### Negative
- Two small near-duplicate helpers exist (backend + web) because the runtimes are separate bundles —
  accepted rather than introducing a new shared runtime dependency.
- The company timezone is a deployment setting: changing `COMPANY_TZ` changes "today" product-wide.

## Affected Areas
- `backend/src/common/datetime/company-time.ts` (new), `backend/test/company-time.spec.ts` (new)
- `backend/src/modules/attendance/{attendance.service.ts,attendance.controller.ts}`,
  `backend/src/modules/daily-plans/{daily-plans.service.ts,daily-plans.controller.ts}`,
  `backend/src/modules/control-tower/control-tower.service.ts`,
  `backend/src/modules/costs/costs.service.ts`, `backend/src/modules/expenses/expenses.service.ts`,
  `backend/src/modules/procurement/procurement.service.ts`
- `web/src/lib/company-time.ts` (new), `web/src/features/planning/{summary.ts,index.ts}`,
  `web/src/features/planning/components/{PlanningDateBar,SiteReadinessCard}.tsx`,
  `web/src/app/planning/page.tsx`, `web/src/app/cheltuieli/page.tsx`,
  `web/src/components/{WorkerDashboard,WorkerMyDay}.tsx`,
  `web/src/components/worker/WorkerActionsRequired.tsx`,
  `web/src/features/daily-reports/{helpers.ts,DailyReportForm.tsx,DailyReportReviewSection.tsx,DailyReportWorkSection.tsx}`,
  `web/src/hooks/useWorkerShift.ts`
- `backend/.env.example` (`COMPANY_TZ`), `.env.example` (`NEXT_PUBLIC_COMPANY_TZ`)
- `REMEDIATION_ROADMAP.md` (§9), `PROGRESS.md`, `VERIFICATION.md`, `ISSUES.md`, `HANDOFF.md`

---

# DEC-016 — PM removed from the project global-scope bypass; MANAGER deferred (Slice 4 / K‑10 / Decision D)

**Date:** 2026-10-01
**Slice:** 4 (K‑10) — Project-scoped authorization tightening
**Supersedes:** the PM row introduced into the global bypass by the Slice 2 / K‑10
  authority work (now removed); does **not** supersede Decision D itself (DEC-015
  covers company timezone; this is the authorization half of K‑10).

### Decision

`PM` (and only `PM`) is removed from `GLOBAL_PROJECT_SCOPE_ROLES`. After this
decision, a **PM no longer bypasses project-membership checks**. A PM must have
an explicit `ProjectMember` row (role `PM`) on the target project — or an
in-memory `projectRoles[projectId]` fast-path entry — to access that project;
otherwise the guard denies with `ForbiddenException`.

`MANAGER` is **preserved** as a global-scope role (unchanged, still bypasses
membership) and is explicitly **deferred** to a follow-up ownership-scope
decision (out of scope for Slice 4). `ADMIN`, `OWNER`, and `MANAGER` keep the
global bypass.

### Why

- K‑10 (Project-Scope Authorization / project isolation) has **two**
  enforcement points that previously listed PM globally: the shared
  `GLOBAL_PROJECT_SCOPE_ROLES` constant (consumed by `ProjectAccessGuard` and
  the project-scope query scoping) and the solar design guard's own inline
  bypass. Removing PM from only one would leave the other as a residual
  cross-project leak for the same role — so both are changed **in lockstep**.
- A PM "owns" projects only through membership; granting every PM unconditional
  access to **every** project (through either guard) is broader than the
  documented `ROLE_VISIBILITY_MATRIX` membership scope and was flagged as a
  cross-project leak (Decision D trail / K‑10).
- MANAGER's global bypass is deferred (not silently changed) so the change stays
  minimal and the remaining scope work is a single, documented decision.

### Impact

- `backend/src/common/auth/project-scope.ts` — PM removed from
  `GLOBAL_PROJECT_SCOPE_ROLES` (comment updated).
- `backend/src/modules/solar/guards/solar-design-access.guard.ts` — PM removed
  from the inline Admin/Owner/PM/Manager bypass (comment updated).
- Tests: `backend/test/project-access.guard.spec.ts`,
  `backend/test/solar-design-access.guard.spec.ts` — PM grant/deny lockstep
  cases added (PM-member grant, PM-non‑member deny; ADMIN/OWNER/MANAGER
  unchanged).
- `web` — **no change** (verified: no client-side mirror of the
  `GLOBAL_PROJECT_SCOPE_ROLES` list; the web surfaces are role-gated at the
  route/component level only, so the backend-scope list is the single authority).

### Verification

- Backend Jest: PM-related guard suites green (see `VERIFICATION.md` Slice 4).
- `npm run typecheck` (backend) exit 0.

---

# Superseded Decisions
Never silently delete old decisions. Mark them SUPERSEDED.

| Old Decision | Replaced By | Date |
|---|---|---|
| Google Cloud Vision as OCR provider (in `extract.ts`, `Mobile/.env.example`) | DEC-003 (PaddleOCR) | 2026 (code); docs cleanup pending |
