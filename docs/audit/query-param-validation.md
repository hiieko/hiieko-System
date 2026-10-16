# HIIEKO — Query Parameter Validation Audit (Phase 6 / Session C2)

**Generated:** 2026-10-16
**Method:** static parse of every `*.controller.ts` under `backend/src/modules` for `@Query(...)`
and `@Query()` parameters on `@Get()` handlers. Each query value was traced to its controller
method and classified by whether it is validated before use.
**Scope:** read-only audit. No source file was modified.

## Risk rubric

- **High** — a raw, unvalidated string from `@Query` feeds a filter/where clause (no DTO class,
  no Nest pipe, no enum parse). Untyped values reach Prisma directly.
- **Medium** — raw string but the value is constrained before use: bound to the caller's
  membership by `RequireProjectAccess`/`ProjectAccessGuard` (e.g. `projectId`) or compile-time
  enum-typed but not runtime-validated.
- **Low** — coerced/parsed by a Nest pipe (`ParseIntPipe`/`DefaultValuePipe`) or used as a
  boolean comparison / presence check only.

The project-access guard mitigates `projectId` (a caller can only reference a project they are a
member of), which is why project-scoped list endpoints are rated **Medium**, not **High**.

## (a) Full inventory — `@Get()` handlers with `@Query`

| Controller | Method | Query params | Validated via DTO? | Risk |
| --- | --- | --- | --- | --- |
| `audit.controller.ts` | `query()` | `entity`, `entityId`, `actorId`, `action`, `limit`, `offset` | No | **High** |
| `attachments.controller.ts` | `findAll()` | `target_type`, `target_id`, `projectId` | No | **High** |
| `activity.controller.ts` | `list()` | `projectId`, `limit`, `q`, `action`, `actorId`, `dateRange` | No | **High** |
| `notifications.controller.ts` | `getMyNotifications()` | `unreadOnly`, `page`, `pageSize` | No | **Low** |
| `expenses.controller.ts` | `findAll()` | `projectId`, `userId`, `status` | No | **High** |
| `attendance.controller.ts` | `findAll()` | `projectId`, `userId`, `startDate`, `endDate` | No | **High** |
| `attendance.controller.ts` | `getTodaySummary()` | `projectId` | No | **Medium** |
| `attendance.controller.ts` | `getMyLogs()` | `date` | No | **Medium** |
| `documents.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `daily-plans.controller.ts` | `findByProject()` | `projectId`, `date` | No | **Medium** |
| `daily-plans.controller.ts` | `findMyTasks()` | `date` | No | **Medium** |
| `procurement.controller.ts` | `getAvize()` | `projectId` | No | **Medium** |
| `procurement.controller.ts` | `getDeliveryNotes()` | `projectId` | No | **Medium** |
| `teams.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `solar.controller.ts` | `listDesigns()` | `projectId` | No | **Medium** |
| `issues.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `qa-qc.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `tasks.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `daily-reports.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `change-orders.controller.ts` | `findAll()` | `projectId` | No | **Medium** |
| `control-tower.controller.ts` | `getOverview()` | `projectId` | No | **Medium** |
| `control-tower.controller.ts` | `getDrillDown()` | `category`, `projectId`, `limit`, `offset` | No | **High** |
| `control-tower.controller.ts` | `getRedFlags()` | `projectId`, `severity` | No | **High** |
| `inventory.controller.ts` | `getBalance()` | `materialId`, `projectId`, `warehouseId` | No | **High** |
| `inventory.controller.ts` | `getMovements()` | `projectId`, `materialId` | No | **High** |
| `inventory.controller.ts` | `listBalances()` | `projectId`, `materialId` | No | **High** |

## (b) High-risk details

These endpoints take free-form string filters that are **not** bounded by the project-access
guard and have no runtime validation. Several reach a Prisma `where` clause directly.

- **`audit.controller.ts` — `query()`**: `entity`, `entityId`, `actorId`, `action` are raw
  strings forwarded to the audit query builder. `limit`/`offset` use `parseInt` with no NaN
  guard (`parseInt('abc')` → `NaN` → Prisma type error / unbounded query).
- **`attachments.controller.ts` — `findAll()`**: `target_type` and `target_id` are raw strings
  used to filter attachments by polymorphic owner; only `projectId` is scoped.
- **`activity.controller.ts` — `list()`**: `q` (free-text), `action`, `actorId`, `dateRange`
  (a compound string) are raw; `limit` is parsed with `|| 50` (no NaN guard).
- **`expenses.controller.ts` — `findAll()`**: `status` is compile-time typed as
  `ExpenseStatusEnum` but arrives as an unvalidated string (no `ParseEnumPipe`), and `userId`
  is raw. Both reach the service where clause.
- **`attendance.controller.ts` — `findAll()`**: `userId` and the `startDate`/`endDate` strings
  are raw and unvalidated; malformed dates may produce an invalid `where`.
- **`control-tower.controller.ts` — `getDrillDown()`**: the whole query object is typed by an
  **inline anonymous type** (`{ category: string; projectId?: string; limit?: string;
  offset?: string }`) — anonymous types are not runtime-validated by a global
  `ValidationPipe`, and `category` is a free string. `limit`/`offset` use bare `parseInt`.
- **`control-tower.controller.ts` — `getRedFlags()`**: `severity` is a raw string compared
  against expected values with no enum parse.
- **`inventory.controller.ts`** (`balance`, `movements`, `stock`): `materialId` is a raw string
  (required for `balance`, optional elsewhere) that filters stock/movements directly;
  `warehouseId` is raw as well.

## (c) Notable observations

- **No `@Query()` DTO anywhere.** Every query parameter in the codebase is either an
  individual `@Query('name')` primitive or, in one case, an inline anonymous object type
  (`control-tower.controller.ts:118`). No controller uses a class-based query DTO with
  `class-validator` decorators, so the global `ValidationPipe` performs **no** query validation
  on any endpoint.
- **`@Query('name') x?: string` typed params are a compile-time-only constraint.** TypeScript
  annotations such as `@Query('status') status?: ExpenseStatusEnum` do not coerce or validate at
  runtime; the value remains whatever string the client sent.
- **Project-scoped endpoints are guard-mitigated.** All `projectId`-only list endpoints carry
  `@RequireProjectAccess('projectId', 'optional')`, so the value is bound to the caller's
  membership before `buildScopedProjectWhere(scope, projectId)` builds the filter. This reduces
  (but does not eliminate) the risk of an unvalidated `projectId`.
- **`control-tower.getOverview()` computes an unused `where`.** It calls
  `buildScopedProjectWhere(scope, projectId)` but passes only `user.organizationId` and
  `projectId` to the service (line 66–70); the `where` value is discarded. Functionally correct
  today but dead code.
- **`notifications` is the only endpoint using Nest pipes** (`ParseIntPipe`, `DefaultValuePipe`
  for `page`/`pageSize`), which is why it is rated **Low**; `unreadOnly` is used as a boolean
  comparison (`=== 'true'`).
- **`solar.listDesigns()`** manually rejects a missing/blank `projectId` with `BadRequestException`
  before calling the service; it has no `ProjectScope`-based filtering.
