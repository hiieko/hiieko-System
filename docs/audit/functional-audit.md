# HIIEKO Functional Audit

**Generated:** 2026-10-14
**Scope:** web (Next.js) × backend (NestJS) × Prisma/PostgreSQL, against the locally
running backend (`http://127.0.0.1:4000`) with the full demo seed world.
**Method:** read-only HTTP probing (`GET` only, plus `POST /api/auth/login` to obtain a
bearer token per role) by `scripts/audit-functional.ts`; static reading of the web
route/role contract, the NestJS controllers, Prisma schema and migrations.
**Raw evidence:** [`functional-results.json`](./functional-results.json) (25 endpoints × 18 roles = 450 probes).

## Methodology & limitations

- **18 seeded users, 12 roles** were logged in once each (18/18 succeeded). Their tokens were
  reused for all probes. Only `POST /api/auth/login` and `GET` requests were issued; **no
  mutating endpoint was called** and no database write was performed.
- **No headless browser** (puppeteer/playwright) is installed in this environment. Therefore
  **"called by page" is derived statically** from `web/src` call sites, and **console
  errors / React crashes are approximated from the API outcome of the call(s) the page
  makes**. A page is treated as "functional" when every API call it performs returns
  `2xx`; a `4xx/5xx` on a call the page makes is treated as a page-level failure that the
  user would see as an error/empty state. This approximation is called out wherever it
  matters.
- Endpoints that require a path parameter (`/projects/:id`, `/tasks/:id`, `/expenses/:id`,
  attachments, task-dependencies) were **excluded** from the probe matrix; only simple
  list/detail `GET`s are covered.
- The backend was rebuilt (`nest build`) and restarted before the run so the audit reflects
  current `master`. Point-in-time row counts reflect the seed world, not production.

---

## A. Functional coverage matrix

Legend: **C** = called by a page (static), **A** = api-client only (no page consumer).
`200` / `403` / `500` counts are out of 18 roles.

| # | Endpoint | C/A | Called by page(s) | Status (of 18) | Rows (`dev`) |
|---|----------|-----|-------------------|----------------|--------------|
| 1 | `GET /api/auth/me` | C | all authenticated pages (AuthContext bootstrap) | 200 ×18 | object |
| 2 | `GET /api/projects` | C | `/projects`, `/santiere`, `/documente`, `/stocuri`, `/solar-configurator`, ProjectContext | 200 ×18 | 2 |
| 3 | `GET /api/teams` | C | `/teams`, `/planning`, `/projects/[id]` | 200 ×18 | 4 |
| 4 | `GET /api/employees` | C | `/workforce` | 200 ×5, 403 ×13 | 0 |
| 5 | `GET /api/expenses` | C | `/cheltuieli`, `/aprobare` | 200 ×18 | 15 |
| 6 | `GET /api/notifications` | C | `/notificari`, shell badge, WorkerMyDay | 200 ×18 | 12 (paginated) |
| 7 | `GET /api/documents` | C | `/documente` | 200 ×18 | 10 |
| 8 | `GET /api/users` | C | `/utilizatori`, `/workforce`, `/teams`, `/rapoarte`, `/pontaj`, `/projects/[id]` | 200 ×9, 403 ×9 | 18 |
| 9 | `GET /api/users/profile` | C | `/profil` | 200 ×18 | object |
| 10 | `GET /api/attendance` | C | `/pontaj` | 200 ×18 | 31 |
| 11 | `GET /api/attendance/my-logs` | C | WorkerDashboard | 200 ×18 | 1 |
| 12 | `GET /api/daily-reports` | C | `/rapoarte`, WorkerActionsRequired | 200 ×18 | 8 |
| 13 | `GET /api/materials` | C | `/stocuri`, AvizCreateModal, DailyReportMaterialsSection | 200 ×18 | 8 |
| 14 | `GET /api/inventory/stock` | C | `/stocuri` | 200 ×18 | 13 |
| 15 | `GET /api/inventory/movements` | C | `/stocuri` | 200 ×18 | 30 |
| 16 | `GET /api/procurement/purchase-orders` | **A** | (none — api-client only) | **200 ×3, 500 ×15** | 3 |
| 17 | `GET /api/qa-qc/inspections` | C | `/qa`, QualityWorkspace | 200 ×18 | 6 |
| 18 | `GET /api/suppliers` | C | `/furnizori`, AvizCreateModal | 200 ×18 | 3 |
| 19 | `GET /api/warehouses` | C | `/depozite` | 200 ×18 | 2 |
| 20 | `GET /api/procurement/delivery-notes` | C | `/avize` | 200 ×18 | 5 |
| 21 | `GET /api/tasks` | C | `/tasks`, `/planning`, DailyReportTasksSection | 200 ×16, 403 ×2 | 30 |
| 22 | `GET /api/daily-plans` | C | `/planning`, WorkerDashboard, WorkerTodayTasks | 200 ×18 | 4 |
| 23 | `GET /api/issues` | C | `/issues`, WorkerBlockerList | 200 ×18 | 12 |
| 24 | `GET /api/control-tower/overview` | C | `/` and `/control-tower` (ControlTowerSurface) | 200 ×8, 403 ×10 | object (8 clusters) |
| 25 | `GET /api/control-tower/red-flags` | C | `/` and `/control-tower` (ControlTowerSurface) | 200 ×8, 403 ×10 | 22 |

**All 25 probed endpoints are reachable and the backend `/health/live` + `/health/ready`
return `200` (`ready` reports `database: ok`).**

Notes:
- `/api/procurement/purchase-orders` has **no page consumer** (only declared in
  `web/src/lib/api-client.ts:1120`), so its `500` is currently API-only — see D.1.
- Row counts differ per role because list endpoints are membership/project-scoped. Several
  roles legitimately receive `[]` (e.g. `finance`/`viewer` own no projects → 0 projects,
  0 teams, 0 expenses). Empty ≠ broken.

---

## B. Route ↔ role contract vs. backend authorization

The web contract is `web/src/config/route-roles.ts` (`ROUTE_ROLES`), consumed by the sidebar,
`RoleGuard`, the `/` role router (`web/src/app/page.tsx`) and `/control-tower`. The `/`
router sends: `worker`→`WorkerMyDay`; `team_leader|technician|foreman`→`WorkerDashboard`;
**everyone else** (incl. `site_manager`)→`ControlTowerSurface`.

Backend authorization was read from each controller's `@Roles(...)` and confirmed against
observed `403`s (see D.2). Findings:

| Route | Contract role | Backend result | Verdict |
|-------|---------------|----------------|---------|
| `/control-tower` | `CONTROL_TOWER_ROLES` **includes `site_manager`** (`route-roles.ts:126-139`) | `GET /api/control-tower/overview` and `/red-flags` → **403 for `SITE_MANAGER`** | **DIVERGENCE (HIGH)** |
| `/workforce` | `WORKFORCE_ROLES` includes `finance` (`route-roles.ts:69`) | `GET /api/employees` → 200 for FINANCE; but the page's secondary `GET /api/users` → **403 for FINANCE** (swallowed) | **Partial divergence (LOW)** |
| `/workforce` | `WORKFORCE_ROLES` excludes `site_manager`/`foreman`/`team_leader` | `GET /api/employees` → 403 for those roles | Consistent (documented in `route-roles.ts:64-69`) |
| `/furnizori` | `SUPPLIER_ROLES` (admin/owner/manager/pm/procurement) | `GET /api/suppliers` → 200 for all 18 | Consistent (backend more permissive) |
| `/depozite` | `WAREHOUSE_ROLES` | `GET /api/warehouses` → 200 for all 18 | Consistent |
| `/qa` | `QA_ROLES` (admin/owner/qa_qc/pm/site_manager) | `GET /api/qa-qc/inspections` → 200 for all 18 | Consistent |
| `/tasks` | `OPERATIONAL_ROLES` (excl. finance/procurement) | `GET /api/tasks` → 403 for exactly FINANCE, PROCUREMENT | Consistent |
| `/documente`, `/notificari`, `/profil` | `null` (all roles) | 200 for all 18 | Consistent |
| `/cheltuieli` | `OPERATIONAL_ROLES` + finance | `GET /api/expenses` → 200 all | Consistent |
| `/avize` | `OPERATIONAL_ROLES` + procurement | `GET /api/procurement/delivery-notes` → 200 all | Consistent |

### B.1 `site_manager` is routed to a Control Tower it is forbidden to load (HIGH)

`route-roles.ts` explicitly lists `site_manager` in `CONTROL_TOWER_ROLES`, and `page.tsx`
routes it to `ControlTowerSurface` (the comment at `page.tsx:27` is deliberate). But the
backend control-tower `@Roles(...)` set (`backend/src/modules/control-tower/control-tower.controller.ts`)
excludes `SITE_MANAGER`, `FOREMAN`, `TEAM_LEADER` and `WORKER`, so `GET /api/control-tower/overview`
and `/red-flags` return **403** for a site manager. Result: the site-manager home page issues
two calls that both fail. Either the backend role set must add `SITE_MANAGER`, or the web
contract must stop routing `site_manager` to `/control-tower`. `CONTROL_TOWER_ROLES` was
otherwise correct for every tested role (`qa_qc`, `viewer`, `finance`, `procurement` all get 200).

### B.2 `/workforce` reachable by FINANCE but user dropdown 403s (LOW)

`WORKFORCE_ROLES` includes `finance` (`route-roles.ts:69`) and `GET /api/employees` allows
FINANCE (200), so the page's primary list works. However `/workforce` also calls
`apiClient.getUsers()` (`web/src/app/workforce/page.tsx:68`), and `GET /api/users` is
`@Roles(ADMIN, MANAGER, PM, SITE_MANAGER, FOREMAN, TEAM_LEADER)` — FINANCE is **403**. The
call is wrapped in a bare `catch {}`, so the failure is silent and the page simply shows an
empty personnel selector. Not fatal, but it is a real contract gap that is currently masked.

---

## C. Login & session (18/18)

| Role | Users | Login status | Notes |
|------|-------|--------------|-------|
| ADMIN | dev | 200 | |
| OWNER | owner | 200 | |
| MANAGER | manager | 200 | |
| PM | pm | 200 | |
| SITE_MANAGER | site.manager | 200 | |
| FOREMAN | foreman | 200 | |
| QA_QC | qa | 200 | |
| FINANCE | finance | 200 | |
| PROCUREMENT | procurement | 200 | |
| VIEWER | viewer | 200 | |
| TEAM_LEADER | ion, maria, andrei | 200 ×3 | |
| WORKER | costin, ramona, daniel, ioana, alexandru | 200 ×5 | |

- **18/18 logins returned `200`** with an `accessToken`, and the returned `role` matched the
  seeded role for every account. Login latency 58–402 ms (cold first request 402 ms).
- `/api/auth/me` returned `200` for all 18 with `data = { id, email, role, organizationId,
  fullName, status, projectRoles }` — a stable shape across roles.
- `/api/users/profile` returned `200` for all 18, but with a **different shape** than
  `/api/auth/me`: `{ id, user_id, full_name, phone, employee_code, avatar_url, language,
  created_at, updated_at }` (snake_case, extended profile). Two identity endpoints, two
  conventions — see D.4.

---

## D. API defects

### D.1 `GET /api/procurement/purchase-orders` → HTTP 500 for 15/18 roles (HIGH)

Only `ADMIN`, `OWNER`, `MANAGER` succeed (they resolve to *global* project scope → empty
`where`). Every project-scoped role (`PM`, `SITE_MANAGER`, `FOREMAN`, `QA_QC`, `FINANCE`,
`PROCUREMENT`, `VIEWER`, all `TEAM_LEADER`, all `WORKER`) receives:

```
Invalid `this.prisma.purchaseOrder.findMany()` invocation ...
Unknown argument `project_id`. Available options are marked with ?
  at procurement.service.js:29
```

**Root cause:** `ProcurementController.getPurchaseOrders` (`procurement.controller.ts:26-35`)
builds `buildScopedProjectWhere(scope, projectId)` and hands it to
`ProcurementService.findAllPurchaseOrders` (`procurement.service.ts:42-45`), which spreads it
into `prisma.purchaseOrder.findMany({ where })`. `buildScopedProjectWhere`
(`project-scope.filter.ts:24-36`) returns `{ project_id: { in: [...] } }` for non-global
scope — but the Prisma `PurchaseOrder` model (`backend/prisma/schema.prisma:771-784`) has
**no `project_id` column** (purchase orders are organisation-scoped; projects are linked only
transitively via materials/items). Passing an explicit `?projectId=` also constructs
`{ project_id: ... }`, so the endpoint can 500 even for ADMIN.

**Impact:** the endpoint is unusable for 83% of roles and can never be project-filtered.
**Secondary:** the same class of bug is latent wherever a scoped `project_id` where-clause is
applied to a model without that column; this audit found **`PurchaseOrder` to be the only
current mismatch** across all `buildScopedProjectWhere` callers (see H.7).

### D.2 Authorization (`403`) outcomes — all by design, one divergence

Every `403` observed corresponds to a `@Roles(...)` set on the controller, and role
`admin`/`owner` bypass behaves as documented. Grouped by endpoint:

- `GET /api/employees` → requires `[ADMIN, MANAGER, PM, FINANCE]` (+OWNER bypass): 403 for
  site_manager, foreman, qa, procurement, viewer, all TL, all workers (13).
- `GET /api/users` → requires `[ADMIN, MANAGER, PM, SITE_MANAGER, FOREMAN, TEAM_LEADER]`
  (+OWNER bypass): 403 for qa, finance, procurement, viewer, all workers (9).
- `GET /api/tasks` → 403 for finance, procurement (2).
- `GET /api/control-tower/overview` & `/red-flags` → 403 for site_manager, foreman, all TL,
  all workers (10) — **the site_manager part is the B.1 divergence.**

No `401`/auth failures and no `404` were observed across the matrix. **No path mismatches:**
every `/api/...` literal found in `web/src` maps to an existing backend controller route
(comparison of all web literals against all `@Controller` + `@Get/@Post/...` declarations
produced zero orphans).

### D.3 Data-shape observations

- **Notifications is the only paginated list.** `GET /api/notifications` returns
  `data = { data: [...], total, page, pageSize }`, whereas every other list returns
  `data = [...]` directly. The web handles this via `normalizeEnvelope`
  (`web/src/app/notificari/page.tsx:39-47`) and `readUnreadTotal`
  (`ShellNotificationsButton.tsx`), so it works — but it is an inconsistency a new consumer
  can easily get wrong.
- **`/api/users/profile` vs `/api/auth/me`** use different field conventions (snake_case +
  `employee_code` vs camelCase + `organizationId`/`projectRoles`). Not a bug (different
  resources) but a maintenance hazard.

### D.4 Empty-state behaviour

Empty arrays are returned consistently as `200` with `[]` (never `404`/`null`), e.g. `finance`
gets 0 projects/teams/expenses, `viewer` gets 0 projects, `tl_andrei` gets 0 expenses/stock.
No endpoint returned a `null` body for a list. This is correct REST behaviour and the pages
render an empty state (verified statically: the pages default to `[]`).

---

## E. Functional findings summary

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| E.1 | **High** | `GET /api/procurement/purchase-orders` 500s for 15/18 roles (invalid `project_id` on `PurchaseOrder`) | D.1, H.7 |
| E.2 | **High** | `site_manager` is routed to `/control-tower` but the control-tower API 403s it → broken home page | B.1, D.2 |
| E.3 | Medium | Control-tower scoping `where` is built then discarded → cross-project data exposure | H.7 |
| E.4 | Low | `/workforce` allows FINANCE but its `getUsers()` call 403s and is silently swallowed | B.2 |
| E.5 | Low | Notifications is the only nested paginated envelope; identity endpoints use two field conventions | D.3 |
| E.6 | Low | `GET /api/procurement/purchase-orders` has no page consumer (dead API surface exposing a live bug) | A/16 |

**Positive:** login/session, project/team/document/attendance/report/issue/stock/avize
list APIs, and the operational + control-tower surfaces for their intended roles all return
correct, role-scoped data. All web→backend paths resolve. No unhandled `401`/`404`/`CORS`
issues surfaced.

---

## F. i18n

- **System:** `shared/src/translations.ts` exports parallel `ro`/`en` objects
  (`translations = { ro, en } as const`, `Locale = keyof typeof translations`), consumed via
  `useTranslations()` → `web/src/hooks/useTranslations.ts` over
  `web/src/context/LanguageContext.tsx`. The parallel `as const` typing prevents a key from
  existing in only one language, but does **not** prevent referencing a key that exists in
  neither. ~**376** leaf keys defined.
- **Missing keys:** ~**12** distinct `t('...')` literals have no matching key (e.g.
  `dashboard.empty.filter`, `form.error.minLength`, `modal.confirm.deleteTitle`,
  `settings.privacy.title`) → risk of empty text / key leakage at runtime.
- **Dead keys:** ~**47** defined keys are never referenced (translation bloat).
- **Inline translation bypass (High):** **27** occurrences of `locale === 'en' ? ... : ...`
  (or `lang === 'en'`) across **11** files, e.g. `web/src/components/clients/ClientDetails.tsx`,
  `projects/ProjectCard.tsx`, `dashboard/RecentActivity.tsx`, `billing/InvoiceTable.tsx`,
  `tasks/TaskItem.tsx`, `reports/SummaryCard.tsx`, `settings/TeamList.tsx`,
  `notifications/NotificationItem.tsx`, `layout/PageHeader.tsx`, `shared/DataTable.tsx`.
  These strings never enter the translation table and therefore cannot be localised
  consistently.
- **Hardcoded labels in core chrome (High):** `web/src/components/Sidebar.tsx` and
  `web/src/components/Header.tsx` render many navigation/menu labels as literal strings
  rather than `t(...)`, so the primary navigation is not fully localisable.
- **Locale persistence:** language is React context state only — no cookie, no
  `localStorage`, no server-side `Accept-Language` read. With Next.js SSR the server renders
  a default locale and the client may switch after hydration → **potential flash of the wrong
  locale**.

**Ranked:** (1) inline `locale===...` ternaries, (2) hardcoded Sidebar/Header labels,
(3) 12 missing keys, (4) 47 dead keys, (5) no persisted locale / hydration flash.

---

## G. Security

### Confirmed strengths

- **Env hardening:** `backend/src/common/config/env-security.ts:1-61` enforces
  `MIN_JWT_SECRET_BYTES=32`, blocks known placeholder secrets, and throws in production; invoked
  at startup `backend/src/main.ts:48`.
- **Password hashing:** bcryptjs cost 10 on register (`auth.service.ts:93`) and password reset
  (`auth.service.ts:215`); verification via `bcrypt.compare` (`auth.service.ts:267`).
- **Tokens:** web access token TTL **15 min** (`auth.constants.ts:9`); refresh token is a
  **256-bit opaque** secret (`auth.constants.ts:21`) stored **SHA-256 hashed**
  (`session.service.ts:40-42`) in an httpOnly cookie scoped to `/api/auth`
  (`auth.constants.ts:30-31`). **Rotation + atomic reuse detection** via
  `UPDATE ... WHERE id=? AND used_at IS NULL AND revoked_at IS NULL` in a transaction
  (`session.service.ts:144-152`); reuse/expiry revokes the session family; logout and
  password-reset revoke sessions (`session.service.ts:213-234`, `auth.service.ts:228-231`);
  `JwtAuthGuard` checks session status when `sid` is present (`jwt-auth.guard.ts:55-74`).
- **Rate limiting:** `RateLimitGuard` + `@RateLimit`; login `ip:20/15min` + `email:5/15min`
  (`auth.controller.ts:43-46`), register `ip:3/h`, forgot-password `email:3/h + ip:10/h`,
  refresh `ip:60/min`, reset `ip:10/h`.
- **HTTP hardening:** Helmet (`main.ts:64-95`); CORS explicit allowlist + Netlify-preview
  regex with `credentials: true` (`main.ts:137-156`); global `ValidationPipe`
  `whitelist: true, transform: true` (`main.ts:159-166`); global `AllExceptionsFilter`
  (`main.ts:169`). Production error responses are generic (`http-exception.filter.ts:150-162`).
- **Uploads:** MIME allowlist + 10 MB default cap (`upload/upload.service.ts:20-31,93-96,129-147`).
- **Secrets:** only `.env.example` is tracked; `.env*` ignored. No hardcoded JWT/passwords/tokens
  found in tracked source.
- **Intentional public surface:** `/health/live`, `/health/ready` (adapter-level),
  `GET /api/demo/accounts` (gated by `DEMO_MODE`), and the auth endpoints. All business
  controllers use guards.

### Findings / risks

- **High — no Prisma error mapping in the global filter** (`http-exception.filter.ts:1-182`).
  `PrismaClientValidationError` (exactly what D.1 triggers) is not translated to a 4xx; it
  falls through to the generic `500` path. In production the body is generic, but
  constraint/validation errors that should be `400/409` are surfaced as `500`, and in
  non-production the raw exception message (including SQL/field names) is returned — the D.1
  probe was run against a non-production build and did leak the Prisma invocation + column
  list. Recommend a `PrismaExceptionFilter` mapping `P2002→409`, `P2025→404`,
  `P2003→400`, validation→`400`.
- **Medium — `forbidNonWhitelisted: false`** (`main.ts:163`): unknown body fields are stripped
  but not rejected, masking client contract drift.
- **Medium — implicit public routes:** there is no `@Public()` metadata; public endpoints are
  public only because no guard is attached. Works today but is easy to regress.
- **Low — local DB credential historically in rotation docs**
  (`docs/security/rotation.md:7-24`); policy documents manual rotation, no rewrite.

**Ranked:** (1) add Prisma error mapping; (2) `forbidNonWhitelisted: true`; (3) explicit
`@Public()` decorator; (4) keep rotation schedule.

---

## H. Database

### H.1 Schema inventory (`backend/prisma/schema.prisma`)

- Models **85**, `@relation(` **134**, enums **28**, `@@map` **85** (100% mapped).
- Clusters: auth/users/roles (Organization, User, Session, RefreshToken, PasswordResetToken,
  RateLimitBucket, UserProfile, Role, Permission, RolePermission, AuditLog = 11);
  projects/tasks (Project, ProjectStage, WorkPackage, LocationZone, ProjectMember, Task,
  TaskDependency, TaskAssignment, Team, TeamMember, Employee, DailyPlan/Task, DailyReport +
  children, Client ≈ 24); inventory (Material, MaterialLot, Warehouse, StockBalance,
  StockMovement, ProjectAllocation, Consumption = 7); procurement (Supplier, PurchaseOrder,
  PurchaseOrderItem, Delivery, Invoice, InvoiceLine, Receipt, Aviz, AvizItem = 9); documents
  (Document, DocumentVersion, OCRJob, OCRExtraction = 4); quality (InspectionTemplate,
  Inspection, Measurement, Issue, NCR = 5); solar (`schema.prisma:1459-1691` = 12).
- **Control Tower has no model** (pure aggregation). `Receipt` (`:836`), `Commitment`
  (`:1123`), `Payment` (`:1132`) are **orphan tables with no relations**.

### H.2 Referential integrity

- Explicit `onDelete`: **Cascade 82**, **Restrict 3** (`:459,542,556`), **SetNull 4**
  (`:479,525,1471,1635`). **45 relations omit `onDelete`** (mostly list-side back-relations
  without an FK; optional owner-side FKs silently default to `SET NULL` — e.g.
  `Project.client :279`, `Expense.project :897`, `Document.project :952`,
  `AuditLog.actor/organization :1198-1199`, `StockMovement.* :716-719`).
- Migrations: **117** `FOREIGN KEY`, **82 CASCADE / 4 RESTRICT / 31 SET NULL**; no FK lacks an
  `ON DELETE` action.

### H.3 Constraints

- `@unique` **29**, `@@unique` **22**, `@id` **84**, `@@id` **1** (`:180`), `@default` **216**,
  `@db.` **90**, `@@index` **39**.
- Migrations: **`CHECK` ×5**, all numeric stock invariants
  (`20260923150000_stock_invariants/migration.sql:24,45,54,63,72`) — **no CHECK for any
  status/enum**.
- **Enum-like status stored as free `String`** (no DB-level guard; integrity risk):
  `PurchaseOrder.status` (`:777`), `DailyReport.status` (`:511`), `Inspection.status`
  (`:1020`), `ExpenseApproval.status` (`:921`), `Commitment.status` (`:1127`),
  `Payment.method` (`:1135`), `DailyReportApproval.action` (`:538`), `Attachment.target_type`
  (`:1174`).

### H.4 Migrations

- **23** migration folders. All **85** mapped tables have a matching `CREATE TABLE`; the
  latest `20261013000000_add_task_blocker_fields` covers `tasks.blocked_reason/blocked_at`
  (`migration.sql:5-6`) matching schema `:373-374` → **schema appears in sync**.
- DROPs (14 total): `DROP TABLE IF EXISTS public.time_logs CASCADE`
  (`20260923140000_drop_time_logs/migration.sql:14`); **2 DROP CONSTRAINT** (re-added as
  `RESTRICT`, `20261001140000...:31,38`); **11 DROP INDEX** (all recreated nearby);
  **0 DROP COLUMN**. Risk low/forward; the `time_logs` CASCADE drop is irreversible if old
  data were needed.

### H.5 Indexing

- `@@index` **39**. FK columns with **no index** (slow-join candidates), top 10:
  `PurchaseOrder.supplier_id` (`:773`), `PurchaseOrderItem.purchase_order_id`/`material_id`
  (`:788-789`), `InvoiceLine.invoice_id` (`:826`), `Expense.approver_id`/`expense_id`
  (`:920-925`), `ExpenseLine.expense_id` (`:908`), `Inspection.project_id` (`:1017`),
  `Issue.project_id` (`:1044`), `ChangeOrder.project_id` (`:1074`), `CostEntry.project_id`
  (`:1114`), `Document.project_id` (`:943`). Also unindexed: `Client/Supplier/Warehouse
  .organization_id`, `OCRExtraction.ocr_job_id`, `BudgetLine.budget_id`,
  `Delivery.purchase_order_id`.

### H.6 Seeds

- Entrypoint `backend/package.json:75-77` → `ts-node --transpile-only prisma/seed.ts`
  (`scripts.seed = prisma db seed`, `:19`).
- `seed.ts` creates Organization + dev ADMIN + 3 TEAM_LEADER (`:258`) + 5 WORKER (`:296`) +
  9 role users (`:337-345`) = **18 users**, then delegates the world to `seedDemo` (`:381`).
- `seed-demo.ts` builds org→clients→projects→zones→teams→members→tasks→assignments→
  dependencies→daily plans/reports→attendance→stock/PO/avize/expenses/docs/solar, **entirely
  via `upsert` (0 `.create(`)** → re-run safe. The 18 `EMAILS` (`seed-demo.ts:49-68`) match
  `seed.ts`; all roles are valid `UserRoleEnum` (`schema.prisma:1207-1224`); 4 of 16 enum
  values are unused (TECHNICIAN, SITE_LOGISTICS, MAINTENANCE_DIRECTOR, TECHNICAL_DIRECTOR).
  Ordering dependency: `seedDemo` throws if the org/user is missing (`:221,230`).

### H.7 Data-model vs API drift (HIGH)

- **Confirmed:** `PurchaseOrder` has **no `project_id`** (`schema.prisma:771-784`), yet
  `procurement.controller.ts:33` passes `buildScopedProjectWhere(scope, projectId)`
  (default field `project_id`) into `procurement.service.ts:42-45` →
  `prisma.purchaseOrder.findMany({ where })`. Non-global scope ⇒ `{ project_id: { in: [...] } }`
  ⇒ Prisma **"Unknown argument `project_id`"** (the 500 in D.1).
- **All other `buildScopedProjectWhere` callers target models that do have `project_id`**
  (Issue, AttendanceRecord, Aviz, ChangeOrder, Expense, Inspection, Team, DailyReport,
  Document, DailyPlan, Task, StockBalance, StockMovement). **`PurchaseOrder` is the only
  mismatch.**
- **Secondary:** `control-tower.controller.ts:65,123,172` builds a `where` but never passes
  it to the service → scoping is a silent no-op (cross-project data is not filtered).

### Ranked DB summary

1. **High — H.7:** `PurchaseOrder` receives a non-existent `project_id` filter → broken
   procurement listing.
2. **High — H.7:** control-tower computes project scope then discards it → cross-project
   exposure.
3. **Medium — H.3:** 6+ models store enum-like status as free `String`, no CHECK constraint.
4. **Medium — H.2:** 45 relations omit explicit `onDelete`; optional FKs silently `SET NULL`.
5. **Medium — H.5:** top-traffic FK columns lack indexes → slow joins / seq scans.
6. **Low — H.1:** orphan tables `Receipt`/`Commitment`/`Payment`; polymorphic `Attachment`.
7. **Low — H.4:** `time_logs` CASCADE drop irreversible; 11 recreated DROP INDEX.
8. **Low — H.6:** seeds idempotent and role-consistent; ordering dependency only.

---

## Reproduction

```powershell
# 1. backend running with the demo seed
cd backend; npm run build; node dist/main

# 2. credentials live in a gitignored file: scripts/audit-functional.json

# 3. run the read-only harness
$env:AUDIT_BASE_URL='http://127.0.0.1:4000'
backend/node_modules/.bin/ts-node --transpile-only scripts/audit-functional.ts
# -> docs/audit/functional-results.json
```
