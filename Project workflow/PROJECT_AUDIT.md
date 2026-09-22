# HIIEKO — MASTER TECHNICAL AUDIT

**Date:** 2026-09-18/19 · **Version:** 1.0 · **Scope:** full repository + attached `Ful project Hiieko .docx` (Master Product Specification, 102 sections).
**Auditor note:** every status below is based on code evidence read in this checkout and on checks actually executed in this environment (§1, §11). Nothing is marked "working" merely because code exists.

---

## 0. Executive Summary

1. **The repository is a Supabase-centric monorepo, not the target NestJS architecture.** All clients (Next.js web, Expo mobile) talk directly to Supabase (PostgREST + RLS + Auth + Storage + one Edge Function). There is **no application backend layer** today.
2. **Verified working:** shared domain package + unit tests; i18n + tutorial system; web production build and live dev server (HTTP 200 on 14 routes); a solid PostgreSQL schema with stock-integrity triggers, RLS, idempotency keys, audit log and notification triggers; the PaddleOCR FastAPI service with a Romanian document parser (6/6 unit tests pass); the `ocr-extract` Edge Function plumbing (JWT-guarded, provider-secret isolated).
3. **Confirmed broken:** dashboard queries nonexistent table `attendance_records` (ISSUE-001); mobile app boots to a hardcoded demo user and never renders `LoginScreen` (ISSUE-002); `syncOfflineQueue()` is dead code — the offline queue is never replayed; the web header site switcher reads mock sites.
4. **Confirmed mocked:** `/pontaj`, `/rapoarte`, `/stocuri` are pure in-file mock pages; mobile attendance/delivery/expense/daily-report screens are alert-and-forget (online path does not persist); barcode scan is an `Alert` simulation; the **"SQLite offline database" described in the docs does not exist anywhere** — the mobile persistence layer is AsyncStorage JSON.
5. **Documentation drift is material and captured as issues:** docs claim SQLite, "sync replays when online", "Google Vision removed" — the code shows no SQLite, sync never called, and Google Vision references remain in `supabase/functions/ocr-extract/extract.ts`, `Mobile/.env.example` and `shared/src/ocr.ts`.
6. **The DOCX spec outpaces the code by a wide margin.** Of 102 spec sections, roughly **14 are fully present, ~20 partial, ~10 mocked, ~6 broken, and ~50 missing** (all of the EPC Project-Control / Finance / QA-QC / Commissioning / Handover / Control Tower layers). Full matrix in §8.
7. **Do not migrate by rewriting.** The existing Supabase schema, RLS rules and shared calculations are correctly designed for their scope and must be ported, not replaced (see `ARCHITECTURE_MIGRATION_PLAN.md`).

---

## 1. Audit Method & Evidence

### 1.1 What was inspected
- **Spec:** `Ful project Hiieko .docx` extracted to text (2,609 lines / ~34.5k chars; 102 numbered requirement sections).
- **Repo:** every file except generated (`node_modules/`, `shared/dist/`, `web/.next/`): root configs, `shared/` (9 src files + 3 test files), `web/` (13 pages, 8 components, 3 lib, AuthContext), `Mobile/` (8 screens, 7 services, 3 components, configs), `supabase/` (11 migrations + `full_setup.sql` + Edge Function), `ocr-service/` (7 py files + tests + Docker), `Project workflow/`, `docs/`.
- **DB artifact:** `supabase/full_setup.sql` (1,234 lines) read in full and cross-checked against migrations (concat of 01–07 = 1,094 lines + 08 = 17 lines → consistent with the consolidated artifact; the header of `full_setup.sql` is stale, see ISSUE-008).

### 1.2 What was actually run (all in this environment)
| Check | Command | Result |
|---|---|---|
| Install | `npm install` | PASS (1,213 packages) |
| shared build | `npm run build --workspace=shared` | PASS (`shared/dist` generated) |
| Root typecheck | `npm run typecheck` (shared→web→mobile) | **PASS**, 0 errors |
| shared domain tests | `npx tsx shared/src/calculations.test.ts` | PASS |
| shared i18n tests | `npx tsx shared/src/i18n.test.ts` | PASS |
| shared tutorials/OCR tests | `npx tsx shared/src/tutorials.test.ts` | PASS (28 checks) |
| Edge function parser | `npx tsx supabase/functions/ocr-extract/extract.test.ts` | PASS (36 assertions) |
| OCR service parser | `python -m pytest ocr-service/tests -q` | **6 passed** (installed `pydantic` into global env; no repo venv exists) |
| Web build | `npm run build --workspace=web` | PASS (14 routes compile) |
| Dev server | `npm run web:dev` (background, log `web-dev.log`) | Live HTTP 200 on `/`, `/pontaj`, `/rapoarte`, `/stocuri`, `/avize`, `/cheltuieli`, `/aprobare`, `/utilizatori`, `/statistici`, `/notificari`, `/santiere`, `/login`, `/signup`, `/profil`; `/pontaje` → 404 (expected) |
| Live OCR service | — | NOT deployed (no project/secrets) → `UNVERIFIED` |
| Mobile runtime | — | NOT started (Expo not launched) → `UNVERIFIED` |

**Explicit non-claims:** no live-Supabase integration test, no Edge Function deployment, no PaddleOCR inference run, no mobile device/emulator run were performed here.

---

## 2. Current (As-Built) Architecture

```text
                  ┌──────────────────────────────┐
                  │  WEB  (Next.js 14, App Router)│
                  │  12 nav routes, i18n, tut.    │
                  └─────────────┬────────────────┘
                                │ supabase-js v2 (anon key + JWT)
                  ┌──────────────────────────────┐
                  │  MOBILE (Expo 51 / RN 0.74)  │
                  │  tabs, AsyncStorage queue    │
                  └─────────────┬────────────────┘
                                │ supabase-js v2 + REST
         ┌───────────────────────┼───────────────────────────┐
         │                       ▼                           │
         │      ┌──────────────────────────────┐              │
         │      │          SUPABASE HOSTED     │              │
         │      │  PostgREST + RLS (SQL defs)  │              │
         │      │  Auth users/JWT + Storage    │              │
         │      │  Edge fn ocr-extract (Deno)  │              │
         │      └────────┬─────────────┬───────┘              │
         │               │ HTTPS       │ HTTPS                │
         │               ▼             ▼                      │
         │   ┌──────────────────┐ ┌─────────────────────┐     │
         │   │  PostgreSQL via   │ │  PaddleOCR service  │     │
         │   │  Supabase (RLS on)│ │  FastAPI · PP-OCRv6 │     │
         │   └──────────────────┘ └────────+────────────┘     │
         └────────────────────────────────────────────────────┘
```

- **No application/API layer between clients and Postgres.** All authorization is RLS written in SQL; all business rules that exist live either in `shared/` (client-side) or in DB triggers/functions.
- **No NestJS / Express / service-role usage anywhere.**
- `shared/` is the single source of domain types, calculations, i18n and tutorials; both clients import it. `dist/` is built from `tsc`.
- OCR chain: client captures → `supabase.functions.invoke('ocr-extract')` (JWT-guarded Deno) → private PaddleOCR `/v1/ocr/document` → normalized JSON with per-field confidence. Provider credentials exist only as function secrets / service env vars.

---

## 3. What Already Works

### 3.1 Verified working (executed in this environment)
| Item | Evidence |
|---|---|
| `shared` domain calculations (Haversine, geofence, attendance hours, overtime, stock validation) | `calculations.test.ts` PASS; consumed by mobile attendance |
| i18n (ro/en) + tutorial system | `i18n.test.ts` + `tutorials.test.ts` PASS (145 keys, 15 sections) |
| Web app typechecks and builds | root `typecheck` PASS; `next build` PASS (14 routes) |
| Dev server serves all routes HTTP 200 | `web-dev.log` |
| OCR structured-extraction module (`toNumber`, RO/EN amounts, VAT guards) | `extract.test.ts` 36/36 PASS |
| PaddleOCR RO parser + validators (CUI checksum, dates, totals consistency) | `pytest` 6/6 PASS |
| SQL artifacts idempotent & consistent | concat check (§1.1); every policy `DROP IF EXISTS` first |
| Auth scaffold: signup→application→approval, `handle_new_user` trigger, web `AuthContext` session restore | code + typecheck |
| Live web pages against real tables: `/avize`, `/santiere`, `/cheltuieli` (list + OCR invoke), `/aprobare`, `/utilizatori`, `/statistici`, `/notificari` | code read; matching RLS per table |

### 3.2 Partially implemented
- Web `/cheltuieli` OCR upload: function invoked, results editable, but the **online submit path is demo-only** (no insert).
- Expense approval lifecycle: statuses + RLS + `prevent_self_approval_expense` OK; **reimbursement workflow has no UI**.
- Notifications: DB triggers create RO/EN rows; web + mobile centers read/mark; no realtime, no push, no preferences.
- Offline-first mobile: queue scaffolding + idempotency keys exist; **sync is never invoked**; online paths alert-and-forget.
- `ReceiptScanFlow`: real camera + rotation/upscale + OCR review + storage upload (when authenticated); depends on deployed function + bucket.
- Stock: DB integrity is excellent; web `/stocuri` page is mock.

### 3.3 Mocked (in-file data, no DB)
`web/src/lib/mock-data.ts` feeds `/pontaj`, `/rapoarte`, `/stocuri`, web `Header` site switcher, `/cheltuieli` fallback list. Mobile `App.tsx` DEMO_SITES/DEMO_MATERIALS/DEMO_WORKERS; barcode scan = `Alert`; delivery photo = Unsplash URL; GPS falls back to simulated coordinates (site center) when location errors.

### 3.4 Broken
| Item | File | Impact |
|---|---|---|
| Dashboard queries `attendance_records` (does not exist) | `web/src/app/page.tsx:54` | Dashboard errors + zero stats on any real project |
| `worker_count: 0` hardcoded in recent reports | `web/src/app/page.tsx:98` | Report rows always show 0 workers |
| Mobile boots with demo team-leader; `LoginScreen` unused | `Mobile/App.tsx:97` | No real authentication on device |
| `syncOfflineQueue()` never called | `Mobile/src/services/supabase.ts` | Offline data never reaches the server |
| Mobile report/delivery/expense online submit does not insert | `TeamLeaderDailyReportScreen.tsx`, `DeliveryIntakeScreen.tsx`, `WorkerExpenseScreen.tsx` | Silent data loss if user believes data was sent |
| `extract.ts` is dead code claiming to be imported by the Edge Function; still tags `provider:'google_cloud_vision'` | `supabase/functions/ocr-extract/extract.ts` | Dead + stale provider tag |

### 3.5 Unknown / unverified
- Live Supabase project behavior (RLS matrix, Edge Function, storage policies) — no keys configured (`web/.env.local` has placeholders).
- PaddleOCR inference quality (model PP-OCRv6, `lang="ro"`) on real receipts — no service deployment yet.
- Mobile device/emulator UX — Expo not started in this environment.
- `.env.example` contains what look like real publishable anon keys for project `aazscejjuucjupzsykku` (anon key is client-safe by design; ownership and rotation still need a decision).

---

## 4. Existing Database (every important table)

Schema source: migrations 01–08 + `full_setup.sql`. RLS is enabled on **all** application tables. Conventions: UUID PKs (uuid-ossp), `updated_at` triggers, `idempotency_key` UNIQUE on offline-capable tables, `is_offline_created` flag.

### 4.1 Profiles & identity
| Table | Purpose | RLS / triggers / indexes | Verdict |
|---|---|---|---|
| `profiles` | identity+role (admin/manager/team_leader/worker), is_active, phone, employee_code, avatar, language | filled by `handle_new_user` (auth.users AFTER INSERT); RLS self/admin; updated_at trigger | KEEP → `profiles` (extend roles §52) |
| `account_applications` | self-service account requests | RLS any-insert / admin view+update; applicant view via email match; **approval does not auto-provision a profile** | KEEP → `account_applications` (+ approve→provision step) |

### 4.2 Sites, teams, assignments
| Table | Purpose | RLS / triggers / indexes | Verdict |
|---|---|---|---|
| `sites` | site master + GPS center + geofence radius + (04b) status/client/dates/budget | RLS active-visible; admin ALL; updated_at; UNIQUE code | SPLIT → `projects` (spec §5–§6) |
| `user_site_assignments` | user↔site visibility | RLS self/site/admin; UNIQUE(user,site) | MERGE → `project_members` |
| `site_assignments` (04b) | user→site with role + dates | RLS site/admin; idx user/site | MERGE → `project_members` |
| `teams` / `team_members` | work teams + membership | RLS site/lead/admin; UNIQUE(team,user) | KEEP → `teams`/`team_members` |
| `warehouses` (04b) | stock locations | RLS auth-view/admin-manage; UNIQUE code | KEEP → `warehouses` (§13) |

### 4.3 Attendance & daily reports
| Table | Purpose | RLS / triggers / indexes | Verdict |
|---|---|---|---|
| `time_logs` | check-in/out + GPS + status + normal_hours + overtime + rest + is_offline_created + idempotency | RLS self/site/admin; idx (user,date),(site,date); **hours computed client-side in `shared`, no SQL calc** | KEEP → `time_logs`/`attendance` (+ verified_by, geofence verdict) |
| `daily_reports` | team report header | RLS site/lead/admin; idempotency | KEEP → `daily_reports` |
| `daily_report_workers` | present workers | RLS via report; UNIQUE(report,worker) | KEEP |
| `daily_report_tasks` | task lines (description+qty) | RLS via report | KEEP → link real `tasks` |
| `daily_report_materials` | consumed materials | RLS via report | KEEP → link `stock_movements` |

### 4.4 Stock & deliveries
| Table | Purpose | RLS / triggers / indexes | Verdict |
|---|---|---|---|
| `materials` | catalog, barcode, thresholds, unit_cost | RLS auth-read / manager-ALL; UNIQUE code/barcode | KEEP → `materials` |
| `site_stock` | balance per site+material, CHECK ≥0 | RLS site; UNIQUE(site,material) | KEEP → `stock_balances` (add warehouse) |
| `stock_movements` | immutable ledger (+/−, movement_type 5 values, reference_id, performed_by, notes) | RLS site+role; `apply_stock_movement_trigger` BEFORE INSERT enforces no over-draw + maintains balance | KEEP → `stock_movements` (+ transfer/return/adjustment types) |
| `delivery_notes` / `delivery_note_items` | aviz intake; items have material_id/qty/unit_price | RLS site + role; idempotency UNIQUE; items via note | KEEP → `avize`/`aviz_items` (§33) |

### 4.5 Expenses & OCR
| Table | Purpose | RLS / triggers | Verdict |
|---|---|---|---|
| `expenses` | full lifecycle (`expense_status_enum`, 9 states), category, payment_method, amounts, ocr_result JSONB, participants, mileage, idempotency | RLS owner/site/admin; `prevent_self_approval_expense`; `notify_expense_submitted` | KEEP → `expenses` (link stock receipts §32) |
| `expense_documents` | scanned docs; mig 07+08: file metadata, storage_bucket, ocr_status/provider/low-conf, document_state machine, raw/normalized/corrections, correlation_id, processed/confirmed, **unique `document_hash` index** | RLS via expense; idx uploaded_by/state | KEEP → `expense_documents` |
| `expense_approvals` | action+reason+approver | RLS manager/admin; `notify_expense_approved` trigger | KEEP |
| `reimbursements` | pending/reimbursed + method/ref | RLS admin / users-own | KEEP → `reimbursements` (§71) |

### 4.6 Notifications & audit
| Table | Purpose | RLS / triggers | Verdict |
|---|---|---|---|
| `notifications` | RO/EN title+body, type, priority, action_url, metadata, read state | RLS recipient; system insert; **no push/email** | KEEP → `notifications` (+ `notification_preferences`) |
| `audit_logs` | actor, role, action, entity, site, details JSONB, ip | RLS admin-view / authenticated-insert; **no client writes it today** | KEEP → `audit_logs` (backend service writes) |

### 4.7 Storage
`storage.buckets['expense-documents']` — private, jpeg/png/webp/pdf, 10 MB, 4 owner/admin-scoped policies on `storage.objects`. **Only expense documents are covered** — no buckets yet for avize photos, daily-report photos, engineering/QA/handover documents.

### 4.8 Enums · functions · triggers summary
- **Enums (11):** user_role, attendance_status, report_status, stock_movement_type, account_application_status, expense_status, expense_category, payment_method, document_type, site_status, stock_receipt_status.
- **Functions (10):** `update_timestamp_column`, `apply_stock_movement_trigger`, `handle_new_user`, `get_auth_user_role`, `is_admin`, `is_manager_or_admin`, `has_site_access`, `create_notification`, `prevent_self_approval_expense`, `prevent_self_approval_report` (function exists; **trigger commented out** — no table).
- **Triggers (~20):** 8 `updated_at`, 1 stock movement, 1 auth profile, 6 notification event feeds, 1 self-approval guard (expenses).

---

## 5. Supabase Dependencies (every usage site)

| Dependency | Where | Detail |
|---|---|---|
| `@supabase/supabase-js` 2.43.4 | `web/src/lib/supabase.ts` | createClient; **null when env missing** ("not configured" UX) |
| Supabase Auth | `web/login`, `web/signup`, `web/contexts/AuthContext.tsx`, `Mobile/LoginScreen.tsx`, `Mobile/services/expenseDocuments.ts` (getSession), `Mobile/services/ocr.ts` (JWT) | signIn/signUp/getSession/onAuthStateChange; metadata role honored by `handle_new_user` |
| Supabase REST (`.from`) | web pages (`page`, `avize`, `cheltuieli`, `aprobare`, `utilizatori`, `statistici`, `notificari`, `santiere`) + `lib/useSupabaseQuery.ts` | 20+ distinct table reads; ~8 writes (e.g. `expense_documents`, application updates) |
| Supabase Storage | `Mobile/src/services/expenseDocuments.ts` → bucket `expense-documents`; policies in migration 07 | upload-before-insert; failure → offline queue |
| Edge Functions | `web/cheltuieli` + `Mobile/services/ocr.ts` → `/functions/v1/ocr-extract` | JWT-authed provider proxy |
| RLS assumptions | all queries | role/site helpers (§4.8); site-scoped visibility everywhere |
| `@supabase/server` (root) | package.json only | **unused by any source file** (cleanup candidate) |

---

## 6. Business Logic — Where It Lives

| Concern | Implementation site | State | Target |
|---|---|---|---|
| Geofence / GPS distance | `shared/calculations.ts` (Haversine) + mobile screen | ✅ tested | keep — backend re-uses it |
| Attendance hours / overtime | `shared/calculations.ts` (09:00–18:00, 60 min rest, 15 min grace) | ✅ tested, client-side only | authoritative compute moves to backend; shared stays as reference |
| Stock invariants | SQL `apply_stock_movement_trigger` + `shared.validateStockMovement` | ✅ DB-enforced | keep trigger; API mirrors errors |
| Expense approval rules | SQL `prevent_self_approval_expense` + `/aprobare` | ✅ | keep; mirror in NestJS |
| Report approval rules | `prevent_self_approval_report` (dormant) | ⚠️ | enable in NestJS flow |
| Permission matrix | `shared/permissions.ts` | ✅ role helpers | input to NestJS `AuthorizationService` |
| Notifications | SQL triggers (6) + web/mobile centers | 🟡 | backend events → notification service |
| OCR normalization | `ocr-service/parser_ro.py` + `validators.py`; legacy dup `extract.ts` | ✅ tested (RO) ⚠️ dup | one backend-owned pipeline; retire `extract.ts` |
| Overtime statistics | `web/src/app/page.tsx` | ❌ broken query | backend reporting module |
| Offline sync | `Mobile/services/supabase.ts` `syncOfflineQueue` | ❌ never invoked | real sync client (SQLite) |
| Labour costing | none | ➖ | new (spec §26) |

---

## 7. Mock Functionality — Full Inventory

| UI / flow | Data source | File(s) |
|---|---|---|
| `/pontaj` daily + monthly matrix + CSV export | `MOCK_TIME_LOGS`, `MOCK_USERS`, `MOCK_SITES`; monthly grid is hardcoded simulation (day 14 "today", fixed 8h/OT cells) | `web/src/app/pontaj/page.tsx` |
| `/rapoarte` reports list + approve button (does nothing) | `MOCK_DAILY_REPORTS`; photos from Unsplash | `web/src/app/rapoarte/page.tsx` |
| `/stocuri` stock table + audit journal | `MOCK_MATERIALS`, `MOCK_SITE_STOCK`, `MOCK_STOCK_MOVEMENTS` | `web/src/app/stocuri/page.tsx` |
| Web header site switcher | `MOCK_SITES` | `web/src/components/Header.tsx` |
| `/cheltuieli` "online" submit path | shows success alert only; fallback list `MOCK_EXPENSES` | `web/src/app/cheltuieli/page.tsx` |
| Mobile app identity + data | `DEMO_SITES`, `DEMO_MATERIALS`, `DEMO_WORKERS`; `currentUser = DEMO_WORKERS[0]` | `Mobile/App.tsx` |
| Mobile attendance check-in/out | local-only (`setActiveTimeLog` AsyncStorage); online path never inserts `time_logs` | `WorkerAttendanceScreen.tsx` |
| Mobile delivery intake | photo = fixed Unsplash URL; barcode = `Alert` with hardcoded code; online path alert-only | `DeliveryIntakeScreen.tsx` |
| Mobile daily report | drafted to AsyncStorage; enqueues only when manual "offline toggle" is on; online path alert-only | `TeamLeaderDailyReportScreen.tsx` |
| Mobile expense | online path alert-only; offline path enqueues | `WorkerExpenseScreen.tsx` |
| GPS fallback | simulated site-center coordinates when location fails (`44.2981,23.8122`) | `WorkerAttendanceScreen.tsx` |
| AsyncStorage "sync" banner | counts queue; **never actually syncs** | `App.tsx` + `OfflineBanner.tsx` |

**Offline-connectivity caveat:** `isOffline` is a manual UI toggle — the app never detects connectivity and never triggers `syncOfflineQueue()`. Pending items stay in AsyncStorage forever (capped only by storage).

---

## 8. DOCX Requirement Matrix (spec §1–§102)

Legend — **Status:** ✅ Complete · 🟡 Partial · 🧪 Mock · ❌ Broken · ➖ Missing · ❔ Unknown. **Migration:** Y = code/behavior change needed to reach spec · (Y) = adapt only.

### 8.A Spec core + attendees + operations (§1–§23)

| Spec § | Requirement | Existing implementation | Status | Target module | Migrated (Y/N) |
|---|---|---|---|---|---|
| §1–2 | Product vision; PLAN→DO→VERIFY→CONTROL loop | deges in daily-report/task lines only; no task engine | ➖ | tasks/planning | Y |
| §3–4 | **Company Control Tower** — real data, drillable | broken dashboard (`attendance_records`, `worker_count:0`, no drill) | ❌ | reporting | Y |
| §5–6 | Project as central entity (basic info) | `sites` master only (GPS, budget, client); no contract/status/phases | 🟡 | projects | Y |
| §7 | Project health indicators from defined rules | none | ➖ | projects/reporting | Y |
| §8 | Configurable project phases | `site_status_enum` (5 rough states) only | ➖ | projects/phases | Y |
| §9 | Engineering module with revisions | none | ➖ | eng docs | Y |
| §10 | Document control (revision/approval/supersedes, private storage) | only `expense_documents` state machine | 🟡 | docs | Y |
| §11 | Procurement (req→order→delivery) | none | ➖ | procurement | Y |
| §12 | Procurement alerts | none | ➖ | procurement | Y |
| §13 | Warehouse + inventory (balances, movements, project allocation) | `warehouses`,`site_stock`,`stock_movements` w/ integrity; RLS | 🟡 | stock | (Y) |
| §14 | Material accountability flow | movements ledger + mock report materials; no allocation | 🟡 | stock | Y |
| §15 | QR/barcode material scanning | `Alert` simulation only | 🧪 | mobile | Y |
| §16 | Task management (statuses, assignee, materials, attachments) | none | ➖ | tasks | Y |
| §17 | Duplicate work protection | none | ➖ | tasks | Y |
| §18 | Task dependencies | none | ➖ | tasks | Y |
| §19 | Blocked task system (structured reasons) | none | ➖ | tasks | Y |
| §20 | Blocked work dashboard | none | ➖ | reporting | Y |
| §21 | Plan→Do→Verify comparison | implicit only in daily reports | 🟡 | tasks/reports | Y |
| §22 | Daily production view | none | ➖ | reporting | Y |
| §23 | Daily report (field content) | mobile screen + DB tables; no photos/equipment/QA fields | 🟡 | reports | Y |

### 8.B Attendance, labour, expenses, BON/OCR (§24–§33)

| Spec § | Requirement | Existing implementation | Status | Target module | Migrated (Y/N) |
|---|---|---|---|---|---|
| §24 | Attendance AM VENIT/AM PLECAT + GPS + calc | mobile screen + `shared` calc; **not persisted online** | 🧪 | attendance | Y |
| §25 | Labour allocation project-aware | none | ➖ | attendance | Y |
| §26 | Labour cost (permissions, rates) | none | ➖ | finance | Y |
| §27 | Expense lifecycle DRAFT→REIMBURSED | statuses + UI + RLS + guard; reimbursement UI missing | 🟡 | expenses | (Y) |
| §28 | BON/FACTURĂ camera workflow | `ReceiptScanFlow` (capture→review→OCR→correct→category→site→payment→submit) | 🟡 | mobile/OCR | (Y) |
| §29 | OCR original vs user-corrected | columns exist; mobile writes OCR only, no corrections write | 🟡 | OCR/expense | Y |
| §30 | OCR confidence highlighting | `getLowConfidenceFields` shared + review UI | ✅ | shared/web/mobile | N |
| §31 | OCR ≠ approval | `review_required`, review-before-submit | ✅ | OCR | N |
| §32 | Invoice → stock receipt draft | none | ➖ | expenses/stock | Y |
| §33 | Avize (number, source/dest, vehicle, driver, movements) | `delivery_notes` subset | 🟡 | avize | (Y) |

### 8.C Finance, QA/QC, issues, commissioning, handover, roles (§34–§52)

| Spec § | Requirement | Existing implementation | Status | Target module | Migrated (Y/N) |
|---|---|---|---|---|---|
| §34 | Project finance (contract/budget/actual/committed/forecast) | `sites.budget` only; nothing else | ➖ | finance | Y |
| §35 | Cost breakdown (configurable) | none | ➖ | finance | Y |
| §36 | Transparent forecast methodology | none | ➖ | finance | Y |
| §37 | Change orders (scope/budget/schedule update, audited) | none | ➖ | change orders | Y |
| §38 | QA/QC inspections/checklists/tests with acceptance criteria | none | ➖ | QA/QC | Y |
| §39 | Flexible electrical test templates (company-defined criteria) | none | ➖ | QA/QC | Y |
| §40 | NCR / defect management | none | ➖ | issues/NCR | Y |
| §41 | Issue register (categories, severity, impact) | none | ➖ | issues | Y |
| §42 | Red-flag engine (rule-based exceptions with WHY/WHO/WHEN) | only low-stock trigger | ➖ | engine | Y |
| §43 | Cost-risk view (operational estimate w/ visible methodology) | none | ➖ | finance | Y |
| §44 | Project timeline (phases, owners) | none | ➖ | projects | Y |
| §45 | Plan vs actual comparison, drillable | none | ➖ | projects/reporting | Y |
| §46 | Work-package productivity metrics | none | ➖ | reporting | Y |
| §47 | Cost per output (per panel/kWp/m) | none | ➖ | reporting/finance | Y |
| §48 | Risk register | none | ➖ | risks | Y |
| §49 | Handover with required deliverables gate | none | ➖ | handover | Y |
| §50 | Commissioning phase (tests/results/corrections/signoff) | none | ➖ | commissioning | Y |
| §51 | Company operations modules set | partial (dashboard, employees, teams, attendance, reports, expenses, stock, notifications) | 🟡 | company ops | (Y) |
| §52 | Granular roles + project/module/action permissions | 4 roles; role helpers; no module/action granularity | 🟡 | auth/roles | Y |

### 8.D Mobile, offline, security, notifications, i18n (§53–§65)

| Spec § | Requirement | Existing implementation | Status | Target module | Migrated (Y/N) |
|---|---|---|---|---|---|
| §53 | Mobile field actions (AM VENIT/PLECAT, plan, tasks, report, expense, materials, QR, issues, photos, notifications) | subset: attendance, report, delivery, expense, notifications, settings | 🟡 | mobile | Y |
| §54 | Mobile field workflow "Today" screen | none | ➖ | mobile | Y |
| §55 | Offline mobile (SQLite, camera, GPS, files, sync queue) | AsyncStorage queue only; **no SQLite** | 🧪 | mobile/sync | Y |
| §56 | Sync operation states + idempotency | states in type; queue w/ idempotency; sync never invoked | 🧪 | mobile/sync | Y |
| §57 | Conflict resolution UX | none | ➖ | mobile/sync | Y |
| §58 | Camera for photos/scans/task/QA evidence | `ReceiptScanFlow` camera (expense only) | 🟡 | mobile/camera | Y |
| §59 | Document scanning (detect/crop/perspective/quality) | rotation/crop/upscale only (managed-Expo limits documented) | 🟡 | mobile/camera | Y |
| §60 | QR/barcode identify material/equipment/task/doc/asset | `Alert` simulation | 🧪 | mobile/QR | Y |
| §61 | Equipment/asset management | none | ➖ | assets | Y |
| §62 | Equipment availability feeds blocking | none | ➖ | assets/tasks | Y |
| §63 | Safety module (observations, incidents, toolbox talks, checklist) | none | ➖ | safety | Y |
| §64 | Client portal (future) | none | ➖ | portal | Y |
| §65 | Notification engine w/ deep links | in-app rows via triggers; no push/email; action_url present | 🟡 | notifications | Y |

### 8.E Help, i18n, analytics, standards, workflows, phasing (§66–§102)

| Spec § | Requirement | Existing implementation | Status | Target module | Migrated (Y/N) |
|---|---|---|---|---|---|
| §66 | Role-specific tutorial/help on every screen | shared tutorials (15 sections) rendered on web + mobile | ✅ | shared/web/mobile | N |
| §67 | RO+EN everywhere, no hardcoded text | 145 keys; **many screens hardcode RO strings** | 🟡 | i18n | Y |
| §68 | Owner analytics (drill company→project→task→evidence) | none | ➖ | reporting | Y |
| §69 | Project financial control | none | ➖ | finance | Y |
| §70 | Financial documents (receipt/invoice/aviz/credit note) | receipts/invoices via OCR; aviz sub-set | 🟡 | docs | (Y) |
| §71 | Reimbursements admin flow | table + statuses; no admin UI | 🟡 | expenses | Y |
| §72 | Audit log (who/what/when/old/new/reason) | `audit_logs` table + RLS; no writer | 🟡 | audit | Y |
| §73 | Database core entity list (55+ entities) | ~24 tables present of 55+ | 🟡 | db | Y |
| §74 | Monorepo layout | deviates: `shared/`, `web/`, `Mobile/` (not `apps/` + `packages/`) | 🟡 | structure | (Y) |
| §75 | Web stack (Next.js, TS, responsive, server-side auth) | Next.js 14 + TS; **no server-side authorization** (all client) | 🟡 | web | Y |
| §76 | Mobile stack (Expo, TS, SQLite, camera, GPS, push, sync) | Expo+TS+GPS+camera; **no SQLite/push/real sync** | 🟡 | mobile | Y |
| §77 | Security (never trust client; RLS; storage policies; no secrets) | RLS + storage policies + no client secrets; no app-layer authZ | 🟡 | security | Y |
| §78 | Offline data protection | none (plain AsyncStorage, no app lock) | ➖ | mobile/security | Y |
| §79 | Error handling (what / data preserved / what to do) | partial RO messages (OCR flows) | 🟡 | app-wide | Y |
| §80 | Empty states with action | some pages (santiere/notificari/statistici) | 🟡 | app-wide | Y |
| §81 | Testing strategy (unit/integration/E2E) | unit tests exist; **no integration/E2E** | 🟡 | tests | Y |
| §82–§87 | Critical workflows (project, expense, procurement, quality, change order, handover) | only the expense loop is partially implemented | 🟡 | workflows | Y |
| §88–§91 | Spec phases 1–4 plan | phase-1 items partially present; phases 2–4 mostly missing | 🟡 | all | Y |
| §92 | AI later, not first | none present (correct) | ➖ | later | N |
| §93–§94 | Management questions + "what must happen next" | dashboard only (broken) | ➖ | reporting | Y |
| §95–§97 | Design philosophy / no-ERP / no duplicate systems | generally aligned; **duplicate OCR parser `extract.ts` violates §97** | 🟡 | all | (Y) |
| §98–§99 | Dev rules / definition of done | docs list matches; practice incomplete | 🟡 | process | Y |
| §100–§102 | Final architecture vision + business loop | aligned at goal level | ➖ | all | Y |

---

## 9. Target Architecture Direction (summary)

Web/Mobile remain the UIs; a new **NestJS** layer becomes the only client of the database and owns authN/authZ, validation, business workflows, reporting and audit. The existing Supabase PostgreSQL becomes the initial backing store for the backend (same Postgres, server-side access), then is re-modeled/dual-written into an explicitly managed Postgres schema per `DATABASE_MIGRATION_MAP.md`. Storage stays object-based (bucket/ACL), OCR stays PaddleOCR behind a provider abstraction, notifications become a channel abstraction. Supabase Auth stays as identity provider during and after migration; Supabase REST/RLS/Edge roles are phased out path-by-path ("decommission last").

---

## 10. Key Risks (summary — detailed in `ARCHITECTURE_MIGRATION_PLAN.md`)
1. **Live-project dependency:** no real Supabase project or keys configured anywhere here → RLS/Edge/Storage behavior unverified (high likelihood, medium impact).
2. **Silent data-loss patterns:** mobile alert-and-forget paths + never-invoked sync can make users believe data was submitted (exists today, high impact).
3. **Authz blind spot:** RLS is the *only* authorization today; a NestJS layer that does not port these predicates faithfully would be insecure.
4. **Scope creep:** spec §5–§102 far exceeds current code; building everything before stabilizing the current core is the main schedule risk.
5. **No VCS/CI:** checkout has no `.git` and no CI; migration work needs a proper repo first.
6. **PaddleOCR on Windows CPU:** oneDNN/PIR caveats documented; service never run here; Python 3.14 + pydantic-only env (OCR service needs its own venv).

---

## 11. Verification Log (environment, 2026-09-18/19)

All commands executed from repo root unless noted; full detail in `VERIFICATION.md`.
- `npm install` → ✓ (1,213 packages)
- `npm run build --workspace=shared` → ✓
- `npm run typecheck` (shared + web + mobile) → ✓ 0 errors
- shared tests via tsx (`calculations`, `i18n`, `tutorials`) → ✓ (12 + all + 28 checks)
- Edge `extract.test.ts` → ✓ (36 assertions)
- `python -m pytest ocr-service/tests -q` → ✓ 6 passed (pydantic installed into global Python env)
- `npm run build --workspace=web` → ✓ 14 routes compiled
- `npm run web:dev` → live; HTTP 200 on all 14 routes; `/pontaje` → 404 (expected)
- Not run here: live Supabase calls, Edge Function deployment, PaddleOCR inference, mobile runtime.

---

*Companion documents: `ARCHITECTURE_MIGRATION_PLAN.md` · `FEATURE_GAP_ANALYSIS.md` · `DATABASE_MIGRATION_MAP.md` · `API_MIGRATION_MAP.md` · `TECHNICAL_DEBT.md` · `IMPLEMENTATION_ROADMAP.md`*