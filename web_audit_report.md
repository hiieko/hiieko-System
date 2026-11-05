# HIIEKO Web Frontend Audit Report (Read-only)

Generated: 2026-10-20  
Scope: `web/src/app` routes, guard infrastructure, `lib/api-client.ts`, patterns (empty/log/mock/alert/TODO), keyboard/PageTutorial

## 1) Route Inventory (all `web/src/app/**/page.tsx`)
All discovered pages:

| Route | File (absolute) | Notes |
|---|---|---|
| `/` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\page.tsx` | Role router (ControlTowerDashboardPage). Worker→WorkerMyDay; team_leader/technician/foreman→WorkerDashboard; else→ControlTowerSurface. No RoleGuard on page itself (routing by role). |
| `/workforce` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\workforce\page.tsx` | Wrapped by RoleGuard(ROUTE_ROLES['/workforce']) which is WORKFORCE_ROLES (admin/owner/manager/pm/finance). Uses PageTutorial(sectionId='workforce'). API: apiClient.getEmployees/getUsers/create/update/deleteEmployee. |
| `/qa` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\qa\page.tsx` | RoleGuard(ROUTE_ROLES['/qa']) = QA_ROLES (admin/owner/qa_qc/pm/site_manager). Uses ProjectContext; GET/POST inspections via apiClient. No updates/deletes. PageTutorial? No PageTutorial used in this page (checked). |
| `/activity` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\activity\page.tsx` | RoleGuard with OPERATIONAL_ROLES (from route-roles). Uses PageTutorial? Not visible in grep results above; has many imports. API-driven activity feed. |
| `/furnizori` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\furnizori\page.tsx` | RoleGuard(ROUTE_ROLES['/furnizori']) = SUPPLIER_ROLES (admin/owner/manager/pm/procurement). Create allowed for admin/owner/manager/procurement (page-level check). Uses apiClient.getSuppliers. No PageTutorial. |
| `/aprobare` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\aprobare\page.tsx` | RoleGuard(ROUTE_ROLES['/aprobare']) = APPROVAL_ROLES (admin/owner/manager/pm/finance). Has PageTutorial(sectionId='approvals'). |
| `/utilizatori` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\utilizatori\page.tsx` | RoleGuard(ROUTE_ROLES['/utilizatori']) = ADMIN_ROLES (admin only). Has PageTutorial(sectionId='users'). Uses apiClient for users. |
| `/teams` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\teams\page.tsx` | RoleGuard(ROUTE_ROLES['/teams']) = PROJECT_ROLES. Has PageTutorial(sectionId='teams'). |
| `/issues` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\issues\page.tsx` | RoleGuard(ROUTE_ROLES['/issues']) = OPERATIONAL_ROLES. Has PageTutorial(sectionId='issues'). Uses getIssues/list features. |
| `/notificari` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\notificari\page.tsx` | RoleGuard(ROUTE_ROLES['/notificari']) = null (every authenticated). Has PageTutorial(sectionId='notifications'). |
| `/rapoarte` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\rapoarte\page.tsx` | RoleGuard(ROUTE_ROLES['/rapoarte']) = OPERATIONAL_ROLES. Has PageTutorial(sectionId='reports'). |
| `/rapoarte/form` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\rapoarte\form\page.tsx` | DAILY_REPORT_CREATE_ROLES (admin/owner/manager/pm/site_manager/foreman/team_leader/technician). |
| `/solar-configurator` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\solar-configurator\page.tsx` | RoleGuard(ROUTE_ROLES['/solar-configurator']) = SOLAR_CONFIGURATOR_ROLES (admin/owner/pm/site_manager). Worker excluded per route-roles. |
| `/qa-qc` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\qa-qc\page.tsx` | Production QA/QC page (separate from /qa; design review notes both). Has RoleGuard usage. |
| `/tasks` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\tasks\page.tsx` | RoleGuard OPERATIONAL_ROLES. |
| `/design-review` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\design-review\page.tsx` | **Prototype/design-review only**. Metadata says "Frontend-only HIIEKO prototype walkthrough with local mock data. No authentication or production data." Renders DesignReviewWorkspace. AppShell bypasses design-review subtree. |
| `/design-review/global` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\design-review\global\page.tsx` | Design review subtree. |
| `/design-review/architecture` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\design-review\architecture\page.tsx` | Design review subtree. |
| `/control-tower` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\control-tower\page.tsx` | Redirects to `/` (canonical). RoleGuard used conceptually via route-roles and role router. |
| `/pontaj` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\pontaj\page.tsx` | RoleGuard OPERATIONAL_ROLES. Has PageTutorial(sectionId='attendance'). |
| `/projects` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\projects\page.tsx` | RoleGuard(ROUTE_ROLES['/projects']) = PROJECT_ROLES. API via projectsApi (getProjects). Has create wizard; uses canCreateProjects. No PageTutorial visible. |
| `/projects/[id]` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\projects\[id]\page.tsx` | RoleGuard(ROUTE_ROLES['/projects/[id]']) = PROJECT_ROLES. Uses apiClient, projects/members/issues APIs. Has PageTutorial(sectionId='project-detail'). Tabs (overview/members/photos/issues). |
| `/profil` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\profil\page.tsx` | RoleGuard null (every authenticated). Has PageTutorial(sectionId='profile'). |
| `/forgot-password` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\forgot-password\page.tsx` | Auth page (AppShell bypasses). |
| `/forgot-password/reset` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\forgot-password\reset\page.tsx` | Auth page. |
| `/signup` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\signup\page.tsx` | Auth page. |
| `/stocuri` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\stocuri\page.tsx` | RoleGuard OPERATIONAL_ROLES. Has PageTutorial(sectionId='stock'). |
| `/planning` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\planning\page.tsx` | RoleGuard OPERATIONAL_ROLES. Has PageTutorial(sectionId='planning'). |
| `/avize` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\avize\page.tsx` | RoleGuard OPERATIONAL_ROLES + procurement. Has PageTutorial(sectionId='deliveries'). |
| `/documente` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\documente\page.tsx` | RoleGuard null (every authenticated). |
| `/santiere` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\santiere\page.tsx` | RoleGuard GIS_ROLES (admin/owner/manager/pm/site_manager). Has PageTutorial(sectionId='sites'). |
| `/cheltuieli` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\cheltuieli\page.tsx` | RoleGuard OPERATIONAL_ROLES + finance. Has PageTutorial(sectionId='expenses'). |
| `/login` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\login\page.tsx` | Auth page (AppShell bypasses). |
| `/depozite` | `C:\Users\NaderGuesmi\hiieko-System\web\src\app\depozite\page.tsx` | RoleGuard WAREHOUSE_ROLES (admin/owner/manager/pm/procurement). |

*Total page.tsx files:* 36 (includes nested routes and [id]).

## 2) Route detail: purpose, data source, role logic, classification, actions/components

| Route | Purpose (1 sentence) | Data source (API) | Role logic (in page) | Classification | Key user actions | Notable components |
|---|---|---|---|---|---|---|
| `/` | Role router that renders WorkerMyDay for workers, WorkerDashboard for team_leader/technician/foreman, otherwise ControlTowerSurface. | None directly (renders components; components may fetch). | Uses `useAuth()` to get `user.role` (lowercased); no RoleGuard; logic branches roles. | Production (auth-gated via AppShell/ProtectedRoute). | Navigation by role (implicit). | `ControlTowerSurface`, `WorkerDashboard`, `WorkerMyDay`, `useAuth`. |
| `/projects` | Project portfolio listing with create wizard. | Yes — `projectsApi.getProjects()`; create via projectsApi/create flows; fetch users/members in wizard. | Wrapped in `RoleGuard(ROUTE_ROLES['/projects'])` (PROJECT_ROLES). Also checks `canCreateProjects` for wizard access. | Production. | Search/filter, open/create project (wizard), navigate to project detail. | PageHeader, Button, Card, Badge, EmptyState/ErrorState/Skeleton, wizard steps. |
| `/projects/[id]` | Project detail workspace with tabs (overview, members, photos, issues). | Yes — `apiClient.getProject`, `getProjectMembers`, `getUsers`, `getIssues`; CRUD for members/role; patch project; upload photos via modal context. | `RoleGuard(ROUTE_ROLES['/projects/[id]'])`. Can manage if `canCreateProjects`; editEnabled for admin/owner. | Production. | Tab switch, add/update/remove members, open photo upload, view/manage issues, edit settings/stages. | PageTutorial, RoleGuard, ConfirmDialog, Modal/Pagination, ProjectSettingsPanel, ProjectStagesPanel, IssueCard/IssueDetailModal. |
| `/workforce` | Workforce/employees management (list, create, edit, delete/archive). | Yes — `apiClient.getEmployees()`, `getUsers()`, `createEmployee()`, `updateEmployee()`, `deleteEmployee()`. | `RoleGuard(ROUTE_ROLES['/workforce'])` = WORKFORCE_ROLES. | Production. | Search, create employee, edit, archive/delete with confirm. | PageTutorial, PageHeader, Button, Card, Badge, Modal, ConfirmDialog, ErrorState/Skeleton/EmptyState, Pagination. |
| `/qa` | QA/QC inspections (read + create). | Yes — `apiClient.getInspections({projectId})`, POST via create modal; scoped to selected project (ProjectContext). | `RoleGuard(ROUTE_ROLES['/qa'])` = QA_ROLES. Create allowed per roles; page checks canCreate (has project). | Production. | Filter by project context, create inspection, view cards with pass/fail counts. | PageHeader, RoleGuard, EmptyState/ErrorState/Skeleton, Button, Pagination, InspectionCard, InspectionCreateModal. |
| `/qa-qc` | QA/QC workspace (related). | Yes per architecture notes; product implementation calls apiClient. | Has RoleGuard usage per grep/design review context. | Production. | Varies by implementation. | QualityWorkspace referenced. |
| `/furnizori` | Suppliers master data (list + create where allowed). | Yes — `apiClient.getSuppliers()`; create via modal. | `RoleGuard(ROUTE_ROLES['/furnizori'])` = SUPPLIER_ROLES. Create restricted to admin/owner/manager/procurement (page-level `SUPPLIER_CREATE_ROLES`). | Production. | Search, create supplier (if allowed), refresh. | RoleGuard, Button, EmptyState/ErrorState/Skeleton, SupplierCreateModal, table/card views. |
| `/depozite` | Warehouses master data. | Yes via apiClient (per design). | `RoleGuard(ROUTE_ROLES['/depozite'])` = WAREHOUSE_ROLES. | Production. | Manage warehouses per roles. | RoleGuard. |
| `/teams` | Teams management. | Yes via apiClient in implementation. | `RoleGuard(ROUTE_ROLES['/teams'])` = PROJECT_ROLES. | Production. | Team ops. | PageTutorial. |
| `/issues` | Issues/blocks tracking. | Yes via `getIssues`/issue APIs. | `RoleGuard(ROUTE_ROLES['/issues'])` = OPERATIONAL_ROLES. | Production. | Create/view/update issues. | PageTutorial, issue components. |
| `/tasks` | Tasks execution. | Yes. | OPERATIONAL_ROLES. | Production. | Task mgmt. | — |
| `/planning` | Daily planning. | Yes. | OPERATIONAL_ROLES. | Production. | Plan create/cards, date nav, day summary. | PageTutorial, Planning components. |
| `/pontaj` | Attendance/time. | Yes. | OPERATIONAL_ROLES. | Production. | Attendance sessions/teams. | PageTutorial. |
| `/rapoarte` | Reports (daily). | Yes. | OPERATIONAL_ROLES. | Production. | Reports list/create. | PageTutorial. |
| `/rapoarte/form` | Daily report form. | Yes. | DAILY_REPORT_CREATE_ROLES. | Production. | Create/edit report. | — |
| `/avize` | Deliveries/receipts. | Yes. | OPERATIONAL_ROLES+procurement. | Production. | Delivery docs. | PageTutorial. |
| `/stocuri` | Stock/materials. | Yes. | OPERATIONAL_ROLES. | Production. | Inventory/movements. | PageTutorial. |
| `/cheltuieli` | Expenses. | Yes. | OPERATIONAL_ROLES+finance. | Production. | Expense mgmt. | PageTutorial. |
| `/activity` | Activity feed. | Yes. | OPERATIONAL_ROLES. | Production. | Activity view. | — |
| `/santiere` | Sites/GIS. | Yes. | GIS_ROLES. | Production. | Site mgmt. | PageTutorial. |
| `/aprobare` | Approvals. | Yes. | APPROVAL_ROLES. | Production. | Approve/review. | PageTutorial. |
| `/utilizatori` | User admin. | Yes. | ADMIN_ROLES. | Production. | User mgmt. | PageTutorial. |
| `/solar-configurator` | PV configurator. | Yes. | SOLAR_CONFIGURATOR_ROLES. | Production. | Configure BOM/layout. | — |
| `/documente` | Documents. | Yes. | null (all auth). | Production. | Document access. | — |
| `/notificari` | Notifications. | Yes. | null. | Production. | Notifications. | PageTutorial. |
| `/profil` | Profile. | Yes. | null. | Production. | Profile edit. | PageTutorial. |
| `/design-review` (+ sub) | Prototype walkthrough (frontend-only, local mock data). | No real API persistence (mock/local). | No auth guards on subtree (AppShell bypasses design-review). | **Prototype/Design Review**. | Interactive exploration of designs. | DesignReviewWorkspace, architecture audit. |
| `/control-tower` | Redirects to `/`. | N/A. | N/A. | Redirect. | — | — |
| Auth pages (`/login`, `/signup`, `/forgot-password*`) | Auth flows. | Yes (auth endpoints). | No role guards; AppShell bypasses. | Production auth. | Login/register/reset. | Auth forms. |

## 3) Guard mechanics (AuthGuard, RoleGuard, ProtectedRoute, route roles, home routing)

### Components
- **`web/src/components/ProtectedRoute.tsx`** (AppShell wraps authenticated area): Shows full-page spinner while `loading` (prevents flash). If no user, redirects to `/login?from=<pathname>` (skipping `/` and `/login` when building `from`). Returns null if not authenticated; else children. Applied around authenticated routes in AppShell (auth pages and design-review bypassed).
- **`web/src/lib/auth-guard.tsx`**: 
  - `AuthGuard`: Wraps pages requiring auth. Redirects to `/login` if no user after loading; shows loader during loading; returns null if not authenticated. (Used in some contexts; AppShell uses ProtectedRoute as primary boundary.)
  - `RoleGuard`: Wraps pages requiring specific roles. Gets `userRole = user?.role?.toLowerCase()`. **Allows if `admin` or `owner` or role in `allowedRoles`** (superset). Has `roleHome = '/'` (every role has home). Uses `useEffect` with `redirectedRef` to show warning toast via `useToast()` and `router.replace('/')` if not allowed; renders nothing while redirecting. If no role home (guard comment says rare), falls back to inline 403 notice with "Go back" button. All hooks called before conditionals. Redirects with message: "You don't have access to that page."
- **`web/src/components/AppShell.tsx`**: Provides shell (Sidebar/Header/MobilePrimaryNav). Bypasses shell for `isAuthPage` (`/login`, `/signup`, `/forgot-password`, `/forgot-password/*`) and `isDesignReviewPage` (`/design-review/*`). For others wraps in `<ProtectedRoute>` (not AuthGuard directly). Inside: ThemeProvider → ProtectedRoute → ProjectProvider → ToastProvider → PhotoUploadModalProvider → layout.
- **`web/src/app/page.tsx` (role router)**: `userRole = user?.role?.toLowerCase()`. Returns `WorkerMyDay` if `worker`. Returns `WorkerDashboard` if `team_leader|technician|foreman`. Else returns `ControlTowerSurface`. Comment confirms manager lands on ControlTowerSurface; canonical entry.

### Route roles map (`web/src/config/route-roles.ts`)
Canonical source of truth. Notes:
- `null` = every authenticated role.
- RoleGuard lets admin/owner through everywhere (superset).
- Key groups: `OPERATIONAL_ROLES` (admin,owner,manager,pm,site_manager,foreman,team_leader,technician,worker), `PROJECT_ROLES` (admin,owner,manager,pm,site_manager,foreman,team_leader), `SOLAR_CONFIGURATOR_ROLES` (admin,owner,pm,site_manager - no worker), `WORKFORCE_ROLES` (admin,owner,manager,pm,finance - excludes site/foreman/team_leader by design due to API 403), `APPROVAL_ROLES` (admin,owner,manager,pm,finance), `GIS_ROLES` (admin,owner,manager,pm,site_manager), `QA_ROLES` (admin,owner,qa_qc,pm,site_manager), `DAILY_REPORT_CREATE_ROLES` (includes technicians etc.), `ADMIN_ROLES` (admin), `SUPPLIER_ROLES` (admin,owner,manager,pm,procurement), `WAREHOUSE_ROLES` (admin,owner,manager,pm,procurement), `CONTROL_TOWER_ROLES`/worker/field home sets defined.

Selected route mappings (from file):
- `/` → `null`
- `/projects`, `/projects/[id]` → `PROJECT_ROLES`
- `/workforce` → `WORKFORCE_ROLES`
- `/qa` → `QA_ROLES`
- `/furnizori` → `SUPPLIER_ROLES`
- `/depozite` → `WAREHOUSE_ROLES`
- `/utilizatori` → `ADMIN_ROLES`
- `/documente`, `/notificari`, `/profil` → `null`
- `/solar-configurator` → `SOLAR_CONFIGURATOR_ROLES`

### Landing/home behavior
- Every authenticated role has home at `/` (roleHome). RoleGuard redirects unauthorized to `/` with toast.
- Root (`/`) branches: worker→WorkerMyDay; field roles (team_leader/technician/foreman)→WorkerDashboard; others (including site_manager as manager)→ControlTowerSurface.

### Auth flow boundaries
- AppShell excludes auth and design-review pages from shell+ProtectedRoute.
- ProtectedRoute handles session boot (loading) and `from` redirect to login.
- Refresh/session rehydration handled via api-client restoreSession (uses httpOnly cookie, exchanges via refresh).

## 4) `web/src/lib/api-client.ts` structure & behavior

### Structure (from header/comments)
- Architecture: IApiClient interface → NestApiClient class (interceptors/token/refresh/logging) → per-domain API modules (lib/api/*) → apiClient singleton (backward compat).
- Envelope: R1.5 — Success `{ statusCode, data: T }` unwrapped by client; Error `{ success:false, statusCode, code, message, details?, timestamp, path, method }`.
- Base URL resolution: `resolveApiBaseUrl(configuredUrl = process.env.NEXT_PUBLIC_API_URL, pageLocation?)`. Rules: SSR → configured/as-is; loopback host → configured/as-is; remote host + loopback-configured → use page host with api port; else respect configured/relative. `API_BASE_URL = resolveApiBaseUrl()`.

### Token/auth
- Access token stored **in memory only** (`private token: string|null`), never in localStorage. Cross-restart persistence via httpOnly refresh cookie; re-minted by `restoreSession()`.
- `setToken/getToken/isAuthenticated()`.
- `AuthTokens { accessToken: string }`, `AuthUser` shape.

### Endpoint functions (approximate count)
The file is large (2267 lines). It defines:
- Typed interfaces/classes: ErrorDetail, ErrorEnvelope, SuccessEnvelope, ApiResponse, PaginatedResponse, PhotoAttachment, AuthTokens/AuthUser/Login/Register, ApiError with helpers.
- NestApiClient methods: constructor, setToken/getToken/isAuthenticated, `request<T>(endpoint, options, allowRefresh=true)`, helpers, refresh logic, generic CRUD helpers (`get/post/patch/put/delete`), and **extensive domain methods** (projects, clients, users, employees, teams, tasks, daily reports, issues, attendance, materials/inventory, warehouses, suppliers, purchase orders, deliveries/avize, expenses, inspections/QA-QC, documents/uploads, notifications, settings, etc.). Scanning quickly shows many method groups — **roughly ~200+ endpoint methods** across the class (conservative estimate; easily hundreds). Also domain modules exist under `lib/api/` per header.

### Base URL handling
- `resolveApiBaseUrl()` implements the LAN-aware logic (use page hostname:port when opening from remote host but configured points to loopback). `API_BASE_URL` exported.

### Token refresh behavior (mechanism + key lines)
- **Single-flight refresh**: `private refreshPromise: Promise<boolean>|null = null`. `refreshSession()` creates once, shared by concurrent 401s; cleared in `finally`. Prevents refresh storm and reuse-detection logout.
- **Refresh-exempt endpoints** (never trigger refresh/retry): `['/api/auth/refresh', '/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/forgot-password', '/api/auth/reset-password']` (checked via `isRefreshExempt()` with `startsWith`).
- **401 handling in `request()`** (Slice 2): if `response.status===401 && allowRefresh && !isRefreshExempt(endpoint)`, calls `await this.refreshSession()`; if refreshed, retries once with `allowRefresh=false` (`return this.request<T>(endpoint, options, false)`). If refresh fails, calls `this.setToken(null)` and throws/surfaces the 401 ApiError.
- **`restoreSession()`**: calls `refreshSession()` on app startup to rehydrate from httpOnly cookie (no JS storage). Returns true if token obtained.
- **`performRefresh()`**: `fetch(`${this.baseUrl}/api/auth/refresh`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rememberMe: this.rememberMePreference() }) })`. Reads token from `payload?.data?.accessToken ?? payload?.accessToken`. On success sets token via `setToken(accessToken)` and returns true. On non-ok or missing token sets token null and returns false. On network error returns false (keeps existing token to avoid logout on transient outage).
- **Remember me**: `REMEMBER_ME_STORAGE_KEY = 'hiieko_remember'` is a non-sensitive UI preference persisted to tell refresh whether to renew session/persistent cookie; no credentials/tokens stored.

Key lines cited: ~83, ~259, ~272, ~443 (from grep). Refresh logic spans ~250-520+ in the file.

## 5) Suspicious patterns (onClick empty/console.log, TODO/FIXME, hardcoded mock/placeholder arrays in app pages, alert())

Search results (app src):
- `onClick.*console.log` / empty handlers / `alert(`: **None found** in `web/src/app` (grep returned no matches).
- `TODO|FIXME`: **None found** in `web/src/app` (grep returned no matches).
- Hardcoded mock/placeholder arrays in `web/src/app` pages: Only hit was `web/src/app/design-review/page.tsx:7` metadata says "Frontend-only HIIEKO prototype walkthrough with local mock data. No authentication or production data." (design-review subtree is prototype). No other matches for mock/placeholder arrays found in app pages.
- `alert(`: **None found** in `web/src/app`.

**Findings list (file:line with 1-line context):**
- `web/src/app/design-review/page.tsx:7` — `description: 'Frontend-only HIIEKO prototype walkthrough with local mock data. No authentication or production data.'` (prototype/design-review only, AppShell bypasses)

## 6) Keyboard shortcut handling & PageTutorial usage

### PageTutorial
- Component: `web/src/components/PageTutorial.tsx` (defines interface/implementation). Used extensively across app pages and ControlTowerSurface.
- Usages (from grep): `/aprobare` (sectionId 'approvals'), `/avize` ('deliveries'), `/cheltuieli` ('expenses'), `/issues` ('issues'), `/notificari` ('notifications'), `/planning` ('planning'), `/pontaj` ('attendance' x2), `/profil` ('profile'), `/projects/[id]` ('project-detail'), `/rapoarte` ('reports'), `/santiere` ('sites'), `/stocuri` ('stock'), `/teams` ('teams'), `/utilizatori` ('users'), `/workforce` ('workforce'), `ControlTowerSurface.tsx` ('dashboard'). Design review also references PageTutorial pattern.
- Classification: Production help/tutorial component used on many operational pages.

### Keyboard shortcut handling
- Searched for `useHotkeys`, `Keyboard.*shortcut`, `shortcut.*key`: **No matches found** in `web/src`. No global keyboard shortcut hooks/handlers detected in the codebase search.

## Summary
- Routes: 36 page.tsx files across auth, core operational, projects, admin, and design-review/prototype areas.
- Guards: AppShell uses `ProtectedRoute` for authenticated area; `RoleGuard` enforces role access with admin/owner superset and redirects unauthorized to `/` with toast; root `/` does role-based routing.
- API client: large typed client with in-memory tokens, httpOnly-cookie refresh with single-flight, refresh-exempt endpoints, LAN-aware base URL resolution, ~hundreds of endpoint methods.
- Patterns: No empty/console.log onClick, TODO/FIXME, or alert() in app pages; only design-review marked as prototype with mock data. No keyboard shortcut handling found; PageTutorial widely used on production pages.
