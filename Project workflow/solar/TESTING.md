# Solar Testing & Validation

Last Updated: 2026-09-26

Documents the actual Solar test and validation setup and the current validation status. No credentials or `DATABASE_URL` are included.

## Test files

All Solar tests live under `backend/test/` (the backend Jest suite; it also runs the shared pure-engine tests via `@solar/shared`).

| File | Covers |
|---|---|
| `solar-geometry.spec.ts` | Shared geometry — polygon area, point-in-polygon, rect↔polygon intersection, transforms; M2 exact clearance/containment/validation; surface transform (elevation/slope/azimuth). |
| `solar-layout.spec.ts` | Shared layout/mounting/BOM — deterministic grid, obstacle exclusion, mounting + BOM; irregular polygon, obstacle keep-out margin, multiple roof sections. |
| `solar-editor.spec.ts` | Editor viewport (pointer↔local, fit, zoom-at-anchor, snap, distance) + module ops (move/rotate/duplicate/delete/align/snap) + undo/redo. |
| `solar-site-object.spec.ts` | SiteObject model — mapping, surface attachment, local→world transform, rotation, generic editor on non-module objects, PV module through the generalized path. |
| `solar-design-access.guard.spec.ts` | `SolarDesignAccessGuard` — Admin bypass, member access, non-member denial. |
| `solar.service.spec.ts` | `SolarService` — CRUD, layout/BOM, persistence, roof update/delete, obstacle CRUD, `replacePlacements` (Phase H). |
| `solar.controller.spec.ts` | `SolarController` — list-design authorization; roof/obstacle/placement route delegation. |

## How to run Solar tests

```bash
# Solar tests only
cd backend
npx jest --config jest.config.json --testPathPattern solar

# Full backend suite
npm test
```

## Validation commands

| Command | Purpose |
|---|---|
| `npm run build --workspace=shared` | Build the shared package (compiles `shared/src/solar/`). |
| `npx tsc --noEmit` (in `backend/`) | Type-check the backend. |
| `npx tsc --noEmit` (in `web/`) | Type-check the web app. |
| `npm test` (in `backend/`) | Full backend Jest suite. |

## Current validation status

| Item | Status |
|---|---|
| Full backend test suite | ✅ **27 suites / 232 tests, passing** (includes 7 Solar suites) |
| Shared build | ✅ PASS |
| Backend typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| Browser/runtime smoke test | ❌ NOT EXECUTED — no live PostgreSQL/auth/browser environment was available |
| Solar migrations | ⚠️ generated and schema-validated, but **NOT deployed** against PostgreSQL |

> The previously documented pre-existing `TRANSFER_IN` / `TRANSFER_OUT` backend-typecheck issue is **resolved on this branch** (the transfer enum values now exist), so the backend typecheck and full suite pass.

## Future required validation

These are required before Solar can be considered fully validated, but could not be executed in this environment:

- PostgreSQL migration deployment (`npx prisma migrate deploy`)
- Runtime API tests against a live backend
- Seeded authentication (run `npm run seed`, log in with the seeded dev admin)
- Browser smoke test (navigate `/solar-configurator`)
- 2D/3D functional verification (roof plan renders, 3D renders roof + modules, layout calculation returns placements, BOM stays visible after calculation)

## Related documents

- `README.md` — current status + validation summary.
- `PHASES.md` — phase-by-phase progress (A–G, H, I).
- `SITE-OBJECT.md` — generalized SiteObject architecture.
- `API.md` — endpoints to exercise in runtime tests.
- `ARCHITECTURE.md` — what the tests validate at the domain level.
