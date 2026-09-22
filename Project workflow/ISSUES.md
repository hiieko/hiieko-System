# Issues

Last Updated: 2026-09-18

## Status Legend
- `OPEN`
- `IN PROGRESS`
- `BLOCKED`
- `RESOLVED`
- `WONT FIX`

# Open Issues

## ISSUE-001 — Dashboard queries nonexistent `attendance_records` table
**Status:** RESOLVED (2026-09-20)

### Description
`web/src/app/page.tsx:54` previously read `supabase.from('attendance_records')`.

### Resolution
Replaced the dashboard completely with the **Management Control Tower** (`web/src/app/page.tsx` + `web/src/app/control-tower/page.tsx`) consuming real data from the centralized NestJS API (`ControlTowerService`). Verified with `npm run build --workspace=web` (PASS).

## ISSUE-002 — Mobile auth is bypassed (demo user)
**Status:** OPEN

### Description
`Mobile/App.tsx` uses `DEMO_WORKERS[0]`; `LoginScreen.tsx` exists but is never mounted. Anyone with the app can act as the demo team leader.

### Impact
No real identity on mobile; RLS identity is meaningless on device; wrong-user data risk.

### Relevant Files
- `Mobile/App.tsx`, `Mobile/src/screens/LoginScreen.tsx`, `Mobile/src/services/storage.ts`

### Proposed Resolution
Boot to `LoginScreen` (or the account-application flow), fetch `profiles` after `auth.signInWithPassword`, pass the real user through screens.

### Verification Required
Manual sign-in on device; offline actions tagged with the real `user_id`.

## ISSUE-003 — OCR provider documentation drift (Google Vision → PaddleOCR)
**Status:** OPEN

### Description
`Mobile/.env.example` instructs `GOOGLE_VISION_API_KEY`; the implemented pipeline is PaddleOCR (`PADDLEOCR_URL`/`PADDLEOCR_TOKEN`, per code + `HOW_TO_RUN.md`).

### Impact
Operators follow outdated setup; confusion about secrets.

### Relevant Files
- `Mobile/.env.example`, `HOW_TO_RUN.md`, `supabase/functions/ocr-extract/index.ts`

### Proposed Resolution
Rewrite the `Mobile/.env.example` OCR section to describe PaddleOCR.

## ISSUE-004 — Dead `extract.ts` OCR parser in the Edge Function
**Status:** OPEN

### Description
`supabase/functions/ocr-extract/extract.ts` is a `google_cloud_vision` parser with a header comment claiming `index.ts` imports it at runtime — `index.ts` never imports it; only `extract.test.ts` uses it. Its `extractStructured` still emits `provider: 'google_cloud_vision'`.

### Impact
Misleading docs; dead code; the test may pass against a pipeline that is not the production one.

### Proposed Resolution
Delete `extract.ts`/`extract.test.ts` (the production path uses the PaddleOCR service result directly) or migrate the test to assert on the shared normalizer. Keep one source of truth.

## ISSUE-005 — Offline expense/delivery paths simulate success
**Status:** OPEN

### Description
In `WorkerExpenseScreen`/`DeliveryIntakeScreen`, the online path only shows "Trimis!" (no insert), and the offline path enqueues only in the expense case (delivery does not enqueue at all). `syncOfflineQueue()` also expects a `stock_consumption_submit` action that `storage.ts` never enqueues.

### Impact
Silent data loss; the "sync later" guarantee is not honored for two flows.

### Relevant Files
- `Mobile/src/screens/WorkerExpenseScreen.tsx`, `Mobile/src/screens/DeliveryIntakeScreen.tsx`, `Mobile/src/services/storage.ts`

### Proposed Resolution
Insert via Supabase when online; enqueue with idempotency keys when offline; align action types with what `syncOfflineQueue()` handles.

## ISSUE-006 — `.gitignore` hygiene
**Status:** OPEN

### Description
Duplicate `.env` blocks; stray line `!.vscode/extensions.json.venv/`; `web/.env.example` and `Mobile/.env.example` are ignored (only root-level `!.env.example` negation). There is no `.git` yet, so this will bite at first commit.

### Proposed Resolution
Clean `.gitignore`; add `!web/.env.example`, `!Mobile/.env.example`, `!docs/AI_INSTRUCTIONS.md` negations.

## ISSUE-007 — `pytest` missing from OCR service dependencies
**Status:** OPEN

### Description
`ocr-service/tests/test_parser_ro.py` exists but `requirements.txt` has no pytest.

### Proposed Resolution
Add `pytest` to a dev requirements file and record install/run steps in VERIFICATION.md.

## ISSUE-008 — `full_setup.sql` header drift
**Status:** OPEN (cosmetic)

### Description
Header says the file is "1/9" sections and lists migrations 01–06; the body contains 11 sections, including migration 07 (storage/OCR columns) and 08 (document states).

### Proposed Resolution
Update the header to list migrations 01–08 and fix the section numbering.

## ISSUE-009 — Mojibake in comments (`â€”`)
**Status:** OPEN (cosmetic)

### Description
UTF-8-reencoded em-dashes appear in comments: `supabase/functions/ocr-extract/index.ts`, `Mobile/src/services/ocr.ts`, `ocr-service/app/main.py`.

### Proposed Resolution
Rewrite the affected comment lines in plain ASCII/UTF-8.

# Resolved Issues

_None recorded yet._

# Known Limitations
- Web pages `/pontaj`, `/rapoarte`, `/stocuri` are static mock UIs (see TODO.md).
- No build/typecheck results exist for the current tree (no `node_modules`; see VERIFICATION.md).
- Node.js 24.x is installed in this environment; `HOW_TO_RUN.md` recommends 20 LTS (likely fine, unverified).
- No git repository, no CI, and no deployment environment are configured in this checkout.
- Root `package.json` declares `@supabase/server`, `react`, `react-dom`; `@supabase/server` is unused by any imported source (potential cleanup).

# Technical Risks
- Migrations have never been applied to a live project in this environment (RLS/triggers could surface SQL runtime issues).
- `paddlepaddle`/`paddleocr` install is Windows-CPU-fragile (documented fallback env var); Linux/Docker recommended.
- Committed values in `web/.env.example` reference a real-looking project ref (`aazscejjuucjupzsykku`); confirm ownership/leak policy before sharing.
- The dead `extract.ts` parser could be mistaken for the production OCR path.

# Questions Requiring Decisions
- Who owns the Supabase project `aazscejjuucjupzsykku`, and is a `.env.example` with real publishable keys acceptable in a shared repo?
- Should `@supabase/server` be removed from root dependencies?
- Is Google Cloud Vision a legacy requirement that should be removed everywhere it is still referenced?
