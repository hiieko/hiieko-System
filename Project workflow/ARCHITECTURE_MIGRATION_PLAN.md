# HIIEKO — ARCHITECTURE MIGRATION PLAN

**Date:** 2026-09-18/19 · **Status:** DRAFT for approval (no implementation started) · **Companions:** `PROJECT_AUDIT.md`, `FEATURE_GAP_ANALYSIS.md`, `DATABASE_MIGRATION_MAP.md`, `API_MIGRATION_MAP.md`, `TECHNICAL_DEBT.md`, `IMPLEMENTATION_ROADMAP.md`.

---

## 1. Guiding rules (binding constraints — from the migration brief, spec §97–§98)

1. **Do not delete Supabase yet.** Run legacy and target in parallel; decommission last (see §7).
2. **Do not rewrite the project.** Keep Next.js web, Expo mobile, `shared/`, the PaddleOCR service.
3. **Do not create fake APIs or mock production data; no claim of migration success without a verification gate.**
4. **Never duplicate `shared/` domain logic** — the NestJS backend consumes `@solar/shared` types/calculations.
5. **Storage / OCR / Notifications stay modular services** behind provider abstractions.
6. **Inspect before changing** (per spec §98): every work package starts from the audit maps, not from assumptions.
7. Every work package has an **exit criterion**: typecheck + unit tests + targeted manual check on a live project.

## 2. As-Is vs Target

| Concern | As-Is (audited 2026-09) | Target (spec §74–§77) |
|---|---|---|
| API layer | none — clients ↔ Supabase PostgREST | NestJS central business/API layer |
| Authorization | RLS + SQL helpers only | NestJS authN/authZ; RLS as defense-in-depth during transition |
| DB | single Supabase Postgres (11 migrations + `full_setup.sql`) | production Postgres owned by NestJS, same logical entities |
| Mobile offline | AsyncStorage JSON queue; sync never called | SQLite local store + queue + conflict states (§56–§57) |
| OCR | Edge Function → PaddleOCR; Google Vision leftovers | provider-abstracted OCR jobs controlled by backend |
| Notifications | DB-trigger in-app only | channel abstraction (in-app/push/email), deep links |
| Shared logic | `@solar/shared` (types, calculations, i18n, permissions, OCR helpers) | **Kept and extended**; never duplicated |
| Web | Next.js 14, direct supabase-js | Next.js frontend only; data via NestJS API |
| Audit | `audit_logs` table + RLS insert policy | audit service writing structured log rows (values diff) |

## 3. Target Architecture (to-be)

```text
      WEB (Next.js)                      MOBILE (Expo + SQLite)
           │                                    │
           │ REST + JWT                        │ REST + JWT (+ sync queue)
           ▼                                    ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                        NESTJS (API layer)                     │
   │  auth · profiles · projects · sites · teams · tasks           │
   │  attendance · dailyReports · stock · procurement · avize      │
   │  expenses · ocrJobs · notifications · audit · reporting       │
   │  sync (offline endpoints) · files                            │
   └──────────────────────────────────────────────────────────────┘
           │  ✓ same JWT (Supabase Auth stays as IdP)
           ▼
      POSTGRESQL  (single source of truth — re-modeled schema)
           │
   ┌───────┼──────────┬───────────────┬──────────────┐
   ▼       ▼          ▼               ▼              ▼
 Storage  OCR       Notifications   Audit         (legacy Supabase
 object   (Paddle    channels        log           mirror, read-only,
 store    OCR)       in-app/push/email             decommissioned last)
```

## 4. Workstreams

### WS-A — API contract extraction (behavior-preserving)
1. From `API_MIGRATION_MAP.md`, generate a typed `ApiClient` interface for every client→Supabase operation.
2. Implement `SupabaseApiAdapter` (current SDK) behind it; clients change imports only (no behavior change, everything keeps working).
3. Later, `NestApiAdapter` implements the same interface → endpoint-by-endpoint cut-over.

### WS-B — NestJS foundation
1. Add `backend/` workspace (decision: keep `shared`, `web`, `Mobile` names; add `backend`).
2. NestJS configured: Auth guard verifies JWT against the existing Supabase issuer/JWKS (`SUPABASE_JWKS_URL` already in `.env.example`); global validation pipe; error envelope matching current RO/EN messages; structured logging; env schema.
3. CI-ready scripts (lint/test/build) — root `package.json` gains `backend:*` scripts.

### WS-C — Database ownership
1. Apply `DATABASE_MIGRATION_MAP.md`: re-model current tables into an explicit Postgres schema owned by the app (mutations audited).
2. **Dual-write phase:** NestJS writes target tables; legacy tables mirrored for rollback; drift-checker job.
3. RLS stays enabled during transition (still a safety net); NestJS guards mirror the same predicates.

### WS-D — Domain module porting order
Follows `IMPLEMENTATION_ROADMAP.md` milestones. First: auth/profiles → sites/teams/assignments → attendance (shared calc) → stock (DB invariants stay) → expenses+approvals → daily reports → notifications → avize → OCR jobs → then new EPC modules.

### WS-E — Mobile offline & sync (spec §55–§57)
1. Introduce real **SQLite** (`expo-sqlite`) for field tables; AsyncStorage reserved for preferences/drafts.
2. Sync client states: LOCAL→QUEUED→SYNCING→SYNCED / FAILED / CONFLICT; idempotency keys everywhere; automatic flush on connectivity + manual retry; conflict UI shows local vs server and preserves both until resolved.
3. Media (photos, scans, avize images) queue as file uploads with retry; never delete local originals until acked by the server.

### WS-F — OCR abstraction (spec §31, §92)
1. `OcrProvider` interface: `extract(image | xml) → OcrResult` with confidence.
2. Adapters: current Paddle service; e-Factura XML path; stub for future providers. **Remove all Google Vision references** (`extract.ts`, `Mobile/.env.example`, `shared/src/ocr.ts`).
3. Backend owns `ocr_jobs` tied to `expense_documents.document_state`; clients only submit jobs and read results.

### WS-G — Notifications abstraction (spec §65)
1. `NotificationChannel` interface: `InAppChannel` (notifications table), `PushChannel` (later), `EmailChannel` (later).
2. Backend domain events → notification service; DB triggers remain for legacy flows during carry-over, then are dropped.

## 5. RLS → Service-Authorization Migration (critical path)

- The current SQL predicates **are the authorization spec**: `is_admin()`, `is_manager_or_admin()`, `has_site_access(site_id)`, `get_auth_user_role()`, plus table policies (owner-record, site-scope, manager/admin). Port them 1:1 into a NestJS `AuthorizationService` (same semantics; role source = `profiles`).
- Enforce **module + action** granularity (spec §52: role + project-access + module-access + action permissions) — a superset; server-side only.
- Policy: clients never filter by claim; they request, the API decides. RLS remains enabled on the legacy Supabase schema but the API is no longer *dependent* on it.
- Permission mapping table lives in `API_MIGRATION_MAP.md` §3.

## 6. Phased rollout (high level; detailed in IMPLEMENTATION_ROADMAP.md)

| Phase | Content | Exit gate |
|---|---|---|
| R0 | Stabilize current repo: fix ISSUE-001/002/003/004/005/006/007/008/009; initialize git; wire real keys in staging; run everything | green CI + live smoke test |
| R1 | NestJS skeleton + auth guard + health + `profiles` API; clients read profiles via API | web login/profile works through API |
| R2 | Sites/teams/assignments, attendance, stock APIs (dual-write); `/pontaj`, `/stocuri` go live | mock pages replaced; DB dual-write verified |
| R3 | Daily reports, expenses+approvals, reimbursements, notifications, avize APIs; mobile submit paths persist for real | alerts replaced by real inserts; tests green |
| R4 | Mobile SQLite + sync + conflicts; QR/camera polish | offline→online round-trip E2E passed |
| R5 | OCR jobs behind backend + provider cleanup; notification channels | OCR E2E + notification E2E |
| R6 | New EPC modules (projects/planning/tasks/procurement/QA/issues/NCR/change orders/finance/commissioning/handover/control tower) — new code, same API rules | spec §88–§91 phase gates |
| R7 | Decommission legacy REST/Edge paths; archive demo data; final report | freeze legacy read-only; delete-after-backup |

## 7. Rollback & risk plan

- Each phase keeps a working snapshot (tagged git releases; repo must be versioned first — see TECHNICAL_DEBT TD-008).
- Dual-write → drift-checker job (row counts + keyed hashes) blocks cut-over when dirty.
- Cut-over gates: all current pages functional through NestJS; no data loss; all unit + new integration tests green; RLS equivalence suite passes.
- Known risks: live-project dependency (no keys today), silent-data-loss patterns in mobile, authorization port fidelity, scope creep of EPC modules, no CI baseline.

*Companion documents: `PROJECT_AUDIT.md` · `FEATURE_GAP_ANALYSIS.md` · `DATABASE_MIGRATION_MAP.md` · `API_MIGRATION_MAP.md` · `TECHNICAL_DEBT.md` · `IMPLEMENTATION_ROADMAP.md`*