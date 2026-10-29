# HIIEKO — TECHNICAL DEBT REGISTER

**Original register date:** 2026-09-18/19 · **Severity:** CRIT / HIGH / MED / LOW · **Effort:** S (≤0.5d) / M (0.5–2d) / L (2–5d+).

> **Historical source register preserved:** TD-001 through TD-030 below retain their original descriptions, severity, effort, and recorded disposition. The current reconciliation table at the end records the evidence/disposition known from the archive, current workflow docs, and the Oct 20 master audit. It does not claim a fresh code audit of the modified worktree. Unverified is not equivalent to fixed.

| ID | Item | Location | Severity | Effort | Notes / fix |
|---|---|---|---|---|
| TD-001 | Dashboard queries nonexistent `attendance_records` | web/src/app/page.tsx:54 | CRIT | S | **SUPERSEDED** — Dashboard replaced with Control Tower consuming real NestJS API (2026-09-22) |
| TD-002 | `worker_count` hardcoded 0 in dashboard report rows | web/src/app/page.tsx:98 | HIGH | S | **SUPERSEDED** — Dashboard replaced with Control Tower (2026-09-22) |
| TD-003 | Mobile boots to hardcoded demo user; LoginScreen unwired | Mobile/App.tsx | CRIT | M | boot to LoginScreen; pass real user (ISSUE-002) |
| TD-004 | `syncOfflineQueue()` exported but never called | Mobile/src/services/supabase.ts | CRIT | M | connectivity detection + flush; then SQLite (WS-E) |
| TD-005 | Mobile online submit paths alert-only (attendance, report, delivery, expense) | 4 screens | CRIT | M | real inserts / queue for all (ISSUE-005) |
| TD-006 | No SQLite — docs claim it | entire Mobile | HIGH | L | add expo-sqlite (ISSUE-005 extension / spec §55) |
| TD-007 | Google Vision legacy references | `extract.ts` (dead, tagged gcv), `Mobile/.env.example`, `shared/src/ocr.ts` provider union, tests headers | MED | S | delete/rename + provider cleanup (ISSUE-003/004) |
| TD-008 | No `.git` / VCS in checkout | repo root | CRIT | S | `git init` + initial commit + CI pipeline |
| TD-009 | `full_setup.sql` header drift (says 01–06 "1/9"; body has 11 sections incl 07/08) | supabase/full_setup.sql | LOW | S | regenerate header (ISSUE-008) |
| TD-010 | Mojibake `â€"` in comments | edge `index.ts`, mobile `ocr.ts`, `ocr-service/app/main.py` | LOW | S | re-save UTF-8 (ISSUE-009) |
| TD-011 | Unused root dep `@supabase/server` (+ root react/react-dom possibly) | package.json | LOW | S | **REMOVED** (2026-09-23) — confirmed no imports ✅ |
| TD-012 | `.env.example` carries seemingly-real anon key + project ref; `.gitignore` hygiene issues (duplicated rules/partial anchors) | `.env.example`, `.gitignore` | MED | S–M | rotate/placeholder + clean ignore (ISSUE-006/007) |
| TD-013 | `shared/dist` includes test files (`.test.js/.d.ts`) | shared/tsconfig.json | LOW | S | exclude `**/*.test.ts` from build |
| TD-014 | Web header site switcher uses `MOCK_SITES` | web/src/components/Header.tsx | MED | S | **SUPERSEDED** — Header migrated to ProjectContext (R2.1 P3, 2026-09-23) |
| TD-015 | `/pontaj`, `/rapoarte`, `/stocuri`, `/profil` not live | 4 pages | HIGH | L | **SUPERSEDED** — All 4 pages wired to real API (R2.1 P3, 2026-09-23) |
| TD-016 | `daily_report_approvals` missing; self-approval report trigger disabled | migration 05 | MED | S–M | add table + wire flow |
| TD-017 | Online `/cheltuieli` submit path demo-only | web/src/app/cheltuieli/page.tsx | HIGH | M | real insert + ocr-status persistence |
| TD-018 | Reimbursement workflow no admin UI | web/mobile | MED | M | add (spec §71) |
| TD-019 | Barcode/QR = `Alert` simulation | DeliveryIntakeScreen.tsx | MED | M | expo-barcode-scanner integration (already a dep) |
| TD-020 | Delivery photo = fixed Unsplash URL; report photos = Unsplash | mobile screens | MED | S–M | camera capture + storage upload |
| TD-021 | GPS fallback simulation hardcoded site-center | WorkerAttendanceScreen.tsx | MED | S | only for demo; gate on real location |
| TD-022 | `isOffline` is a manual toggle, not real connectivity | App.tsx | HIGH | M | connectivity probe + auto mode |
| TD-023 | Duplicate OCR normalization logic | edge `extract.ts` vs `ocr-service/parser_ro.py` | MED | S | retire TS parser; single Python source of truth (spec §97) |
| TD-024 | `expense_documents.low_confidence_fields` insert from mobile uses column name mismatch hazard (JSONB vs string[]) | expenseDocuments.ts + migration 07 | MED | S | align schema/type |
| TD-025 | Notifications dirty `INSERT WITH CHECK (true)` policy | migration 04c | MED | S | tighten to service-role / RPC during dual-run |
| TD-026 | Account approval doesn't auto-activate user/profile | trigger + /utilizatori | MED | S–M | provision on approve |
| TD-027 | No integration/E2E tests; no CI | tests/ | HIGH | L | add agent runners (spec §81) |
| TD-028 | Many hardcoded RO strings bypass i18n | most pages/screens | MED | L | migrate to shared keys (spec §67) |
| TD-029 | Mobile receipt 'online' not used when demo fallback login | LoginScreen demo fallback | HIGH | S | remove fallback after real auth (ISSUE-002) |
| TD-030 | `profiles` insert policy allows `auth.uid()=id` on signup while `handle_new_user` also inserts → dependency on trigger ordering | migration 02/04d | MED | S | document ordering; add ON CONFLICT DO NOTHING |

*Ownership: each TD is fixed together with its linked issue in `TODO.md`/`ISSUES.md`; no TD is fixed silently — link the commit/PR id.*

---

## Consolidated disposition and evidence (2026-10-23)

Evidence keys: **H** = preserved historical completion/evidence in `archive/PROGRESS_HISTORY.md` or linked issue; **A** = Oct 20 master audit snapshot (baseline `3457db9`, not rerun); **D** = later workflow decision/status record; **U** = current state not established. The original TD row above remains authoritative for what was reported in 2026-09-18/19; this table is the reconciliation, not a rewrite of its history.

| ID | Consolidated disposition | Evidence / caveat |
|---|---|---|
| TD-001 | SUPERSEDED | Dashboard replaced by API-backed Control Tower; original register records this (2026-09-22). **H** |
| TD-002 | SUPERSEDED | Same dashboard replacement; original register records this (2026-09-22). **H** |
| TD-003 | IMPLEMENTED; runtime acceptance outstanding | ISSUE-002 marked resolved in preserved progress history; Mobile device acceptance still outstanding. **H** |
| TD-004 | IMPLEMENTED IN PART / device acceptance outstanding | Later roadmap records SQLite queue and auto-sync; Oct 20 audit says queue/idempotency/auto-sync exist but Mobile was not deeply audited. **H/A/U** |
| TD-005 | IMPLEMENTED at repository level; device acceptance outstanding | ISSUE-005 and history record real API/queue persistence; current Mobile runtime not re-exercised. **H/U** |
| TD-006 | HISTORICAL DESCRIPTION SUPERSEDED | SQLite/offline queue is documented as present; runtime/restart acceptance remains open. **H/U** |
| TD-007 | DEFERRED / historical provider references | OCR is frozen; old Google Vision cleanup is recorded in history, but no current OCR sweep was run. Do not reopen OCR on this basis. **H/D/U** |
| TD-008 | RESOLVED | Git repository and CI are present; Oct 20 audit records a Git baseline and test/build run. **A** |
| TD-009 | RESOLVED (historical record) | Archive marks ISSUE-008 resolved; current source not rechecked. **H** |
| TD-010 | RESOLVED (historical record) | Archive marks ISSUE-009 resolved; current source not rechecked. **H** |
| TD-011 | RESOLVED | Supabase dependency removal is recorded in the original row and current architecture. **D** |
| TD-012 | PARTIALLY RESOLVED / separate credential concern remains | Historical cleanup recorded; Oct 20 audit separately notes a local development DB password in Git history (P-09). Do not conflate that with old example keys. **H/A** |
| TD-013 | UNVERIFIED | No disposition/evidence in the inspected current audit; verify `shared/dist` build output before closure. **U** |
| TD-014 | SUPERSEDED | Header migrated to ProjectContext; original row records R2.1 P3. **H** |
| TD-015 | SUPERSEDED | Pages wired to real API per original row; verify individual V1 acceptance separately. **H** |
| TD-016 | SUPERSEDED AS LEGACY SCHEMA DESIGN / REQUIREMENTS PARTLY IMPLEMENTED | Daily-report approval workflow is recorded as implemented, but that does not prove the old Supabase table/trigger architecture should be recreated. **H/D** |
| TD-017 | UNVERIFIED AGAINST CURRENT ACCEPTANCE | Expenses are present in the domain inventory; no current end-to-end expense-submission evidence was established by this reconciliation. **A/U** |
| TD-018 | OUT OF SCOPE OR UNRESOLVED | Reimbursement administration is not explicitly included in proposed V1 scope; retain as a scope decision, not an assumed feature. **D** |
| TD-019 | DEVICE ACCEPTANCE OUTSTANDING | Barcode/hardware acceptance is included in the Mobile device checklist; no device run is evidenced. **D/U** |
| TD-020 | DEVICE / STORAGE ACCEPTANCE OUTSTANDING | Photo capture and persistent retrieval need device/runtime evidence; production storage is unverified (P-04). **A/U** |
| TD-021 | DEVICE ACCEPTANCE OUTSTANDING | GPS/geofence behavior requires physical device/emulator acceptance; not established by static evidence. **D/U** |
| TD-022 | IMPLEMENTED AT REPOSITORY LEVEL; DEVICE ACCEPTANCE OUTSTANDING | Later roadmap documents SQLite auto-sync; the original manual-toggle finding was not freshly tested. **H/A/U** |
| TD-023 | DEFERRED WITH OCR | OCR is frozen; no current duplicate-normalization audit was performed. **D/U** |
| TD-024 | LEGACY SUPABASE HAZARD / CURRENT RUNTIME UNVERIFIED | Original concern names a Supabase-era table/type path; no runtime proof or fresh search was performed here. **H/U** |
| TD-025 | SUPERSEDED BY RUNTIME REMOVAL, SUBJECT TO ARCHIVE ONLY | Supabase is not an active runtime; archived migration policy is not an application runtime action. **D** |
| TD-026 | IMPLEMENTED AT ACCOUNT-LIFECYCLE LEVEL; ACCEPTANCE NOT REPEATED | Current audit describes account lifecycle/auth implementation; no separate live approval test was rerun. **A/U** |
| TD-027 | RESOLVED AT BASELINE; CURRENT WORKTREE NOT VERIFIED | Oct 20 audit reports CI/build and 48 backend suites / 567 tests; this is not evidence for current modified files. **A** |
| TD-028 | PARTIALLY OPEN | Oct 20 audit reports 417 dead i18n keys and residual hardcoded strings; count not rerun. **A** |
| TD-029 | IMPLEMENTED; device acceptance outstanding | ISSUE-002 history records demo bypass removal; no current device test was run. **H/U** |
| TD-030 | SUPERSEDED BY SUPABASE RUNTIME REMOVAL; archived DDL only | Supabase migrations are archival, not runtime; no migration changes authorized. **D** |

**Canonical tracking:** current issues/findings in `ISSUES.md`; verification boundaries in `VERIFICATION.md`; implementation tasks only in the proposed `docs/HIIEKO_IMPLEMENTATION_PLAN.md`. This register does not authorize deletion, schema changes, or reopening frozen work.
