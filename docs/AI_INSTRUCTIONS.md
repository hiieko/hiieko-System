# AI Instructions

> Instructions for AI assistants (and humans acting in that role) working in the **HIIEKO — Solar Site Management System** repository.
> Version: 1.0.0 · Last Updated: 2026-09-18

## Purpose
This file defines the working contract for any AI assistant that touches this repository, so that work stays aligned with the rules in `Project workflow/` and does not silently drift from reality.

## 1. Before Working
1. Read `Project workflow/PROJECT.md` and `Project workflow/HANDOFF.md` first.
2. Read and follow this file (`docs/AI_INSTRUCTIONS.md`).
3. Consult `HOW_TO_RUN.md` and `README.md` for the runbook.
4. Check `Project workflow/REQUIREMENTS.md`, `ISSUES.md`, `TODO.md`, and `VERIFICATION.md` for current state before implementing anything.
5. If documentation contradicts the code, treat the code as evidence, record the contradiction in `ISSUES.md`, and flag it to the user.

## 2. While Working
- Never modify files outside the scope of the currently approved task.
- Monitor the functioning of the overall system: no partial files, no placeholder code, no invented results.
- Follow existing conventions (TS/TSX, naming, `@solar/shared` i18n usage, RLS patterns, idempotent SQL with `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`).
- Keep `docs/` and `Project workflow/` synchronized with every change (definition of done).

## 3. Verification Rules
- Never mark a verification check as PASS unless it actually ran and passed in the current environment.
- Record real commands and results in `VERIFICATION.md`.
- As of 2026-09-18 the environment has no dependencies installed (no `node_modules`, Deno, pytest, pydantic) — verification must be explicitly enabled before running checks.

## 4. After Working
- Update `VERIFICATION.md` with actual results.
- Update `REQUIREMENTS.md`, `ISSUES.md`, `TODO.md`, and `HANDOFF.md` to reflect the new state.
- List exactly which files changed in `HANDOFF.md`.
- Report changes to the user with a summary.

## 5. Prohibited
- No silent deletion of decision records (mark them `SUPERSEDED` in `DECISIONS.md` instead).
- No hard-coded secrets or service-role keys in client code or docs.
- No claims of passing tests that were not run.
- No code changes without user approval.

## 6. Handoff
If work is paused mid-task, update `Project workflow/HANDOFF.md` (Current Task, What Remains, Open Issues, Next Action) before stopping.