# HIIEKO — DATABASE MIGRATION MAP

**Date:** 2026-09-18/19 · **Source of truth today:** `supabase/full_setup.sql` + migrations 01–08 (concat verified consistent). **Target:** Postgres schema owned by the NestJS layer — same logical entities, explicit domain naming, service-level guards + RLS retained as defense-in-depth during transition.

**Disposition legend:** KEEP = reuse as-is (maybe renamed) · MERGE = combine tables · SPLIT = split into more tables · REPLACE = re-designed target · NEW = does not exist yet.

## A. Current tables → target

### A.1 Auth / People
| Current | Purpose | RLS / triggers / idx | Disposition | Target |
|---|---|---|---|---|
| `auth.users` (Supabase) | identity | Supabase-managed | KEEP | stays as IdP; JWT verified by backend |
| `profiles` | role(4), phone, is_active, employee_code, avatar, language | RLS self/admin; `handle_new_user`; updated_at trigger | KEEP → `profiles` | extend roles §52 (+ owner, pm, site_manager, technician, procurement, finance, qa_qc, viewer) |
| `user_site_assignments` | user↔site visibility | RLS self/site/admin | MERGE | → `project_members` (user, project, role, start/end, assigned_by) |
| `site_assignments` (04b) | user→site + role/dates | RLS site/admin | MERGE | → `project_members` (same target) |
| `teams` / `team_members` | work teams + membership | RLS site/lead/admin | KEEP → `teams`/`team_members` | add project link, effective dates |

### A.2 Sites / Projects
| Current | Disposition | Target / notes |
|---|---|---|
| `sites` (+ `site_status_enum`, status, client, dates, project_code, budget) | SPLIT → **Core** | `projects` (spec §5–§6: code, name, client+contacts, address, GPS, contract, currency, dates, PM/site manager, status/phase, MWp, notes) + `project_phases` (configurable §8) + `project_health` (cached indicators §7) |
| `warehouses` | KEEP → `warehouses` | + address/manager (already) + active flag (already) |
| (new) | | NEW `project_contracts`, `project_documents`, `document_revisions` (approval/supersede §9–§10), `project_budgets`, `project_costs`, `project_assignments` |
| (new) | | NEW `projects` statuses: PLANNING/ENGINEERING/PROCUREMENT/CONSTRUCTION/TESTING/COMMISSIONING/HANDOVER/COMPLETED/ON_HOLD/CANCELLED |

### A.3 Attendance & Reports
| Current | Purpose | RLS / triggers | Disposition | Target |
|---|---|---|---|---|
| `time_logs` | check-in/out + GPS + status + hours + overtime + rest + offline flags + idempotency | RLS self/site/admin; idx (user,date),(site,date) | KEEP → `time_logs` (or `attendance` rename decision) | + geofence_verdict, verified_by, source_device, server_computed flag (compute moves server-side) |
| `daily_reports` (+workers/tasks/materials) | team report | RLS site/lead + idempotency | KEEP → `daily_reports` + items | link `tasks`, `stock_movements`, photos; add equipment/QA/weather fields (§23) |
| (new) | | NEW `daily_report_approvals` (activate dormant `prevent_self_approval_report` flow) | | |
| (new) | | NEW `time_allocations` (project-aware attendance §25) | | |

### A.4 Stock & Delivery
| Current | Purpose | RLS / triggers | Disposition | Target |
|---|---|---|---|---|
| `materials` | catalog + barcode + thresholds + cost | RLS auth-read/manage | KEEP → `materials` | add QR, unit histories |
| `site_stock` | balance, CHECK≥0, UNIQUE(site,material) | RLS site | KEEP → `stock_balances` | + warehouse_id, reserved_qty |
| `stock_movements` | immutable ledger; `apply_stock_movement_trigger` prevents over-draw | RLS site+role | KEEP → `stock_movements` | extend movement_type: + allocation, transfer, return, adjustment (§13) |
| `delivery_notes` + `delivery_note_items` | aviz intake | RLS site + role; idempotency | KEEP → `avize` / `aviz_items` | + source/dest/vehicle/driver/status (§33) |
| (new) | | NEW `stock_allocations`, `stock_receipts` (+items), `stock_consumptions` (linked to daily_reports), `procurement_requests`, `purchase_orders` (+items), `deliveries` (§11, §13–§14, §32) | | |

### A.5 Expenses & Documents
| Current | Disposition | Target / notes |
|---|---|---|
| `expenses` (9-state lifecycle, category, payment, amounts, ocr_result, idempotency) | KEEP → `expenses` | link `stock_receipts` (invoice→stock §32); add payment_source clarity (§28) |
| `expense_documents` (07+08: document_state machine, raw/normalized/corrections, low-confidence, correlation_id, unique doc-hash) | KEEP → `expense_documents` | storage pointers to object store |
| `expense_approvals` + `prevent_self_approval_expense` | KEEP → `expense_approvals` | mirror guard in backend |
| `reimbursements` | KEEP → `reimbursements` | + admin workflow fields (method, reference, processed_by — mostly present) |
| (new) | | NEW `ocr_jobs` (expense_document_id, provider, state, correlation_id, retries, results JSONB) |

### A.6 Notifications / Audit / Applications
| Current | Disposition | Target / notes |
|---|---|---|
| `notifications` (RO/EN, priority, action_url, metadata; 6 DB-trigger senders) | KEEP → `notifications` | backend-inserted; triggers legacy→optional; add `notification_preferences` (per-type per-channel) |
| `audit_logs` | KEEP → `audit_logs` | backend service writes; add `old_value`/`new_value` JSONB per spec §72 |
| `account_applications` | KEEP → `account_applications` | add approve→provision action (create profile + notify) |
| `storage.buckets['expense-documents']` + 4 policies | KEEP → object store | add buckets: avize, daily-report photos, engineering docs, QA evidence, handover docs (§10, §33, §58) |

## B. Enums / types inventory (all migrate as Postgres enums)
Current 11: `user_role_enum`, `attendance_status_enum`, `report_status_enum`, `stock_movement_type_enum`, `account_application_status_enum`, `expense_status_enum`, `expense_category_enum`, `payment_method_enum`, `document_type_enum`, `site_status_enum`, `stock_receipt_status_enum`.
New enums needed: task status (§16: PLANNED/READY/IN_PROGRESS/BLOCKED/COMPLETED/VERIFIED/CANCELLED), blocked-task reason (§19), issue category/severity/status (§41), NCR status (§40), change-order status (§37), inspection/test result, commissioning, handover item status.

## C. Functions & triggers → how they migrate
| Function | Owner | Migration |
|---|---|---|
| `update_timestamp_column` | Postgres | KEEP (standard) |
| `apply_stock_movement_trigger` | Postgres | KEEP at DB (single-writer invariant); API mirrors `shared.validateStockMovement` errors |
| `handle_new_user` (auth.users) | Supabase Auth | KEEP (identity provisioning) |
| `get_auth_user_role` / `is_admin` / `is_manager_or_admin` / `has_site_access` | SQL | **port 1:1** to backend `AuthorizationService`; keep SQL versions active during dual-run |
| `create_notification` + 6 notification triggers | SQL | KEEP during carry-over; superseded by backend notification service |
| `prevent_self_approval_expense` / `prevent_self_approval_report` | SQL | KEEP first; mirrored in backend; triggers dropped only after cut-over |

## D. Data migration strategy (dual-run model)
1. **Extract → Transform → Load:** `pg_dump` targeted tables; map per section A (e.g. `sites`→`projects` picks fields; assignments merged; add `migrated_from` audit columns). Tag and archive demo seed data (migration 03) — do not carry demo users/IDs into production.
2. **Dual-write:** NestJS writes target tables and mirrors legacy tables in the same transaction; `drift-checker` job compares row counts + keyed hashes each run and blocks cut-over on divergence.
3. **UUID stability:** reuse existing UUIDs for `profiles`, `sites`→`projects`, materials, users (keeps storage paths, notifications and RLS references intact).
4. **Sequence:** profiles → members/teams → projects/phases → time_logs → daily reports → stock (materials, balances, movements) → deliveries/avize → expenses (+documents/approvals/reimbursements) → notifications → audit. Storage URLs migrated last (re-point or signed-URL; never move blobs before code understands the new URL scheme).
5. **Pre-cut-over checks:** FK integrity, enum drift, RLS-equivalence test suite, `idempotency_key` uniqueness, storage policy equivalence, notification/audit continuity.

*Companions: `PROJECT_AUDIT.md` §4 · `ARCHITECTURE_MIGRATION_PLAN.md` · `API_MIGRATION_MAP.md`.*