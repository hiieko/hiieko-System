# Solar Configurator BOM Verification

Priority: Medium
Effort: Medium
Session: 1
Estimated time: 60 minutes

## What is wrong

The audit identified the Solar Configurator bill of materials (BOM) and 3D behavior as areas requiring verification against the documented implementation plan. `docs/plan/STATUS.md` and `docs/plan/04-phase2-wire-apis.md` describe prototype-oriented concerns, but the current runtime behavior and API integration must be inspected before classifying any feature as incomplete.

## Why it matters

Users need to understand whether configurator output is backed by real application data or is only a prototype representation. Incorrectly presenting an unverified BOM or 3D result as production-ready could mislead users making project decisions.

## Files involved

- `docs/plan/STATUS.md` — verify the documented Solar Configurator status.
- `docs/plan/04-phase2-wire-apis.md` — verify the documented API integration requirements.
- `web/src/app/solar-configurator/page.tsx` — inspect the current configurator UI and BOM/3D behavior.
- `web/src/features/solar-configurator/api/solar.ts` — verify API calls and data handling.
- `backend/src/modules/solar/` — inspect existing backend capabilities; verify exact relevant files before editing.

## Steps

1. Read `docs/plan/STATUS.md` and `docs/plan/04-phase2-wire-apis.md`. Verify the current line numbers and documented requirements before making a change.
2. Trace the configurator page through `web/src/features/solar-configurator/api/solar.ts` and the existing solar backend module. Identify which BOM and 3D behaviors use real API data, which are presentation-only, and which are not implemented.
3. Compare the verified implementation with the documented requirements. Record any uncertainty rather than assuming that a missing-looking UI element proves missing backend functionality.
4. Make the smallest correction supported by the current API and plan. Add regression tests for confirmed behavior where appropriate. If a requirement needs a missing backend capability, document that dependency instead of inventing an endpoint, field, or persistence flow.
5. Run relevant tests and `npm run build --workspace=web`. If backend files are changed, run relevant backend tests and `npm run build --workspace=backend`.
6. Review the diff and stage only verified changes: `git add <reviewed-files>` followed by `git commit -m "fix(solar): verify configurator BOM behavior"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] The documented Solar Configurator requirements have been checked.
- [ ] BOM and 3D behavior has been traced through the current frontend and API integration.
- [ ] Prototype-only and API-backed behavior are clearly distinguished.
- [ ] Any confirmed defect is corrected without inventing backend capabilities.
- [ ] Relevant regression tests pass.
- [ ] No unrelated files or backend architecture are changed.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not assume the entire Solar Configurator is a prototype based only on the audit notes.
- Do not invent BOM fields, engineering calculations, endpoints, database fields, or workflows.
- Do not modify backend architecture or database schema.
- Do not represent sample or static data as persisted production data.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

This item is a verification task first. Confirm the current implementation and requirements before deciding whether code changes are necessary.
