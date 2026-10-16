# Control Tower Project Scope

Priority: Critical
Effort: Medium
Session: 1
Estimated time: 45 minutes

## What is wrong

The project-scope guard and helper exist, but the Control Tower controller appears to calculate a scoped query and then discard it. The service scopes data by organization and an optional `projectId`; when no project is specified, it can aggregate across active projects in that organization. This is a potential project-level data-isolation issue that must be verified before changing behavior.

## Why it matters

Users should only see Control Tower information for projects they are authorized to access. Organization-level filtering alone may expose information from other projects within the same organization.

## Files involved

- `backend/src/modules/control-tower/control-tower.controller.ts` — verify how the scoped `where` value is constructed and passed to the service.
- `backend/src/modules/control-tower/control-tower.service.ts` — verify how organization and optional project filters affect aggregation.
- `backend/src/common/auth/guards/project-access.guard.ts` — verify how `request.projectScope` is populated.
- `backend/src/common/auth/project-scope.filter.ts` — verify the existing `buildScopedProjectWhere` helper and its expected use.
- Relevant Control Tower tests — VERIFY the existing test paths before adding or changing tests.

## Steps

1. Verify the current code before editing. Use `Select-String` to locate `projectScope`, `buildScopedProjectWhere`, and the Control Tower query construction in the four paths above. Record the actual current line numbers; do not rely on line numbers from an older audit.
2. Trace the controller-to-service call and confirm whether the computed scoped filter is discarded. Identify the smallest correction consistent with the existing authorization model.
3. Apply only the necessary project-scope correction. Do not invent a new permission, role, field, endpoint, or authorization rule.
4. Add or update regression tests for an authorized project, an unauthorized project, and a request without an explicit project where those cases are supported by the existing contract.
5. Run the relevant backend tests, then run `npm run build --workspace=backend`.
6. Commit only the reviewed fix and its tests: `git add <reviewed-files>` followed by `git commit -m "fix(control-tower): enforce project scope"`.
7. After reviewing `git status` and the commit diff, push the intended branch with `git push origin master` only if `master` is the branch being fixed.

## Acceptance criteria

- [ ] The current scope behavior is verified in the controller, service, guard, and scope helper.
- [ ] Control Tower aggregation respects the existing project-access rules.
- [ ] Regression tests cover the relevant project-scope cases.
- [ ] No unrelated files or backend architecture are changed.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not change database schema or backend/API architecture.
- Do not invent roles, permissions, project-scope fields, endpoints, or workflows.
- Do not assume the audit's suspected bug is confirmed until the current call chain is traced.
- Do not modify unrelated files or commit unrelated existing work.

## Notes

This is a security-sensitive fix. If the existing authorization contract does not clearly define behavior when no project is selected, stop and document the ambiguity rather than inventing a policy.
