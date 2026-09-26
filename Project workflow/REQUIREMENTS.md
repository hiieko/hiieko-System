# Requirements

Last Updated: 2026-09-24 (R2.1 P6 CLOSURE — Documentation reconciliation)

> **⚠️ HISTORICAL / SUPERSEDED:** Requirements below that reference Supabase auth, Supabase storage, Supabase Edge Functions, or RLS policies were originally written against the Supabase-era architecture. As of 2026-09-23, the backend is NestJS + Prisma + PostgreSQL 18, and Supabase has been fully removed from the runtime. See CURRENT_STATUS.md for the authoritative architecture.

## Status Legend
- `DONE` — implemented and verified
- `PARTIAL` — partially implemented
- `IN PROGRESS` — actively being implemented
- `BLOCKED` — cannot currently proceed
- `NOT STARTED` — not implemented

# Functional Requirements

## REQ-001 — Authentication and user profiles
**Status:** PARTIAL (web DONE; mobile demo bypass — ISSUE-002)

### Description
Email/password login, sign-up with auto-created profile, account-application flow, role-based experiences (`admin`, `manager`, `team_leader`, `worker`).

### Acceptance Criteria
- [x] Web login/signup and account applications against Supabase auth.
- [x] `profiles` table + RLS with roles and `is_active`.
- [ ] Mobile signs in the real user; `App.tsx` uses a hardcoded demo user (ISSUE-002).

### Related Files
- `web/src/app/login/page.tsx`, `web/src/app/signup/page.tsx`, `web/src/app/utilizatori/page.tsx`
- `Mobile/src/screens/LoginScreen.tsx`, `Mobile/App.tsx`
- `supabase/migrations/04*_security_policies.sql`

### Verification
Typecheck + manual sign-in against a live Supabase project.

## REQ-002 — Attendance tracking with geofencing
**Status:** PARTIAL

### Description
Workers check in/out at geofenced site locations; overtime minutes are calculated; attendance is summarized.

### Acceptance Criteria
- [x] Geofence/overtime logic implemented and tested (`shared/src/calculations.ts`; PASS in `shared/shared_test_out.txt`).
- [x] Mobile check-in/out screen functional (demo data).
- [x] `time_logs` table + RLS in the database.
- [ ] `/pontaj` web page live (currently mock).
- [ ] Dashboard uses the correct table (`attendance_records` does not exist — ISSUE-001).

### Related Files
- `shared/src/calculations.ts`, `Mobile/src/screens/WorkerAttendanceScreen.tsx`, `web/src/app/page.tsx`, `web/src/app/pontaj/page.tsx`

### Verification
Unit tests + live query on a migrated DB.

## REQ-003 — Team-leader daily reports
**Status:** PARTIAL

### Description
Team leaders submit end-of-day reports; managers/admins review them.

### Acceptance Criteria
- [x] `daily_reports` table + RLS + notification trigger.
- [x] Mobile report screen (demo path).
- [ ] Web `/rapoarte` review UI live (currently mock).

### Related Files
- `Mobile/src/screens/TeamLeaderDailyReportScreen.tsx`, `web/src/app/rapoarte/page.tsx`, `supabase/migrations/01_initial_schema.sql`

## REQ-004 — Delivery notes and stock management
**Status:** PARTIAL

### Description
Record supplier delivery notes (aviz), update stock with an audit trail, track site stock, prevent negative stock.

### Acceptance Criteria
- [x] `delivery_notes`, `stock_movements`, `site_stock` + integrity trigger (no negatives).
- [x] Web `/avize` and `/santiere` live.
- [x] Mobile delivery intake screen (demo path).
- [ ] `/stocuri` web page live (currently mock).
- [ ] Offline delivery submissions persist to the queue and sync (ISSUE-005).

### Related Files
- `web/src/app/avize/page.tsx`, `web/src/app/stocuri/page.tsx`, `Mobile/src/screens/DeliveryIntakeScreen.tsx`

## REQ-005 — Expense management with OCR scanning
**Status:** PARTIAL

### Description
Capture receipts/invoices, OCR them (private PaddleOCR service via Edge Function), review low-confidence fields, route through approval (no self-approval).

### Acceptance Criteria
- [x] Full pipeline implemented (client → storage → Edge Function → PaddleOCR → normalized fields → review → confirm).
- [x] Approval UI (`/aprobare`) with self-approval prevention.
- [x] e-Factura XML ingestion + Romanian validation rules in the OCR service.
- [x] Mobile expense submit with optional `ReceiptScanFlow` (demo submission path).
- [ ] Requires deployed Edge Function + secrets + running OCR service (unverified here).

### Related Files
- `supabase/functions/ocr-extract/`, `ocr-service/`, `web/src/app/cheltuieli/page.tsx`, `web/src/app/aprobare/page.tsx`, `Mobile/src/screens/ReceiptScanFlow.tsx`

## REQ-006 — Notifications
**Status:** DONE (DB triggers + web/mobile centers; inspection-verified)

### Description
Notify managers/admins on report submission, delivery received, low stock, account applications; per-user settings.

### Related Files
- `supabase/migrations/05*_notifications.sql`, `web/src/app/notificari/page.tsx`, `Mobile/src/screens/NotificationCenterScreen.tsx`

## REQ-007 — Account applications
**Status:** DONE (web flow + DB triggers; inspection-verified)

### Description
Apply for an account; admin approves/rejects; outcome is notified.

## REQ-008 — Localization (Romanian-first)
**Status:** DONE

### Description
`ro`/`en` UI strings via `@solar/shared` translations with contextual i18n.

## REQ-009 — Offline-first mobile operation
**Status:** PARTIAL

### Description
Without connectivity, queue actions and sync with idempotency keys.

### Acceptance Criteria
- [x] Queue + idempotency key infrastructure (`Mobile/src/services/storage.ts`).
- [x] Attendance offline path persists.
- [ ] Expense/delivery offline paths simulate success without real persistence (ISSUE-005).

## REQ-010 — Dashboard and statistics
**Status:** BLOCKED (dashboard metrics query `attendance_records`, which does not exist — ISSUE-001)

### Description
Live today counts, approvals, stock alerts, recent reports; statistics page with site/team aggregates.

## REQ-011 — Guided tutorials
**Status:** DONE

### Description
Tutorial content keyed by page/screen id, provided by `@solar/shared`.

## REQ-012 — OCR XML (e-Factura) ingestion
**Status:** PARTIAL

### Description
Accept e-Factura XML, normalize, validate, and require review when validation fails.

# Non-Functional Requirements

## NFR-001 — Performance
**Status:** NOT VERIFIED
### Requirement
Acceptable page load and OCR round-trip latency on typical 4G connections.
### Verification
Load tests + OCR latency measurements (not yet performed).

## NFR-002 — Security
**Status:** PARTIAL (design implemented; live audit pending)
### Requirement
RLS on all tables; private storage bucket; no client-held OCR secrets; Edge Function verifies caller JWT.
### Verification
Policy review (2026-09-18) + live RLS/permission audit (pending).

## NFR-003 — Reliability (offline resilience)
**Status:** PARTIAL
### Requirement
Offline actions queued and synchronized with idempotency keys.
### Verification
`storage.ts` unit path (partially tested) + device tests (pending).

## NFR-004 — Maintainability
**Status:** PARTIAL
### Requirement
Type-shared domain, decision records, enforced workflow docs.
### Verification
Docs baseline established 2026-09-18; further audits pending.

## NFR-005 — Documentation currency
**Status:** PARTIAL
### Requirement
Docs reflect reality (regenerated from audit on 2026-09-18).
### Verification
Review of all `Project workflow/*.md` + `docs/AI_INSTRUCTIONS.md`.

# Requirement Summary
| ID | Requirement | Status |
|---|---|---|
| REQ-001 | Authentication and profiles | PARTIAL |
| REQ-002 | Attendance with geofencing | PARTIAL |
| REQ-003 | Daily reports | PARTIAL |
| REQ-004 | Deliveries and stock | PARTIAL |
| REQ-005 | Expenses and OCR | PARTIAL |
| REQ-006 | Notifications | DONE |
| REQ-007 | Account applications | DONE |
| REQ-008 | Localization | DONE |
| REQ-009 | Offline-first mobile | PARTIAL |
| REQ-010 | Dashboard/statistics | BLOCKED |
| REQ-011 | Guided tutorials | DONE |
| REQ-012 | XML (e-Factura) OCR | PARTIAL |
| NFR-001 | Performance | NOT VERIFIED |
| NFR-002 | Security | PARTIAL |
| NFR-003 | Reliability | PARTIAL |
| NFR-004 | Maintainability | PARTIAL |
| NFR-005 | Documentation currency | PARTIAL |

# Changes to Requirements
| Date | Requirement | Change | Reason |
|---|---|---|---|
| 2026-09-18 | all | Baseline created from repository audit | Templates replaced with evidence-based inventory |
