
| **OCR** | **\xf0\x9f\xa7\x8a FROZEN / DEFERRED** | OCR is not a current workstream. Deferred to final milestone per CLINE_MASTER_ROADMAP.md section 17. |
# HIIEKO — Current Status

**Last Updated:** 2026-10-05 (Phase 1 closure + Slice 7 hardening + Pontaj/task contract cleanup; all merged to `master`, CI/database gates green, Vercel deployment successful)
**Version:** pre-1.0 (Phase 1 authorization hardening accepted; broader production-readiness gaps remain)

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
- Legacy DDL archived at `database/archive/supabase-migrations/` (ETL source of truth only — never loaded at runtime)
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
| **R2.1 Sitesâ†’Projects P3** | âœ… **COMPLETE** | Web (Header, symbols, delete mock-data) — ProjectContext, no Site, no mock data |
| **R2.1 Sitesâ†’Projects P4** | âœ… **COMPLETE** | Shared cleanup — all dead Site-era contracts removed; `AuditLog.site_id?`, `Warehouse.site_id?`, `SiteStatus` type, `NotificationType.'site_assignment'`, `DashboardStats.active_sites` deleted; `site_id` zeroed from shared/dist; no DB migration required |
| **R2.1 Sitesâ†’Projects P5** | âœ… **COMPLETE** | Project authorization (members, guards, backfill) — 13 guard tests PASS, all routes protected |
| **R2.1 Sites→Projects P6** | ✅ **COMPLETE** | Documentation / closure reconciliation — all 12 workflow docs edited; verification gates re-run |
| **Solar Configurator** | ✅ **INTEGRATED** | origin/feature/solar-configurator merged into origin/master via integrate/solar-configuration; 52 new files; 202 tests; 22 web routes |

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

**R2.1 P6 — Documentation / closure reconciliation (2026-09-24).**

**Phase 10 — Solar Configurator Integration (2026-09-26).**

- origin/feature/solar-configurator merged into origin/master at commit 73d78e8
- Integration branch integrate/solar-configuration created, conflicts resolved (Sidebar.tsx only genuine conflict)
- Prisma client regenerated, shared package built
- Backend typecheck: 0 errors
- Web typecheck: 0 errors (dependencies installed: @react-three/drei, @react-three/fiber, three)
- Backend build: PASS
- Web build: PASS (22 routes, +solar-configurator)
- Backend tests: 25 suites / 202 tests PASS (was 154)
- Prisma validate: PASS
- Solar feature branch preserved; integration branch preserved
- OCR remains frozen/deferred; Supabase runtime remains removed

- All 12 `Project workflow/*.md` documents audited for factual consistency against live code and DB
- 47 factual defects cataloged and corrected across 5 primary docs + 7 tier-2 docs
- Historical Supabase/site-era sections marked with `> **âš ï¸ HISTORICAL / SUPERSEDED**` banners
- `CONFIGURATION.md` — entire file superseded; top-level banner redirects to current architecture
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

**R2.1 P4 — Shared cleanup (Site-era dead types removed).**

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

**R2.1 P5 — Project authorization (COMPLETE 2026-09-24):**

### Summary
Implemented full project-scoped authorization across all 102 routes:

1. **Hardened `ProjectAccessGuard`** — fail-closed, global-scope allowlist (ADMIN/OWNER/PM/MANAGER), entity-derived project resolution (tasks, plans, reports, teams, documents, expenses, change orders, inspections, issues, OCR jobs, purchase orders, avize), 403 for missing params, 404 for nonexistent entities.

2. **Membership endpoints** — `GET/POST/PATCH/DELETE /api/projects/:projectId/members` with role validation, uniqueness, audit logging, last-member protection.

3. **Auto-provisioning** — Project creation automatically creates the creator's `ProjectMember` row.

4. **Evidence-derived backfill** — Script at `backend/scripts/backfill-project-members.ts` with `--dry-run` support, deriving candidates from global-scope users, attendance, teams, daily plans/reports, expenses, issues, and tasks.

5. **Project list scoping** — `GET /api/projects` now returns only authorized projects for non-global roles, fixing both web ProjectContext and mobile project lists simultaneously.

6. **Purchase orders** — Project-scoped; `findAllPurchaseOrders` accepts optional `projectId` filter.

7. **Controller protection** — All 30 controllers updated: `ProjectAccessGuard` + `@RequireProjectAccess`/`@RequireEntityProjectAccess` decorators.

8. **Tests** — 13 guard unit tests (global roles, member access, fail-closed, entity-derived, unauthenticated). E2E test at `e2e/project-access.js`.

## 6. Phase 1 acceptance / closure

**Phase 1 authorization hardening: COMPLETE (2026-10-05).**

- PR #1 (`fix: restore production document upload`) merged to `master` after correcting the document-type enum in the upload test; post-fix Typecheck, Tests, and Build all passed.
- PR #2 (`fix: harden users roles and organization boundaries`) merged to `master` after correcting stale test doubles for the `AuthenticatedUser` contract and organization-scoped `findFirst`; post-fix Typecheck, Tests, and Build all passed.
- Authorization review confirmed organization scoping in `UsersService.findAll/findOne`, ADMIN/OWNER-only role/status mutation, session revocation on suspension, document project guards, entity-derived document project checks, and PM exclusion from the global project-scope allowlist.
- Vercel deployment for the final `master` merge commit completed successfully.
- No live backend HTTP smoke test was claimed here because the available deployment integration exposes Vercel deployment status but not an authenticated runtime API test harness. Code-level acceptance and CI evidence are green.

### Remaining production-readiness / product gaps
- No dedicated staging/production CI deployment pipeline or rollback automation
- No monitoring/alerting/structured production logging beyond application error handling
- ISSUE-039: resolved — field-supervisor roster access is now organization-scoped and permitted
- ISSUE-043: resolved for evidence-backed query paths; non-evidenced indexes remain intentionally absent
- ISSUE-054: accepted design divergence; no code change warranted
- ISSUE-056: RESOLVED 2026-10-05; Romanian copy/role-map cleanup is complete for the R1B scope; Mobile role-map duplication was already resolved and frozen-Mobile runtime behavior was not changed.
- ISSUE-050: development fixture-task cleanup/product decision remains open
- Broader frontend/mobile/product completion remains after the remediation slices.

## 7. Remaining remediation / product work

**Core remediation slices 1–7: COMPLETE.** Slice 8 CI enforcement is active in the repository, and Slice 9 frontend contract alignment is ongoing.

**R2.6 — Core Operations Completion (Implementation Audit).** R2.1 Sites→Projects is fully complete across all 6 phases. See `IMPLEMENTATION_ROADMAP.md` for the next milestones.

### R2.6 Audit Summary (2026-09-24)

**All 28 backend modules verified** — Every module in `backend/src/modules/` has a controller, service, and module file. Full inventory in PROGRESS.md.

**Correction to prior session summary:** The modules `asks` and `ask-dependencies` do NOT exist in the codebase (they were likely planned but never created). All other previously-reported-missing modules DO exist: daily-plans, daily-reports, attendance, inventory (stock), procurement (purchase-orders), qa-qc, issues, change-orders, costs, control-tower, notifications, documents, upload, ocr, roles, permissions, materials, suppliers, warehouses, users, auth, expenses, project-stages, audit.

**Next recommended actions:**
1. Verify the solar-configurator route works in development environment
2. Apply Prisma migration to production database (npx prisma migrate deploy)
3. Monitor for any runtime issues with solar module
4. Consider adding integration tests for solar configurator API endpoints
5. Add unit tests for untested modules (14 of 28 modules have zero tests)
6. Fix known gaps (missing route, missing role decorators, activate PermissionsGuard)
7. Perform frontend audit (web + mobile coverage against backend modules)

## 8. Known carried-over gaps

- **ISSUE-023:** a safe reconciliation script now maps the 8 legacy development users to AR-001/TM-002/CJ-003; it is dry-run by default and requires `--apply`.
- **ISSUE-049:** concurrent next dev processes can corrupt the shared web/.next cache. A guard is being added in the current close-out branch; until merged, run only one web dev server.
- **ISSUE-050:** an explicit development-only cleanup script now targets the four CJ-003 verification fixtures; it is dry-run by default and requires `--apply` after accepting the evidence impact.
- **ISSUE-051:** Mobile daily-report submission still has a task-ID/draft-loss defect. Mobile is frozen for the remediation program, so this remains deferred.
- **ISSUE-053:** frontend navigation and backend @Roles contracts still have documented business-rule divergences; this requires an explicit authorization decision rather than an incidental UI fix.
- **ISSUE-056:** RESOLVED 2026-10-05; Control Tower/drilldown copy is locale-keyed, the remaining worker R1B copy coupling is removed, and the role-visibility matrix encoding debt is normalized.
- **PermissionsGuard:** permission catalog and guard coverage are merged; endpoint metadata/role grants remain intentionally unenforced pending a complete business permission matrix.
- **Procurement:** `GET /api/procurement/avize/:id` is implemented and entity-project scoped.
- **Production readiness:** health/live + health/ready probes and structured HTTP request logs are now in place. Provider-specific staging/production deployment, rollback automation, and external monitoring/alerting still require deployment-provider credentials/configuration.

## 9. Project authorization

**R2.1 P5: COMPLETE** — Full project-scoped authorization enforced.

### Global-scope roles (membership-exempt)
- ADMIN, OWNER, MANAGER — bypass project membership checks.
- PM is not global-scope; PM project access requires a ProjectMember assignment.

### Membership lifecycle
- **Provisioning:** Auto-created on project creation. Manual via POST /api/projects/:projectId/members.
- **Management:** GET, PATCH :userId, DELETE :userId — restricted to ADMIN/OWNER/PM/MANAGER roles.
- **Backfill:** backend/scripts/backfill-project-members.ts (evidence-derived, idempotent, --dry-run support).
- **Last-member protection:** Removal blocked when a project would have zero members.

### Entity-derived resolution
The guard resolves project_id from entities including tasks, daily plans, daily reports, teams, documents, expenses, change orders, inspections, issues, OCR jobs, purchase orders, and avize. Returns 404 if an entity is not found and 403 if unauthorized.

### Purchase orders
Project-scoped. GET /api/procurement/purchase-orders accepts optional projectId. When omitted, results are filtered by global-scope role or project membership.

## 10. Current production-readiness gaps

- **Pre-1.0:** the repository is not yet declared production-ready.
- **Deployment:** no dedicated staging/production CI deployment pipeline or automated rollback.
- **Observability:** no production-grade monitoring, alerting, or structured logging beyond application error handling.
- **Governance:** PermissionsGuard is not activated and its permission tables are unseeded.
- **Product/UX:** ISSUE-050, ISSUE-051 and other explicitly deferred items remain as described above; ISSUE-056 is RESOLVED.
- **Security status:** authentication rate limiting is implemented and shared across API instances (Slice 7); refresh-token rotation/revocation is implemented (Slice 2); the Control Tower role boundary is implemented (PR #5 / ISSUE-052 resolved).
## 11. Supabase future

**No new Supabase functionality will be introduced.** The migration from Supabase to NestJS+PostgreSQL is complete. Any future changes will use the existing architecture.

