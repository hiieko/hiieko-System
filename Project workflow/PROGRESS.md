# Project Progress

> **Canonical current status document.**
> Historical material has been moved to `archive/PROGRESS_HISTORY.md`.

**Last Updated:** 2026-09-25 (Phase 3.2 Authorization Hardening complete — 20 suites / 154 tests, 60/60 db:verify, all typechecks PASS)

---

## Current Status

| Check | Status | Notes |
|-------|--------|-------|
| **Phase 3.2 Authorization Hardening** | ✅ **COMPLETE** | ISSUE-033/034/035 resolved; RoleGuard wired on 8 pages; OWNER management sidebar; project scoping on 13 controllers |
| **Backend Tests** | ✅ **PASS** | 20 suites / 154 tests |
| **db:verify** | ✅ **PASS** | 60/60 checks |
| **Backend Typecheck** | ✅ **PASS** | 0 errors |
| **Shared Typecheck** | ✅ **PASS** | 0 errors |
| **Web Typecheck** | ✅ **PASS** | 0 errors |
| **Backend Build** | ✅ **PASS** | `nest build` exit 0 |
| **Web Build** | ✅ **PASS** | 21 routes, 0 errors |
| **Prisma Validate** | ✅ **PASS** | Schema valid |
| **PostgreSQL 18** | ✅ **Canonical** | `localhost:5432` is the canonical development database |

---

## Milestones

### ✅ Phase 3.2 — Authorization Hardening (COMPLETE)

| Issue | Status | Description |
|-------|--------|-------------|
| ISSUE-033 | ✅ RESOLVED | Project-scope query filtering — all 13 controller/service pairs pass `buildScopedProjectWhere()` into Prisma queries |
| ISSUE-034 | ✅ RESOLVED | Registration whitelist — only WORKER/VIEWER roles can be self-assigned; privileged roles require ADMIN assignment |
| ISSUE-035 | ✅ RESOLVED | Tasks controller — explicit `@Roles()` decorators on all 4 endpoints |
| RoleGuard | ✅ WIRED | Client-side route guard on 8 pages: projects, project detail, teams, workforce, santiere, statistici, aprobare, utilizatori |
| OWNER sidebar | ✅ IMPLEMENTED | OWNER added to management sidebar tier (matching backend global-scope treatment) |
| Project scoping | ✅ IMPLEMENTED | 13 controllers enforce project-scoped data access via `ProjectAccessGuard` |

### ✅ R2.x — Core Operations (ALL E2E VERIFIED)

| Wave | Package | Status | Description |
|------|---------|--------|-------------|
| R2.2 | Attendance | ✅ E2E VERIFIED | Backend complete; 52/52 tests; live PostgreSQL verification |
| R2.3 | Stock + Avize | ✅ E2E VERIFIED | Schema repaired, 5 defects fixed, 30/30 E2E tests |
| R2.4 | Daily Reports | ✅ E2E VERIFIED | Backend complete; 52/52 tests; live E2E |
| R2.5 | Notifications/Audit | ✅ E2E VERIFIED | 12 suites / 65 tests; audit logging, pagination, locale-aware |
| R2.1 | Sites→Projects | ✅ P6 COMPLETE | All 6 phases: Shared contract, Mobile, Web, Cleanup, Authorization, Documentation |

### ✅ Supabase Runtime Removal (COMPLETE)

- Zero `@supabase/*` dependencies in any workspace
- Zero `createClient` / `SUPABASE_*` env var assignments in active source
- Zero Edge Function references in runtime code
- `package-lock.json` has 0 Supabase references
- Legacy DDL archived at `database/archive/supabase-migrations/`

---

## Architecture

```
Web (Next.js) ─┐
               ├──→ NestJS :4000 ──→ Prisma ──→ PostgreSQL 18 :5432
Mobile (Expo) ─┘
```

- All data flows through the NestJS API
- No direct database access from clients
- JWT authentication on all protected endpoints
- Project-scoped authorization via `ProjectAccessGuard`
- Role-based access via `@Roles()` decorators

---

## Open Issues

**All previously tracked issues (ISSUE-001 through ISSUE-035) are RESOLVED, FIXED, or IMPLEMENTED+VERIFIED.**

See [ISSUES.md](ISSUES.md) for the complete list with resolution details.

---

## Known Limitations (non-blocking)

- **`PermissionsGuard` not activated** — The `PermissionsGuard` exists but is not wired into any controller. Permission tables are unseeded. Deferred from P5.
- **`GET /api/procurement/avize/:id` route missing** — The procurement controller lacks this single-aviz retrieval endpoint. Documented in HANDOFF.md.
- **Historical docs reference Supabase** — `HOW_TO_RUN.md`, `CONFIGURATION.md`, and other pre-2026-09-23 documents may still describe Supabase as current runtime. These are harmless historical artifacts.
- **OCR is frozen/deferred** — OCR is not a current workstream. Deferred per project roadmap.
- **No production CI/CD** — No staging/production deployment pipeline configured.

---

## Verification Gates

All quality gates verified as of 2026-09-25:

| Gate | Result |
|------|--------|
| Backend tests (20 suites / 154 tests) | ✅ PASS |
| db:verify (60/60) | ✅ PASS |
| Backend typecheck | ✅ PASS |
| Shared typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| Backend build | ✅ PASS |
| Web build (21 routes) | ✅ PASS |
| Prisma validate | ✅ PASS |
| PostgreSQL 18 connection | ✅ VERIFIED |

---

## Recent Work

### 2026-09-25 — Phase 3.2 Authorization Hardening

**Completed:**
- ISSUE-033: Project-scope query filtering fixed across all 13 controller/service pairs
- ISSUE-034: Registration endpoint whitelisted to WORKER/VIEWER only
- ISSUE-035: Tasks controller @Roles decorators added on all 4 endpoints
- RoleGuard wired into 8 client-side pages
- OWNER added to management sidebar tier
- Documentation reconciled: 12 workflow docs updated

**Verification:**
- Backend tests: 20 suites / 154 tests PASS
- db:verify: 60/60 PASS
- All typechecks PASS (backend, shared, web)
- Backend build PASS
- Web build PASS (21 routes)
- Prisma validate PASS

---

## Next Actions

Per the implementation roadmap, the next areas of work are:
1. R2.6 Audit — implement remaining audit recommendations
2. Authorization refinements — `actorId` propagation from auth context
3. DTO validation — class-validator decorators
4. Read APIs — pagination/filters for stock movements
5. Web rewrites — `/stocuri` and `/avize` pages
6. Integration/E2E tests — concurrent operations

See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) and [HANDOFF.md](HANDOFF.md) for detailed planning.
