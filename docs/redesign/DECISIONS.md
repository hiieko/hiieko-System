# HIIEKO Web Redesign — Decisions

This log records settled decisions and any explicitly identified future owner choices. Do not reopen an approved decision without new evidence, an explicit owner request, or a documented scope-change review. A proposal in another document is not itself an approval.

## Repository and workflow constraints

| ID | Decision | Status / source |
|---|---|---|
| RD-001 | The original planning-chain setup was documentation-only; it did not authorize implementation. | **CLOSED** for the original setup task; it is not a standing prohibition on the approved roadmap. |
| RD-002 | Use the existing Anthropic `frontend-design` skill. Do not install UI UX Pro Max, Canvas Design, Superpowers, other skills, or packages. | **APPROVED** by the user request. |
| RD-003 | Do not alter application code, dependencies, lockfiles, environment/database configuration, or `opencode.jsonc` during planning setup. | **APPROVED** by the user request. |
| RD-004 | Preserve existing user modifications and untracked files; never overwrite, delete, reset, clean, or stash existing work. | **APPROVED** by the user request and repository `AGENTS.md`. |
| RD-005 | Preserve authentication/session/refresh, organization/project authorization, APIs, and persistence throughout redesign implementation. | **APPROVED** by the user request and `AGENTS.md`. |
| RD-006 | Reconcile and read the planning chain before implementation; do not ask again for owner-approved RD-P01–RD-P03. Stop for explicit review after the web `/tasks` prototype and before any other web page. | **APPROVED** by owner instruction; reflected in this reconciled chain. |

## Owner-approved redesign decisions

| ID | Decision | Status and rationale |
|---|---|---|
| RD-P01 | Redesign the existing production web application and mobile application. Exclude `/design-review`, `/design-review/global`, and `/design-review/architecture` from production redesign. Mobile layouts are not required to match web layouts. | **APPROVED** by owner instruction, 2026-10-23. Rationale: include both production clients, preserve a distinct mobile interaction/layout approach, and keep the named prototypes out of production scope. |
| RD-P02 | Use HIIEKO green, solar amber, and navy navigation; retain Inter and existing semantic tokens where suitable. Resolve the existing teal Sidebar mismatch through the approved design system. | **APPROVED** by owner instruction, 2026-10-23. Rationale: establish consistent HIIEKO brand/navigation anchors and reuse the existing type/token foundation. The sidebar code change belongs to its later approved implementation task; it was not made during this documentation pass. |
| RD-P03 | The first implementation prototype is the existing web `/tasks` route, using existing APIs and real data. Stop for explicit owner review before expanding the web redesign to any other page. Plan Mobile as a separate implementation sequence; do not copy web layouts by default. | **APPROVED** by owner instruction, 2026-10-23. Rationale: validate a real web workflow before broader web rollout and audit/design/implement Mobile according to its own screens and platform behavior. |

These decisions are settled and are reflected across the reconciled planning chain. No further approval is required for RD-P01–RD-P03. The explicit post-prototype owner-review gate remains mandatory before any other web page is changed.

## W1 implementation decisions

| ID | Decision | Status and rationale |
|---|---|---|
| RD-007 | Expand the bounded W1 prototype within `/tasks` to include Board/List/Calendar views, task cards/details, create/edit controls supported by the existing API, filtering and responsive behavior. | **APPROVED** by owner-directed `/tasks` follow-up requests, recorded 2026-10-25. Rationale: complete the existing task workflow before the W2 review. This does not authorize another route, shell work, backend/API change, or new feature. |
| RD-008 | Render task timestamps on the canonical company calendar day using the existing company-time helper. | **SETTLED** as an implementation decision under the existing company-day invariant. Rationale: task dates must agree with the backend/company day across device timezones; no date storage semantics changed. |
| RD-009 | Do not invent priority, task comments, or editing for backend-ignored fields; expose only supported behavior and record the gaps for separate scope review. | **SETTLED** under RD-003/RD-005 and `AGENTS.md`. Rationale: no fake persistence or unsupported controls; backend capability changes require separate approval. |
| RD-010 | Render a multi-day task once at its range start for the visible Calendar period, while including it in the selected-day list for every date its range covers. | **SETTLED** as a `TaskCalendar` display rule. Rationale: avoid duplicate event cards in a cell grid without hiding ongoing work when an in-range day is selected. |

## Decision protocol

- Do not reopen or ask for approval of a settled decision absent new contradictory evidence or an owner request. If the owner amends a decision, record the date/rationale here and reflect the change in `STATE.md` and the plan.
- When source evidence contradicts an approved choice, stop the affected task, document the evidence/options, and request a decision; do not quietly reinterpret the choice.
- Do not convert a route/API/permission or storage decision into a visual decision. Such scope changes require explicit approval and the relevant technical/business review.
