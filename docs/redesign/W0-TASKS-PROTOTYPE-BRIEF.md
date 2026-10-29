# W0 — `/tasks` Inspection and W1 Prototype Brief

**Status:** W0 complete — static source inspection and bounded W1 brief prepared.  
**Next roadmap task:** W1, the existing production web `/tasks` visual prototype.  
**Implementation status:** Not started. No application code, build, test, or live API call was run for W0.

## Inspection boundary and evidence

Inspected the current working tree and relevant route, feature, shared component, API, backend, permission, translation, and test sources. The repository was already dirty. `/tasks` source and task feature files were not listed as modified/untracked, but related files including `web/src/components/Sidebar.tsx`, `web/src/config/navigation.ts`, `backend/src/common/auth/guards/project-access.guard.ts`, package files, and test/Jest setup are existing user work. Read them for context; W1 must re-check status and preserve all of them.

This is static evidence only. No server, database, browser, account, or live API was started/probed. Test files were inspected but not run. Runtime response shapes, current account/project data, and visual behavior must be confirmed during W1's safe manual review.

## Files inspected

### Web route and task feature

- `web/src/app/tasks/page.tsx`
- `web/src/features/tasks/api.ts`
- `web/src/features/tasks/types.ts`
- `web/src/features/tasks/components/index.ts`
- `web/src/features/tasks/components/TaskCard.tsx`
- `web/src/features/tasks/components/TaskFilters.tsx`
- `web/src/features/tasks/components/TaskCreateModal.tsx`
- `web/src/features/tasks/components/TaskAssignModal.tsx`
- `web/src/features/tasks/components/TaskStatusWorkflow.tsx`
- `web/src/features/tasks/components/TaskQuantityEditor.tsx`
- `web/src/features/tasks/components/TaskProgressBar.tsx`
- `web/src/features/tasks/components/TaskDependencyChips.tsx`
- `web/src/lib/api-client.ts` (task methods)
- `web/src/lib/api/tasks.ts` (legacy forwarding module; not imported by this route)
- `web/src/features/projects/api.ts` (project/member/stage methods used by dialogs)
- `web/src/contexts/ProjectContext.tsx`
- `web/src/contexts/PhotoUploadModalContext.tsx`
- `web/src/hooks/useMediaQuery.ts`

### Route authorization, shell, tokens, and shared UI

- `web/src/config/route-roles.ts`
- `web/src/lib/auth-guard.tsx`
- `web/src/components/AppShell.tsx`, `web/src/components/ProtectedRoute.tsx`
- `web/src/components/Sidebar.tsx` (pre-existing modified file; inspected only)
- `web/src/app/globals.css`, `web/tailwind.config.js`
- `web/src/components/ui/PageHeader.tsx`, `Button.tsx`, `Card.tsx`, `Badge.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `Skeleton.tsx`, `Drawer.tsx`, `Pagination.tsx`, `Tabs.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`

### API enforcement and tests/configuration

- `backend/src/modules/tasks/tasks.controller.ts`, `tasks.service.ts`
- `backend/src/modules/task-dependencies/task-dependencies.controller.ts`
- `backend/src/modules/projects/projects.controller.ts`, `project-members.controller.ts`
- `backend/src/modules/project-stages/project-stages.controller.ts`
- `backend/src/common/auth/guards/project-access.guard.ts` (pre-existing modified file; inspected only)
- `backend/test/tasks.service.spec.ts`
- `backend/test/task-dto-validation.spec.ts`
- `backend/test/task-dependency.service.spec.ts`
- `backend/test/project-access.guard.spec.ts` (pre-existing modified file; inspected only)
- `web/src/lib/auth-guard.test.tsx` (existing role-guard test)
- `web/src/features/documents/components/DocumentsWorkspace.test.tsx` (current React Testing Library pattern)
- `web/jest.config.js`, `web/jest.setup.ts` (pre-existing untracked test setup; inspected only)
- `web/package.json`, root `package.json` (current scripts; both are pre-existing modified files)
- `shared/src/translations.ts` (task status, page, filter, state, form, action and error keys)

No `web/src/app/tasks/page.test.tsx` or task-feature component test was found. The current web test glob found only the auth-guard and documents workspace suites. Backend task tests cover service lifecycle/scope/assignment, DTO validation, dependency rules, and project-access behavior. No task controller-specific test was found in the inspected test inventory.

## Current route behavior

`TasksPage` wraps `TasksPageInner` in `RoleGuard` using `ROUTE_ROLES['/tasks']`. The route contract is `OPERATIONAL_ROLES`: `admin`, `owner`, `manager`, `pm`, `site_manager`, `foreman`, `team_leader`, `technician`, and `worker`; `RoleGuard` also preserves its established admin/owner superset behavior. `viewer` and `qa_qc` are not route roles even though the backend list endpoint allows both. Do not expand this route contract.

The authenticated `AppShell` provides `ProtectedRoute`, project context, toast and photo-upload providers, plus the existing web shell. An unauthenticated user is redirected to `/login`; route-role denial redirects to `/` with an access-denied warning, rather than rendering a page-local 403. W1 does not alter the shell, navigation, auth flow, or guards.

The page reads `selectedProject` from `ProjectContext`; that context loads accessible projects from `GET /api/projects`. A selected project scopes the task list by ID. With no selected project, the page omits the query parameter and the backend returns only the requester's authorized project scope. This is not an unscoped-data mode.

## Existing API calls and real data

| UI operation | Existing method/endpoint | Current server-side boundary |
|---|---|---|
| Load/refresh tasks | `getTasks(projectId?)` → `GET /api/tasks[?projectId=…]` | JWT, roles and `ProjectAccessGuard`; optional project scope; controller builds a scoped project filter. `TasksService.findAll` excludes archived tasks, includes work package, zone, assignments with user/profile, prerequisites/dependents, and orders by creation time. |
| Create task (existing create modal) | `createTask(dto)` → `POST /api/tasks` | Project access required. `ADMIN`, `OWNER`, `PM`, `MANAGER`, `SITE_MANAGER`, `FOREMAN`, `TEAM_LEADER`. Supported fields are those in `CreateTaskDto`; project ID is the selected project. |
| Change status / actual quantity | `updateTask(id, dto)` → `PATCH /api/tasks/:id` | Entity-derived project access. API roles: admin/owner/pm/manager/site_manager/foreman/team_leader/technician/worker/qa_qc. Service enforces status transitions, verification membership and no self-verification; start/end/verification timestamps are server-controlled. |
| Report blocker | `blockTask(id, reason)` → `PATCH /api/tasks/:id/block` | Entity-derived project access and the same operational mutation roles; reason required; terminal tasks cannot be blocked. |
| Resolve blocker | `unblockTask(id)` → `PATCH /api/tasks/:id/unblock` | Entity-derived project access and the same operational mutation roles; the existing API restores `IN_PROGRESS`. |
| Assign a member (existing assign modal) | `getProjectMembers(projectId)` → `GET /api/projects/:projectId/members`; `assignTask(id,userId)` → `POST /api/tasks/:id/assign` | Member listing requires project access. Assignment also requires entity project access and admin/owner/pm/manager/site_manager/foreman/team_leader; service checks that the selected user is a member of that task's project. |
| Create-modal options | `getProjectStages(projectId)` → `GET /api/projects/:projectId/stages`; `getProject(projectId)` → `GET /api/projects/:id` | Both are project-scoped. Stages/work packages and project zones populate existing selectors. |
| Task photos | `TaskCard` calls `openPhotoUpload({targetType:'task', targetId, projectId})` from the existing global photo-upload context/provider. | Keep the existing upload path and project/task target. The `/tasks` page does not implement a separate photo API. |

The route currently uses the typed adapter in `features/tasks/api.ts`, which delegates to `apiClient`. Task dependencies are rendered from fields included in the list response; the page does **not** call the dependency create/prerequisite methods. There is no supported delete-task or unassign endpoint/action in this route; do not add one.

### Data and UI-derived behavior

- `Task` is the real task DTO shape in `features/tasks/types.ts`: seven statuses (`PLANNED`, `READY`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `VERIFIED`, `CANCELLED`), project ID, code/title/description, work package/zone, planned/actual dates and quantities, unit, blocker data, verifier data, assignments and dependencies. Decimal quantities may serialize as strings or numbers.
- Four summary values are computed from the fetched task array: total, in progress, blocked, and completed + verified. They are not a separate KPI API.
- Search and status/“only mine” filtering occur client-side over the fetched authorized list. Search uses title/code/description, optional project name/code, work package, zone, and assignment user name/email. The backend `findAll` include list does not explicitly include the project relation, so project-name/code search may not have those fields in the current response; do not add an endpoint or imply this search is complete without verifying actual responses.
- Pagination is client-side: 10 rows at `max-width:639px`, 20 otherwise. The page resets to page 1 on search/status/only-mine/project/page-size changes.
- Task status transition buttons come from the frontend status map. The backend remains authoritative and rejects illegal transitions; reopen transitions and verification have extra role/membership/self-verification rules. Preserve action/error handling; do not weaken or redefine these rules.

## Current components and state behavior

- `PageHeader` shows localized “Tasks”, selected project code/name or all-projects label, refresh and permitted create action. Create is disabled without a selected project.
- `TaskFilters` supplies search, status tabs/counts and the only-mine toggle. At `sm` and above it sits under the sticky header; below `sm` a header button opens the existing bottom `Drawer`. Tabs horizontally scroll. Keep the current semantics and filter behavior.
- Four `Card` summary tiles show live counts; task rows use `TaskCard`. Card rows contain code/status, title, work package/zone/dates, assigned users, and quantity progress where supplied. Details expand to description/dependencies, quantity editor, status workflow, blocker controls and task photo entry. Cancellation uses `ConfirmDialog`; blocker reason uses `Modal`.
- Existing shared primitives include `Button`, `Card`, `Badge`, `PageHeader`, `Skeleton`, `EmptyState`, `ErrorState`, `Drawer`, `Pagination`, `Tabs`, `Modal`, `ConfirmDialog`, and `ToastProvider`. Prefer them; do not change global primitives for W1.
- Initial load: summary values show dashes and four task-card skeletons. Refresh reuses `PageHeader` loading state; after initial load, existing rows remain while refresh is in progress.
- Populated state: filtered/paginated task cards and local result count. Counts are for all fetched tasks, not filtered rows.
- Empty state: localized copy/actions distinguish no project/no accessible scope, no task, only-mine, and filters/search with no results. Clear-filters action resets applicable filters; permitted users can create in the selected project.
- List error: `ErrorState` with retry. On an action, status/quantity/blocker/assignment/create flows update the page or show existing toast/modal feedback only after API result. A status 400 shows illegal-transition feedback; status 403 uses verification-denied feedback; other mutation failures use current generic/inline error behavior.
- Permission denied: unauthenticated users are redirected to login; a role denied by `RoleGuard` is redirected to `/` with warning. A backend project-scope 403 during list loading becomes the existing error/retry state; it is not a separate permission page and must not reveal unauthorized task details.

### Existing translation and visual tokens

Task page/status/filter/empty/action/error strings already have Romanian and English keys in `shared/src/translations.ts` (`task.*`). Keep them; do not add hard-coded copy or modify the translation file in W1 unless an actual missing string is confirmed and separately scoped.

The approved design anchors are existing HIIEKO green `#188C51` (brand token shades, including current `hii-600` action), solar amber `#F59E0B` (Tailwind amber; semantic warning token currently uses `#D97706` with soft/foreground tokens), and navy shell/sidebar (`#0F172A`/`#111827`). Inter is already loaded. Reuse the `surface`, `content`, `success`, `warning`, `danger`, `info`, `hii-*`, spacing and radius tokens. Do not redefine status meaning, change tokens, or add colors/fonts.

The shared navigation is outside W1's file scope. `Sidebar.tsx` currently has pre-existing teal `#087E83` active/focus literals despite the approved green/navy direction; do not change it during W1. It remains a later shared-shell task after the W2 owner gate. W1's screenshot should identify this existing shell mismatch, not silently fix it.

## W1 exact bounded file scope

Expected W1 files:

1. **Modify `web/src/app/tasks/page.tsx`** — adjust the page-level hierarchy/composition for the existing header/project context, real count summary, filters, task list and states. Keep existing fetch, local filter/pagination, role helpers, handlers, API methods and callbacks behaviorally unchanged.
2. **Modify `web/src/features/tasks/components/TaskCard.tsx`** — improve task-card visual hierarchy for real work-front/task identity, status, location/work package, dates, assignment and measured progress. Keep details disclosure and existing action semantics/confirmation/modal/photo paths; status is never communicated by color alone.
3. **Add `web/src/app/tasks/page.test.tsx`** — route-level regression tests for loading → populated, authorized role affordances, project-scoped API call, search/status/only-mine/pagination, distinct empty/no-results, load error/retry and relevant mutation feedback. Tests may use isolated mocked API responses; production runtime must continue using the existing real API.
4. **Add `web/src/features/tasks/components/TaskCard.test.tsx`** — test status/content rendering, expand/collapse, status/cancel confirmation, quantity/blocker/assignment affordances by supplied permission props, and photo target passed to existing context. Do not create fake persistence.

No other source files are expected in W1. In particular, do not edit `TaskFilters.tsx` (its existing search/status controls and mobile drawer are sufficient for this bounded pass), create/assign modals, UI primitives, shell/Sidebar/navigation, route-role config, project context, APIs/types, translations, backend or package/test configuration. If the above scope cannot satisfy the agreed visual/acceptance goal without another file or behavior/API change, stop and report the exact reason instead of expanding W1 silently.

## W1 proposed web layout

- Keep the existing AppShell/nav unchanged. On the route, make the first reading order: “Tasks” + selected project context and permitted create/refresh actions; then a compact strip of the same four live summary counts; then search/status/only-mine filters; then the authorized task list and pagination.
- Use a clear green primary action and existing HIIEKO green/semantic tokens. Keep amber for meaningful attention/in-progress semantics, navy in the existing shell, neutral canvas/paper for the reading surface. Preserve semantic badge variants and text/icon state labels; never apply solar amber as decoration or a new status.
- Make the task row's code/title the strongest work identity, with status, work package/zone, dates, assignments and quantity progress in a legible second level. Use actual task data only. No fabricated roof/map imagery, task rows, statuses, trends, KPIs, or task operations.
- Keep status, quantity, blocker, assignment and photo actions within the existing expanded-details workflow unless visual-only adjustment can preserve the same interaction and accessibility. Do not add delete/unassign or new action semantics.
- Reuse existing `PageHeader`, `Card`, `Badge`, `Button`, `TaskFilters`, `Drawer`, `Pagination`, `Skeleton`, `EmptyState`, `ErrorState`, `Modal` and `ConfirmDialog`. No global token, shared component, shell or package change.

## Responsive plan (web only)

- **375/390 px:** single-column task cards; narrow-screen page title/project context and permitted primary action remain visible; keep current 2-column real summary layout only if it does not crowd; filter button opens existing bottom drawer; status tabs remain horizontally scrollable; task metadata wraps; no page-level horizontal overflow; card detail actions fit and remain touch-operable. Account for AppShell's bottom nav and safe-area/content padding.
- **640–767 px:** existing inline filter mode begins at `sm`; verify status tabs/search/only-mine do not crowd. Do not alter the shared breakpoint or mobile app.
- **768 px:** inspect tablet hierarchy and action wrapping; preserve project context and avoid shrinking task text.
- **1280/1440 px:** preserve centered max-width reading surface, inline filters, readable list width and desktop navigation.
- Check Romanian and English at narrow widths. A browser class check alone is not acceptance.

## W1 acceptance and verification plan

**Functional/authorization:** verify only the original `/tasks` route; no route/role/API/persistence changes; project selection still requests the same optional `projectId`; no-project selection remains server membership-scoped. Verify representative allowed roles (worker/technician and PM/manager or foreman) show only their existing actions. Verify denied roles (viewer and qa_qc) remain denied at the web route despite backend GET support; admin/owner superset behavior is unchanged. Backend remains authoritative for project membership, transitions, verification, and assignment.

**States and interactions:** verify initial load/skeleton, populated data, refresh, empty project/scope, only-mine empty, filter/search no-results, load failure/retry, create permission, disabled create without selected project, task expansion, status update including server-rejected transition/verification cases, quantity save/error, blocker report/unblock, assignment from authorized project members, cancellation confirmation, photo modal target and pagination. Do not use production fixture data or treat test mocks as live data.

**Automated checks to run in W1 (not run during W0):**

1. Focused new web tests, for example `npm run test --workspace=web -- --runInBand src/app/tasks/page.test.tsx src/features/tasks/components/TaskCard.test.tsx`.
2. Existing `npm run web:typecheck` and `npm run web:build`.
3. `npm run i18n:check` and `npm run guards:check` if relevant to changed files; report exact outcomes.
4. If backend contracts are suspected to have regressed, run focused existing backend task/DTO/project guard tests using the current workspace test command; W1 must not edit backend code. No migrations/database writes.

**Manual/browser checks to run in W1:** use a safe non-production environment with existing real API data/accounts; inspect 375, 390, 768, 1280 and 1440 px; both `ro` and `en`; at least a field worker and a task-creating/assigning manager role, plus denied viewer/qa_qc route behavior. Verify keyboard/focus, contrast/status text, drawer escape/close, bottom navigation clearance, no overflow and all existing actions. Record environment/account role (not credentials), exact observations/screenshots, and any unrun check.

## Static risks / genuine blockers

No scope or authorization blocker prevents preparing W1. These source-level risks need explicit W1 verification and must not be silently “fixed” by changing an API:

1. **Update response relation shape:** `TasksService.update` returns the scalar `prisma.task.update` result without the relation includes used by `findAll`, while the page replaces the entire local task with `res.data`. Assignment/work-package/zone/dependency display may therefore disappear after a successful mutation. This is a static contract risk, not a runtime observation. If reproduced, preserve/report it and request a separate behavior/API scope decision; do not invent fields.
2. **Project name/code search:** the page tests optional `task.project` fields, but `findAll` does not explicitly include `project`; actual support is unverified. Do not add an endpoint/API include in W1.
3. **Role/status presentation:** UI offers transitions from its frontend map; server rejects illegal transitions and restricts reopening/verification further. Keep current server error feedback and permission rules; no route-role changes.
4. **Existing create/assign dialogs:** some labels/forms and optimistic assignment relation data are outside expected W1 file scope. Do not expand into those modals unless a concrete `/tasks`-prototype acceptance issue requires a separately approved scope update.

**W0 outcome:** exact W1 candidate files and acceptance/verification plan are defined. W1 is not started. Stop here until the next task begins implementation under the existing approvals; after W1, the mandatory W2 owner-review gate applies.
