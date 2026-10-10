
# D7 — Final Polish Pass (execution command)

This is the D7 execution spec. Read docs/plan/01-design-d0-d7.md
section D7 for background. The list below overrides the raw D7 text
where they disagree (some D7 checks are outdated by earlier phases).

Work on master. No branch. Commit per category. Build before each
commit. Push at the end. No PR.

---

## PHASE 1 — AUDIT ONLY (no fixing)

Scan every page under web/src/app/** for:

1. Font sizes outside: text-2xl, text-lg, text-sm, text-xs
2. Radius outside: rounded-lg, rounded-xl.
   NOTE: rounded-md is ALLOWED. D0 kept it intentionally (custom 0.5rem).
   Do NOT remove rounded-md.
3. Shadows outside: shadow-card, shadow-elevated, hii-shadow-*.
   NOTE: shadow-sm exists in some pages and is allowed if it maps to
   shadow-card. Do not remove blindly.
4. Raw color classes: bg-emerald, text-emerald, bg-green, text-green,
   bg-gray, bg-zinc, bg-stone, raw red-* and amber-* outside the
   semantic tokens
5. Hand-rolled: any <button className="..."> that is not <Button>;
   any div with "bg-white border shadow" that is not <Card>;
   any span with "bg-*-100 text-*-700" that is not <Badge>
6. Mock content: "lorem ipsum", "sample", "demo", "coming soon",
   TODO, FIXME, console.log
7. Button casing: "Save Changes" should be "Save changes"
8. Date formats inconsistent within a page
9. Number formats: "1.5kWp" should be "1.5 kWp"
10. Icon sizes outside: 16, 20, 24, 32, 48
11. Card padding not p-4 md:p-6
12. Section gaps mixed (space-y-4 vs space-y-6 vs space-y-8)
13. EmptyState icon size not matching variant
14. Loading: spinners where Skeleton should be
15. Error: raw alert blocks where ErrorState should be

Keep a list, grouped by page. Fix nothing yet. Report the list.

---

## PHASE 2 — FIX PASS (one commit each)

Fix in this order:

1. Global text replacements (font, radius, shadow, raw color)
2. Component swaps (buttons, cards, badges)
3. Button and label casing
4. Date and number formats
5. Icon sizes
6. Card padding and section gaps
7. EmptyState consistency
8. Loading and error state consistency
9. Remove mock data, TODO, console.log

Commit message pattern: "D7: <category>"

---

## PHASE 3 — CARRY-OVER ITEMS

A. Stale comment in web/src/components/Sidebar.tsx (around lines 59-60)
   The comment claims /control-tower has its own nav entry. D6 added
   one. Check current state — if the comment is now accurate, remove it
   or update it. If it is stale, fix it.
   Commit: "D7: fix stale Control Tower comment in Sidebar"

B. Duplicate Control Tower
   web/src/app/page.tsx (~798 lines) renders Control Tower inline.
   web/src/components/ControlTowerSurface.tsx (~816 lines) is the
   extracted version used by /control-tower.
   - Compare them carefully.
   - If functionally identical: replace the inline block in page.tsx
     with <ControlTowerSurface />, delete the inline code.
   - If they differ: STOP and report differences. Do not merge.
   Commit: "D7: dedupe Control Tower — use ControlTowerSurface in /"

C. Duplicate page header on /stocuri
   Check for two headers:
   - Dark banner "STOCK — Management of materials..."
   - PageHeader "INVENTORY — Stock & Material Movements"
   If both exist, remove one or reword so they do not duplicate.
   Check any other page with a dark banner + PageHeader.
   Commit: "D7: remove duplicate page header on /stocuri"

D. Decorative icons in PageHeader
   /utilizatori, /teams, /workforce use PageHeader with a Users icon.
   These are decorative. Recommendation: remove for consistency.
   Check every page using the PageHeader icon prop.
   Commit: "D7: remove decorative icons from page headers"

E. ToastProvider note — DOCUMENT ONLY, DO NOT FIX
   Every page wraps itself because AppShell does not mount
   ToastProvider. Add this line to the session report:
   "ToastProvider not mounted globally (ISSUE-036). Phase 0 item."

F. Documentation cleanup — DOCUMENT ONLY, DO NOT FIX
   Note in the report:
   - docs/plan/11-post-design-track.md has escaped markdown
     (\#, \---) and double-spaced blank lines.
   - docs/HIIEKO_IMPLEMENTATION_DECISIONS.md has mixed line endings.

---

## PHASE 4 — VERIFY

Build: npm run build --workspace=web

Report:
- Every Phase 1 finding: fixed / deferred / not-fixable
- Every commit made (one line each)
- Anything you could NOT fix and why
- The ToastProvider note from 3E
- The doc notes from 3F

Push: git push origin master

---

## OUT OF SCOPE (do not touch)

- route-roles.ts authorization changes
- navigation.ts role changes
- Any behavior change
- Any new feature
- Any layout redesign
- The NavGuard / route-roles.ts mismatch for /solar-configurator
  (see docs/plan/11-post-design-track.md)