# Sales Phase 7 Implementation

Priority: High
Effort: Large
Session: 1
Estimated time: 120 minutes

## What is wrong

Phase 7 is a new product surface, not simply a defect fix. The documented plan identifies sales negotiation and handover list/detail pages, approve and return flows, project creation after approval, navigation integration, role-aware visibility, mobile navigation, and end-to-end testing as required work. The audit has not established that all these requirements are implemented and accepted.

## Why it matters

Sales must connect lead capture, field visits, negotiation, and handover to project operations without re-entering information. Approval must create a real Project with the documented client, budget, capacity, documents, and assigned Project Manager information. The workflow must respect role visibility and record sales actions in the activity log.

## Files involved

- `docs/plan/09-phase7-sales.md` — authoritative Phase 7 requirements; read before implementation.
- `web/src/app/` — VERIFY exact existing sales route paths before changing negotiation or handover list/detail pages.
- `web/src/config/route-roles.ts` — verify existing route-role conventions before integrating sales visibility.
- Existing navigation components — VERIFY exact paths before adding sales navigation and mobile navigation integration.
- Existing sales frontend and backend modules — VERIFY exact paths, models, APIs, and current implementation before editing.
- Existing Project creation and activity-log modules — VERIFY exact paths and supported contracts before connecting approval to project creation and activity recording.
- Existing Phase 7 tests — VERIFY exact paths; the source plan requires all 12 tests to pass.

## Steps

1. Read `docs/plan/09-phase7-sales.md` in full and inspect the current repository. Verify the actual paths, current line numbers, existing models, routes, API contracts, and implementation status before deciding what is missing.
2. Verify the `/sales/negotiations` and `/sales/handovers` list/detail experiences and the documented approve, return, and project-creation flows. Do not assume an item is missing until the current implementation has been checked.
3. Implement only confirmed Phase 7 gaps for lead capture and tracking, mobile field visits, negotiation and acceptance, handover package generation and review, return/approval, and real Project creation after approval. Reuse existing models and APIs where possible; follow the plan if additional models are required.
4. Integrate sales navigation, role-aware visibility, and mobile navigation using the project's existing conventions. Verify that sales is hidden from roles that should not access it.
5. Verify that the handover transfers existing sales information to operations without re-entry, and that every sales action is recorded in the activity log. Add or update tests to match the documented contract.
6. Run the complete Phase 7 test suite and confirm all 12 tests pass. Test the end-to-end workflow on three roles, verify the preview deployment, and run the relevant frontend/backend builds. Open a PR and merge only after review and preview acceptance, following the repository's actual branch and PR workflow.
7. Review the final diff and ensure the changes are limited to Phase 7 and its necessary tests/docs. Commit with `feat(sales): complete phase 7 workflow` and push the intended branch. Do not push directly to `master` if the repository workflow requires a PR.

## Acceptance criteria

- [ ] A lead can be captured, qualified, and tracked.
- [ ] Field visits can be logged from mobile.
- [ ] Negotiations can be tracked and accepted.
- [ ] Accepted contracts produce a handover package.
- [ ] Handover packages can be reviewed, returned, and approved.
- [ ] Approval creates a real Project with client, budget, capacity, documents, and assigned Project Manager.
- [ ] Sales information transfers to operations without re-entry.
- [ ] Sales has its own dashboard and work queue.
- [ ] Sales is not visible to roles that should not access it.
- [ ] All 12 documented Phase 7 tests pass.
- [ ] The activity log records every sales action.
- [ ] Documentation describes the sales lifecycle.
- [ ] Navigation, role-aware visibility, mobile navigation, and end-to-end behavior are verified.
- [ ] Preview testing and PR review are complete before merge.
- [ ] Relevant builds pass.
- [ ] Commit pushed through the approved workflow.

## Do NOT do

- Do not build a full CRM.
- Do not add marketing automation or email campaign tools.
- Do not add a customer portal; the source plan places it in a later phase.
- Do not redesign existing pages.
- Do not change existing models; add new models only where Phase 7 requires them.
- Do not touch Phases 0 through 6.
- Do not add features that Bogdan did not ask for.
- Do not invent fields, statuses, permissions, endpoints, or workflows.
- Do not re-enter data that should transfer from sales to operations.
- Do not bypass role restrictions or activity logging.

## Notes

The source plan estimates approximately 13–15 hours of focused work over 4–5 sessions. This file is a verification and implementation plan, not evidence that Phase 7 is complete. After Phase 7, follow the source plan's acceptance and real-project onboarding sequence before considering optional future features.
