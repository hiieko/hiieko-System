\# HIIEKO — Technical Audit



Repository: hiieko/hiieko-System

Branch: master

Date: as of last full audit



\## Audit basis



Current GitHub master branch as accessible through the repository

connector.



Important: several project documents describe fixes that are not

reflected in the current source. For this audit, current source wins.

Historical audit claims are not treated as proof that a current problem

is fixed.



\---



\## 1. Repository structure



\### 1.1 Repository type



Monorepo: YES.



The root `package.json` declares four npm workspaces:



\- shared

\- web

\- Mobile

\- backend



Source: `package.json:5-9`



```

hiieko-System/

├── shared/

├── web/

├── Mobile/

├── backend/

├── database/

├── scripts/

├── docs/

├── Project workflow/

├── .github/

├── .opencode/

├── package.json

├── package-lock.json

├── netlify.toml

├── .gitignore

└── .env.example

```



A literal complete recursive tree is MISSING from the GitHub connector

interface available to this audit.



Verified directories and files include:



\- `web/src/app/`

\- `web/src/components/`

\- `web/src/config/`

\- `web/src/contexts/`

\- `web/src/features/`

\- `web/src/lib/`

\- `Mobile/src/`

\- `Mobile/src/screens/`

\- `Mobile/src/services/`

\- `backend/src/common/`

\- `backend/src/modules/`

\- `backend/prisma/`

\- `backend/prisma/migrations/`

\- `backend/test/`

\- `backend/e2e/`

\- `database/migrations/`

\- `database/scripts/`

\- `shared/src/`

\- `scripts/`

\- `.github/workflows/`

\- `.opencode/`

\- `Project workflow/`

\- `docs/`



\### 1.2 Package manager and lockfiles



npm.



Root package.json uses npm workspace commands such as:



\- `npm run build --workspace=web`

\- `npm run typecheck`

\- `npm run test`

\- `npm ci` in CI



Source: `package.json:21-39`, `.github/workflows/ci.yml:24-26`



Lockfiles:



\- `package-lock.json` — PRESENT

\- `web/package-lock.json` — MISSING

\- `backend/package-lock.json` — MISSING

\- `Mobile/package-lock.json` — MISSING

\- `yarn.lock` — MISSING

\- `pnpm-lock.yaml` — MISSING

\- `bun.lockb` — MISSING



\### 1.3 Frontend and backend



YES, same repository.



The repository contains:



\- Next.js web application: `web/`

\- Expo/React Native application: `Mobile/`

\- NestJS API: `backend/`

\- shared TypeScript package: `shared/`



Source: `package.json:5-9`



\---



\## 2. Frontend



\### 2.1 Framework



Web: Next.js 14.2.x / React 18.3.x.



Source: `web/package.json:16-19`



```

next: ^14.2.4

react: ^18.3.1

react-dom: ^18.3.1

```



Mobile: Expo \~51 / React Native 0.74.2.



Source: `Mobile/package.json:8-23`



Shared: TypeScript package containing shared types, calculations, i18n.



Source: `shared/package.json:1-17`



\### 2.2 Routing



The canonical route contract is defined in:

`web/src/config/route-roles.ts:118-214`



Current application routes:



| Route | Role contract |

|---|---|

| / | all authenticated roles |

| /control-tower | control-tower roles |

| /solar-configurator | admin, owner, pm, site\_manager |

| /tasks | operational roles |

| /planning | operational roles |

| /issues | operational roles |

| /pontaj | operational roles |

| /rapoarte | operational roles |

| /rapoarte/form | report creation roles |

| /avize | operational + procurement |

| /stocuri | operational |

| /cheltuieli | operational + finance |

| /projects | project roles |

| /projects/\[id] | project roles |

| /teams | project roles |

| /furnizori | supplier roles |

| /depozite | warehouse roles |

| /workforce | workforce roles |

| /santiere | GIS roles |

| /qa | QA roles |

| /aprobare | approval roles |

| /utilizatori | admin |

| /documente | all authenticated |

| /notificari | all authenticated |

| /profil | all authenticated |



Source: `web/src/config/route-roles.ts:118-214`



Additional auth routes:



\- /login

\- /signup



Source: `web/src/app/login/page.tsx:1-107`, `web/src/app/signup/page.tsx:1-100`



`/statistici` is not a current destination. It redirects to

`/control-tower`.



Source: `web/next.config.js:4-11`



Important routing inconsistency:



`navigation.ts` still advertises:



\- /qa-qc

\- /statistici



while `route-roles.ts` defines:



\- /qa



and explicitly says `/statistici` is no longer a destination.



Source: `web/src/config/navigation.ts:31-77`,

`web/src/config/route-roles.ts:118-214`



Status: UNCLEAR / inconsistent navigation contract.



\### 2.3 State management



No Redux, Zustand, Jotai, or Recoil dependency is present.



Source: `web/package.json:8-36`



State is primarily:



\- React useState

\- useEffect

\- useCallback

\- React Context



Known contexts include:



\- AuthContext

\- ProjectContext

\- ThemeContext

\- locale provider



Example: `web/src/contexts/AuthContext.tsx:1-194`



There is no dedicated global state library.



\### 2.4 API client



The web application uses a centralized typed API client:

`web/src/lib/api-client.ts`



The file contains:



\- NestApiClient

\- apiClient

\- typed API contracts

\- error envelopes

\- token management

\- refresh handling

\- domain API methods



Source: `web/src/lib/api-client.ts:1-2069`



The generic request implementation is around line 298.



The client sends HTTP requests directly to the NestJS API.



The base URL is controlled by `NEXT\_PUBLIC\_API\_URL`.



Source: `web/src/lib/api-client.ts:25-70`



\### 2.5 Frontend authentication — CRITICAL



Current state: BROKEN / BYPASSED



The current /login page does not perform login. It explicitly says

"Temporary preview mode" and "Login is temporarily disabled."



Source: `web/src/app/login/page.tsx:81-94`



Selecting a role writes `sessionStorage\['hiieko\_role\_preview']` and

calls `refreshUser()`.



Source: `web/src/app/login/page.tsx:90-96`



AuthContext then detects this value and manufactures a user.



Source: `web/src/contexts/AuthContext.tsx:111-119`



It contains hardcoded preview identities such as:



\- preview-admin

\- preview-owner

\- preview-manager

\- preview-worker



Source: `web/src/contexts/AuthContext.tsx:20-109`



The authentication provider explicitly does:



```

if (previewUser) {

&#x20;   apiClient.setToken(null);

&#x20;   setUser(previewUser);

&#x20;   ...

}

```



Source: `web/src/contexts/AuthContext.tsx:128-135`



Therefore: real web authentication is currently bypassed.

This is not an interpretation. The current source explicitly implements

the bypass.



Underlying real auth exists:



The API client does support a real token.

Source: `web/src/lib/api-client.ts:259-270`



It reads and writes `localStorage\['api\_token']`.



The real backend also has login, refresh, and logout endpoints.



So the architecture exists, but the production login page currently

bypasses it.



Token storage:



\- Web access-token storage: localStorage, key `api\_token`

&#x20; Source: `web/src/lib/api-client.ts:259-270`

\- Refresh token: httpOnly cookie named `hiieko\_rt`

&#x20; Source: `backend/src/modules/auth/auth.constants.ts`,

&#x20; `backend/src/common/auth/cookies.ts`

\- Refresh request uses `credentials: 'include'`

&#x20; Source: `web/src/lib/api-client.ts:414`



\### 2.6 Frontend environment variables



Names only.



From `.env.example:13-47`:



\- NEXT\_PUBLIC\_API\_URL

\- EXPO\_PUBLIC\_API\_URL

\- NEXT\_PUBLIC\_APP\_NAME

\- NEXT\_PUBLIC\_DEFAULT\_LOCALE

\- NEXT\_PUBLIC\_COMPANY\_TZ

\- NEXT\_PUBLIC\_DEFAULT\_GEOFENCE\_RADIUS\_METERS

\- NEXT\_PUBLIC\_WORK\_START\_HOUR

\- NEXT\_PUBLIC\_WORK\_END\_HOUR

\- NEXT\_PUBLIC\_STANDARD\_REST\_MINUTES

\- DATABASE\_URL



Backend-specific names in `backend/.env.example:3-31`:



\- DATABASE\_URL

\- JWT\_SECRET

\- JWT\_EXPIRES\_IN

\- PORT

\- NODE\_ENV

\- COMPANY\_TZ

\- PADDLEOCR\_URL

\- PADDLEOCR\_TOKEN

\- PADDLEOCR\_TIMEOUT

\- CORS\_ORIGIN

\- MAX\_FILE\_SIZE

\- STORAGE\_DRIVER

\- STORAGE\_ROOT



\### 2.7 Netlify build



`netlify.toml:1-7`:



\- command = `npm run build --workspace=web`

\- publish = `web/.next`

\- NODE\_VERSION = "22"



The root build script builds all three major packages

(shared, web, backend), but Netlify explicitly builds only the web

workspace.



\---



\## 3. Backend



\### 3.1 Framework and language



TypeScript with NestJS 10.



Source: `backend/package.json:1-77`



Relevant versions:



\- @nestjs/common ^10.3.8

\- @nestjs/core ^10.3.8

\- @nestjs/platform-express ^10.3.8

\- @nestjs/jwt ^10.2.0

\- @prisma/client ^5.14.0



\### 3.2 Entry point



Backend entry point: `backend/src/main.ts:1-120`



Root application module: `backend/src/app.module.ts:1-72`



It imports major domain modules including:



\- Auth

\- Users

\- Roles

\- Permissions

\- Employees

\- Teams

\- Projects

\- Project stages

\- Tasks

\- Task dependencies

\- Attendance

\- Daily plans

\- Daily reports

\- Materials

\- Inventory

\- Warehouses

\- Procurement

\- Suppliers

\- Documents

\- OCR

\- Expenses

\- Upload

\- QA/QC

\- Issues

\- Change Orders

\- Costs

\- Notifications

\- Control Tower

\- Solar



Source: `backend/src/app.module.ts:7-68`



\### 3.3 API endpoints



\#### Authentication



`backend/src/modules/auth/auth.controller.ts`



| Method | Endpoint | Purpose |

|---|---|---|

| POST | /api/auth/register | Register |

| POST | /api/auth/login | Login |

| POST | /api/auth/refresh | Refresh access token |

| GET | /api/auth/me | Current user |

| POST | /api/auth/logout | Logout |



Lines 31, 42, 79, 110, 118.



\#### Projects



`backend/src/modules/projects/projects.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/projects |

| GET | /api/projects/:id |

| POST | /api/projects |

| PATCH | /api/projects/:id |



Lines 19, 30, 37, 44.



\#### Project members



`backend/src/modules/projects/project-members.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/projects/:projectId/members |

| POST | /api/projects/:projectId/members |

| PATCH | /api/projects/:projectId/members/:userId |

| DELETE | /api/projects/:projectId/members/:userId |



Lines 36, 43, 65, 89.



\#### Project stages



`backend/src/modules/project-stages/project-stages.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/projects/:projectId/stages |

| POST | /api/projects/:projectId/stages |



Lines 17, 24.



\#### Tasks



`backend/src/modules/tasks/tasks.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/tasks |

| GET | /api/tasks/:id |

| POST | /api/tasks |

| PATCH | /api/tasks/:id |

| POST | /api/tasks/:id/assign |



Lines 26, 50, 57, 73, 96.



\#### Task dependencies



`backend/src/modules/task-dependencies/task-dependencies.controller.ts`



| Method | Endpoint |

|---|---|

| POST | /api/task-dependencies |

| GET | /api/task-dependencies/check-prerequisites/:taskId |



Lines 16, 23.



\#### Daily planning



`backend/src/modules/daily-plans/daily-plans.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/daily-plans |

| GET | /api/daily-plans/my-tasks |

| GET | /api/daily-plans/:id |

| POST | /api/daily-plans |

| POST | /api/daily-plans/:id/publish |

| POST | /api/daily-plans/:id/complete |

| POST | /api/daily-plans/:id/cancel |

| PATCH | /api/daily-plans/tasks/:planTaskId/progress |



Lines 42, 54, 63, 70, 86, 101, 118, 133.



\#### Daily reports



`backend/src/modules/daily-reports/daily-reports.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/daily-reports |

| GET | /api/daily-reports/:id |

| POST | /api/daily-reports |

| POST | /api/daily-reports/:id/submit |

| POST | /api/daily-reports/:id/review |

| PATCH | /api/daily-reports/:id |



Lines 51, 62, 69, 101, 125, 144.



\#### Attendance



`backend/src/modules/attendance/attendance.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/attendance |

| POST | /api/attendance/check-in |

| POST | /api/attendance/check-out |

| GET | /api/attendance/today |

| GET | /api/attendance/my-logs |

| PATCH | /api/attendance/:id |



Lines 32, 46, 53, 60, 71, 87.



\#### Issues and blockers



`backend/src/modules/issues/issues.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/issues |

| POST | /api/issues |

| POST | /api/issues/ncrs |



Lines 25, 36, 43.



\#### QA/QC



`backend/src/modules/qa-qc/qa-qc.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/qa-qc/inspections |

| POST | /api/qa-qc/inspections |



Lines 25, 36.



\#### Materials



`backend/src/modules/materials/materials.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/materials |

| GET | /api/materials/:id |

| POST | /api/materials |



Lines 18, 24, 30.



\#### Inventory and stock



`backend/src/modules/inventory/inventory.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/inventory/balance |

| POST | /api/inventory/receive |

| POST | /api/inventory/consume |

| POST | /api/inventory/transfer |

| GET | /api/inventory/movements |

| GET | /api/inventory/stock |



Lines 22, 35, 43, 51, 59, 71.



\#### Procurement



`backend/src/modules/procurement/procurement.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/procurement/purchase-orders |

| POST | /api/procurement/purchase-orders |

| GET | /api/procurement/avize |

| GET | /api/procurement/delivery-notes |

| GET | /api/procurement/avize/:id |

| POST | /api/procurement/avize |



Lines 26, 37, 45, 56, 67, 74.



\#### Suppliers



`backend/src/modules/suppliers/suppliers.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/suppliers |

| GET | /api/suppliers/:id |

| POST | /api/suppliers |



Lines 18, 24, 30.



\#### Warehouses



`backend/src/modules/warehouses/warehouses.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/warehouses |

| GET | /api/warehouses/:id |

| POST | /api/warehouses |



Lines 18, 24, 30.



\#### Employees



`backend/src/modules/employees/employees.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/employees |

| GET | /api/employees/:id |

| POST | /api/employees |

| PATCH | /api/employees/:id |

| DELETE | /api/employees/:id |



Lines 18, 25, 31, 38, 49.



\#### Teams



`backend/src/modules/teams/teams.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/teams |

| GET | /api/teams/:id |

| POST | /api/teams |

| POST | /api/teams/:id/members |

| PATCH | /api/teams/:id |

| DELETE | /api/teams/:id |

| DELETE | /api/teams/:id/members/:userId |



Lines 26, 37, 45, 53, 65, 77, 88.



\#### Documents



`backend/src/modules/documents/documents.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/documents |

| GET | /api/documents/:id |

| POST | /api/documents |

| POST | /api/documents/:id/versions |



Lines 24, 35, 42, 49.



\#### Upload



`backend/src/modules/upload/upload.controller.ts`



| Method | Endpoint |

|---|---|

| POST | /api/upload |

| GET | /api/upload/:documentId |



Lines 42, 84.



\#### OCR



`backend/src/modules/ocr/ocr.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/ocr/jobs/:id |

| POST | /api/ocr/jobs |

| POST | /api/ocr/process |

| PATCH | /api/ocr/extractions/:extractionId/review |

| GET | /api/ocr/health |



Lines 29, 35, 41, 90, 106.



\#### Expenses



`backend/src/modules/expenses/expenses.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/expenses |

| GET | /api/expenses/:id |

| POST | /api/expenses |

| POST | /api/expenses/:id/approve |



Lines 26, 45, 52, 59.



\#### Notifications



`backend/src/modules/notifications/notifications.controller.ts`



| Method | Endpoint |

|---|---|

| GET | /api/notifications |

| POST | /api/notifications/:id/read |

| POST | /api/notifications/read-all |



Lines 16, 35, 41.



\#### Roles, permissions, users



`backend/src/modules/roles/roles.controller.ts:16,23`



\- GET /api/roles

\- GET /api/roles/:code



`backend/src/modules/permissions/permissions.controller.ts:16`



\- GET /api/permissions



`backend/src/modules/users/users.controller.ts:18,32,38,49,63`



\- GET /api/users

\- GET /api/users/:id

\- PATCH /api/users/:id/role

\- PATCH /api/users/:id/status

\- PATCH /api/users/profile



\#### Audit



`backend/src/modules/audit/audit.controller.ts:16`



\- GET /api/audit



\#### Change orders



`backend/src/modules/change-orders/change-orders.controller.ts:26,37,44,52`



\- GET /api/change-orders

\- GET /api/change-orders/:id

\- POST /api/change-orders

\- PATCH /api/change-orders/:id/status



\#### Costs and budgets



`backend/src/modules/costs/costs.controller.ts:22,29,37,44`



\- GET /api/costs/budgets/:projectId

\- POST /api/costs/budgets

\- GET /api/costs/entries/:projectId

\- POST /api/costs/entries



\#### Control Tower



`backend/src/modules/control-tower/control-tower.controller.ts:34,72,136`



\- GET /api/control-tower/overview

\- GET /api/control-tower/drilldown

\- GET /api/control-tower/red-flags



\#### Solar



`backend/src/modules/solar/solar.controller.ts:41-212`



\- GET /api/solar/designs

\- POST /api/solar/designs

\- GET /api/solar/designs/:id

\- POST /api/solar/designs/:designId/roof-sections

\- GET /api/solar/designs/:designId/roof-sections

\- PATCH /api/solar/designs/:designId/roof-sections/:roofSectionId

\- DELETE /api/solar/designs/:designId/roof-sections/:roofSectionId

\- POST /api/solar/designs/:designId/roof-sections/:roofSectionId/obstacles

\- GET /api/solar/designs/:designId/roof-sections/:roofSectionId/obstacles

\- PATCH /api/solar/designs/:designId/obstacles/:obstacleId

\- DELETE /api/solar/designs/:designId/obstacles/:obstacleId

\- PUT /api/solar/designs/:designId/layout-settings

\- POST /api/solar/designs/:designId/layout/calculate

\- PUT /api/solar/designs/:designId/placements

\- GET /api/solar/designs/:designId/bom

\- GET /api/solar/modules

\- GET /api/solar/products



\### 3.4 Authentication



JWT.



Backend guard: `backend/src/common/auth/guards/jwt-auth.guard.ts:1-91`



It requires `Authorization: Bearer <token>` and verifies it with

JWT\_SECRET.



Source: `backend/src/common/auth/guards/jwt-auth.guard.ts:17-32`



Session-bound JWTs additionally carry `sid`.



Source: `backend/src/common/auth/guards/jwt-auth.guard.ts:54-72`



Web access tokens have a 900-second TTL. Legacy Mobile compatibility

remains 7 days.



Source: `backend/src/modules/auth/auth.service.ts:181-224`



Refresh tokens are rotated and stored hashed.



Source: `backend/src/modules/auth/auth.service.ts:226-287`



\### 3.5 Middleware, validation, rate limiting, CORS



Validation:



Global ValidationPipe: `backend/src/main.ts:76-85`



Configured with:



\- whitelist: true

\- transform: true

\- forbidNonWhitelisted: false



CORS:



`backend/src/main.ts:52-74`



Uses explicit CORS\_ORIGIN allowlist. Credentials enabled:

`credentials: true`.



Rate limiting:



Auth routes use RateLimitGuard.

Source: `backend/src/modules/auth/auth.controller.ts:31-46`



Authorization:



Server-side role guard: `backend/src/common/auth/guards/roles.guard.ts:1-42`



Admin and Owner are global bypass roles:

`backend/src/common/auth/guards/roles.guard.ts:22-31`



Project-level access is separately enforced by decorators such as:



\- @RequireProjectAccess(...)

\- @RequireEntityProjectAccess(...)



Examples: `backend/src/modules/tasks/tasks.controller.ts:26-96`



\### 3.6 Error handling



Global exception filter: `backend/src/common/filters/http-exception.filter.ts:1-183`



Produces structured errors:



\- success

\- statusCode

\- code

\- message

\- details

\- timestamp

\- path

\- method



Validation errors are converted to HTTP 422 / VALIDATION\_ERROR.



Source: `backend/src/common/filters/http-exception.filter.ts:42-67`



Production internal errors are hidden behind:



"An unexpected error occurred"



Source: `backend/src/common/filters/http-exception.filter.ts:113-147`



\### 3.7 Logging



Structured request logging exists: `backend/src/main.ts:37-51`



Logs:



\- request ID

\- method

\- path

\- status

\- duration



It deliberately avoids logging request bodies, cookies, and

authorization headers.



Application and error logging are also implemented in the exception

filter.



Source: `backend/src/common/filters/http-exception.filter.ts:22-39`



\---



\## 4. Database



\### 4.1 Database



PostgreSQL.



Prisma is the ORM.



Source: `backend/package.json:42-77`, `backend/prisma/schema.prisma:1+`



Architecture:



```

Web / Mobile

&#x20;    ↓

NestJS

&#x20;    ↓

Prisma

&#x20;    ↓

PostgreSQL

```



Source: `.env.example:1-47`



\### 4.2 Schema location



Primary schema: `backend/prisma/schema.prisma` (1,673 lines)



Migrations: `backend/prisma/migrations/`



Verified migrations:



\- 20260922102428\_init

\- 20260926090000\_add\_solar\_domain

\- 20260926120000\_add\_surface\_type

\- 20260929073840\_add\_daily\_report\_approval\_revision

\- 20260929105838\_add\_daily\_report\_time\_and\_ohs

\- 20261001130000\_add\_sessions\_refresh\_tokens

\- 20261001140000\_add\_attendance\_correction\_integrity



CI runs `prisma migrate deploy` against a clean PostgreSQL 18 instance.



Source: `.github/workflows/ci.yml:79-97`



Whether the exact production database currently has every migration

applied is UNCLEAR from repository source alone.



\### 4.3 Tables, models, and columns



The Prisma schema currently contains 84 models.



Source: `backend/prisma/schema.prisma:10-1673`



Organization (`schema.prisma:10`)

\- id, name, cui, address, created\_at, updated\_at



User (`:27`)

\- id, organization\_id, email, password\_hash, role, is\_active,

&#x20; status, created\_at, updated\_at



Session (`:67`)

\- id, user\_id, created\_at, last\_used\_at, expires\_at,

&#x20; revoked\_at, revoked\_reason, created\_ip, user\_agent



RefreshToken (`:90`)

\- id, session\_id, token\_hash, issued\_at, expires\_at,

&#x20; used\_at, revoked\_at, replaced\_by\_id



RateLimitBucket (`:107`)

\- id, window\_start, expires\_at, count, updated\_at



UserProfile (`:118`)

\- id, user\_id, full\_name, phone, employee\_code,

&#x20; avatar\_url, language, created\_at, updated\_at



Role (`:133`)

\- id, name, code, description, created\_at, updated\_at



Permission (`:145`)

\- id, module, action, description, created\_at



RolePermission (`:157`)

\- role\_id, permission\_id



Employee (`:167`)

\- id, user\_id, first\_name, last\_name, cnp, position,

&#x20; hourly\_rate, is\_active, created\_at, updated\_at



Team (`:183`)

\- id, name, code, leader\_id, project\_id,

&#x20; is\_active, created\_at, updated\_at



TeamMember (`:199`)

\- id, team\_id, user\_id, joined\_at



Client (`:211`)

\- id, organization\_id, name, cui, contact\_person,

&#x20; contact\_email, contact\_phone, created\_at, updated\_at



Project (`:227`)

\- id, organization\_id, client\_id, name, code, address,

&#x20; latitude, longitude, geofence\_radius\_meters,

&#x20; installed\_capacity\_mwp, status, start\_date, target\_end\_date,

&#x20; budget\_total, currency, is\_active, created\_at, updated\_at



ProjectStage (`:274`)

\- id, project\_id, name, stage\_order, status,

&#x20; start\_date, end\_date, created\_at, updated\_at



WorkPackage (`:291`)

\- id, stage\_id, name, code, description, created\_at, updated\_at



LocationZone (`:305`)

\- id, project\_id, name, code, coordinates, created\_at, updated\_at



ProjectMember (`:320`)

\- id, project\_id, user\_id, role, assigned\_at



Task (`:333`)

\- id, project\_id, work\_package\_id, zone\_id,

&#x20; title, code, description, status,

&#x20; planned\_start, planned\_end, actual\_start, actual\_end,

&#x20; planned\_quantity, actual\_quantity, unit\_of\_measure,

&#x20; created\_at, updated\_at, verified\_by, is\_archived, verified\_at



TaskDependency (`:370`)

\- id, predecessor\_task\_id, successor\_task\_id, dependency\_type, lag\_days



TaskAssignment (`:383`)

\- id, task\_id, user\_id, assigned\_at



AttendanceRecord (`:395`)

\- id, user\_id, project\_id, date, check\_in\_time,

&#x20; check\_out\_time, status,

&#x20; check\_in\_latitude, check\_in\_longitude, check\_in\_distance\_m,

&#x20; is\_within\_geofence, check\_out\_latitude, check\_out\_longitude,

&#x20; regular\_hours, overtime\_minutes, is\_offline\_sync,

&#x20; idempotency\_key, notes, created\_at, updated\_at



AttendanceCorrection (`:431`)

\- id, attendance\_id, corrected\_by, reason,

&#x20; before\_state, after\_state, created\_at



DailyPlan (`:447`)

\- id, project\_id, team\_id, plan\_date, status,

&#x20; notes, created\_by, created\_at, updated\_at



DailyPlanTask (`:466`)

\- id, daily\_plan\_id, task\_id, target\_quantity,

&#x20; actual\_quantity, completed



DailyReport (`:480`)

\- id, project\_id, team\_id, team\_leader\_id,

&#x20; report\_date, start\_time, end\_time, weather\_notes,

&#x20; blockages, proposed\_work, general\_notes, status,

&#x20; idempotency\_key, reviewed\_by, reviewed\_at,

&#x20; revision\_number, created\_at, updated\_at



DailyReportApproval (`:515`)

\- id, daily\_report\_id, reviewer\_id, action, comment, created\_at



DailyReportRevision (`:529`)

\- id, daily\_report\_id, revision\_number, snapshot,

&#x20; submitted\_by\_id, submitted\_at



DailyReportWorker (`:543`)

\- id, daily\_report\_id, worker\_id, hours\_worked,

&#x20; overtime\_hours, notes



DailyReportTask (`:555`)

\- id, daily\_report\_id, task\_id, quantity\_done, notes



DailyReportMaterial (`:567`)

\- id, daily\_report\_id, material\_id, quantity\_used



ProductionEntry (`:578`)

\- id, daily\_report\_id, metric\_name, quantity, unit



DailyReportOhsItem (`:601`)

\- id, daily\_report\_id, risk\_type, notes



Material (`:611`)

\- id, code, name, unit, category, barcode, qr\_code,

&#x20; min\_stock\_threshold, unit\_cost\_estimate,

&#x20; is\_active, created\_at, updated\_at



MaterialLot (`:637`)

\- id, material\_id, lot\_number, expiry\_date, created\_at



Warehouse (`:650`)

\- id, organization\_id, name, code, address,

&#x20; is\_active, created\_at, updated\_at



StockBalance (`:666`)

\- id, material\_id, project\_id, warehouse\_id,

&#x20; current\_quantity, reserved\_quantity, updated\_at



StockMovement (`:683`)

\- id, material\_id, lot\_id, project\_id, warehouse\_id,

&#x20; movement\_type, quantity, reference\_type, reference\_id,

&#x20; idempotency\_key, created\_by\_id, notes, created\_at



ProjectAllocation (`:707`)

\- id, project\_id, material\_id, allocated\_qty, created\_at



Consumption (`:720`)

\- id, project\_id, material\_id, consumed\_qty, consumed\_at



Supplier (`:732`)

\- id, organization\_id, name, cui, address,

&#x20; contact\_person, contact\_email, contact\_phone,

&#x20; is\_active, created\_at, updated\_at



PurchaseOrder (`:752`)

\- id, supplier\_id, order\_number, total\_amount,

&#x20; currency, status, order\_date



PurchaseOrderItem (`:767`)

\- id, purchase\_order\_id, material\_id, quantity, unit\_price



Delivery (`:779`)

\- id, purchase\_order\_id, delivery\_number, delivery\_date



Invoice (`:789`)

\- id, supplier\_id, number, issue\_date, due\_date,

&#x20; total\_net, vat\_amount, total\_gross, currency



InvoiceLine (`:805`)

\- id, invoice\_id, description, quantity, unit\_price, total



Receipt (`:817`)

\- id, number, date, total



Aviz (`:826`)

\- id, project\_id, supplier\_id, aviz\_number,

&#x20; delivery\_date, status, driver\_name, vehicle\_plate,

&#x20; notes, idempotency\_key, created\_at



AvizItem (`:846`)

\- id, aviz\_id, material\_id, quantity



Expense (`:858`)

\- id, project\_id, submitted\_by\_id, category,

&#x20; payment\_method, amount, vat\_amount, currency,

&#x20; expense\_date, merchant\_name, merchant\_cui,

&#x20; document\_number, description, status,

&#x20; idempotency\_key, created\_at, updated\_at



ExpenseLine (`:887`)

\- id, expense\_id, description, amount, vat\_rate



ExpenseApproval (`:898`)

\- id, expense\_id, approver\_id, status, notes, created\_at



Reimbursement (`:911`)

\- id, expense\_id, amount, payment\_ref, processed\_at



Document (`:922`)

\- id, project\_id, document\_type, title, code,

&#x20; storage\_path, current\_version, created\_at, updated\_at



DocumentVersion (`:939`)

\- id, document\_id, version, storage\_path,

&#x20; file\_size, checksum, uploaded\_by, created\_at



OCRJob (`:954`)

\- id, document\_id, expense\_id, provider, state,

&#x20; correlation\_id, raw\_payload, error\_message,

&#x20; created\_at, updated\_at



OCRExtraction (`:972`)

\- id, ocr\_job\_id, field\_name, raw\_value,

&#x20; normalized\_val, confidence, is\_reviewed



InspectionTemplate (`:985`)

\- id, name, code, checklist, created\_at



Inspection (`:996`)

\- id, project\_id, template\_id, inspector\_name,

&#x20; status, inspected\_at



Measurement (`:1011`)

\- id, inspection\_id, parameter, value, unit, passed



Issue (`:1023`)

\- id, project\_id, title, description,

&#x20; severity, status, reported\_by, created\_at, updated\_at



NCR (`:1039`)

\- id, issue\_id, inspection\_id, ncr\_number,

&#x20; description, status, created\_at



ChangeOrder (`:1053`)

\- id, project\_id, order\_number, title, description,

&#x20; cost\_impact, schedule\_impact, status, version,

&#x20; created\_at, updated\_at



Budget (`:1070`)

\- id, project\_id, version, total\_limit, created\_at



BudgetLine (`:1083`)

\- id, budget\_id, category, allocated



CostEntry (`:1093`)

\- id, project\_id, category, amount, entry\_date



Commitment (`:1104`)

\- id, description, amount, status



Payment (`:1113`)

\- id, amount, method, paid\_at



Notification (`:1122`)

\- id, user\_id, title\_ro, title\_en,

&#x20; message\_ro, message\_en, priority, action\_url,

&#x20; metadata, is\_read, read\_at, created\_at



NotificationPreference (`:1141`)

\- id, user\_id, category, channel, is\_enabled



Attachment (`:1153`)

\- id, target\_type, target\_id, file\_name,

&#x20; storage\_url, mime\_type, created\_at



AuditLog (`:1166`)

\- id, organization\_id, actor\_id, action,

&#x20; entity, entity\_id, before\_state, after\_state,

&#x20; metadata, ip\_address, user\_agent, created\_at



SolarDesign (`:1440`)

\- id, project\_id, name, description, status,

&#x20; current\_version\_id, created\_by, created\_at, updated\_at



SolarDesignVersion (`:1464`)

\- id, design\_id, version, label, status,

&#x20; snapshot, created\_by, created\_at



SolarRoofSection (`:1482`)

\- id, design\_id, name, roof\_type, surface\_type,

&#x20; slope\_deg, azimuth\_deg, roof\_material,

&#x20; thickness\_mm, polygon, origin, created\_at, updated\_at



SolarObstacle (`:1505`)

\- id, roof\_section\_id, name, obstacle\_type,

&#x20; polygon, keepout\_margin\_mm



SolarModuleSpec (`:1519`)

\- id, manufacturer, model, power\_wp, length\_mm,

&#x20; width\_mm, thickness\_mm, weight\_kg, voc, isc,

&#x20; vmp, imp, technology, module\_type,

&#x20; is\_active, created\_at, updated\_at



SolarLayoutSettings (`:1545`)

\- id, design\_id, module\_spec\_id, orientation,

&#x20; edge\_margin\_mm, row\_spacing\_mm, column\_spacing\_mm



SolarModulePlacement (`:1560`)

\- id, design\_id, roof\_section\_id, module\_spec\_id,

&#x20; row, column, local\_x, local\_y, local\_z,

&#x20; rotation\_deg, width\_mm, height\_mm



SolarMountingFamily (`:1583`)

\- id, code, name, description



SolarProduct (`:1594`)

\- id, code, name, family\_id, product\_type, unit,

&#x20; length\_mm, width\_mm, height\_mm, weight\_kg, alloy,

&#x20; cross\_section, structural\_properties, cad\_ref,

&#x20; catalog\_status, material\_id, is\_active,

&#x20; created\_at, updated\_at



SolarProductCompatibility (`:1628`)

\- id, product\_id, compatible\_product\_id,

&#x20; rule\_type, notes



SolarBomSnapshot (`:1642`)

\- id, design\_version\_id, generated\_at,

&#x20; total\_weight\_kg, notes



SolarBomItem (`:1655`)

\- id, bom\_snapshot\_id, product\_id, item\_type,

&#x20; code, name, quantity\_required, unit,

&#x20; cut\_length\_mm, notes



\### 4.4 Relationships and foreign keys



Major relationships are explicitly defined in the Prisma schema.



Examples:



\- User.organization\_id → Organization.id

\- Session.user\_id → User.id

\- RefreshToken.session\_id → Session.id

\- UserProfile.user\_id → User.id

\- RolePermission.role\_id → Role.id

\- RolePermission.permission\_id → Permission.id

\- Employee.user\_id → User.id

\- TeamMember.team\_id → Team.id

\- TeamMember.user\_id → User.id

\- Client.organization\_id → Organization.id

\- Project.organization\_id → Organization.id

\- Project.client\_id → Client.id

\- ProjectStage.project\_id → Project.id

\- WorkPackage.stage\_id → ProjectStage.id

\- LocationZone.project\_id → Project.id

\- ProjectMember.project\_id → Project.id

\- ProjectMember.user\_id → User.id

\- Task.project\_id → Project.id

\- Task.work\_package\_id → WorkPackage.id

\- Task.zone\_id → LocationZone.id

\- TaskAssignment.task\_id → Task.id

\- TaskAssignment.user\_id → User.id

\- AttendanceRecord.project\_id → Project.id

\- AttendanceRecord.user\_id → User.id

\- AttendanceCorrection.attendance\_id → AttendanceRecord.id

\- DailyPlan.project\_id → Project.id

\- DailyPlan.team\_id → Team.id

\- DailyPlanTask.daily\_plan\_id → DailyPlan.id

\- DailyPlanTask.task\_id → Task.id

\- DailyReport.project\_id → Project.id

\- DailyReport.team\_id → Team.id

\- DailyReportApproval.daily\_report\_id → DailyReport.id

\- DailyReportRevision.daily\_report\_id → DailyReport.id

\- DailyReportWorker.daily\_report\_id → DailyReport.id

\- DailyReportTask.daily\_report\_id → DailyReport.id

\- DailyReportTask.task\_id → Task.id

\- DailyReportMaterial.daily\_report\_id → DailyReport.id

\- DailyReportMaterial.material\_id → Material.id



All are defined in `backend/prisma/schema.prisma:10-1673`.



Notably, some logical-looking models such as TaskDependency,

Commitment, Payment, and Attachment have no conventional Prisma FK

relation to their referenced entities.



For example, TaskDependency at `schema.prisma:370-381` stores

predecessor\_task\_id and successor\_task\_id, but no Prisma @relation is

defined.



Status: UNCLEAR whether deliberate or incomplete relational modelling.



\### 4.5 Seed data



Seed exists: `backend/prisma/seed.ts`



It creates:



\- development organization

\- development admin

\- team leaders

\- workers

\- demo Solar catalog



The seed explicitly contains development credentials.



Source: `backend/prisma/seed.ts:1-31`



Default development credentials are hardcoded as fallback values in

the seed.



The seed refuses execution when NODE\_ENV === production.



Source: `backend/prisma/seed.ts:130-134`



Security classification: acceptable only as explicitly development-only

seed material; must never be used in production.



\---



\## 5. Security



\### 5.1 Secrets in code



Real production secrets: none found in inspected source.

`.env.example` contains placeholders, not production credentials.

`.gitignore` ignores:



\- .env

\- .env.local

\- .env.\*.local



Source: `.gitignore:15-27`



Hardcoded development credentials: YES.



`backend/prisma/seed.ts:1-31` contains fallback:



\- dev@hiieko.local

\- DevPassword123!



Additional demo accounts and passwords are created later in the same

seed.



This is not a production secret, but it is still hardcoded credential

material.



\### 5.2 .env committed



`.env` itself is ignored. Source: `.gitignore:15-27`



No committed production .env file was verified.



Status: NO verified committed .env.

`.env.example` is intentionally committed.



\### 5.3 Input validation



Global validation exists: `backend/src/main.ts:76-85`



DTOs use class-validator.



Backend dependencies: `backend/package.json:43-45`



\- class-transformer

\- class-validator



Controller methods consistently receive DTOs.



Example: `backend/src/modules/tasks/tasks.controller.ts:57-73`



\### 5.4 SQL injection



The normal data access layer uses Prisma.



However, raw SQL exists in the readiness health check:

`backend/src/main.ts:42`



`prisma.$queryRawUnsafe('SELECT 1')`



This particular query has no user-controlled input and therefore is

not an SQL injection vector.



No evidence was found of user input being interpolated into raw SQL.



\### 5.5 CORS



Explicit allowlist: `backend/src/main.ts:52-74`



Configured through CORS\_ORIGIN.



Default origins:



\- http://localhost:3000

\- http://localhost:19006



Source: `backend/src/main.ts:12-15`



No wildcard `\*` is used with credentials.



\### 5.6 Authentication vs authorization



Authentication: YES, server-side JWT verification.



Source: `backend/src/common/auth/guards/jwt-auth.guard.ts:17-91`



Authorization: YES, server-side.



Role authorization: `backend/src/common/auth/guards/roles.guard.ts:8-42`



Project authorization: controllers use:



\- @RequireProjectAccess

\- @RequireEntityProjectAccess

\- @RequireProjectParams



Examples: `backend/src/modules/tasks/tasks.controller.ts:26-96`



Important problem:



The frontend currently allows access through the role-preview session

without obtaining a real JWT.



Source: `web/src/app/login/page.tsx:81-96`,

`web/src/contexts/AuthContext.tsx:128-135`



Backend authorization remains real, but the frontend login layer is

not.



\### 5.7 File uploads



Upload endpoint exists: `backend/src/modules/upload/upload.controller.ts:42-84`



The storage implementation is abstracted.



The repository documentation indicates:



\- MIME allowlist

\- 10 MB limit

\- server-generated object keys

\- path traversal protection

\- SHA-256 checksum



The upload controller itself is protected with project access.



Source: `backend/src/modules/upload/upload.controller.ts:42-84`



Status: IMPLEMENTED.



\---



\## 6. Deployment



\### 6.1 Netlify



Netlify configuration exists: `netlify.toml:1-7`



\- build: `npm run build --workspace=web`

\- publish: `web/.next`

\- NODE\_VERSION=22



Netlify backend: MISSING.



There is no evidence in netlify.toml that NestJS is deployed as

Netlify Functions.



The backend is a conventional NestJS server:

`backend/src/main.ts:110-120`



Therefore:



\- Backend hosting location: MISSING / UNCLEAR from repository.

\- There is no verified Render, Railway, or Vercel backend configuration

&#x20; in the repository.



\### 6.2 Required environment variables



Web:



\- NEXT\_PUBLIC\_API\_URL

\- NEXT\_PUBLIC\_APP\_NAME

\- NEXT\_PUBLIC\_DEFAULT\_LOCALE

\- NEXT\_PUBLIC\_COMPANY\_TZ

\- NEXT\_PUBLIC\_DEFAULT\_GEOFENCE\_RADIUS\_METERS

\- NEXT\_PUBLIC\_WORK\_START\_HOUR

\- NEXT\_PUBLIC\_WORK\_END\_HOUR

\- NEXT\_PUBLIC\_STANDARD\_REST\_MINUTES



Source: `.env.example:13-29`



Backend:



\- DATABASE\_URL

\- JWT\_SECRET

\- JWT\_EXPIRES\_IN

\- PORT

\- NODE\_ENV

\- COMPANY\_TZ

\- PADDLEOCR\_URL

\- PADDLEOCR\_TOKEN

\- PADDLEOCR\_TIMEOUT

\- CORS\_ORIGIN

\- MAX\_FILE\_SIZE

\- STORAGE\_DRIVER

\- STORAGE\_ROOT



Source: `backend/.env.example:3-31`



\### 6.3 CI/CD



GitHub Actions PRESENT: `.github/workflows/ci.yml`



Pipeline includes:



1\. typecheck

2\. tests

3\. i18n check

4\. frontend guard check

5\. Prisma generation

6\. Prisma validation

7\. migration diff

8\. clean PostgreSQL migration deployment

9\. database verification

10\. full build



Source: `.github/workflows/ci.yml:1-132`



Deployment automation: MISSING from repository.



CI verifies and builds. No repository evidence proves that GitHub

Actions itself deploys backend production.



Netlify deployment is presumably platform-managed, but exact Netlify

dashboard configuration is UNCLEAR.



\---



\## 7. What exists vs what is stubbed



\### 7.1 Clearly implemented backend domains



The backend modules are not merely empty scaffolds. Current

controllers, services, and schema exist for:



| Feature | Backend |

|---|---|

| Auth | IMPLEMENTED |

| Users | IMPLEMENTED |

| Roles | IMPLEMENTED |

| Permissions | IMPLEMENTED |

| Projects | IMPLEMENTED |

| Project members | IMPLEMENTED |

| Project stages | IMPLEMENTED |

| Teams | IMPLEMENTED |

| Employees | IMPLEMENTED |

| Tasks | IMPLEMENTED |

| Task dependencies | IMPLEMENTED |

| Attendance | IMPLEMENTED |

| Daily planning | IMPLEMENTED |

| Daily reports | IMPLEMENTED |

| Materials | IMPLEMENTED |

| Inventory/stock | IMPLEMENTED |

| Warehouses | IMPLEMENTED |

| Procurement | IMPLEMENTED |

| Suppliers | IMPLEMENTED |

| Documents | IMPLEMENTED |

| Upload | IMPLEMENTED |

| OCR | IMPLEMENTED |

| Expenses | IMPLEMENTED |

| QA/QC | IMPLEMENTED |

| Issues/NCR | IMPLEMENTED |

| Change orders | IMPLEMENTED |

| Costs/budgets | IMPLEMENTED |

| Notifications | IMPLEMENTED |

| Audit log | IMPLEMENTED |

| Control Tower | IMPLEMENTED |

| Solar configurator | IMPLEMENTED |



Source: `backend/src/app.module.ts:7-68`



\### 7.2 Major current stub/bypass



Login: STUB/BYPASS — CRITICAL.



Current login is a role selector rather than authentication.



Source: `web/src/app/login/page.tsx:81-96`



This is the biggest end-to-end problem found.



\### 7.3 Design-only / mock surfaces



The repository contains an extensive ArchitectureAuditWorkspace that

itself documents which surfaces are design-only/mock.



For example: `web/src/components/ArchitectureAuditWorkspace.tsx`



It explicitly describes prototype/design surfaces using local sample

values for several modules.



The file identifies design-only examples including:



\- Control Tower review surface

\- Worker My Day review

\- Tasks review

\- Planning review

\- notification prototype

\- support center

\- report-a-problem prototype

\- login prototype

\- signup prototype

\- forgot-password prototype

\- user-administration prototype



Important: these are review/prototype surfaces and are separate from

some production pages.



The audit file itself distinguishes "DESIGN ONLY" from actual

production routes.



Source: `web/src/components/ArchitectureAuditWorkspace.tsx`



\### 7.4 Missing/unfinished authentication features



Password reset: MISSING.



No verified production password-reset API or controller exists in the

inspected auth controller.



Source: `backend/src/modules/auth/auth.controller.ts:31-118`



Only:



\- register

\- login

\- refresh

\- me

\- logout



The prototype references forgot-password functionality, but that is

not evidence of a backend implementation.



Invitation system: MISSING.



User administration exists, but no verified invitation endpoint was

found in the current controller.



Source: `backend/src/modules/users/users.controller.ts:18-63`



\### 7.5 Mobile



The Mobile application exists and has:



\- authentication service

\- API client

\- screens

\- AsyncStorage

\- SQLite

\- offline/network dependencies



Source: `Mobile/package.json:1-44`



However, historical project documentation and current code indicate

Mobile has more complicated legacy/offline compatibility paths.



The exact current end-to-end status of every Mobile screen is UNCLEAR

without executing the app against the backend.



\### 7.6 Broken imports and missing files



Not enough evidence from the current source scan to claim a specific

unresolved import failure.



Therefore: no specific broken import: NOT VERIFIED.



There are historical documents mentioning broken files and imports,

but those cannot be treated as current failures without current

source/build evidence.



\---



\## 8. Gaps for a construction project management system



Required domains:



| Domain | Current status | Evidence |

|---|---|---|

| Projects | IMPLEMENTED | Project model `schema.prisma:227`; Projects controller |

| Zones | IMPLEMENTED | LocationZone `schema.prisma:305`; Tasks reference zones |

| Tasks | IMPLEMENTED | Task `schema.prisma:333`; Tasks controller |

| People | IMPLEMENTED | User/Employee/Team/TeamMember models |

| Materials | IMPLEMENTED | Material, inventory, stock models |

| Documents | IMPLEMENTED | Document/DocumentVersion + upload |

| Photos | PARTIAL | Attachment/storage infrastructure exists; dedicated project/site photo workflow not clearly established |

| Daily Reports | IMPLEMENTED | DailyReport + approvals/revisions/workers/tasks/materials |

| Issues | IMPLEMENTED | Issue/NCR + controller |

| QA/QC | IMPLEMENTED | Inspection/Measurement/NCR |

| Activity Log | IMPLEMENTED | AuditLog + audit API |

| Auth | BACKEND IMPLEMENTED / WEB FRONTEND BYPASSED | Auth service exists; current login page is preview mode |

| Roles | IMPLEMENTED | Prisma role enum + RolesGuard + route roles |

| Project authorization | IMPLEMENTED | RequireProjectAccess / entity access |

| Planning | IMPLEMENTED | DailyPlan/DailyPlanTask + API |

| Procurement | IMPLEMENTED | PO/Aviz/Delivery/Supplier |

| Stock | IMPLEMENTED | StockBalance/Movement/Consumption |

| Expenses | IMPLEMENTED | Expense/Approval/Reimbursement/OCR |

| Solar design | IMPLEMENTED | Solar models + API |



Most important construction-management gaps:



1\. Real web login is disabled

&#x20;  This is the largest functional blocker.

&#x20;  Source: `web/src/app/login/page.tsx:81-96`



2\. Photo workflow is incomplete or UNCLEAR

&#x20;  Generic attachment/storage support exists and upload infrastructure

&#x20;  exists, but a complete construction-specific flow is not verified:

&#x20;  - Project → Zone → Daily Report → Photo

&#x20;  - Task → Photo

&#x20;  - Issue → Photo

&#x20;  - QA/QC Inspection → Photo

&#x20;  Status: PARTIAL / UNCLEAR.



3\. Password recovery is missing

&#x20;  No `/api/auth/forgot-password` or reset-token flow is present in the

&#x20;  current auth controller.

&#x20;  Source: `backend/src/modules/auth/auth.controller.ts:31-118`



4\. Backend production hosting is not defined in repository

&#x20;  NestJS clearly runs as a server.

&#x20;  Source: `backend/src/main.ts:110-120`

&#x20;  But production backend host = MISSING from repository configuration.



5\. Frontend navigation has route drift

&#x20;  `navigation.ts` advertises /qa-qc while canonical route roles define

&#x20;  /qa.

&#x20;  Source: `web/src/config/navigation.ts:31-77`,

&#x20;  `web/src/config/route-roles.ts:118-214`



6\. Authorization has two separate concepts

&#x20;  Frontend: `web/src/config/route-roles.ts`

&#x20;  Backend: @Roles + project access guards.

&#x20;  The route-role file itself explicitly says backend decorators are

&#x20;  not its source of truth.

&#x20;  Source: `web/src/config/route-roles.ts:14-21`

&#x20;  This creates a governance risk: frontend role matrix and backend

&#x20;  authorization can drift.



\---



\## TOP 10 BLOCKERS



\### 1. Restore real web authentication — CRITICAL



Remove the current role-preview login path and reconnect /login to:



```

apiClient.login()

→ JWT

→ AuthContext

→ /api/auth/me

```



Evidence:

\- `web/src/app/login/page.tsx:81-96`

\- `web/src/contexts/AuthContext.tsx:128-135`



\### 2. Remove preview identities from production AuthContext — CRITICAL



preview-admin, preview-owner, preview-worker, etc. are currently

treated as legitimate frontend users.



Source: `web/src/contexts/AuthContext.tsx:20-109`



\### 3. Verify production backend hosting — CRITICAL / MISSING



The repository does not establish where the NestJS server is deployed.



Source: `backend/src/main.ts:110-120`



\### 4. Verify production database migration state — CRITICAL



CI migrates a clean database, but repository source cannot prove the

production PostgreSQL instance has all migrations applied.



Source: `.github/workflows/ci.yml:79-97`



\### 5. Fix /qa vs /qa-qc route drift — HIGH



\- `navigation.ts` uses /qa-qc

\- `route-roles.ts` uses /qa



Source: `web/src/config/navigation.ts:31-77`,

`web/src/config/route-roles.ts:118-214`



\### 6. Establish one authoritative authorization contract — HIGH



Frontend ROUTE\_ROLES and backend @Roles() are separate authorization

definitions.



Source: `web/src/config/route-roles.ts:14-21`,

`backend/src/common/auth/guards/roles.guard.ts:8-42`



They need a deliberate, tested contract.



\### 7. Complete construction photo workflow — HIGH



Generic file upload exists, but a complete domain-specific construction

photo model/workflow is not verified.



Source: `backend/prisma/schema.prisma:1153-1164`,

`backend/src/modules/upload/upload.controller.ts:42-84`



\### 8. Implement password recovery — HIGH



No production forgot-password/reset endpoint exists in the current auth

controller.



Source: `backend/src/modules/auth/auth.controller.ts:31-118`



\### 9. Verify every frontend mutation against real backend APIs — HIGH



The backend has extensive real APIs, but the repository also contains

prototype/design-only surfaces.



Source: `web/src/components/ArchitectureAuditWorkspace.tsx`



The production rule should be:



```

UI action

→ apiClient

→ NestJS endpoint

→ Prisma

→ PostgreSQL

→ persisted result

```



and each production page should be tested against that chain.



\### 10. Run a clean end-to-end production acceptance test — HIGH



The codebase has extensive CI, but the current audit found a direct

conflict between the intended authentication architecture and the

current web login.



Minimum acceptance path:



```

Real user login

↓

JWT/session

↓

Project access

↓

Projects

↓

Zones

↓

Tasks

↓

Daily planning

↓

Attendance

↓

Daily report

↓

Materials/stock

↓

Issues

↓

QA/QC

↓

Documents/photos

↓

Audit log

```



The backend and domain model for most of this already exists. The main

problem is making the current production frontend use the real

architecture consistently instead of preview/mock paths.



\---



\## Final assessment



The repository is not a blank or skeletal construction-management

system. The backend, Prisma domain model, migrations, authorization

infrastructure, CI, inventory, planning, attendance, daily reports,

QA/QC, issues, documents, OCR, procurement, and Solar modules are

substantially present.



However, the current master branch has one particularly severe

contradiction:



> The backend has real authentication, but the current web login

> deliberately bypasses it and creates preview users.



That makes the current web application not end-to-end

production-authenticated, regardless of how much backend functionality

exists.



The second major issue is architecture drift between frontend

route/role definitions and backend authorization, with /qa vs /qa-qc

being a concrete example.



The third is deployment: the repository defines Netlify for the Next.js

frontend but does not define where the NestJS backend is hosted.



Those three areas should be resolved before treating the system as

production-ready.

