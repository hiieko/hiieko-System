# HIIEKO Web + Mobile Redesign — Implementation Roadmap

**Execution rule:** execute one bounded task at a time. Owner-approved scope and high-level visual direction are recorded as RD-P01–RD-P03 in `DECISIONS.md`; do not request those approvals again. No task authorizes backend/API/data/authorization changes.

## Track A — Web

| ID | Task / bounded scope | Dependencies | Exit evidence |
|---|---|---|---|
| W0 — Inspect and prepare `/tasks` | **Next task.** Inspect the current `web/src/app/tasks` implementation, its feature API/client methods and corresponding backend endpoints, route/role permissions, project scoping, task components, translations, current tests, scripts, and relevant existing modifications. Identify behavior/contracts to preserve and the smallest changed-file set. Then prepare the exact bounded prototype implementation brief and verification checklist. No code changes in W0. | Owner decisions RD-P01–RD-P03 already approved. | Report source paths and evidence, existing tests/checks, ownership conflicts, proposed file scope, and acceptance plan. Stop if any true authorization/API/scope conflict is found. |
| W1 — Implement real web `/tasks` prototype | Change only the existing `/tasks` route and directly necessary task feature component(s)/tests. Follow RD-P02 and `02-DESIGN-SYSTEM.md`; use existing APIs and real project-scoped data. Do not redesign the shell, navigation, or any other route in this task. | W0 inspection/brief complete. | Meet the exact prototype acceptance checklist below. Report changed files and all actual verification. Then stop. |
| W2 — **Owner review gate** | Present the completed `/tasks` prototype and evidence. Do not implement another web page while awaiting review. | W1 complete and handoff delivered. | Only explicit owner acceptance releases web expansion. If revisions are requested, perform a narrowly scoped `/tasks` follow-up and repeat this gate. Rejection or blocker means stop and document it. |
| W3 — Shared web shell/system | Align the web shell, navigation and shared primitives to the approved HIIEKO green + solar amber + navy direction, including resolving the teal active-sidebar mismatch to the approved green treatment. Preserve navigation paths, role filtering, project context, language/account/logout behavior. | W2 explicitly accepted. | Focused role-aware desktop/mobile-web shell review and regression evidence; no other routes silently swept in. |
| W4 — Web field execution | Independently bounded tasks for `/planning`, `/pontaj`, `/rapoarte`, `/rapoarte/form`, and `/issues`. | W3 accepted; W2 gate passed. | Per-route acceptance in `03-PAGE-INVENTORY.md`; real workflows and permission/scope unchanged. |
| W5 — Web projects and solar | Independently bounded tasks for `/projects`, `/projects/[id]`, `/santiere`, and `/solar-configurator`. Treat the configurator as a standalone specialized-editor task. | W3 accepted; W2 gate passed. | Project membership/scope, persisted solar design and editor operations remain unchanged; responsive/editor evidence recorded. |
| W6 — Web supply and finance | Independently bounded tasks for `/stocuri`, `/avize`, `/depozite`, `/furnizori`, `/cheltuieli`, and `/aprobare`. | W3 accepted; any existing policy/API mismatch blocks only the affected task pending evidence/decision. | Quantities, transitions, role rules, confirmations, and persistence remain unchanged. |
| W7 — Web people, account, communication, and documents | Independently bounded tasks for `/teams`, `/workforce`, `/utilizatori`, `/profil`, `/notificari`, `/activity`, and `/documente`. Treat auth/account-recovery routes as separate tasks if touched. | W3 accepted; inspect real provider/security behavior for documents. | Per-route criteria pass; sensitive user/file metadata remains protected. |
| W8 — Web auth and root-home review | Separate behavior-preserving tasks for `/login`, `/signup`, `/forgot-password`, `/forgot-password/reset`, `/`, and `/control-tower`; root/control-tower surfaces share `ControlTowerSurface`. | W3 accepted; inspect auth/session code before auth UI work. | Authentication/session/refresh and role routing are unchanged; no duplicated Control Tower UI. |
| W9 — Web coverage and final QA | Review all production web routes and `/qa-qc` alias, confirm the three design-review prototype routes remain excluded, and complete web acceptance. | W4–W8 as applicable. | Final web verification matrix and approved deferrals recorded. |

### W1 prototype acceptance checklist

The `/tasks` prototype is accepted as complete for owner review only when:

1. It remains the existing `/tasks` route and uses only existing APIs/client methods with real persisted data; no fixture, fake ID, mock persistence, new endpoint, or unsupported action is introduced.
2. Existing route guard, role restrictions, organization/project isolation, task lifecycle, status/quantity/blocker/assignment/photo behavior, confirmation and error semantics remain intact. Any behavior not inspected in W0 is not redesigned by guess.
3. Loading, populated, empty, no-results, error/retry where supported, disabled, submitting/saving, and success states accurately represent existing behavior.
4. The approved visual anchors are applied to the task surface; Inter and existing semantic tokens are reused where suitable. A narrow responsive web view is not a specification for the Mobile app.
5. Romanian and English are checked; layout is reviewed at 390, 768, 1280, and 1440 px; no horizontal page overflow, clipped essential data/actions, or mobile-web bottom-nav obstruction remains.
6. Keyboard/focus, semantic controls, labels, status text beyond color, contrast, and reduced motion are reviewed.
7. Relevant existing task tests and applicable web typecheck/build are actually run; browser/manual checks are performed where available. Exact commands, outcomes, and blocked checks are reported. No check is marked passed unless run.
8. Changed file list is limited to `/tasks` and directly necessary task feature components/tests. If another page, shell, route/role, API, persistence layer, or dependency appears necessary, stop and request a separate owner scope decision.

### Exact W2 owner-review gate

After W1, stop without starting W3 or touching any other web route. Deliver the standard handoff with changed files, role/API preservation evidence, commands/results, not-run/blocked checks, and screenshots or recorded observations by viewport and locale. The owner must explicitly accept the `/tasks` prototype in review before **any other web page** is expanded. If revisions are requested, scope them to `/tasks`, then repeat the review. Silence is not acceptance.

## Track B — Mobile application (separate sequence)

Mobile work uses the same approved high-level HIIEKO green/amber/navy direction and semantic meaning where suitable, but does not inherit web wireframes, navigation, layout, or responsive breakpoints. The actual Mobile source and device workflows determine the screen inventory and implementation.

| ID | Task / bounded scope | Dependencies | Exit evidence |
|---|---|---|---|
| M0 — Mobile source/workflow audit | Inspect existing Mobile app entry points, screens/navigation, roles, API clients, auth/session behavior, persistence/offline queue and sync, localization, device affordances, tests, and current modified files. Map only screens actually present. | Begin as its own task after W2 prototype review; it may be scheduled separately from web page-family tasks. | Source-backed mobile screen/workflow inventory added to `03-PAGE-INVENTORY.md` in an authorized planning/implementation task; evidence gaps and preserved behavior documented. No Mobile code changes in M0. |
| M1 — Mobile-specific design brief | Select one existing, high-value field workflow/screen based on M0 evidence. Define native interaction/layout, states, devices, offline behavior, accessibility, files, tests, and acceptance. Do not assume the screen corresponds one-to-one with `/tasks`. | M0 complete. | Bounded mobile prototype brief and screen-specific criteria recorded; no web layout is copied by default. |
| M2 — Mobile prototype review | Review the mobile brief and test/device plan before the first Mobile implementation. | M1 complete. | Explicit owner approval of that mobile-specific prototype brief; this is a new Mobile implementation decision, not reapproval of RD-P01–RD-P03. |
| M3 — Implement one mobile prototype | Change only the selected existing Mobile screen and directly necessary components/tests. Keep current API, role, organization/project scope, authentication, offline persistence/sync, and platform behavior. | M2 accepted. | Real API/data, online/offline and device-specific acceptance evidence; then stop for explicit owner review. |
| M4 — Mobile prototype review gate | Present the mobile prototype at agreed devices/sizes, roles, locale, and connectivity states. | M3 complete. | Owner explicitly accepts before expansion to other mobile screens. Revisions remain bounded to the selected screen. |
| M5 — Mobile rollout and final mobile QA | Expand remaining inventoried mobile screens in independently verifiable tasks; run required emulator/device, offline/sync, accessibility, localization, regression, and build/test checks. | M4 accepted. | Every inventoried screen accepted or explicitly deferred; final evidence and limitations recorded. |

Mobile sequencing does not authorize web-route expansion before W2 and does not permit a Mobile code change during W0/W1.

## Task contract

For every task:

1. State exact route/screen, files allowed, behavior to preserve, and acceptance criteria before editing.
2. Inspect `git status --short` and relevant current files. Preserve existing user work; if a target conflicts, stop and report the conflict.
3. Implement only the approved task. No backend, route-role, API, schema, dependency, lockfile, environment, or persistence changes.
4. Run relevant safe checks that exist and record exact commands/outcomes. Never infer a pass from earlier audits or another task.
5. Manually inspect relevant web viewports/locales/roles or Mobile devices/connectivity states when available. Record blocked checks honestly.
6. Apply the existing `.opencode/skills/frontend-design/SKILL.md` plan → critique → build → self-review process. Do not install other skills/tools/packages.
7. Stop at completion. Honor W2 and M4 gates; do not advance without explicit owner acceptance.
8. Provide the handoff, update `STATE.md`, and record significant decisions in `DECISIONS.md`.

## Reusable short prompt

```text
Read AGENTS.md and every docs/redesign/*.md file. Use the existing
.opencode/skills/frontend-design/SKILL.md only. RD-P01–RD-P03 are approved; do not ask
for those decisions again.
Today: execute [ROADMAP ID + exact route/screen/file scope] only.
First inspect git status --short and relevant current files. Preserve all existing
modifications/untracked work. Preserve auth/session/refresh, route and role restrictions,
organization/project authorization, APIs, real data, and persistence/offline behavior.
No mock data, new routes/features, APIs, dependencies, lockfiles, env/config changes,
backend/database/storage changes, commits, pushes, reset, clean, stash, or scope expansion.
Run only applicable checks; report exact results and all blocked/not-run items. Never claim
an unrun check passed. After the task, stop, update STATE.md, record significant decisions,
and provide the handoff. For W1 stop for the W2 owner-review gate; do not modify another
web page before explicit acceptance. For Mobile, follow only the separate M-sequence and
do not copy web layouts by default.
```

## Standard handoff report

```text
Task: [roadmap ID and exact scope]
Outcome: [complete / partial / blocked]
Changed files: [exact paths, or “none”]
Behavior/auth/role/project/API/persistence preservation: [evidence or concern]
Verification run: [exact command/manual step] — [actual result]
Not run / blocked: [check and reason]
Visual/device review: [route/screen, role, locale, viewport/device, connectivity, evidence]
Outstanding issues: [list]
Scope changes: [none or owner-approved reference]
STATE.md / DECISIONS.md: [updates]
Proposed next task: [one ID; not started]
Required approval gate: [if any]
```

## Scope-change protocol

If implementation appears to require a changed endpoint/payload, route/role/permission, data model, dependency, new feature, new screen, or design-system deviation, stop the affected task. Report evidence and impact and seek approval for that new scope. Do not reopen RD-P01–RD-P03 absent new contradictory evidence or owner request. Never silently widen scope or bypass W2/M4 review gates.
