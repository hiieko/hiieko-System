# Architecture & Technical Decisions

Last Updated: 2026-09-18

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

# Superseded Decisions
Never silently delete old decisions. Mark them SUPERSEDED.

| Old Decision | Replaced By | Date |
|---|---|---|
| Google Cloud Vision as OCR provider (in `extract.ts`, `Mobile/.env.example`) | DEC-003 (PaddleOCR) | 2026 (code); docs cleanup pending |
