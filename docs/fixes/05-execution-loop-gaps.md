# Execution Loop Gaps

Priority: High
Effort: Large
Session: 1
Estimated time: 90 minutes

## What is wrong

The audit did not establish that the full execution loop is complete. Worker photo attachment, daily-report and blocker workflows, and a user-visible activity feed need verification against the existing requirements and API implementation. Relevant inspection targets include `web/src/components/WorkerMyDay.tsx`, `web/src/components/ui/PhotoUpload.tsx`, `web/src/app/tasks/page.tsx`, the daily-report and issue modules, `backend/src/modules/attachments/`, and `docs/plan/06-phase4-execution-loop.md`.

## Why it matters

Field teams need to record work, attach supporting evidence where supported, report and resolve blockers, and understand relevant activity without relying on separate informal processes. Any implementation must use existing backend capabilities and documented requirements rather than presenting a frontend-only workflow as saved data.

## Files involved

- `docs/plan/06-phase4-execution-loop.md` — source of requirements for the execution loop.
- `web/src/components/WorkerMyDay.tsx` — verify the worker's current-day task workflow.
- `web/src/components/ui/PhotoUpload.tsx` — verify upload behavior and integration points.
- `web/src/app/tasks/page.tsx` — verify existing task actions and evidence workflow.
- `backend/src/modules/attachments/` — inspect existing attachment API and persistence behavior.
- Daily-report frontend and backend modules — VERIFY exact paths and current API capabilities before editing.
- Issue/blocker frontend and backend modules — VERIFY exact paths and current API capabilities before editing.
- Existing activity-related modules — VERIFY whether a user-visible activity feed is specified and implemented before proposing changes.

## Steps

1. Read `docs/plan/06-phase4-execution-loop.md` and verify the current implementation in each inspection target. Record actual file paths and line numbers; do not infer missing behavior from filenames alone.
2. Trace each relevant frontend action to its existing API endpoint and persistence behavior. Identify which gaps are confirmed, already implemented, or blocked by missing backend capability.
3. Make the smallest frontend correction for confirmed gaps that can be completed using existing APIs and documented requirements. If an API or workflow is missing, document the dependency rather than inventing an endpoint or changing backend architecture.
4. Add or update tests for the confirmed behavior, including attachment success/failure and relevant blocker or report transitions where supported by the existing contract.
5. Run relevant tests and the affected workspace build. At minimum, run `npm run build --workspace=web`; run backend tests/build if backend files are changed.
6. Review the diff and stage only the verified implementation and tests: `git add <reviewed-files>` followed by `git commit -m "fix(execution): close verified workflow gaps"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] Phase 4 requirements have been checked against the current implementation.
- [ ] Each reported gap is confirmed before it is changed.
- [ ] Supported frontend actions use existing APIs and persist as documented.
- [ ] Upload, report, blocker, and activity behavior is not represented as complete when it is not supported.
- [ ] Regression tests cover the confirmed changes.
- [ ] No unrelated files or backend architecture are changed.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not invent backend endpoints, database fields, statuses, permissions, or workflows.
- Do not implement fake or local-only persistence for production actions.
- Do not treat an activity feed as required unless the phase plan or current product requirements support it.
- Do not change backend architecture or database schema.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit identified areas requiring verification; it did not prove that every listed workflow is absent. Confirm each gap against the phase plan, existing API, and current UI before implementation.
