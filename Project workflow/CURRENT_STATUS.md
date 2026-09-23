# HIIEKO — Current Status

**Last Updated:** 2026-09-23
**Version:** pre-1.0 (NOT production-ready)

---

## 1. Current architecture (authoritative)

```
Web (Next.js) ─┐
                ├──→ NestJS :4000 ──→ Prisma ──→ PostgreSQL 18 :5432
Mobile (Expo) ─┘
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

## 3. Milestones

| Milestone | Status | Notes |
|---|---|---|
| PostgreSQL 18 migration | ✅ COMPLETE | Prisma-managed schema; 41/41 DB integrity checks PASS |
| Supabase runtime removal | ✅ COMPLETE | Zero active deps; archival only |
| **R2.2 Attendance** | ✅ **E2E VERIFIED** | Backend complete; dual-write standardized |
| **R2.3 Stock + Avize** | ✅ **E2E VERIFIED** | Schema repaired; all 10 smoke tests PASS |
| **R2.4 Daily Reports** | ✅ **E2E VERIFIED** | Backend complete (10 of 10 endpoints dual-write) |
| **R2.5 Notifications/Audit** | ✅ **E2E VERIFIED** | Backend complete; PostgreSQL-authoritative |
| **R2.1 Sites→Projects P1** | ✅ **COMPLETE** | Shared contract: `Project`/`ProjectMember`, `project_id`, `isWithinProjectGeofence` |
| **R2.1 Sites→Projects P2** | ✅ **COMPLETE** | Mobile screens migrated; `mapToScreenProject` mapper |
| **R2.1 Sites→Projects P3** | ⬜ REMAINING | Web (Header, symbols, delete mock-data) |
| **R2.1 Sites→Projects P4** | ⬜ REMAINING | Shared cleanup (delete dead `Site`/`SiteAssignment`) |
| **R2.1 Sites→Projects P5** | ⬜ REMAINING | Project authorization (members, guards) |
| **R2.1 Sites→Projects P6** | ⬜ REMAINING | Documentation / closure |

## 4. Latest completed work

**R2.1 P2 — Mobile screens migrated to `Project`/`projectId`.**

- All 5 Mobile screens + `App.tsx` updated
- `mapToScreenProject()` bridges `LocalProject` → shared `Project`
- Typecheck ×4 PASS (shared, mobile, web, backend)
- DeliveryIntakeScreen retains `site` as prop name only (type is `Project`)

## 5. Next development step

**R2.1 P3 — Web changes:**
- Fix `Header.tsx` site switcher (rename props, types)
- Delete `web/src/lib/mock-data.ts` (dead mock runtime data — zero consumers)
- Rename symbols (`Site`→`Project`, `siteId`→`projectId`)

## 6. Known carried-over gap

**`GET /api/procurement/avize/:id`** — route is absent from `procurement.controller.ts`.
The controller has `@Get('avize')` (list) and `@Post('avize')` (create) but no single-aviz retrieval endpoint. Both `Mobile/src/services/apiClient.ts` and `web/src/lib/api-client.ts` reference the path. Documented in `HANDOFF.md` and `PROGRESS.md`.

## 7. Project authorization

Not yet enforced. R2.1 P5 will add project members, provision guards, and write E2E tests. Currently any authenticated user can access any project.

## 8. Known production-readiness gaps

- R2.1 P3–P6 incomplete (web still uses `Site`, shared still exports `Site`, no auth guards)
- No root `README.md` — **added in this audit** ✅
- `HOW_TO_RUN.md` / `CONFIGURATION.md` — **refreshed in this audit** ✅
- Backend Jest: all 12 test suites / 69 tests PASS (`npm run test` via `jest --config jest.config.json`, exit 0)
- Pre-1.0; not ready for production deployment
- No staging/production CI pipeline configured
- No monitoring, alerting, or structured logging at production level

## 9. Supabase future

**No new Supabase functionality will be introduced.** The migration from Supabase to NestJS+PostgreSQL is complete. Any future changes will use the existing architecture.
