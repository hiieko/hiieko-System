# HIIEKO — TECHNICAL DEBT REGISTER

**Date:** 2026-09-18/19 · **Severity:** CRIT / HIGH / MED / LOW · **Effort:** S (≤0.5d) / M (0.5–2d) / L (2–5d+) · Status: OPEN unless noted. Fixed = linked to its issue in `ISSUES.md`/`TODO.md`.

| ID | Item | Location | Severity | Effort | Notes / fix |
|---|---|---|---|---|
| TD-001 | Dashboard queries nonexistent `attendance_records` | web/src/app/page.tsx:54 | CRIT | S | Use `time_logs` + today filter (ISSUE-001) |
| TD-002 | `worker_count` hardcoded 0 in dashboard report rows | web/src/app/page.tsx:98 | HIGH | S | resolve real counts (daily_report_workers) |
| TD-003 | Mobile boots to hardcoded demo user; LoginScreen unwired | Mobile/App.tsx | CRIT | M | boot to LoginScreen; pass real user (ISSUE-002) |
| TD-004 | `syncOfflineQueue()` exported but never called | Mobile/src/services/supabase.ts | CRIT | M | connectivity detection + flush; then SQLite (WS-E) |
| TD-005 | Mobile online submit paths alert-only (attendance, report, delivery, expense) | 4 screens | CRIT | M | real inserts / queue for all (ISSUE-005) |
| TD-006 | No SQLite — docs claim it | entire Mobile | HIGH | L | add expo-sqlite (ISSUE-005 extension / spec §55) |
| TD-007 | Google Vision legacy references | `extract.ts` (dead, tagged gcv), `Mobile/.env.example`, `shared/src/ocr.ts` provider union, tests headers | MED | S | delete/rename + provider cleanup (ISSUE-003/004) |
| TD-008 | No `.git` / VCS in checkout | repo root | CRIT | S | `git init` + initial commit + CI pipeline |
| TD-009 | `full_setup.sql` header drift (says 01–06 "1/9"; body has 11 sections incl 07/08) | supabase/full_setup.sql | LOW | S | regenerate header (ISSUE-008) |
| TD-010 | Mojibake `â€"` in comments | edge `index.ts`, mobile `ocr.ts`, `ocr-service/app/main.py` | LOW | S | re-save UTF-8 (ISSUE-009) |
| TD-011 | Unused root dep `@supabase/server` (+ root react/react-dom possibly) | package.json | LOW | S | remove after confirming no imports |
| TD-012 | `.env.example` carries seemingly-real anon key + project ref; `.gitignore` hygiene issues (duplicated rules/partial anchors) | `.env.example`, `.gitignore` | MED | S–M | rotate/placeholder + clean ignore (ISSUE-006/007) |
| TD-013 | `shared/dist` includes test files (`.test.js/.d.ts`) | shared/tsconfig.json | LOW | S | exclude `**/*.test.ts` from build |
| TD-014 | Web header site switcher uses `MOCK_SITES` | web/src/components/Header.tsx | MED | S | live sites from API |
| TD-015 | `/pontaj`, `/rapoarte`, `/stocuri`, `/profil` not live | 4 pages | HIGH | L | wire to API (R2–R3) |
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