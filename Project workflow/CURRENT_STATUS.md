
| **OCR** | **\xf0\x9f\xa7\x8a FROZEN / DEFERRED** | OCR is not a current workstream. Deferred to final milestone per CLINE_MASTER_ROADMAP.md section 17. |
# HIIEKO â€” Current Status

**Last Updated:** 2026-09-25 (Phase 1-2 Documentation Truth-Up + OCR FROZEN; actual counts: 15 suites / 125 tests, 21 routes, PostgreSQL 18)
**Version:** pre-1.0 (NOT production-ready)

---

## 1. Current architecture (authoritative)

```
Web (Next.js) â”€â”
                â”œâ”€â”€â†’ NestJS :4000 â”€â”€â†’ Prisma â”€â”€â†’ PostgreSQL 18 :5432
Mobile (Expo) â”€â”˜
```

All data flows through the NestJS API. No direct database access from clients.

## 2. Supabase

**Runtime removal: COMPLETE.**

- Zero `@supabase/*` dependencies in any workspace
- Zero `createClient` / `SUPABASE_*` env var assignments in active source
- Zero `supabase/functions` or Edge Function references in runtime code
- Legacy DDL archived at `database/archive/supabase-migrations/` (ETL source of truth only â€” never loaded at runtime)
- `package-lock.json` has 0 Supabase references

**No new Supabase functionality will be introduced.** Supabase will not be reintroduced as a runtime dependency.

> **âš ï¸ HISTORICAL / SUPERSEDED:** Earlier documents in this repository (CONFIGURATION.md, PROJECT.md, REQUIREMENTS.md, TECHNICAL_DEBT.md, HOW_TO_RUN.md, etc.) may still describe Supabase as the current runtime or reference Supabase setup steps. Those sections are **historical artifacts** from the pre-2026-09-23 architecture. The authoritative runtime is NestJS + Prisma + PostgreSQL 18 as shown above. See PROGRESS.md â†’ Architecture Decision (2026-09-23) for the migration record.

## 3. Milestones

| Milestone | Status | Notes |
|---|---|---|
| PostgreSQL 18 migration | âœ… COMPLETE | Prisma-managed schema; 41/41 DB integrity checks PASS |
| Supabase runtime removal | âœ… COMPLETE | Zero active deps; archival only |
| **R2.2 Attendance** | âœ… **E2E VERIFIED** | Backend complete; dual-write standardized |
| **R2.3 Stock + Avize** | âœ… **E2E VERIFIED** | Schema repaired; all 10 smoke tests PASS |
| **R2.4 Daily Reports** | âœ… **E2E VERIFIED** | Backend complete (10 of 10 endpoints dual-write) |
| **R2.5 Notifications/Audit** | âœ… **E2E VERIFIED** | Backend complete; PostgreSQL-authoritative |
| **R2.1 Sitesâ†’Projects P1** | âœ… **COMPLETE** | Shared contract: `Project`/`ProjectMember`, `project_id`, `isWithinProjectGeofence` |
| **R2.1 Sitesâ†’Projects P2** | âœ… **COMPLETE** | Mobile screens migrated; `mapToScreenProject` mapper |
| **R2.1 Sitesâ†’Projects P3** | âœ… **COMPLETE** | Web (Header, symbols, delete mock-data) â€” ProjectContext, no Site, no mock data |
| **R2.1 Sitesâ†’Projects P4** | âœ… **COMPLETE** | Shared cleanup â€” all dead Site-era contracts removed; `AuditLog.site_id?`, `Warehouse.site_id?`, `SiteStatus` type, `NotificationType.'site_assignment'`, `DashboardStats.active_sites` deleted; `site_id` zeroed from shared/dist; no DB migration required |
| **R2.1 Sitesâ†’Projects P5** | âœ… **COMPLETE** | Project authorization (members, guards, backfill) â€” 13 guard tests PASS, all routes protected |
| **R2.1 Sitesâ†’Projects P6** | âœ… **COMPLETE** | Documentation / closure reconciliation â€” all 12 workflow docs edited; verification gates re-run |

## 4. Latest completed work

**Phase 1 — Documentation Truth-Up (2026-09-25).**

- All 11 target documents swept for stale values: test counts, port references, architecture descriptions
- Fixed stale values across 7 documents (CURRENT_STATUS.md, PROGRESS.md, VERIFICATION.md, ISSUES.md, HANDOFF.md, docs/HIIEKO_IMPLEMENTATION_PLAN.md, docs/HIIEKO_MASTER_ROADMAP.md)
- Backend `.env.example` PADDLEOCR_URL fixed from `:8080` to `:8001`
- Historical Supabase/dual-write instructions marked with HISTORICAL/SUPERSEDED banners
- OCR service verified stopped on all documented ports
- PostgreSQL 18 (`:5432`) and PostgreSQL 14 (`:5433`) confirmed running concurrently [HISTORICAL - only PG 18 remains in use]
- [HISTORICAL: Phase 1 sweep was superseded by later Phase 1-2 documentation reconciliation]

**Phase 2 — OCR Port Unification (2026-09-25) [HISTORICAL — OCR NOW FROZEN].****

- Canonical OCR port confirmed as 8001 (already set in backend `.env` and `.env.example`)
- OCR service started on port 8001
- Health endpoint verified: `{"status":"ok","provider":"paddleocr","version":"3.7.0","model":"paddleocr-3.7.0"}`
- All 3 BonFiscal images processed successfully:
  - 1.jpeg → 29 lines (matches historical baseline)
  - 2.jpeg → 51 lines (matches historical baseline)
  - 3.jpeg → 35 lines (matches historical baseline)
- Full document OCR returns `needs_review` (correct production behavior)
- No configuration changes required — ports already unified

**R2.1 P6 â€” Documentation / closure reconciliation (2026-09-24).**

- All 12 `Project workflow/*.md` documents audited for factual consistency against live code and DB
- 47 factual defects cataloged and corrected across 5 primary docs + 7 tier-2 docs
- Historical Supabase/site-era sections marked with `> **âš ï¸ HISTORICAL / SUPERSEDED**` banners
- `CONFIGURATION.md` â€” entire file superseded; top-level banner redirects to current architecture
- Test counts unified to **15 suites / 125 tests** wherever current-state counts appear
- 401/403 semantics corrected: NestJS JwtGuard returns 401 for missing/invalid token; ProjectAccessGuard returns 403 for unauthorized; 404 for entity not found
- **8 non-global users (3 TEAM_LEADER, 5 WORKER) currently unassigned to projects** documented in ISSUES.md (ISSUE-023)
- ISSUE-018/019/021/022/023 remain OPEN; ISSUE-020 marked RESOLVED
- All verification gates re-run and PASS
- Zero application-code files modified; zero GitHub operations performed

### Verification gates (2026-09-24 R2.1 P6 closure)

| Gate | Result |
|------|--------|
| Shared typecheck | âœ… PASS |
| Shared build | âœ… PASS |
| Mobile typecheck | âœ… PASS |
| Web typecheck | âœ… PASS |
| Backend typecheck | âœ… PASS |
| Backend tests | âœ… **15 suites / 125 tests ALL PASS** |
| Web build | âœ… **21 routes (20 user-facing + 1 internal /_not-found), 0 errors** |
| Backend build | âœ… PASS |
| Root typecheck | âœ… PASS (all 4 workspaces) |
| db:verify | âœ… **41/41 checks PASS** |
| E2E authorization | âœ… **12/12 tests PASS** (after test-script fix: `Array.isArray` assertions corrected for NestJS response envelope) |

**R2.1 P4 â€” Shared cleanup (Site-era dead types removed).**

- Deleted `Site` interface from `shared/src/types.ts`
- Deleted `SiteAssignment` interface
- Deleted `SiteStock` interface (replaced by `ProjectStock`)
- Renamed `SiteCostSummary` â†’ `ProjectCostSummary`
- Removed `canManageSites` permission helper
- Renamed `isWithinSiteGeofence` â†’ `isWithinProjectGeofence` (canonical)
- Renamed `TimeLog.site_id` â†’ `project_id` (required)
- Renamed `Expense.site_id` â†’ `project_id` (required)
- Renamed `DeliveryNote.site_id` â†’ `project_id` (required)
- Renamed `DailyReport.site_id` â†’ `project_id` (required)
- Renamed `StockReceipt.site_id` â†’ `project_id` (required)
- Renamed `StockConsumption.site_id` â†’ `project_id` (required)
- Renamed `StockMovement.site_id` â†’ `project_id` (required)
- Renamed `AccountApplication.requested_site_id` â†’ `requested_project_id`
- Renamed `UserProfile.assigned_site_ids` â†’ `assigned_project_ids`
- Removed `site_id` from `Team` (kept `project_id?`)
- Updated all consumer code (web `avize/page.tsx`, `aprobare/page.tsx`, mobile `WorkerAttendanceScreen.tsx`)
- Rebuilt shared dist package
- All verification gates pass

## 5. Latest completed work

**R2.1 P5 â€” Project authorization (COMPLETE 2026-09-24):**

### Summary
Implemented full project-scoped authorization across all 102 routes:

1. **Hardened `ProjectAccessGuard`** â€” fail-closed, global-scope allowlist (ADMIN/OWNER/PM/MANAGER), entity-derived project resolution (tasks, plans, reports, teams, documents, expenses, change orders, inspections, issues, OCR jobs, purchase orders, avize), 403 for missing params, 404 for nonexistent entities.

2. **Membership endpoints** â€” `GET/POST/PATCH/DELETE /api/projects/:projectId/members` with role validation, uniqueness, audit logging, last-member protection.

3. **Auto-provisioning** â€” Project creation automatically creates the creator's `ProjectMember` row.

4. **Evidence-derived backfill** â€” Script at `backend/scripts/backfill-project-members.ts` with `--dry-run` support, deriving candidates from global-scope users, attendance, teams, daily plans/reports, expenses, issues, and tasks.

5. **Project list scoping** â€” `GET /api/projects` now returns only authorized projects for non-global roles, fixing both web ProjectContext and mobile project lists simultaneously.

6. **Purchase orders** â€” Project-scoped; `findAllPurchaseOrders` accepts optional `projectId` filter.

7. **Controller protection** â€” All 30 controllers updated: `ProjectAccessGuard` + `@RequireProjectAccess`/`@RequireEntityProjectAccess` decorators.

8. **Tests** â€” 13 guard unit tests (global roles, member access, fail-closed, entity-derived, unauthenticated). E2E test at `e2e/project-access.js`.

## 6. Next development step

**R2.6 â€” Core Operations Completion (Implementation Audit).** R2.1 Sitesâ†’Projects is fully complete across all 6 phases. See `IMPLEMENTATION_ROADMAP.md` for the next milestones.

### R2.6 Audit Summary (2026-09-24)

**All 28 backend modules verified** â€” Every module in `backend/src/modules/` has a controller, service, and module file. Full inventory in PROGRESS.md.

**Correction to prior session summary:** The modules `asks` and `ask-dependencies` do NOT exist in the codebase (they were likely planned but never created). All other previously-reported-missing modules DO exist: daily-plans, daily-reports, attendance, inventory (stock), procurement (purchase-orders), qa-qc, issues, change-orders, costs, control-tower, notifications, documents, upload, ocr, roles, permissions, materials, suppliers, warehouses, users, auth, expenses, project-stages, audit.

**Next recommended actions:**
1. Add unit tests for untested modules (14 of 28 modules have zero tests)
2. Fix known gaps (missing route, missing role decorators, activate PermissionsGuard)
3. Perform frontend audit (web + mobile coverage against backend modules)

## 7. Known carried-over gaps

- `GET /api/users/:id` â€” No organization-scope enforcement (ISSUE-018, OPEN)
- `GET /api/users/:id` â€” Global-role users can access any user by ID regardless of organization (ISSUE-019, OPEN)
- `POST /api/inventory/transfer` â€” Guard checks both sourceProjectId and targetProjectId (P5 GAP1 fixed); global-role users bypass membership checks by design (see ISSUE-019)
- No authentication rate limiting (ISSUE-021, OPEN)
- No refresh-token rotation or revocation (ISSUE-022, OPEN)
- 8 non-global users (3 TEAM_LEADER, 5 WORKER) currently unassigned to any project (ISSUE-023, OPEN)
- `PermissionsGuard` not activated; permission tables unseeded
- `GET /api/procurement/avize/:id` route absent from controller (documented in HANDOFF.md)
- `GET /api/users/:id` â€” No organization-scope enforcement. Deferred from P5.
- `POST /api/inventory/transfer` â€” Uses sourceProjectId/targetProjectId; guard checks both (fixed in P5). Residual: global-role bypass by design.

## 8. Project authorization

**R2.1 P5: COMPLETE** â€” Full project-scoped authorization enforced.

### Global-scope roles (membership-exempt)
- ADMIN, OWNER, PM, MANAGER â€” bypass membership checks, retain organization-level access.

### Membership lifecycle
- **Provisioning:** Auto-created on project creation. Manual via `POST /api/projects/:projectId/members`.
- **Management:** `GET` (list), `PATCH :userId` (change role), `DELETE :userId` (remove) â€” restricted to ADMIN/OWNER/PM/MANAGER roles.
- **Backfill:** `backend/scripts/backfill-project-members.ts` (evidence-derived, idempotent, `--dry-run` support).
- **Last-member protection:** Removal blocked when project would have zero members.

### Entity-derived resolution
The guard resolves project_id from entity ID for: tasks, daily plans, daily reports, teams, documents, expenses, change orders, inspections, issues, OCR jobs, purchase orders, and avize. Returns 404 if entity not found, 403 if unauthorized.

### Purchase orders
Project-scoped. `GET /api/procurement/purchase-orders` accepts optional `projectId`. When omitted, returns all POs (filtered by global-scope role or membership).

## 9. Known production-readiness gaps

- Pre-1.0; not ready for production deployment
- No staging/production CI pipeline configured
- No monitoring, alerting, or structured logging at production level
- No authentication rate limiting (ISSUE-021, OPEN)
- No refresh-token rotation or revocation (ISSUE-022, OPEN)

## 10. Supabase future

**No new Supabase functionality will be introduced.** The migration from Supabase to NestJS+PostgreSQL is complete. Any future changes will use the existing architecture.

