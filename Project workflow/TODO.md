# TODO

Last Updated: 2026-09-22

# Next
- [ ] Fix ISSUE-002 — wire mobile login: mount `LoginScreen` in `App.tsx`, remove the demo-user fallback
- [ ] Replace the manual `isOffline` toggle with connectivity detection and actually INVOKE `syncOfflineQueue()` (ISSUE-011); make online submits insert for real (ISSUE-005)
- [ ] Fix ISSUE-003/004 — PaddleOCR-era cleanup of Google Vision references (`extract.ts`, `Mobile/.env.example`, `shared/src/ocr.ts`)
- [ ] Fix ISSUE-006/008/009 — `.gitignore`, `full_setup.sql` header, mojibake
- [ ] `git init` the repo (no VCS today) and add a CI pipeline (typecheck + tests + build)
- [ ] Record new audit findings and progress in `ISSUES.md`/`TODO.md`/`HANDOFF.md` (doc-sync rule)

# In Progress
- [x] Documentation baseline (`Project workflow/*.md` + `docs/AI_INSTRUCTIONS.md`) — 2026-09-18
  - Current state: all 10 workflow templates now carry real content; `AI_INSTRUCTIONS.md` created.
  - Remaining work: keep in sync as issues are fixed; stamp AI_INSTRUCTIONS.md after an AI session actually completes work.
  - Relevant files: `Project workflow/*.md`, `docs/AI_INSTRUCTIONS.md`

# In Progress
- [x] Documentation baseline (`Project workflow/*.md` + `docs/AI_INSTRUCTIONS.md`) — 2026-09-18
  - Current state: all 10 workflow templates now carry real content; `AI_INSTRUCTIONS.md` created.
  - Remaining work: keep in sync as issues are fixed; stamp AI_INSTRUCTIONS.md after an AI session actually completes work.
  - Relevant files: `Project workflow/*.md`, `docs/AI_INSTRUCTIONS.md`

# Planned
## Features
- [x] Wire `/pontaj` to `time_logs` (real attendance summary) — 2026-09-22
  - Current state: API calls implemented (`getAttendanceRecords`, `getProjects`, `getUsers`); loading/error states added; typecheck PASS
  - Remaining work: live backend API testing, UI actions (check-in/check-out)
  - Relevant files: `web/src/app/pontaj/page.tsx`
- [x] Wire `/rapoarte` to `daily_reports` — 2026-09-22
  - Current state: API calls implemented (`getDailyReports`, `getProjects`, `getUsers`); loading/error states added; typecheck PASS
  - Remaining work: add approval actions, live backend API testing
  - Relevant files: `web/src/app/rapoarte/page.tsx`
- [x] Wire `/stocuri` to `site_stock`/`stock_movements` — 2026-09-22
  - Current state: API calls implemented (`getStockBalances`, `getMaterials`, `getStockMovements`); loading/error states added; typecheck PASS
  - Remaining work: add stock-transfer UI, live backend API testing
  - Relevant files: `web/src/app/stocuri/page.tsx`
- [ ] Mount `LoginScreen` in mobile `App.tsx`; replace the demo user (ISSUE-002)
- [ ] Persist mobile expense/delivery submissions into the offline queue on the submit path (ISSUE-005)
## Testing
- [ ] Domain suite on the current tree (gate: PASS)
- [ ] Edge Function tests (gate: PASS)
- [ ] OCR parser tests with pytest (add `pytest` — ISSUE-007)
- [ ] E2E: apply `full_setup.sql` to a fresh Supabase project; RLS smoke test per role
## Configuration
- [ ] Fix `Mobile/.env.example` to document PaddleOCR (ISSUE-003)
- [ ] Fix `.gitignore` so `web/.env.example` and `Mobile/.env.example` stay visible (ISSUE-006)
- [ ] Remove unused root dependency `@supabase/server` (no imports found)
## Documentation
- [ ] Keep ISSUES.md/TODO.md/HANDOFF.md current while fixing issues (link each fix to its issue)
- [ ] Resolve documented contradictions listed in the 2026-09-18 status report §13
## Deployment
- [ ] Create/recover a Supabase project (ref `aazscejjuucjupzsykku`?) and apply `supabase/full_setup.sql`
- [ ] `supabase functions deploy ocr-extract`; set secrets `PADDLEOCR_URL`, `PADDLEOCR_TOKEN`
- [ ] Deploy OCR service (Docker or `uvicorn`) on a private host; set `OCR_SERVICE_TOKEN`
- [ ] Choose web/mobile hosting (Vercel/Netlify; EAS Build); add CI

# Technical Debt
- [ ] ISSUE-004: delete or integrate `supabase/functions/ocr-extract/extract.ts` (dead `google_cloud_vision` parser; comment claims it is imported by `index.ts`)
- [ ] ISSUE-008: fix `full_setup.sql` header (says migrations 01–06/"1/9"; body has 11 sections incl. 07/08)
- [ ] ISSUE-009: fix mojibake (`â€”`) in comments (`supabase/functions/ocr-extract/index.ts`, `Mobile/src/services/ocr.ts`, `ocr-service/app/main.py`)
- [ ] ISSUE-006: clean `.gitignore` (stray `!.vscode/extensions.json.venv/`, duplicated `.env` blocks, missing negations)
- [ ] Revisit OCR review/decision notes so future edits keep them accurate

# Nice to Have
- [ ] Excel/CSV export for reports and statistics
- [ ] Supabase Realtime push for web notifications
- [ ] Real GPS geofence test fixtures for mobile

# Completed TODOs (2026-09-22)
- [x] Fix ISSUE-001 — dashboard: replace the `attendance_records` query with `time_logs` (`web/src/app/page.tsx:54`) and remove the hardcoded `worker_count: 0`
  - Current state: Dashboard completely replaced with **Management Control Tower** consuming real data from centralized NestJS API
  - Verification: `npm run build --workspace=web` PASS
- [x] Migrate `/pontaj`, `/rapoarte`, `/stocuri` pages from mock data to real API calls
  - Added `useEffect` data loading with `apiClient`
  - Added loading/error states with proper UX
  - Fixed JSX syntax and TypeScript type errors
  - Verified: `npm run typecheck --workspace=web` PASS (0 errors)
- [x] 2026-09-22: Add 3 sample records to all pages (dashboard, pontaj, cheltuieli, aprobare, notificari, avize, stocuri)
- [x] 2026-09-22: Fix all TypeScript errors (toFixed, Expense interface, DNRow interface, useLocale imports, missing sampleProjects)
- [x] 2026-09-22: Start development server on localhost:3001 successfully
- [x] 2026-09-22: Update PROGRESS.md, TODO.md, PROJECT.md with current state
- [x] 2026-09-18: regenerate `Project workflow/*.md` and create `docs/AI_INSTRUCTIONS.md`
- [x] 2026-09-18/19: `npm install` (1,213 packages) + `shared` build + `web` build (14 routes)
- [x] 2026-09-18/19: `npm run typecheck` (shared+web+mobile) — 0 errors
- [x] 2026-09-18/19: unit suites — shared (calculations/i18n/tutorials), Edge `extract.test.ts` (36), OCR `pytest` (6)
- [x] 2026-09-18/19: web dev server verified live (HTTP 200 on 14 routes; `web-dev.log`)
- [x] 2026-09-18/19: master technical audit vs DOCX spec (102 sections) → 7 new audit documents in `Project workflow/`
