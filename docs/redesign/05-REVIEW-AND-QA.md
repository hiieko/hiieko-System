# HIIEKO Web Redesign — Review and QA

**Rule:** these are required review dimensions, not claims that checks have passed. Record exact evidence for the current task and final web/mobile acceptance. A build is not browser, device, accessibility, or workflow acceptance. RD-P01–RD-P03 are approved; do not ask the owner to approve them again.

## 1. Visual review

- Compare every changed route to the owner-approved `02-DESIGN-SYSTEM.md`. After W2 acceptance, use the `/tasks` prototype as an additional reference for later web pages. Do not silently reinterpret the visual direction.
- Capture/review screenshots at **390 px**, **768 px**, **1280 px**, and **1440 px** where browser tooling is available; include the same locale/role states when layout differs.
- Review hierarchy, alignment, line length, page density, project/site context, task/record priority, spacing, contrast, clipping, and consistency with the shell.
- Check real populated, empty, loading, error, no-results, denied, and action states as applicable. Never use fixture/mock content as proof of real-data behavior.
- Check both Romanian and English. Longer translated labels, dates, numbers, and action text must not clip or cause unintended overflow.
- Check dark shell/active/inactive navigation and mobile bottom nav/More drawer, including focus and safe-area clearance.
- For the solar configurator, review actual tool selection, canvas/editor, summary, and narrow-screen behavior; do not judge it as a generic CRUD page.
- For the separate React Native Mobile application, review its own audited screens and native interaction patterns. Do not use web wireframes or web breakpoints as the mobile app's acceptance standard.
- Record route, viewport, role, locale, environment/build identity, screenshot/reference location if available, reviewer, findings, and disposition.

## 2. Responsive review

For web at each applicable width, check:

- No horizontal page overflow, clipped controls, overlapping content, or hidden required action.
- Header/project context remains understandable; menus/drawers open/close and remain reachable.
- Primary actions and frequent field controls are reachable; touch targets aim for 44×44 px.
- Tables adapt by an intentional mobile representation (priority-first rows/cards or explicit accessible scrolling), not unreadable shrinking.
- Filters, forms, modals, task cards, document names/paths, and feedback fit and remain operable.
- Mobile bottom navigation does not cover content or keyboard-focused controls; safe-area padding is respected.

Do not claim “responsive” based only on Tailwind class presence.

For the Mobile application, use the screen/device matrix established by the Mobile audit. Check native navigation, safe areas, touch/keyboard behavior, device affordances, offline and reconnect states as relevant. Do not require the same composition as web.

## 3. Accessibility review

- Keyboard-only traverse: logical order, skip-to-content, navigation, filters, rows, forms, actions, drawers/modals, confirmation flows, and close behavior.
- Verify visible focus, no keyboard trap except intentional modal focus management, correct focus return, labels/description/error associations, accessible icon-only names, semantic controls, and expanded/selected/current state attributes.
- Verify screen-reader announcements for meaningful loading/result/error changes where applicable; do not announce decorative updates.
- Check color contrast for text, controls, focus indicators, status badges, disabled states, and both shell/surface combinations against WCAG 2.2 AA targets.
- Every severity/status has a text or shape cue as well as color. Zoom/reflow and reduced-motion preference are checked where tooling permits.
- Avoid adding an accessibility dependency unless separately approved. If no automated accessibility tool is already available, record manual review and the missing automation explicitly.

## 4. Existing-functionality regression

For each affected workflow, verify against the pre-task behavior and current API contract:

- Sign-in/out, registration, forgot/reset password, current user/session renewal, protected routing, and role-specific landing remain unchanged when those surfaces are touched.
- Unauthorized route/action behavior and backend authorization remain authoritative; try only approved safe test accounts/data. Verify organization/project boundaries for relevant pages.
- Project selector/context and role-aware desktop/mobile navigation remain consistent with `route-roles.ts` and existing `NAV_GROUPS`.
- CRUD, search/filter, pagination, form validation, status transitions, confirmation, file upload/download/preview, attendance, reports, inventory, approvals, and solar editing remain connected to the same supported APIs/actions.
- Loading, error, retry, empty/no-results, saving, and success feedback reflect real API outcomes. No success toast or visual transition may occur before the actual successful response.
- Data survives navigation/refresh according to existing server persistence; no local-only state is substituted for persistence.
- Verify translation selection and no mixed-language copy in both supported locales.
- For Mobile, additionally preserve current offline persistence/queue, synchronization and retry behavior; verify device-dependent behavior only on an actual supported emulator/device. Record unavailable device checks as blocked/not run.

Any behavioral change, role/API mismatch, cross-project leak, auth/session regression, or unsupported visible action is a blocker. Stop and report rather than modifying the contract under a redesign task.

## 5. Automated checks

Use only scripts that exist in the current checkout and are relevant. Root `package.json` currently declares:

- `npm run web:typecheck`
- `npm run web:build`
- `npm run web:test -- --runInBand` or the applicable focused Jest command, if supported by the current web test setup.
- `npm run i18n:check`
- `npm run guards:check`
- `npm run backend:test` only when a change or regression concern makes backend tests relevant; redesign scope must not modify backend code.

The web workspace also declares `npm run lint --workspace=web`, but verify it is supported in the installed Next version/environment before relying on it. Do not install missing packages to satisfy a check. Record command, exit code, environment, and any pre-existing or unrelated failure separately. Do not run migrations or database-mutating scripts.

Before each task, verify the actual current scripts/config because user work may have changed since this document was written. For Mobile, first discover the actual workspace commands and relevant tests; do not assume web scripts cover Mobile. Use targeted tests plus necessary broad checks; a no-test or unrun command is not a pass.

## 6. `/tasks` prototype and mandatory owner-review gate

The first implementation is only the existing web `/tasks` route and directly necessary task feature components/tests, using existing APIs and real data. Apply the approved HIIEKO green + solar amber + navy direction and existing Inter/semantic tokens where suitable. Preserve route/role permissions, organization/project isolation, task action semantics, authentication/session behavior, and persistence. The Mobile app is not part of this prototype and does not inherit its layout.

Before handoff, confirm the criteria in `04-IMPLEMENTATION-ROADMAP.md`: real API data; same supported actions and confirmations; relevant loading/populated/empty/no-results/error/disabled/saving/success states; Romanian/English; 390/768/1280/1440 px; keyboard/focus/status/contrast/reduced-motion review; relevant tests, web typecheck/build, and actual browser/manual evidence. Report any unavailable or blocked evidence explicitly.

**Stop condition:** when `/tasks` prototype work is complete, stop and deliver the standard handoff plus viewport/locale/role evidence. Do not start shared-shell work or change any other web route. Resume web expansion only after the owner explicitly accepts the prototype. If the owner requests revisions, keep the follow-up bounded to `/tasks` and repeat review. Silence is not acceptance.

## 7. Separate Mobile review

Mobile has its own roadmap: source/workflow audit → mobile-specific design brief → owner review of the selected existing screen → one-screen prototype → owner review → remaining screen families. Use the audited mobile screen, role, API, storage/offline and device requirements. Test persistence/sync and relevant device workflows; do not claim emulator/device acceptance unless actually performed. The mobile prototype review gate is separate from W2 and must not be treated as authorization to copy the web layout.

## 8. Final acceptance

The final report includes:

1. The exact changed web routes/mobile screens/files and approved deferrals for every inventoried surface in `03-PAGE-INVENTORY.md`.
2. Actual visual/browser checks for web and actual device/emulator checks for Mobile: role, locale, width/device, environment/version, observed result, and evidence reference. Explicitly list unavailable browser/device checks.
3. Actual test, typecheck, build, i18n, guard, and other relevant command outcomes; distinguish pass/fail/not run/pre-existing failure.
4. Functional regressions exercised and role/project boundaries checked; no claims based only on static code presence.
5. Accessibility issues fixed, still open, and any acceptance exception approved by owner.
6. Outstanding issues, blockers, and limitations; no high-impact item silently omitted.
7. Confirmation that auth/session/refresh behavior, organization/project authorization, APIs, and persistence were preserved—or stop acceptance if this cannot be evidenced.
8. Updated `STATE.md`, significant decisions in `DECISIONS.md`, standard handoff, explicit owner acceptance at W2 before web expansion and M4 before mobile expansion, and final overall owner acceptance.

### Verification record template

| Check | Route/role/locale/viewport | Exact method/command | Result | Evidence / limitation |
|---|---|---|---|---|
| Visual | | | Not run until actually performed | |
| Responsive | | | Not run until actually performed | |
| Keyboard/accessibility | | | Not run until actually performed | |
| Functional/API | | | Not run until actually performed | |
| Tests/typecheck/build | | | Not run until actually performed | |
