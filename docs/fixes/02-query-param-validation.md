# Query Parameter Validation

Priority: High
Effort: Medium
Session: 1
Estimated time: 60 minutes

## What is wrong

The audit identified query parameters that may be consumed without comprehensive DTO validation. Several controllers use raw query values or `parseInt` without consistently checking invalid values and bounds. The affected paths must be inspected to confirm each case before making changes.

## Why it matters

Invalid, malformed, or extreme query values can cause incorrect filtering, unexpected errors, or unnecessarily expensive requests. Validation should be consistent with the existing API contract and must not silently introduce new query parameters or behavior.

## Files involved

- `backend/src/modules/audit/audit.controller.ts` — verify query parameter parsing and validation.
- `backend/src/modules/activity/activity.controller.ts` — verify query parameter parsing and validation.
- `backend/src/modules/expenses/expenses.controller.ts` — verify query parameter parsing and validation.
- `backend/src/modules/attendance/attendance.controller.ts` — verify query parameter parsing and validation.
- `backend/src/modules/control-tower/control-tower.controller.ts` — verify query parameter parsing and validation.
- `backend/src/modules/inventory/inventory.controller.ts` — verify query parameter parsing and validation.
- `backend/src/main.ts` — inspect existing validation-pipe configuration before proposing changes.
- Existing DTO and controller tests — VERIFY exact paths before editing.

## Steps

1. Verify the current code and line numbers in each listed controller. Search for `@Query`, `parseInt`, numeric conversions, pagination, date filters, and other query values that are used without validation.
2. Check existing DTOs, validation decorators, and the global validation configuration in `backend/src/main.ts`. Separate confirmed gaps from already validated parameters.
3. Make the smallest corrections using the project's existing validation conventions. Preserve current parameter names, response formats, defaults, and documented API behavior.
4. Add or update tests for malformed numeric values, missing optional values, and out-of-range values where applicable. Confirm the expected behavior from the existing contract rather than inventing it.
5. Run the relevant backend tests, then run `npm run build --workspace=backend`.
6. Review the diff and stage only the verified changes: `git add <reviewed-files>` followed by `git commit -m "fix(api): validate query parameters"`.
7. Confirm the intended branch and cleanly reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] Query parameters in the listed controllers have been inspected individually.
- [ ] Confirmed unvalidated inputs are validated consistently with existing project conventions.
- [ ] Existing API parameter names and response contracts are preserved.
- [ ] Regression tests cover the confirmed validation gaps.
- [ ] No unrelated files or backend architecture are changed.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not assume every query parameter in the listed files is unvalidated.
- Do not invent new query parameters, fields, defaults, bounds, or response formats.
- Do not change database schema or backend/API architecture.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit identified these controllers as inspection targets; verify the current code before treating any individual parameter as a confirmed defect.
