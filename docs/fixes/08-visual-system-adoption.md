# Visual System Adoption

Priority: Medium
Effort: Large
Session: 1
Estimated time: 90 minutes

## What is wrong

The audit found that the HIIEKO visual system and shared UI primitives are not adopted consistently across all pages. The static audit identified areas requiring review, including raw buttons, mobile table fallbacks, page headings, touch targets, and contrast. Browser-based responsive verification at 375px has not been completed.

## Why it matters

Inconsistent controls and layouts make the application harder to learn and use, especially on phones and field tablets. Small touch targets, poor contrast, or tables that do not adapt to narrow screens can impede field work and accessibility.

## Files involved

- `docs/audit/full-audit-v2.md` — review the existing static design-audit findings.
- `web/src/app/globals.css` — verify existing design tokens and global styles.
- `web/tailwind.config.js` — verify the current theme and breakpoint configuration.
- `web/src/components/ui/` — inspect existing shared UI primitives before replacing or duplicating components.
- `web/src/app/**/page.tsx` — inspect only pages with confirmed visual-system inconsistencies; record exact paths before editing.

## Steps

1. Read `docs/audit/full-audit-v2.md` and verify the current design tokens, component conventions, and relevant page paths. Record actual line numbers after inspecting the current files.
2. Establish a short list of confirmed inconsistencies, referencing the affected route, component, viewport, and expected design-system behavior. Do not treat every raw button or table as automatically defective.
3. Fix the highest-impact inconsistencies using existing shared components and tokens where suitable. Preserve role-specific actions, terminology, data, permissions, and workflows.
4. Verify responsive behavior at desktop, tablet, and a 375px mobile viewport. Check loading, empty, error, and blocked states where relevant. If browser testing is unavailable, document that limitation instead of claiming it passed.
5. Add or update tests for any behavior affected by the UI changes. Run relevant frontend tests and `npm run build --workspace=web`.
6. Review the diff and stage only the verified page/component changes and tests: `git add <reviewed-files>` followed by `git commit -m "fix(ui): improve design system consistency"`.
7. Confirm the intended branch and reviewed diff before pushing. If fixing `master`, use `git push origin master`.

## Acceptance criteria

- [ ] Confirmed design-system inconsistencies are documented by route and component.
- [ ] Existing HIIEKO tokens and shared components are reused where appropriate.
- [ ] Mobile, tablet, and desktop layouts are verified for changed pages.
- [ ] Touch targets, contrast, and narrow-screen table behavior are checked.
- [ ] Role-specific actions, terminology, and workflows remain unchanged.
- [ ] Build passes.
- [ ] Commit pushed.

## Do NOT do

- Do not redesign the application from scratch.
- Do not introduce a second design system or duplicate shared components unnecessarily.
- Do not change API behavior, backend architecture, permissions, or database schema.
- Do not remove role-specific functionality to simplify responsive layouts.
- Do not claim browser verification without actually performing it.
- Do not modify unrelated files or include unrelated existing work in the commit.

## Notes

The audit was primarily static. Prioritize confirmed usability issues and record any responsive or visual checks that cannot be performed in the current environment.
