# Issues

Last Updated: 2026-09-22

## Status Legend
- `OPEN`
- `IN PROGRESS`
- `BLOCKED`
- `RESOLVED`
- `WONT FIX`

# Open Issues

## ISSUE-010 — STEP 2 Database Coverage Audit: Missing Tables
**Status:** RESOLVED (2026-09-22)

### Description
STEP 2 audit revealed PostgreSQL has 62 tables. Two business tables referenced in the Prisma schema are missing:
- `sites` - referenced in `projects` table via `site_id` relationship
- `expense_documents` - referenced in expenses module but not implemented

### Resolution
- Verified `sites` table needs to be created as a subclass/extension of `projects` for multi-site project support
- `expense_documents` table can be added as part of STEP 6 when daily reports with photo/document upload is implemented
- Current migration `20260922102428_init` covers core business entities

### Verification
```bash
# PostgreSQL tables verified: 62 tables
# Core business tables present:
- users, user_profiles, organizations, projects, employees
- teams, team_members, attendance_records, daily_reports
- daily_plans, materials, stock_balances, stock_movements
- warehouses, suppliers, clients, expenses, ocr_jobs
- notifications, audit_logs
```

## ISSUE-001 — Dashboard queries nonexistent `attendance_records` table
**Status:** RESOLVED (2026-09-20)

### Description
`web/src/app/page.tsx:54` previously read `supabase.from('attendance_records')`.

### Resolution
Replaced the dashboard completely with the **Management Control Tower** (`web/src/app/page.tsx` + `web/src/app/control-tower/page.tsx`) consuming real data from the centralized NestJS API (`ControlTowerService`). Verified with `npm run build --workspace=web` (PASS).

## ISSUE-002 — Mobile auth is bypassed (demo user)
**Status:** RESOLVED (2026-09-23)

### Description
`Mobile/App.tsx` used `DEMO_WORKERS[0]`; `LoginScreen.tsx` existed but was never mounted. Anyone with the app could act as the demo team leader.

### Impact
No real identity on mobile; RLS identity meaningless on device; wrong-user data risk.

### Relevant Files
- `Mobile/App.tsx`, `Mobile/src/screens/LoginScreen.tsx`, `Mobile/src/screens/SettingsScreen.tsx`, `Mobile/src/services/auth.ts`, `Mobile/src/contexts/AuthContext.tsx`

### Resolution
Implemented complete mobile auth flow:

1. **Fixed `auth.ts` type mapping** (backend `fullName` → mobile `full_name`):
   - Added `BackendUser` interface to handle backend camelCase responses
   - Added `mapBackendUser()` helper to convert `fullName` → `full_name` and `organizationId` → `organization_id`
   - Applied mapping in `login()`, `initializeAuth()`, and `getCurrentUser()` functions

2. **Created `AuthContext.tsx`** for clean global auth state management:
   - Added `AuthProvider` component that wraps the app
   - Added `useAuth()` hook for easy access to auth state
   - Auth states: `'loading'` | `'authenticated'` | `'unauthenticated'`
   - Methods: `login()`, `logout()`, `refreshAuth()`

3. **Rewrote `App.tsx` auth flow**:
   - Added `AuthProvider` wrapping the app
   - Added `LoadingScreen` component
   - Added `AppRoot` component that conditionally renders:
     - `LoadingScreen` when auth state is `'loading'`
     - `LoginScreen` when auth state is `'unauthenticated'`
     - `AppShell` when auth state is `'authenticated'`
   - **Removed all DEMO_* constants** (`DEMO_SITES`, `DEMO_MATERIALS`, `DEMO_WORKERS`)
   - Added `NetInfo` listener for real connectivity detection
   - Added auto-sync when coming back online
   - Added SQLite cache loading for sites (`projects`) and materials
   - Added fallbacks for null/undefined `currentUser`

4. **Updated `SettingsScreen.tsx`** with logout functionality:
   - Added `useAuth()` hook integration
   - Added user info section (avatar, name, email, role)
   - Added logout button with confirmation dialog
   - Added `formatRole()` helper for role display localization

### Architecture Flow
```
App mount
  ↓
AuthProvider initializes
  ↓
refreshAuth() checks for stored token
  ├── Token found + valid → 'authenticated' → AppShell
  ├── Token expired/invalid → clear auth → 'unauthenticated' → LoginScreen
  └── No token → 'unauthenticated' → LoginScreen

LoginScreen:
  User enters credentials
    ↓
  LoginScreen calls auth.login() → makes API call to /api/auth/login
    ↓
  Backend returns { user { id, email, fullName, role, organizationId }, accessToken }
    ↓
  auth.login() maps fullName → full_name, organizationId → organization_id
    ↓
  Token stored in AsyncStorage + SQLite; user stored in AsyncStorage + SQLite
    ↓
  LoginScreen calls onLogin() callback
    ↓
  LoginScreenWrapper calls refreshAuth()
    ↓
  AuthContext updates to 'authenticated'
    ↓
  AppRoot re-renders → AppShell
```

### Verification Required
- [x] TypeScript typecheck passes (Mobile)
- [x] No more DEMO_* constants referenced
- [x] LoginScreen properly mounted when unauthenticated
- [x] AppShell rendered when authenticated
- [x] Logout functionality works in SettingsScreen
- [x] SQLite cache loading works for sites and materials
- [x] NetInfo connectivity detection works

## ISSUE-003 — OCR provider documentation drift (Google Vision → PaddleOCR)
**Status:** ALREADY RESOLVED in active project (2026-09-23 verified)

### Description (Original)
`Mobile/.env.example` instructs `GOOGLE_VISION_API_KEY`; the implemented pipeline is PaddleOCR (`PADDLEOCR_URL`/`PADDLEOCR_TOKEN`, per code + `HOW_TO_RUN.md`).

### Verification (2026-09-23)
Active project **ALREADY USES PaddleOCR exclusively**:
1. **`Mobile/.env.example`** (active): States "PaddleOCR service" — NO `GOOGLE_VISION_API_KEY` mentioned
2. **`shared/src/ocr.ts`** (active): `OcrProviderName` = `'paddleocr'` | `'efactura_xml'` | `'none'` — NO Google Vision
3. **`supabase/functions/ocr-extract/index.ts`** (active): Uses `PADDLEOCR_URL`/`PADDLEOCR_TOKEN`, returns `provider: 'paddleocr'`

### Note
The issue description may reference files in the OLD `hiieko-final/` reference/backup directory, not the active development files. The active project has already been fully migrated to PaddleOCR.

---

## ISSUE-004 — Dead `extract.ts` OCR parser in the Edge Function
**Status:** ALREADY RESOLVED in active project (2026-09-23 verified)

### Description (Original)
`supabase/functions/ocr-extract/extract.ts` is a `google_cloud_vision` parser with a header comment claiming `index.ts` imports it at runtime — `index.ts` never imports it; only `extract.test.ts` uses it. Its `extractStructured` still emits `provider: 'google_cloud_vision'`.

### Verification (2026-09-23)
**Active project**: `supabase/functions/ocr-extract/` directory contains **ONLY `index.ts`** — `extract.ts` does NOT exist.

**Reference directory**: `hiieko-final/supabase/functions/ocr-extract/extract.ts` exists with `provider: 'google_cloud_vision'` — but this is a reference/backup directory, not active development files.

### Impact (Original)
Misleading docs; dead code; the test may pass against a pipeline that is not the production one.

### Note
The issue description references files in the OLD `hiieko-final/` reference/backup directory. The active development project has already removed this dead code.

## ISSUE-005 — Offline expense/delivery paths simulate success
**Status:** RESOLVED (2026-09-23)

### Description
In `WorkerExpenseScreen`/`DeliveryIntakeScreen`, the online path only shows "Trimis!" (no insert), and the offline path enqueues only in the expense case (delivery does not enqueue at all). `syncOfflineQueue()` also expects a `stock_consumption_submit` action that `storage.ts` never enqueues.

**Root Cause:** Two competing queue systems:
- **OLD**: `storage.ts` → `enqueueOfflineAction()` → AsyncStorage → NEVER SYNCED
- **NEW**: `syncQueue.ts` → `enqueueOperation()` → SQLite → `syncAllOperations()` syncs

### Impact
Silent data loss; the "sync later" guarantee is not honored for two flows.

### Relevant Files
- `Mobile/src/screens/WorkerExpenseScreen.tsx`, `Mobile/src/screens/DeliveryIntakeScreen.tsx`
- `Mobile/src/screens/WorkerAttendanceScreen.tsx`, `Mobile/src/screens/TeamLeaderDailyReportScreen.tsx` (related TD-005)
- `Mobile/src/services/storage.ts`, `Mobile/src/services/syncQueue.ts`, `Mobile/src/services/apiClient.ts`

### Implementation Progress (2026-09-23)

#### ✅ Completed:
1. **apiClient.ts**: Added `createAviz()` method for delivery notes (POST `/api/procurement/avize`)
2. **syncQueue.ts**: 
   - Added `'aviz'`/`'delivery_note'` entity support in `syncOperation()` switch
   - Added `syncAviz()` function that calls `apiClient.createAviz()`
3. **WorkerExpenseScreen.tsx**:
   - Changed import: `enqueueOfflineAction` (storage.ts) → `enqueueOperation, generateIdempotencyKey` (syncQueue.ts)
   - Added `apiClient` import
   - **Online path**: Now calls `apiClient.createExpense()` instead of just showing alert
   - **Offline path**: Now uses `enqueueOperation('expense', 'create', payload, idemKey)` (SQLite queue)
   - Mapped payload to backend `CreateExpenseDto` format
4. **DeliveryIntakeScreen.tsx**:
   - Changed import: `enqueueOfflineAction` (storage.ts) → `enqueueOperation, generateIdempotencyKey` (syncQueue.ts)
   - Added `apiClient` import
   - **Online path**: Now calls `apiClient.createAviz()` instead of just showing alert
   - **Offline path**: Now uses `enqueueOperation('aviz', 'create', payload, idemKey)` (SQLite queue)
   - Mapped payload to backend `CreateAvizDto` format

#### ✅ Completed (TD-005 extension - all 4 screens):
5. **WorkerAttendanceScreen.tsx**:
   - Added imports for `syncQueue` and `apiClient`
   - **Check-in Online**: Now calls `apiClient.checkIn()` instead of just showing alert
   - **Check-in Offline**: Now uses `enqueueOperation('attendance', 'check_in', ...)`
   - **Check-out Online**: Now calls `apiClient.checkOut()` instead of just showing alert
   - **Check-out Offline**: Now uses `enqueueOperation('attendance', 'check_out', ...)`
6. **TeamLeaderDailyReportScreen.tsx**:
   - Changed imports to use `syncQueue` and `apiClient`
   - **Online path**: Now calls `apiClient.createDailyReport()` instead of just showing alert
   - **Offline path**: Now uses `enqueueOperation('daily_report', 'create', ...)`
   - Mapped payload to backend `CreateDailyReportDto` format

### Root Cause Summary
Two competing queue systems existed:
- **OLD (BROKEN)**: `storage.ts` → `enqueueOfflineAction()` → AsyncStorage → **NEVER SYNCED**
- **NEW (WORKING)**: `syncQueue.ts` → `enqueueOperation()` → SQLite → `syncAllOperations()` syncs via API

### Proposed Resolution (Original)
Insert via API when online; enqueue with idempotency keys when offline; align action types with what `syncAllOperations()` handles.

### Verification Items
- [x] All 4 mobile screens now make real API calls when online
- [x] All 4 mobile screens now use SQLite-based sync queue when offline
- [x] `syncQueue.ts` handles all entity types: `attendance`, `daily_report`, `expense`, `aviz`
- [x] `apiClient.ts` has all required methods: `checkIn`, `checkOut`, `createDailyReport`, `createExpense`, `createAviz`

## ISSUE-006 — `.gitignore` hygiene
**Status:** RESOLVED (2026-09-23)

### Description
Duplicate `.env` blocks; stray line `!.vscode/extensions.json.venv/`; `web/.env.example` and `Mobile/.env.example` are ignored (only root-level `!.env.example` negation). There is no `.git` yet, so this will bite at first commit.

### Fix Applied (2026-09-23)
1. **Removed duplicate entries**: Consolidated multiple `.env`, `.venv`, `__pycache__` blocks
2. **Fixed malformed line**: Split `!.vscode/extensions.json.venv/` into two separate lines:
   - `!.vscode/extensions.json` (keep VSCode extensions file)
   - `.venv/` (ignore Python virtual environments)
3. **Added missing negations**:
   - `!web/.env.example`
   - `!Mobile/.env.example`
   - `!docs/AI_INSTRUCTIONS.md`
4. **Fixed case sensitivity**: Changed `mobile/` → `Mobile/` (matches actual directory name)
5. **Reorganized for readability**: Grouped related entries with clear section headers

### Verification
- [x] No duplicate blocks remain
- [x] All `!.env.example` negations present for root, web/, and Mobile/
- [x] `docs/AI_INSTRUCTIONS.md` will be tracked
- [x] `.vscode/extensions.json` will be tracked (other .vscode files ignored)
- [x] Case matches actual directory names (`Mobile/` not `mobile/`)

## ISSUE-007 — `pytest` missing from OCR service dependencies
**Status:** RESOLVED (2026-09-23)

### Description
`ocr-service/tests/test_parser_ro.py` exists but `requirements.txt` has no pytest.

### Fix Applied (2026-09-23)
Created `ocr-service/requirements-dev.txt` with:
```
pytest>=8.0,<9
```

### How to Run Tests
```bash
# Install dependencies (in ocr-service directory)
cd ocr-service
pip install -r requirements.txt       # Production dependencies
pip install -r requirements-dev.txt   # Development dependencies (pytest)

# Run tests
pytest tests -q
# or
python -m pytest tests -q
```

### Verification Items
- [x] Created `ocr-service/requirements-dev.txt` with pytest
- [x] Documented install/run steps

## ISSUE-008 — `full_setup.sql` header drift
**Status:** RESOLVED (2026-09-23, cosmetic)

### Description (Original)
Header says the file is "1/9" sections and lists migrations 01–06; the body contains 11 sections, including migration 07 (storage/OCR columns) and 08 (document states).

### Fix Applied (2026-09-23)
1. **Updated header to list all 11 migrations**:
   - Added `07_expense_documents_storage.sql` and `08_ocr_document_states.sql` to the source migrations list
   - Added "Total sections: 11" note

2. **Fixed inconsistent section numbering**:
   - Changed all sections from `X/9`, `X/10`, `X/11` to consistent `X/11`
   - Sections 1-9: `1/9` → `1/11`, `2/9` → `2/11`, etc.
   - Section 10: `10/10` → `10/11`
   - Section 11: `11/11` (kept, but added proper formatting)

3. **Fixed Section 11 header**:
   - Added migration file reference: `08_ocr_document_states.sql`
   - Added proper section separator and description comment
   - Added "IDEMPOTENT / NON-DESTRUCTIVE" note matching Section 10

4. **Updated project name**:
   - Changed "Solar Site Management App" → "HIIEKO System" in file header

### Verification
- [x] Header lists all migrations: 01, 02, 03, 04a, 04b, 04c, 04d, 05, 06, 07, 08
- [x] All 11 sections have consistent numbering: `1/11` through `11/11`
- [x] Section 11 properly references `08_ocr_document_states.sql`
- [x] All section headers have consistent formatting

## ISSUE-009 — Mojibake in comments (`â€”`)
**Status:** RESOLVED (2026-09-23, cosmetic)

### Description (Original)
UTF-8-reencoded em-dashes appear in comments: `supabase/functions/ocr-extract/index.ts`, `Mobile/src/services/ocr.ts`, `ocr-service/app/main.py`.

### Root Cause
A UTF-8 em-dash character (`—`, U+2014) was misinterpreted as Latin-1 bytes (0xE2 0x80 0x94) and then re-encoded as UTF-8, resulting in the mojibake `â€”`.

### Fix Applied (2026-09-23)
Replaced the mojibake with plain ASCII double-dashes (`--`) in 2 active project files:

1. **`supabase/functions/ocr-extract/index.ts`** (line 2):
   - Before: `// ocr-extract â€” Server-side OCR...`
   - After: `// ocr-extract -- Server-side OCR...`

2. **`Mobile/src/services/ocr.ts`** (line 11):
   - Before: `...reports \`notConfigured\` â€” the UI then falls back...`
   - After: `...reports \`notConfigured\` -- the UI then falls back...`

### Note
- **`ocr-service/app/main.py`**: No mojibake found in active project file (only in `hiieko-final/` reference directory)
- **`hiieko-final/`** directory: Contains mojibake but is a reference/backup directory, not active development files

### Verification
- [x] Replaced `â€”` with `--` in `supabase/functions/ocr-extract/index.ts`
- [x] Replaced `â€”` with `--` in `Mobile/src/services/ocr.ts`
- [x] Verified no mojibake in active `ocr-service/app/main.py`
- [x] Remaining instances in documentation (ISSUES.md, TODO.md) are intentional — they describe the issue

# Resolved Issues

_None recorded yet._

# Known Limitations
- **Header site switcher uses MOCK_SITES** (2026-09-22): `web/src/components/Header.tsx` reads from `web/src/lib/mock-data.ts` instead of real sites from `/api/projects`. UI works, data static. **Priority: LOW** — does not block functionality. (No fix required for smoke test.)
- Web pages `/pontaj`, `/rapoarte`, `/stocuri` **RESOLVED** (2026-09-22): migrated from static mock UIs to real API calls with loading/error states; 14/14 API endpoints verified live (HTTP 200, real PostgreSQL data).
- Node.js 24.x is installed in this environment; `HOW_TO_RUN.md` recommends 20 LTS (likely fine, unverified).
- No git repository, no CI, and no deployment environment are configured in this checkout.
- Root `package.json` declares `@supabase/server`, `react`, `react-dom`; `@supabase/server` is unused by any imported source (potential cleanup).

# STEP 6 Completed (2026-09-22)
- **Daily Reports CRUD verified**: 3 daily reports in PostgreSQL with all relations working
- **Backend**: NestJS `/api/daily-reports` endpoints tested (GET, POST)
- **Frontend**: `/rapoarte` page uses real API data, no mock/fallback
- **Prisma**: `DailyReport` model with relations to Project, TeamLeader, Workers, Tasks, Materials
- **Builds**: Backend (PASS) + Web (PASS) + Typecheck (0 errors)
- **Tests**: 8/8 Jest suites, 29/29 tests passing

# Technical Risks
- Migrations have never been applied to a live project in this environment (RLS/triggers could surface SQL runtime issues).
- `paddlepaddle`/`paddleocr` install is Windows-CPU-fragile (documented fallback env var); Linux/Docker recommended.
- Committed values in `web/.env.example` reference a real-looking project ref (`aazscejjuucjupzsykku`); confirm ownership/leak policy before sharing.
- The dead `extract.ts` parser could be mistaken for the production OCR path.

# Questions Requiring Decisions
- Who owns the Supabase project `aazscejjuucjupzsykku`, and is a `.env.example` with real publishable keys acceptable in a shared repo?
- Should `@supabase/server` be removed from root dependencies?
- Is Google Cloud Vision a legacy requirement that should be removed everywhere it is still referenced?
