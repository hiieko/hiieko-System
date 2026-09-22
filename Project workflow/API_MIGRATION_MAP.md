# HIIEKO — API MIGRATION MAP

**Date:** 2026-09-18/19 · **Method:** every client→Supabase operation audited and mapped to the future NestJS endpoint contract. Current call paths are direct Supabase REST/Storage/Edge/Auth calls; target is `Web/Mobile → NestJS → Postgres`, with Supabase Auth retained as IdP.

**Conventions:**
- `S` = `supabase-js` client (web `lib/supabase.ts`, mobile `services/supabase.ts`)
- `M` = mobile; `W` = web. `WS-E` = future sync workstream.
- Target endpoint shape: `M{GET,POST,PATCH,DELETE} /api/v1/<resource>` + tenant scoping headers.

## 1. Auth operations
| # | Caller | Current call | Target NestJS | Notes |
|---|---|---|---|---|
| A1 | W login | `S.auth.signInWithPassword` | `POST /api/v1/auth/login` (proxy/finalize session) | Keep Supabase Auth as IdP; JWT returned |
| A2 | W signup | `S.auth.signUp` + insert `account_applications` | `POST /api/v1/auth/apply` | backend provisions auth user + application + notification |
| A3 | W session | `S.auth.getSession` / `onAuthStateChange` | `GET /api/v1/auth/session` + WS socket/SSE for state | keep client session helpers during transition |
| A4 | M login | `S.auth.signInWithPassword` (LoginScreen, unwired) | `POST /api/v1/auth/login` | wire into AppShell (ISSUE-002) |
| A5 | M token | `S.auth.getSession` (ocr.ts, expenseDocuments.ts) | `GET /api/v1/auth/token` | same JWT |
| A6 | W/M signOut | `S.auth.signOut` | `POST /api/v1/auth/logout` | |

## 2. Web REST reads/writes (per page)
| Page | Current calls (table:filter) | Target resource(s) |
|---|---|---|
| `/` dashboard | profiles, sites, **attendance_records (BROKEN→time_logs)**, expenses(pending), daily_reports(5), site_stock+join materials, delivery_notes(today) | `GET /api/v1/dashboard/overview` (one aggregate; fixes §3–§4) |
| `/avize` | delivery_notes + items + materials + sites + profiles | `GET /api/v1/avize` (+items); `POST /api/v1/avize` |
| `/santiere` | sites(active) + profiles(managers) | `GET /api/v1/projects` (or /sites until §5 land); `POST /api/v1/projects` |
| `/cheltuieli` | expenses list; `functions.invoke('ocr-extract')`; MOCK fallback | `GET /api/v1/expenses`; `POST /api/v1/ocr-jobs`; `GET /api/v1/expenses/:id` |
| `/aprobare` | expenses(filtered); (writes) expense_approvals + status change | `GET /api/v1/expenses?status=pending`; `POST /api/v1/expenses/:id/approve|reject|request-correction` |
| `/utilizatori` | profiles; account_applications + update status | `GET /api/v1/users`; `GET /api/v1/account-applications`; `POST /api/v1/account-applications/:id/approve|reject` |
| `/statistici` | profiles/sites/expenses/daily_reports aggregates | `GET /api/v1/dashboard/stats` |
| `/notificari` | notifications (reads + mark read) | `GET /api/v1/notifications`; `PATCH /api/v1/notifications/:id` |
| `/pontaj` (mock) | none today | `GET /api/v1/attendance?date=&scope=monthly` + CSV export endpoint |
| `/rapoarte` (mock) | none today | `GET /api/v1/daily-reports`; `POST /api/v1/daily-reports/:id/approve` |
| `/stocuri` (mock) | none today | `GET /api/v1/stock/balances`; `GET /api/v1/stock/movements` |
| `/profil` (static) | — | `GET/PATCH /api/v1/profiles/me` |
| `useSupabaseQuery` (lib) | generic `S.from(tb).select/eq/in/order/limit` | replaced by typed per-resource methods |

## 3. Authorization mapping (RLS → API)
| RLS helper / policy | Backend equivalent |
|---|---|
| `is_admin()` | `Authz.authorize('admin')` |
| `is_manager_or_admin()` | `Authz.hasAnyRole('manager','admin')` |
| `has_site_access(site)` | `Authz.hasProjectAccess(projectId)` (membership or manager-of-project) |
| owner-record policies (time_logs, expenses, notifications) | resource guard: `resource.ownerId === userId` + role fallback |
| storage policies (owner select/insert/update/delete + manager view) | file service guard: owner or manager/admin on linked entity |
| `get_auth_user_role()` | JWT profile claim re-validated per request from `profiles` |

## 4. Mobile operations (per service/screen)
| # | Caller | Current call | Target NestJS | Notes |
|---|---|---|---|---|
| M1 | `App.tsx` queue poll | `getOfflineQueue()` (AsyncStorage) | `POST /api/v1/sync` (batch) | sync becomes real (WS-E) |
| M2 | `WorkerAttendanceScreen` | local `setActiveTimeLog` only (no server calls today) | `POST /api/v1/attendance/clock-in`, `POST /api/v1/attendance/clock-out` | compute server-side; geofence verdict stored |
| M3 | `TeamLeaderDailyReportScreen` | enqueue `daily_report_submit`; online = alert | `POST /api/v1/daily-reports` (+items) | idempotency via `idempotency_key` |
| M4 | `DeliveryIntakeScreen` | enqueue `delivery_note_submit`; online = alert | `POST /api/v1/avize` + `POST /api/v1/stock/movements` | photo upload endpoint |
| M5 | `WorkerExpenseScreen` / `ReceiptScanFlow` | `expenseDocuments.ts`: storage upload → expenses insert → expense_documents insert | `POST /api/v1/expenses` (multipart: images + fields + ocr ref) | single call, tx in backend; file service |
| M6 | `services/ocr.ts` | `fetch /functions/v1/ocr-extract` (Edge) | `POST /api/v1/ocr-jobs` (async) + `GET /api/v1/ocr-jobs/:id` | provider abstraction (WS-F) |
| M7 | `NotificationCenter` | `S.from('notifications').select/update` | `GET/PATCH /api/v1/notifications` (same as web) | |
| M8 | `expenseDocuments` draft flow | AsyncStorage drafts + submitted-keys | retain local; server ack via idempotency | never delete local until ack |

## 5. Storage operations
| Current | Target | Notes |
|---|---|---|
| `storage.from('expense-documents').upload` (mobile) | `POST /api/v1/files` → object store; `GET /api/v1/files/:ref` (signed) | add buckets for avize/daily-report photos/engineering/QA/handover documents |

## 6. Edge Function / OCR service
| Current | Target | Notes |
|---|---|---|
| `ocr-extract` Deno fn: auth JWT → PaddleOCR `/v1/ocr/document` | NestJS `ocr-jobs` service → PaddleOCR (same URL/token) | retire Edge function after cut-over; `PADDLEOCR_URL/TOKEN` move to backend secrets |
| OCR service return `NormalizedDocument` | keep schema; feed `ocr_jobs` results → `expense_documents` state machine | e-Factura XML path preserved as adapter |

## 7. Deprecation order (R7)
1. Web pages that can switch first: profile, statistici, notificari, avize, santiere (read-only). 2. Approval/expense writes. 3. Mobile writes via sync. 4. OCR path. 5. Storage direct SDK. 6. `@supabase/supabase-js` removal from clients; Edge function removal; legacy mirror freeze.

## 8. Generic endpoint conventions for all modules
- `GET /api/v1/:res` — list w/ filters (eq/in/range/order/limit mirroring today's `useSupabaseQuery`), envelope `{data, total, error}`.
- `POST/PATCH/:id/DELETE/:id` with typed DTOs; validation 422; auth 401/403; not-found 404.
- Idempotency: `Idempotency-Key` header honored for all mobile writes.
- Tenant scoping: project/site ids always validated against authorization service; never trust client crypto.

*Companions: `PROJECT_AUDIT.md` §5 · `ARCHITECTURE_MIGRATION_PLAN.md` · `DATABASE_MIGRATION_MAP.md`.*