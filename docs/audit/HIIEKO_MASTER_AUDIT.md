# HIIEKO — Master Audit (Authoritative Consolidation)

**Generated:** 2026-10-20
**Status:** Authoritative consolidation of all prior HIIEKO audit artifacts. This document does
not replace them; it reconciles them, adjudicates conflicts, and records what is verified vs.
unverified as of `master` @ `3457db9`.
**Author:** Consolidation session (read-only w.r.t. application code, schema, and data).

**Method.** Static reading of the repository (source, schema, migrations, tests, docs) plus the
execution of the repository's own read-only verification commands:
- `npm test --workspace=backend` → **48 suites / 567 tests passed** (this session, 2026-10-20).
- `npm run build --workspace=web` → **35 app routes built** (this session, 2026-10-20).
- Git history inspection (`git log`, `git status`, `git rev-list`).

**What this session did NOT do (and therefore does not claim):**
- No live backend was started; no HTTP probing was re-run. All functional/probe numbers below are
  quoted from the prior artifacts, not re-measured.
- No browser/headless check was performed (no Playwright/Puppeteer confirmed installed). All
  responsive/visual/accessibility findings remain **static** unless a prior artifact says otherwise.
- No production environment was inspected. All production-readiness items are **unverified**.
- No subagent reviews were run in this session. Section 6 reviews are reasoned analyses by this
  consolidation session, not independent third-party assessments.

---

## 1. Executive Summary and Audit Scope

### 1.1 What HIIEKO is

A construction-project management system in a monorepo (`shared`, `web`, `backend`, `Mobile`):

- **web** — Next.js (App Router) frontend, deployed target: Netlify.
- **backend** — NestJS + Prisma + PostgreSQL, deployed target: Render (per `docs/deploy.md`).
- **shared** — shared types and the i18n dictionary (`shared/src/translations.ts`).
- **Mobile** — React Native app (present; not audited in depth here).

### 1.2 Headline assessment

The system is **not a prototype**. The backend domain model is large (85 Prisma models, 23
migrations), authentication/sessions/rate-limiting/audit are real, and the repository's own test
suite passes cleanly (567/567). The prior audit artifacts describing a "login stub" and "missing
password reset" (`docs/audits/technical-audit.md`, dated 2026-10-13) are **stale and superseded** —
see §3.1 and §8.

The system is **not production-ready as evidenced**. The blocking reason is not a single code bug
but a cluster of **unverified production concerns**: hosting/DB/email/storage configuration and a
runtime acceptance test have never been confirmed (see §3 P-01..P-04 and §5.12).

### 1.3 Scope of this consolidation

In-scope source of truth: repository at `master` @ `3457db9` (2 commits ahead of `origin/master`).
Prior artifacts reconciled (see §8 for the full table):
`web_audit_report.md`, `docs/audit/full-audit-v2.md`, `docs/audit/functional-audit.md`,
`docs/audit/query-param-validation.md`, `docs/audit/i18n-inventory.md`,
`docs/audit/functional-results.json` + `functional-results-after-quality-pass.json`,
`docs/audits/technical-audit.md`, `docs/audits/design-audit.md`, `docs/fixes/*`, `docs/plan/*`,
`docs/security/rotation.md`, `docs/deploy.md`.

### 1.4 Current repository state (evidence)

| Item | Value | Evidence |
| --- | --- | --- |
| Branch | `master` | `git status` |
| HEAD | `3457db9 fix(ui): adopt shared Button and Card primitives in Control Tower` | `git log -1` |
| Ahead of origin | 2 commits | `git rev-list --count origin/master..HEAD` |
| Working tree | clean except untracked `web_audit_report.md` | `git status` |
| Total commits | 358 | `git rev-list --count HEAD` |
| Backend tests | 567 passed / 48 suites | `npm test --workspace=backend` (this session) |
| Web build | 35 routes; largest First Load JS = 200 kB (`/`) | `npm run build --workspace=web` (this session) |
| Prisma models | 85 (85 `@@map`, 100% mapped) | schema inspection |
| Migrations | 23 folders | migration dir count |

---

## 2. GOOD WORK — Implemented Features, Fixes, and What Must Be Preserved

Verification level key: **[E]** = evidenced by source/tests/build run this session or a cited
artifact; **[D]** = documented in a prior artifact (not re-verified this session); **[U]** = unverified.

### 2.1 Authentication, sessions, and account lifecycle

- **Real web login** wired to the backend (`web/src/app/login/page.tsx` imports `apiClient` and
  `useAuth`, calls the real API). **[E]** This **contradicts and supersedes** the "login is a
  STUB/BYPASS" claim in `technical-audit.md:3291`.
- **Role-based demo quick-fill** on the login page is gated behind `NEXT_PUBLIC_DEMO_MODE === 'true'`
  (`login/page.tsx:27`), so it never mounts in a normal build. **[E]**
- **Password reset implemented**: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
  (`auth.controller.ts:125,141`), plus `POST /api/auth/change-password` (`:153`). **[E]** This
  **contradicts** `technical-audit.md:3375` ("Password reset: MISSING").
- **Refresh tokens**: 256-bit opaque, stored SHA-256-hashed, httpOnly cookie scoped to `/api/auth`,
  rotation with atomic reuse detection. **[D]** (`functional-audit.md` §G; commits
  `20261001130000`, `20261001140100`).
- **Remember me** with memory-only access token (`6218cab`, `dfa2a08`), **idle session timeout**
  (`14f666c`), **session revocation on password change** (`3582b0e`) and **on role change**
  (`389179d`). **[E]** (present in `git log`).
- **Password policy** enforced (`854a6e9`, and `backend/test/password-policy.spec.ts` passes). **[E]**
- **JWT secret strength guard** (`env-security.ts`, `jwt-secret-guard.spec.ts`). **[D/E]**

### 2.2 Authorization and project scoping

- **Control Tower project scope enforced** — commit `3ba6ec3 fix(control-tower): enforce project
  scope`; controller now passes `buildScopedProjectWhere(scope, projectId, 'id')` into the service
  (`control-tower.controller.ts:66,126,177`). **[E]** This resolves the functional-audit
  **E.3 / H.7-secondary** "scope computed then discarded" finding.
- **`site_manager` Control Tower divergence resolved** — `control-tower.controller.ts:40` now
  includes `SITE_MANAGER`, and `CONTROL_TOWER_ROLES` (`route-roles.ts:126-139`) lists the same
  roles. The two lists match. **[E]** This resolves functional-audit **E.2 / B.1 (HIGH)**.
- **Query-parameter validation fixes** — commit `a58dc7f fix(api): validate query parameters`;
  new/updated specs for attendance, audit, expenses, inventory controllers. **[E]**
- **Prisma error mapping** — commit `3af5bf9`; new `prisma-exception.filter.ts`. **[E]** Resolves
  functional-audit §G "no Prisma error mapping".
- **`forbidNonWhitelisted: true`** — commit `3d12ad9`. **[E]** Resolves functional-audit §G Medium.

### 2.3 Guard infrastructure (frontend)

- `AppShell` uses `ProtectedRoute` for the authenticated area; `RoleGuard` enforces role access with
  an admin/owner superset and redirects unauthorized users to `/` with a toast; root `/` does
  role-based routing (worker → `WorkerMyDay`; field roles → `WorkerDashboard`; else → Control
  Tower). **[E]** (`web_audit_report.md` §3, corroborated by source inspection).

### 2.4 Execution loop, uploads, OCR

- Daily report create/submit/review/approve and next-morning planning exist. **[D]** (`STATUS.md`).
- **Global photo upload modal** accessible from any page (`a5755f0`); **auto-save draft on photo
  attach** (`286cf8c`). **[E]**
- **Upload content validation** — commit `10c9139 fix(upload): validate uploaded file content`. **[E]**
  Resolves `docs/fixes/09`.
- **OCR**: availability-gated upload (`e25ade7`), improved extraction workflows (`7854f5d`). **[E]**

### 2.5 Solar configurator

- BOM/layout computed server-side from persisted geometry
  (`GET /api/solar/designs/:id/bom`, `POST /api/solar/designs/:id/layout/calculate`), covered by
  solar specs (part of the 48 passing suites). Only the BOM **component catalog** is a documented
  prototype (`DEMO-*` codes). **[D/E]** (`STATUS.md` Phase 2 note; `docs/fixes/07`).

### 2.6 i18n remediation

- Large remediation completed: inline `locale === 'en'` ternaries and hardcoded chrome strings
  replaced with dictionary keys across pages and components (commits `9a77b00`, `1b34194`, …,
  `e82f5a1`, `31d14f1`, `b2b0b21`). **[E]** Recorded in `i18n-inventory.md` Phase A.1/A.2/A.3.

### 2.7 Visual-system / accessibility remediation (partial)

- Invalid `*-soft0` Tailwind classes corrected (commit `92a9050`; **0 occurrences remain** — verified
  this session). **[E]** Resolves full-audit-v2 §2.3 #1.
- Toast `aria-live` + larger close target (`7a72ad2`); label association (`bd48d01`); muted token
  contrast raised (`4aff9c9`); PhotoUpload lightbox focus trap + Escape (`200ff1c`). **[E]**
  These partially resolve full-audit-v2 §4 blockers 1, 2, 5, 6, 8.
- **Pagination component** added (`ee4ac76`) and adopted across many list pages. **[E]**

### 2.8 Database integrity and performance (baseline)

- 85 models, 100% `@@map`-ed; referential actions present on all FKs in migrations. **[D]**
  (`functional-audit.md` §H).
- No slow queries at current volume; connection pool not a bottleneck. **[D]** (`full-audit-v2` §3.5).

### 2.9 What must be preserved

1. Real authentication/session/refresh behavior (do not re-introduce preview identities).
2. The `ROUTE_ROLES` contract as the single frontend authorization source, and its parity with
   backend `@Roles`.
3. In-memory-only access token + httpOnly refresh cookie (never localStorage-as-token-store).
4. No fake/mock persistence on production surfaces; the `design-review` subtree stays an explicit
   prototype.
5. The `DEMO_MODE` gate on the login quick-fill.
6. The passing 567-test backend suite as a regression gate.

---

## 3. PROBLEMS — Confirmed Defects, Risks, and Unverified Items

Labels: **CONFIRMED** (source/run evidence), **SUSPECTED** (strong static signal, not run),
**UNVERIFIED** (could not be established from available evidence).

### Confirmed (present in current source)

| ID | Sev | Problem | Evidence | Impact | Areas |
| --- | --- | --- | --- | --- | --- |
| P-10 | **High** | `Expense.project` / `Document.project` etc. optional FKs silently `SET NULL` (45 relations omit explicit `onDelete`). | `functional-audit.md` §H.2 | Deleting a project can orphan financial/document rows instead of failing. | DB/schema |
| P-11 | **High** | Audit/attachments/activity/expenses/inventory query params feed Prisma `where` without DTO validation. | `query-param-validation.md` §a/b; `a58dc7f` addressed only some (see gaps) | Malformed params → wrong filters / 500s. | Backend API |
| P-12 | **High** | `purchaseOrder` model has no `project_id`, but `getPurchaseOrders` now takes **only** `user.organizationId` (`procurement.controller.ts:30`) — project filtering is impossible by design, and the old 500 path is gone but the API has no page consumer. | source inspection + `functional-audit.md` D.1 | Dead/ambiguous procurement listing; untested by UI. | Backend/DB |
| P-13 | Medium | Enum-like status stored as free `String` (no CHECK): `PurchaseOrder.status`, `DailyReport.status`, `Inspection.status`, `ExpenseApproval.status`, etc. | `functional-audit.md` §H.3 | Integrity risk; invalid statuses possible. | DB/schema |
| P-14 | Medium | Unindexed `project_id` filters on `cost_entries`, `expenses`, `inspections`, `documents`, `ncrs`; unindexed sort columns `avize.delivery_date`, `attendance_records.check_in_time`. | `full-audit-v2` §3.5 | Scale-only degradation (seq scans). Not an issue at current volume. | DB/perf |
| P-15 | Medium | 417 dead i18n keys retained; some non-ternary hardcoded strings remain outside the A.1/A.2 file sets. | `i18n-inventory.md` tail | Translation bloat / residual localisation gaps. | i18n |
| P-16 | Medium | Notifications is the only nested paginated envelope; `/api/users/profile` and `/api/auth/me` use different casing conventions. | `functional-audit.md` §D.3 | Consumer hazard. | API contract |
| P-17 | Low | Orphan tables `Receipt`, `Commitment`, `Payment` with no relations. | `functional-audit.md` §H.1 | Dead schema. | DB |
| P-18 | Low | `time_logs` CASCADE drop is irreversible; 11 recreated DROP INDEX. | `functional-audit.md` §H.4 | Historical data irrecoverable. | Migrations |

### Suspected (strong static signal, not executed this session)

| ID | Sev | Problem | Evidence | Impact |
| --- | --- | --- | --- | --- |
| P-20 | Medium | Remaining a11y gaps: unlabeled inputs/selects (sibling `.hii-label` without `htmlFor`), icon-only buttons without `aria-label`, sub-44px touch targets (`Button sm`/`icon`, `Modal` close, `DropdownMenu`, `Pagination`). | `full-audit-v2` §4.3/4.5 | Keyboard/SR/mobile usability. Partially addressed by `7a72ad2`/`bd48d01`; residual static signals remain. |
| P-21 | Medium | Low-contrast muted tokens may persist (`slate-400` placeholder/label 2.34–2.56). | `full-audit-v2` §4.1 | WCAG AA failures. `4aff9c9` raised some tokens; not fully re-measured. |
| P-22 | Low | Raw `<button>` elements (~170) bypass the shared `Button` primitive; Card padding inconsistent. | `full-audit-v2` §2.3 | Visual/interaction drift. |
| P-23 | Low | Table→card fallback inconsistent on `avize`, `pontaj`, `stocuri`, `utilizatori`. | `full-audit-v2` §2.3 #4 | Phone horizontal scroll. |

### Missing functionality (confirmed absent)

| ID | Sev | Problem | Evidence |
| --- | --- | --- | --- |
| P-30 | **High** | **Phase 7 Sales domain absent** — no models, backend modules, routes, or nav. | `STATUS.md` Phase 7 "NOT STARTED"; `docs/fixes/10` |
| P-31 | Medium | Worker blocker report/resolve workflow incomplete (blockedReason exists only as red-flag text). | `STATUS.md` Phase 4 |
| P-32 | Medium | Control Tower health cards / "activity since yesterday" absent; client never calls drilldown/red-flags endpoints (builds drilldown in-memory). | `STATUS.md` Phase 5 |

### UNVERIFIED / externally dependent

| ID | Sev | Problem | Why unverified |
| --- | --- | --- | --- |
| P-01 | **Critical** | Production backend hosting (Render service) not confirmed to exist/deploy. | No production access this session. |
| P-02 | **Critical** | Production DB migration state not confirmed. | No production access. |
| P-03 | **High** | Production email (`RESEND_API_KEY`, `PUBLIC_APP_URL`) not confirmed. | No production access. `docs/fixes/04`. |
| P-04 | **High** | Production storage driver/root not confirmed (`STORAGE_DRIVER=local` in docs). | No production access. |
| P-05 | **High** | No end-to-end runtime acceptance test ever run against deployed frontend+backend+DB. | `docs/fixes/06`; not performed. |
| P-06 | Medium | Browser responsive/visual verification at 375/768/1280 never performed. | No headless browser. `full-audit-v2` §2.1. |
| P-07 | Medium | Live HTTP functional re-run not performed this session. | Backend not started. Prior run: `functional-results-after-quality-pass.json` (2026-10-16). |
| P-08 | Low | `dev@hiieko.local` login returned 401 in the 2026-10-16 re-run (credential/DB drift, not code). | `functional-audit.md` §1; not re-checked. |
| P-09 | Low | Local dev DB password appears in git history (local-only; intentionally not rotated). | `docs/security/rotation.md`. |

### Contradictory documentation (must be adjudicated — see §8)

| ID | Contradiction | Resolution in this master audit |
| --- | --- | --- |
| C-1 | `technical-audit.md` says login is a STUB/BYPASS and password reset MISSING; `STATUS.md` and source say both are implemented. | **Source wins.** Login is real (`login/page.tsx`); reset endpoints exist (`auth.controller.ts:125,141`). The technical-audit is dated **2026-10-13**, before the Phase 0 work. Treat it as a historical snapshot. |
| C-2 | `functional-audit.md` (2026-10-14) E.2/B.1: `site_manager` routed to a Control Tower that 403s it (HIGH). | **Resolved** by `control-tower.controller.ts:40` + `route-roles.ts` parity. |
| C-3 | `functional-audit.md` §F i18n numbers (~376 keys / ~12 missing / ~47 dead / 27 ternaries) vs `i18n-inventory.md` (1432 / 0 / 417 / 307). | **i18n-inventory wins**; its reconciliation section explicitly corrects the earlier numbers. |
| C-4 | `functional-audit.md` D.1: purchase-orders 500s for 15/18 roles. | **Superseded** — controller now passes only `organizationId`; the invalid `project_id` filter is gone. Endpoint still has no UI consumer (P-12). |

---

## 4. RECOMMENDED CHANGES

Each item is classified in exactly one bucket.

### REQUIRED FIX

1. **P-01/P-02/P-03/P-04 — Production configuration & acceptance.** Stand up/verify Render backend,
   production Postgres, email, and storage; run `npm run migrate:deploy --workspace=backend` and a
   real end-to-end acceptance pass. Evidence: `docs/fixes/06`. Do not run migrations until backup/
   recovery and authorization are confirmed.
2. **P-11 — Complete query-param validation** for the controllers still lacking DTO validation
   (`attachments`, `activity`, `control-tower.getDrillDown/getRedFlags`, `inventory` balance/movements
   as needed). Follow `docs/fixes/02` conventions; add NaN/date guard.
3. **P-10 — Decide `onDelete` policy** for the 45 relations without explicit actions; at minimum add
   `@@index`/`onDelete` where financial/document data is at risk (`docs/audit/functional-audit.md` §H.2).

### RECOMMENDED IMPROVEMENT

4. **P-20/P-21 — Finish a11y remediation**: associate remaining labels with `htmlFor`, add
   `aria-label` to icon-only buttons, raise sub-44px targets, re-measure contrast after `4aff9c9`.
5. **P-14 — Add `@@index([project_id])`** to `cost_entries`, `expenses`, `inspections`, `documents`,
   `ncrs`; composite `[project_id, delivery_date]` on `avize`. Scale hardening only.
6. **P-16 — Normalise API envelopes** (single pagination convention; consistent casing) — documented,
   not urgent.
7. **P-22/P-23 — Finish visual-system adoption** (raw buttons, Card padding, table→card fallback).
8. **P-32 — Wire Control Tower drilldown/red-flags client calls** to the existing endpoints.

### OPTIONAL FUTURE FEATURE

9. **P-30 — Phase 7 Sales** (lead capture, field visits, negotiation, handover) — large, new product
   surface, not a defect fix (`docs/fixes/10`).
10. **P-31 — Worker blocker report/resolve** full workflow.
11. **P-15 — Purge 417 dead i18n keys** (defer until full-page test coverage exists).
12. **P-17 — Remove/formalise orphan tables** `Receipt`/`Commitment`/`Payment`.

### OWNER DECISION REQUIRED

13. **`dev@` seed credential** (P-08): re-seed the password or update `scripts/audit-functional.json`.
14. **Whether `/workforce` FINANCE access is intended** — page loads but a swallowed `getUsers()`
    call 403s (`functional-audit.md` §B.2). Product decision, not automatically a bug.
15. **`STORAGE_DRIVER=local` in production** — confirm acceptable or migrate to object storage.

### DO NOT CHANGE

16. Real auth/session/refresh flow and the in-memory-token + httpOnly-cookie model.
17. `ROUTE_ROLES` as the frontend authorization source of truth.
18. The `design-review` prototype subtree and its explicit "local mock data" labelling.
19. The `DEMO_MODE` gate on login quick-fill.
20. The passing backend test suite structure (extend, don't replace).

---

## 5. COMPLETE INVENTORIES

### 5.1 Frontend routes/pages (34 `page.tsx` files; evidence: filesystem scan this session)

`/` · `/login` · `/signup` · `/forgot-password` · `/forgot-password/reset` · `/profil` · `/activity` ·
`/notificari` · `/projects` · `/projects/[id]` · `/santiere` · `/teams` · `/planning` · `/tasks` ·
`/issues` · `/control-tower` · `/workforce` · `/utilizatori` · `/pontaj` · `/rapoarte` ·
`/rapoarte/form` · `/aprobare` · `/cheltuieli` · `/qa` · `/qa-qc` (redirect → `/qa`) · `/stocuri` ·
`/depozite` · `/furnizori` · `/avize` · `/documente` · `/solar-configurator` · `/design-review` ·
`/design-review/global` · `/design-review/architecture`.

> Reconciliation note: `web_audit_report.md` stated "36 page.tsx files". This session's scan counts
> **34**. The discrepancy is not resolved (the frontend report may have counted additional files);
> recorded as a documentation inconsistency, frontend report preserved unchanged.

### 5.2 User-facing functions (by domain)

Auth/session; profile & change-password; projects & members & stages; teams & workforce/employees;
planning (daily plans) & tasks & task dependencies; attendance (pontaj); daily reports (list/form/
approve); issues/blockers; QA/QC inspections; inventory (stocuri/materials/movements/warehouses);
procurement (suppliers, purchase orders, avize/delivery notes); expenses/approvals; documents &
uploads & OCR; notifications; activity feed; solar configurator; Control Tower dashboard.

### 5.3 Role/permission matrix (roles: admin, owner, manager, pm, site_manager, foreman,
team_leader, technician, worker, qa_qc, finance, procurement, viewer, site_logistics,
maintenance_director, technical_director)

Key route→role contract (`web/src/config/route-roles.ts`), corroborated by backend `@Roles`:
`/workforce`=WORKFORCE_ROLES(admin,owner,manager,pm,finance); `/qa`=QA_ROLES(+qa_qc,site_manager);
`/control-tower`=CONTROL_TOWER_ROLES (12 roles, includes site_manager); `/utilizatori`=admin;
`/solar-configurator`=admin,owner,pm,site_manager; `/projects*`=PROJECT_ROLES. `admin`/`owner`
bypass `RoleGuard` everywhere. **[E]** Parity between `CONTROL_TOWER_ROLES` and backend now holds.

### 5.4 Backend endpoints (35 controllers; evidence: filesystem scan)

activity, attachments, attendance, audit, auth, change-orders, control-tower, costs, daily-plans,
daily-reports, demo, documents, employees, expenses, inventory, issues, materials, notifications,
ocr, permissions, procurement, projects(+project-members), project-stages, qa-qc, roles, solar,
suppliers, task-dependencies, tasks, teams, upload, users, warehouses. **[E]**

### 5.5 Database models / migrations / integrity

85 models, 85 `@@map`, @relation 134, enums 28, 23 migration folders. Referential actions present in
migrations (82 CASCADE / 4 RESTRICT / 31 SET NULL); 45 relations in schema omit explicit `onDelete`.
5 CHECK constraints (stock invariants only). 39 `@@index`. **[D]** (`functional-audit.md` §H).

### 5.6 End-to-end workflows

Worker day loop (check-in → tasks → report → next-morning plan) present; photo attach infra present
with partial UI history; blocker resolution partial; Control Tower aggregation present but client
consumes only overview. Sales (Phase 7) absent. **[D/E]**

### 5.7 Security/privacy

Env hardening (`MIN_JWT_SECRET_BYTES=32`, placeholder block, prod boot refusal); bcrypt cost 10;
15-min access token; opaque rotating refresh + reuse detection; per-route rate limits; Helmet; CORS
allowlist; global ValidationPipe; upload MIME+size caps; upload content validation added (`10c9139`);
Prisma→HTTP mapping added (`3af5bf9`); no committed production secrets. **[D/E]**

### 5.8 UI/accessibility/responsiveness

Shared primitives (`PageHeader`, `Card`, `Button`, `Badge`, `PageContainer`, `Pagination`); 24 of 34
routes use the system. A11y: partial remediation landed; residual static gaps (P-20/P-21). No browser
verification performed (P-06). **[D/E]**

### 5.9 Automated/manual tests

**Backend: 48 suites / 567 tests pass (this session) [E].** Cover auth, guards, sessions, password
policy, control-tower, daily-reports, inventory/stock, expenses, solar (multiple), upload, users,
error-envelope, project-scope. No frontend test framework confirmed; no E2E/browser tests confirmed.
Manual acceptance: not performed (P-05). **[E/U]**

### 5.10 Integrations

Email (Resend — configured name documented, delivery unverified); OCR (PaddleOCR — URL/token
documented, availability-gated in UI); storage (local driver default); Prisma/PostgreSQL. **[D/U]**

### 5.11 Deployment/operations

`docs/deploy.md` (Render backend + Netlify frontend + managed Postgres), `netlify.toml`, CI build;
`docs/ops` restore/incident-response/runbook added (`4ffd052`); health endpoints `/health/live` &
`/health/ready`. Actual deployment & migration state **unverified** (P-01/P-02). **[D/U]**

### 5.12 Production readiness

**Not production-ready as evidenced.** Strong code/test baseline; blocking on unverified production
configuration (P-01..P-04) and the absence of any runtime acceptance test (P-05). This aligns with
`docs/fixes/06` ("Treat production readiness as unverified until the relevant checks have actually
been performed").

---

## 6. FIVE INDEPENDENT REVIEWS

> **Disclosure:** These are five *perspectives* reasoned by the consolidation session. They are **not**
> independent third-party reviews and no subagent ran them. Legal content distinguishes **fact**
> (traceable to the repo) from **counsel-needed** (requires qualified Romanian/EU advice).

### 6.1 Product Owner

- Strengths: real auth, broad domain coverage, passing tests, most field workflows exist.
- Biggest value gaps: Sales (Phase 7) absent; Control Tower insights under-consumed by the UI;
  worker blocker loop incomplete.
- Priority: finish the operational loop and ship the acceptance test before adding Sales.
- Decision needed: FINANCE `/workforce` intent; `dev` seed credential.

### 6.2 Defender

- The system is materially complete: 85 models, 567 green tests, granular RBAC, strong auth.
- Most "HIGH" findings in older reports (login stub, site_manager 403, soft0) are **already fixed**;
  quoting them as current would be unfair.
- Structural schema issues (P-10, P-13) are latent, not active failures, at current data volume.

### 6.3 Skeptical Principal Engineer / Security Reviewer

- No runtime acceptance evidence (P-05) — a green test suite does not prove a deployable system.
- Query-param validation gaps (P-11) still allow unvalidated strings into Prisma `where`.
- Test-coverage measurement is not evidenced (only pass counts), so "567 passing" ≠ "well covered".
- `STORAGE_DRIVER=local` and email config unverified (P-03/P-04) are real availability risks.
- **Fact:** local dev DB password is in git history but is local-only (`docs/security/rotation.md`).
  Mitigation is operational (rotate local password), not a code change.
- Required before sign-off: production config check + E2E acceptance + DTO completion.

### 6.4 Change Advocate

- Add query DTOs uniformly; index the control-tower filter columns proactively; normalise the API
  envelope; finish a11y and visual-system adoption; wire the unused Control Tower endpoints.
- These are low-risk, high-consistency improvements that reduce future defect surface.

### 6.5 Independent Legal/Privacy/Compliance Reviewer

- **Facts traceable to repo:** the app processes personal data (users, profiles with phone/avatar,
  attendance/geolocation `gps_valid`, documents, OCR of uploaded files). Access tokens are held in
  memory only; refresh is an httpOnly cookie. Audit logging exists (`AuditLog`, common/audit). No
  RLS is used (FYI in `STATUS.md`).
- **Requires qualified Romanian/EU counsel (not determinable from the repo):**
  - GDPR lawful basis, DPIA necessity, and data-subject rights (access/erasure) for employees'
    geolocation and attendance data.
  - Retention periods for `audit_logs`, OCR extractions, and uploaded documents (no retention policy
    evidenced in code).
  - Whether OCR of uploaded documents (which may contain personal data) to a third-party
    `PADDLEOCR_URL` requires a data-processing agreement and/or EU data-residency assurances.
  - Whether the leaked local dev password constitutes a notifiable incident (**assessment in repo:
    local-only, low severity, not remote-reachable** — but notifiability is a legal determination).
- **Do not treat the above as legal conclusions.** This reviewer only flags scope; it provides no
  legal advice.

---

## 7. PRIORITIZED, DEPENDENCY-AWARE ISSUE REGISTER

Ordering is dependency-aware (blockers first).

| Rank | ID | Sev | Issue | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| 1 | P-01 | Critical | Verify/stand up Render backend hosting | — | Render service builds & serves `/health/live`=200 |
| 2 | P-02 | Critical | Verify production DB migration state | P-01 | `prisma migrate status` clean on prod; backup confirmed |
| 3 | P-05 | High | End-to-end production acceptance test | P-01,P-02,P-03,P-04 | Login, role access, data load, upload, core workflows pass on the deployed env; failures documented |
| 4 | P-03 | High | Verify email config (`RESEND_API_KEY`,`PUBLIC_APP_URL`) | P-01 | Reset email delivered; link points to public URL |
| 5 | P-04 | High | Verify storage config | P-01 | Upload persists and is retrievable in prod |
| 6 | P-11 | High | Complete query-param validation | — | Malformed/out-of-range params rejected 400; tests added |
| 7 | P-10 | High | Decide `onDelete` policy for 45 relations | — | Policy documented & applied where data loss risk exists |
| 8 | P-12 | High | Resolve purchase-orders API ambiguity/dead surface | P-11 | Endpoint either project-filterable or formally org-scoped & consumed |
| 9 | P-20/21 | Medium | Finish a11y remediation | — | No unlabeled controls; targets ≥44px; contrast re-measured |
| 10 | P-14 | Medium | Index control-tower filter/sort columns | — | `EXPLAIN` shows index use at scale |
| 11 | P-32 | Medium | Wire Control Tower drilldown/red-flags client | — | UI calls existing endpoints |
| 12 | P-31 | Medium | Worker blocker report/resolve | — | Blocker recorded & resolvable end-to-end |
| 13 | P-16 | Low | Normalise API pagination/casing | — | One documented envelope |
| 14 | P-30 | Optional | Phase 7 Sales | — | Per `docs/fixes/10` acceptance list |

**Recommended single next task:** **P-01 — verify/stand up the Render backend hosting and confirm
`/health/live`.** It is the root blocker for the entire production-readiness cluster (P-02, P-03,
P-04, P-05) and can be performed without touching application code or the database.

---

## 8. RECONCILIATION TABLE

| Prior artifact | Date | Incorporated | Status | Notes |
| --- | --- | --- | --- | --- |
| `web_audit_report.md` | 2026-10-20 | Yes (§2.3, §5.1) | **Preserved, unchallenged except route count (36 vs 34)** | Separate frontend artifact; not replaced. |
| `docs/audit/full-audit-v2.md` | 2026-10-16 | Yes (§3 P-14/P-20..P-23, §5) | **PARTIAL** — Sections 1–4 only; §§5–10 never written | Continues as evidence; not a substitute for this master. |
| `docs/audit/functional-audit.md` | 2026-10-14 | Yes (§3, §8) | Superseded in parts (site_manager, purchase-orders 500, i18n numbers) | Pre-Phase-0-remediation snapshot. |
| `docs/audit/query-param-validation.md` | 2026-10-16 | Yes (P-11) | Current | Some items fixed by `a58dc7f`; residual gaps tracked. |
| `docs/audit/i18n-inventory.md` | 2026-10-15 | Yes (P-15, §2.6) | Current; corrects functional-audit §F | 1432 keys / 0 missing / 417 dead / 307 ternaries. |
| `docs/audit/functional-results.json` | 2026-10-15 | Referenced (baseline) | Raw evidence | 25 endpoints × 18 users. |
| `docs/audit/functional-results-after-quality-pass.json` | 2026-10-16 | Referenced (after) | Raw evidence | `dev` 401 drift; additive demo data. |
| `docs/audits/technical-audit.md` | 2026-10-13 | Yes (C-1) | **STALE / SUPERSEDED** | "login stub"/"password reset missing" no longer true. |
| `docs/audits/design-audit.md` | 2026-10-13 | Partially (§5.8) | Historical | Uses pre-remediation line numbers; drift risk. |
| `docs/fixes/00–10` | 2026-10-16 | Yes (§2, §4, §7) | Mix: several **DONE** (see §2), several **NOT STARTED** (06, 10) | `00-index.md` progress tracker still shows all unchecked — **inconsistent with git** (fixes 01,02,03,04,05,08,09 have commits). |
| `docs/plan/STATUS.md` | 2026-10-12 (updated 10-18) | Yes (§3 P-30..P-32) | Largely current | Corrections about subagent claims preserved. |
| `docs/plan/00–14` | 2026-10-13 | Referenced | Historical plans | Requirements source, not status. |
| `docs/security/rotation.md` | 2026-10-13 | Yes (P-09, §6.3, §6.5) | Current | Local-only leaked credential. |
| `docs/deploy.md` | — | Yes (§5.11) | Documented, **unverified** | Production acceptance not performed. |

**Could not be verified (missing evidence):**
- Production runtime state (P-01..P-05) — no access.
- Browser/responsive/axe results (P-06) — no headless browser.
- Frontend/E2E test coverage numbers — no frontend test runner evidenced.
- The `web_audit_report.md` "36 routes" vs scanned 34 discrepancy.

**Incomplete prior artifact explicitly continued here:**
`full-audit-v2.md` stopped at Section 4 (of 10). This master incorporates Sections 1–4 as evidence
and supersedes them where later commits changed the facts, but it does **not** claim to complete the
v2 Sections 5–10; those remain open in their own file.

---

## 9. Evidence Index

- Backend tests (this session): `npm test --workspace=backend` → 48 suites / 567 passed.
- Web build (this session): `npm run build --workspace=web` → 35 routes, max 200 kB (`/`).
- Git: HEAD `3457db9`; `origin/master..HEAD` = 2; 358 total commits.
- Fix commits cited: `92a9050`, `3ba6ec3`, `a58dc7f`, `3af5bf9`, `3d12ad9`, `854a6e9`, `10c9139`,
  `200ff1c`, `7a72ad2`, `bd48d01`, `4aff9c9`, `14f666c`, `3582b0e`, `389179d`, `ee4ac76`, plus i18n
  commits in `i18n-inventory.md`.
- Source anchors: `backend/src/modules/control-tower/control-tower.controller.ts:40,66,126,177`;
  `backend/src/modules/auth/auth.controller.ts:125,141,153`;
  `backend/src/modules/procurement/procurement.controller.ts:30`;
  `web/src/app/login/page.tsx:8,27`; `web/src/config/route-roles.ts:126-139`;
  `web/src/app/qa-qc/page.tsx`.

*End of master audit. No application code, configuration, schema, migrations, or data were modified
in producing this document. No commit, push, reset, stash, or clean was performed.*
