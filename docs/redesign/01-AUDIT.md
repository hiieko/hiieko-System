# HIIEKO Web + Mobile Redesign — Audit

**Audit type:** Static repository audit for planning; not a runtime, production, or browser certification.  
**Repository context:** The checkout already contains user modifications and untracked work. Some inspected source is modified in this checkout; findings describe what was read, not a clean-branch comparison.  
**Evidence labels:** **[S]** source/config inspected in this planning task; **[D]** prior documentation/audit; **[A]** assumption/proposal needing confirmation; **[U]** unverified.

## Product and audiences

HIIEKO is a solar-PV construction-site operations system. Its production web and mobile clients use the NestJS API backed by Prisma/PostgreSQL; shared TypeScript code includes domain types and Romanian/English translations. **[S]** `AGENTS.md`, route configuration, the web shell, API client, and backend controller inventory. Mobile is in scope but its screen-level implementation is not audited in this planning pass; the separate Mobile roadmap begins with that inspection.

The web experience serves field workers and technicians, team leaders and foremen, site/project managers, managers/owners, QA/QC, finance, procurement, site logistics, maintenance/technical directors, viewers, and administrators. **[S]** `web/src/config/route-roles.ts` and `navigation.ts` expose these role identifiers. These are route/UI role labels, not a complete business-permission specification. Backend authorization remains authoritative for data and actions.

### Important role and authorization constraints

- The route contract is centralized in `web/src/config/route-roles.ts`; desktop and mobile navigation filter links through it. `RoleGuard` also has existing admin/owner superset behavior. **[S]**
- `AppShell` wraps authenticated pages with `ProtectedRoute`, project context, toast and photo-upload providers; login/signup/password-recovery and `/design-review*` use a separate shell path. **[S]**
- The root route selects a role-specific home: worker → `WorkerMyDay`; team leader/technician/foreman → `WorkerDashboard`; other roles → shared `ControlTowerSurface`. `/control-tower` is another entry to that shared surface with its own route guard. **[S]**
- Do not infer permissions from a visual role label, hidden button, or this audit. Preserve backend checks and project/organization isolation. Any discovered mismatch blocks the affected UI change and is reported for an owner decision.

## Core workflows already represented

1. **Field day:** worker home/My Day, assigned daily-plan tasks, task progress, attendance check-in/out, daily report submission, notifications, and photo attachment entry points. **[S/D]** Source components and API client show these surfaces; exact end-to-end behavior and device acceptance are not established here.
2. **Planning and execution:** project context, daily plan creation/publication/completion/cancellation, task assignment/status/quantity/blocker actions, filtering, and task dependencies. **[S]** Current route and task feature modules plus backend controllers.
3. **Project oversight:** role-routed Control Tower overview, drilldown/red flags, project pages/members/stages, and site/geofence settings. **[S]** Routes/API methods exist; current data quality and all role/runtime combinations are **[U]**.
4. **Daily reporting and quality:** daily reports, form/review actions, QA inspections, issue/blocker tracking, and approvals. **[S]** UI routes and controller methods exist; full workflow completeness is not certified.
5. **Materials and delivery:** materials, stock balances/movements, warehouses, suppliers, and avize/delivery notes. **[S]** Existing routes and API/controller methods.
6. **Expenses and approvals:** expense list/create/review/approve surfaces and OCR-related UI/API. **[S]** The presence of screens/endpoints does not prove every policy or production provider is configured.
7. **Documents and account:** authorized project documents, upload/download/versions, notifications, activity, profile, login/register, forgot/reset password. **[S]** Current routes/API methods; production storage and end-to-end authorization are not checked here.

## Route inventory and purpose

The current web route source tree and the 2026-10-20 consolidated audit identify **31 production web route surfaces** and three prototype-only design-review routes. **[S/D]** The inventory is captured in [03-PAGE-INVENTORY.md](./03-PAGE-INVENTORY.md). `/qa-qc` is a redirect/legacy alias to `/qa`, not a separate redesign target. `/design-review`, `/design-review/global`, and `/design-review/architecture` are explicit prototype surfaces and excluded from production redesign. The Mobile app is also in production scope; its actual screens, navigation, platform workflows, and test coverage must be inventoried from Mobile source before implementation. Do not infer mobile routes or reuse the web route count.

Routes absent from the current source tree—including sales/CRM pages—are not redesign targets. Do not create a page to make the route list appear complete.

## Existing API surface

The frontend calls the NestJS REST API through `web/src/lib/api-client.ts` and domain feature API modules. **[S]** Inspected client methods and NestJS controller decorators show existing domains/endpoints for:

- Auth/session: register, login, refresh, logout, current user, forgot/reset/change password.
- Projects, project members/stages, teams, employees/users/roles/permissions.
- Tasks, task dependencies/prerequisite checks, daily plans and progress.
- Attendance, daily reports, issues, QA/QC inspections, activity and audit.
- Control Tower overview, drilldown, and red flags.
- Materials, inventory balance/stock/movements, suppliers, warehouses, procurement purchase orders and delivery notes/avize.
- Expenses/approvals, documents/versions, upload/download, attachments, OCR jobs/extraction review, and solar designs/roof sections/obstacles/layout/placements/BOM.

This is an inventory of controller/client surface, not proof that each operation is consumed, works for every role, is deployed, or is production-ready. Some older audits contain stale findings; see the consolidated audit's reconciliation notes. Before each page task, trace the actual page → client method → controller/guard for the action being retained. Do not invent endpoints, filters, data, or statuses.

## Shared frontend architecture and visual foundation

- Next.js App Router web application. **[S]**
- `AppShell`, `ProtectedRoute`, `Sidebar`, `Header`, `MobilePrimaryNav`, `MoreSheet`, project context, and shell components (`ShellBrand`, `ProjectContextChip`, `PageContainer`) provide the common frame. **[S]**
- Shared UI exports include Button, Input, Card family, Badge, Skeleton/TableRowSkeleton, EmptyState, ErrorState, PageHeader, ToastProvider, Modal, Drawer, LoadingSpinner, Tabs, ConfirmDialog, DropdownMenu, Breadcrumbs, Pagination, and PhotoUpload. **[S]** `web/src/components/ui/index.ts`.
- Feature-oriented modules exist for tasks, planning, attendance, daily reports, issues, projects, procurement, QA, documents, activity, warehouses, suppliers, and solar configuration. Reuse existing components and APIs where suitable; inspect their current checkout state first.
- Current web tokens define HIIEKO green `#188C51`, shell/navy values including `#0F172A`/`#111827`, solar amber `#F59E0B`, light canvas/surfaces, semantic state colors, Inter, spacing/radius/shadows, focus styling, reduced-motion handling, and responsive shell behavior. **[S]** `web/src/app/globals.css`, `web/tailwind.config.js`.
- Owner-approved visual direction is HIIEKO green + solar amber + navy navigation; retain Inter and existing semantic tokens where suitable. The inspected `Sidebar.tsx` uses literal teal `#087E83` for its active item, inconsistent with the approved direction. Resolve that mismatch through the approved system during the appropriate implementation task; no code change was part of this planning reconciliation. Older D8 amber-led branding is historical and does not override the owner decision.

## Responsive behavior and evidence boundary

The **web** authenticated shell uses a desktop sidebar, compact header, mobile drawer, role-aware bottom navigation, a More sheet, and small-screen safe-area padding. **[S]** `AppShell`, `Sidebar`, `MobilePrimaryNav`, `MoreSheet`, and global CSS. This is not evidence that the separate Mobile app should copy those layouts.

Page layouts vary: some use responsive tables/cards, filters, or feature-specific mobile structures; others rely on local styling. Historical `docs/audits/design-audit.md` lists likely weak areas (including profile, signup, expenses, notifications, and some dense lists), but it is a static and partly stale snapshot. **[D/U]** No browser/device review was run for this planning task. Do not state that any viewport, page, control, or contrast passed until actually checked.

## Existing planning material and conflicts

- `docs/plan/13-d8-redesign.md` is a detailed historical redesign plan but prescribes its own palette/visual vocabulary, includes stale route descriptions, and has user modifications. Preserve it; this chain does not adopt it wholesale.
- `docs/plan/01-design-d0-d7.md` and `12-d7-command.md` contain useful phase/gate and audit-first practices, but include old workflow directions and contradictory status.
- `docs/audits/design-audit.md` is a useful page-level issue source, not current certification. `docs/audit/HIIEKO_MASTER_AUDIT.md` is the newer consolidation but is based on a prior repository baseline, not this dirty checkout.
- `docs/design/DOCUMENTS_PAGE_SPEC.md` provides useful safety rules: no invented document categories/actions, no fake data, preserve source identity, verify authorization, localize copy, and inspect storage/API first. It remains a proposed page specification, not approval to expand document functionality.
- Current `AGENTS.md` is authoritative over conflicting historical plan instructions. The architecture is Next.js + NestJS + Prisma/PostgreSQL + shared + Mobile; v0 is reference only.

## Open audit questions / assumptions

1. **Approved scope:** redesign the existing production web and mobile applications. No external marketing site or new production route is included. Exclude the three named design-review prototype routes.
2. **[U]** Current working-tree changes may materially affect the implementation baseline. Before any code task, re-read changed files and establish what work is user-owned; do not treat this planning audit as a clean HEAD snapshot.
3. **[U]** Actual browser/device behavior, responsive fit, screen-reader output, focus behavior, contrast, and real production API/storage behavior were not tested here.
4. **[U]** Mobile screen inventory, navigation, platform-specific interaction patterns, offline behavior, and mobile tests have not been audited here. The separate mobile roadmap starts with a source inspection; do not assume parity with web layouts.
5. **[U]** Business policy for some route-role and approval behaviors must be resolved from existing source/owner decisions; redesign work must not resolve policy implicitly.

### Audit exit criteria

Before the web `/tasks` prototype, inspect its current implementation, APIs, role permissions, components, tests, and user-modified files; identify behavior that must not move and prepare an exact bounded implementation brief. Before mobile implementation, perform the separately sequenced Mobile source/workflow/test audit. Do not “clean up” old audit documents as part of this redesign.
