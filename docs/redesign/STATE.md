# HIIEKO Web + Mobile Redesign — State

**Last updated:** 2026-10-25  
**Current phase:** Expanded W1 `/tasks` implementation complete and verified; W2 owner review pending  
**Implementation status:** The production web `/tasks` route and its directly related task components/tests have been refined and expanded at the owner's direction. No other production web route was changed by this W1 handoff. W2 has not been accepted; W3 and Mobile implementation have not started.

## Approved decisions

- RD-P01: redesign the existing production web and mobile applications; exclude `/design-review`, `/design-review/global`, and `/design-review/architecture`; do not assume mobile layouts copy web.
- RD-P02: HIIEKO green + solar amber + navy navigation; retain Inter and existing semantic tokens where suitable; resolve the teal sidebar mismatch through the approved system.
- RD-P03: first implementation is existing web `/tasks`, using existing APIs and real data; stop for owner review before changing any other web page; mobile has a separate sequence.
- RD-007: W1's bounded scope was expanded within `/tasks` to Board, cards/details, create/edit, List, Calendar, filtering and responsive behavior. This does not authorize another route, shell work, API/backend change, or new feature.
- RD-008: task timestamps are displayed on the canonical company calendar day via the existing company-time helper; no date storage semantics changed.
- RD-009: unsupported priority, task comments, and backend-ignored task edit fields were not faked or added to the backend during W1.
- RD-010: multi-day tasks render once at their range start in Calendar, but appear in the selected-day list for every covered date.

These decisions are recorded in `DECISIONS.md`. Do not ask for their approval again.

## Completed work

- Read `AGENTS.md` and every existing Markdown file in `docs/redesign/`.
- Reconciled the master plan, audit, design system, page inventory, roadmap, QA, state, and decisions to RD-P01–RD-P03.
- Added a separate Mobile audit/design/prototype/rollout sequence without starting Mobile implementation.
- Defined the bounded web `/tasks` prototype acceptance checklist and explicit stop/owner-review gate before web expansion.
- Completed W0 static inspection of the `/tasks` route, child components, API/type contracts, route and project guards, translations, shared UI, tests and current scripts. Detailed findings and W1 brief: [W0-TASKS-PROTOTYPE-BRIEF.md](./W0-TASKS-PROTOTYPE-BRIEF.md).
- Applied the initial W1 visual refinement within `/tasks` and `TaskCard`.
- Implemented the owner-directed W1 expansion:
  - responsive sticky page header/toolbar and compact filter grid;
  - Board/List/Calendar view switch with guarded switching while details, saves, modals or blockers are active;
  - board status columns with live counts and status dots;
  - compact/expanded card hierarchy, schedule, workfront, assignee, quantity/progress, blocker and verification details;
  - real task creation with supported optional fields, accessible field labels/error announcements, planned start/end dates and reversed-range validation;
  - List summary, pagination and existing empty/error/loading states;
  - month/week Calendar using real planned dates, actual-date fallback, assignee/unassigned filtering, day selection, selected-day tasks and unscheduled tasks;
  - Calendar day selection includes ongoing multi-day tasks for every covered date while rendering each range once at its start;
  - compact Calendar event metadata on narrow widths;
  - relation-preserving PATCH response merge so project, work package, zone, assignments and dependencies are not lost in local state;
  - canonical company-day rendering for task date timestamps.
- Added/updated task regression tests, including create-date validation/optional fields, card timestamps, detail editing, Calendar filtering/selection/ongoing ranges and view-switch guards.
- Final QA removed a duplicate Calendar filter test, a duplicate assertion, an unused import and newly introduced comments.
- Preserved all pre-existing user modifications and untracked files. Separate in-progress work in the shell/sidebar, documents/R2 and other areas was not modified as part of this `/tasks` handoff.

## Verification evidence

- `npm run test --workspace=web -- --runInBand --silent --runTestsByPath src/app/tasks/page.test.tsx src/features/tasks/components/TaskCard.test.tsx src/features/tasks/components/TaskCalendar.test.tsx src/features/tasks/components/TaskCreateModal.test.tsx src/features/tasks/components/TaskAssignModal.test.tsx` — passed, 5 suites / 34 tests.
- `npm run web:typecheck` — passed.
- `npm run web:build` — passed; Next.js compiled and generated 36 routes, including static `/tasks`.
- `npm run i18n:check` — PASS, 273 source files / 1997 key definitions / 1997 unique keys. Orphan-key and inline-locale output is report-only.
- `npm run guards:check` — PASS, 273 source files scanned; reported legacy-token and missing-diacritic rows are report-only and outside this task's changed scope.
- `git diff --check` — passed with no whitespace errors.
- `git status --short` was inspected before and after the work; unrelated modifications/untracked files remain present and were not committed.
- No browser/screenshot review or live API check was run; W2 visual review remains outstanding.

## Unresolved issues / blockers

1. W2 owner review is pending. No other web route may be expanded until the owner explicitly accepts the `/tasks` prototype.
2. Browser/device visual evidence has not been gathered. Exact FlowTick visual matching is not claimed because no reference screenshots are available.
3. Backend `TasksService.update()` persists only title, description, status fields and actual/planned quantity. Planned dates, zone and work package are accepted by the DTO but not persisted, so full task editing of those fields is not implemented.
4. The backend has no task priority or task-comment model; neither was invented.
5. The Mobile screen inventory and workflow/API/offline/test details remain unknown until M0; do not invent screens or start mobile implementation before that audit and mobile-specific brief.
6. Separate working-tree changes outside `/tasks` must be reviewed in their own bounded tasks and are not evidence for this W1 handoff.

## Last review

The owner has not accepted the final `/tasks` implementation and evidence. The expanded prototype is ready for a W2 review; no broader web or Mobile rollout is approved.

## Next concrete task — W2 review

Present the `/tasks` implementation and evidence at the agreed roles, locales and viewports. Record actual visual/browser observations when available; do not substitute static inspection for them. No implementation task is next until this review is accepted or further bounded `/tasks` feedback is provided. Do not change any other web route or begin Mobile work.

## Required approval gates

- **No reapproval required now:** RD-P01–RD-P03 and the bounded `/tasks` scope expansion are recorded.
- **W0:** complete; brief recorded at `W0-TASKS-PROTOTYPE-BRIEF.md`.
- **W1:** complete for review in the expanded `/tasks` scope; verification commands above were run.
- **W2 mandatory and still pending:** owner reviews the `/tasks` evidence. Do not expand to another web page until the owner explicitly accepts it. Silence is not acceptance.
- **W3:** not started; shell/sidebar work requires its own accepted scope and must not be conflated with this handoff.
- **Mobile M2/M4:** use the separate Mobile-specific brief and review gates after the mobile source audit; do not assume web layouts.
- **Final:** owner accepts overall web and mobile evidence or records explicit deferrals/remaining work.
