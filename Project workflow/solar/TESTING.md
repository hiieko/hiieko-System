# Solar Testing & Validation

Last Updated: 2026-09-25

Documents the actual Solar test and validation setup and the current validation status. No credentials or `DATABASE_URL` are included.

## Test files

All Solar tests live under `backend/test/` (the backend Jest suite; it also runs the shared pure-engine tests via `@solar/shared`).

| File | Covers |
|---|---|
| `solar-geometry.spec.ts` | Shared geometry — polygon area, point-in-polygon, rect↔polygon intersection, transforms; **M2**: exact segment-to-segment distance, boundary clearance, containment, normalization, self-intersection/validation, winding-order independence. |
| `solar-layout.spec.ts` | Shared layout/mounting/BOM — deterministic grid, obstacle exclusion, mounting + BOM; **M2**: irregular polygon, obstacle keep-out margin, multiple roof sections. |
| `solar-design-access.guard.spec.ts` | `SolarDesignAccessGuard` — Admin bypass, member access, non-member denial. |
| `solar.service.spec.ts` | `SolarService` — CRUD, layout/BOM, persistence; **M2**: roof update/delete, obstacle CRUD, polygon/containment validation, multi-roof layout. |
| `solar.controller.spec.ts` | `SolarController` — list-design authorization; **M2**: roof/obstacle route delegation. |

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
| `npm run typecheck --workspace=web` | Type-check the web app. |
| `npm run typecheck --workspace=backend` | Type-check the backend (currently blocked by a pre-existing unrelated issue, see below). |
| `npm run build --workspace=web` | Next.js production build. |
| `npm test` | Full backend Jest suite. |

## Current validation status

| Item | Status |
|---|---|
| Solar tests | ✅ **5 suites / 48 tests, passing** |
| Shared build | ✅ PASS |
| Web typecheck | ✅ PASS |
| Web production build | ✅ PASS |
| Backend typecheck | ⚠️ blocked by pre-existing unrelated `TRANSFER_IN` / `TRANSFER_OUT` errors (see below) |
| Full backend tests | ⚠️ **109 passed**; one pre-existing `stock.service.spec.ts` compilation failure caused by the same unrelated inventory issue |
| Browser/runtime smoke test | ❌ NOT EXECUTED — no live PostgreSQL/auth/browser environment was available |
| Solar migration | ⚠️ generated and schema-validated, but **NOT deployed** against PostgreSQL |

### Pre-existing `TRANSFER_IN` / `TRANSFER_OUT` failures

The `inventory.service.ts` and `test/stock.service.spec.ts` files reference `TRANSFER_IN` / `TRANSFER_OUT` enum values that do not exist in the current `StockMovementTypeEnum`. This is a **pre-existing, unrelated** issue:

- It is **outside the Solar scope**.
- It was **intentionally not modified**.
- It blocks `backend` typecheck and causes the one failing Jest suite (`stock.service.spec.ts`), but has no impact on the Solar suites.

## Future required validation

These are required before Solar can be considered fully validated, but could not be executed in this environment:

- PostgreSQL migration deployment (`npx prisma migrate deploy`)
- Runtime API tests against a live backend
- Seeded authentication (run `npm run seed`, log in with the seeded dev admin)
- Browser smoke test (navigate `/solar-configurator`)
- 2D/3D functional verification (roof plan renders, 3D renders roof + modules, layout calculation returns placements, BOM stays visible after calculation)

## Related documents

- `M1-PROGRESS.md` — main progress/status.
- `API.md` — endpoints to exercise in runtime tests.
- `ARCHITECTURE.md` — what the tests validate at the domain level.
