\# HIIEKO — Design Phases D0 to D7



This file contains the complete design track for HIIEKO.

Eight phases, executed in order. Each phase is one work session.



Do not skip. Do not reorder. Do not combine sessions.



The goal of D0 through D7 is to make the frontend look and behave

like one finished product instead of two products stitched together.



After D7 is complete, the design track is done and the app looks

finished. The functional track (Phase 0 through Phase 7) comes after.



\---



\## The order



\- D0 — Global design tokens

\- D1 — Login and signup

\- D2 — Empty states

\- D3 — Responsive passes

\- D4 — Migrate Gen 2 pages onto the design system

\- D5 — Resolve duplication

\- D6 — Mobile nav discoverability

\- D7 — Final polish pass



\---



\## How to run each phase



1\. Open Codespaces or OpenCode.

2\. Create a branch named as shown in the phase.

3\. Do the work described.

4\. Commit per file or per logical change.

5\. Push. Open a PR.

6\. Test the Netlify deploy preview on your phone.

7\. Merge to main only if the preview looks right.

8\. Update the progress tracker in 00-master-plan.md.



Do not start the next phase until this one is merged.



\---



\# D0 — GLOBAL DESIGN TOKENS



Branch: `design/d0-tokens`

Time: 1 session (2 to 3 hours)



\## Goal



One color system, one radius, one shadow, one font scale.

Every page inherits the same rules automatically.



D0 is invisible to users. It only changes the rules.



\## Files touched



1\. `web/tailwind.config.js` — colors, radius, shadow, font scale

2\. `web/src/app/globals.css` — semantic tokens, component classes

3\. `web/src/components/ui/index.ts` — verify exports only



\## File 1 — `web/tailwind.config.js`



\### Colors



In `theme.extend.colors`, define only these semantic groups:



\- Brand: keep `hii.500`, `hii.600`, `hii.700`

\- Success: one green

\- Warning: one amber

\- Danger: one red

\- Info: one blue

\- Neutrals: Tailwind `slate` only



Remove every other custom color. No emerald, no gray, no zinc, no stone.



\### Border radius



Only two values beyond Tailwind defaults:

\- `lg` — badges, inputs, small buttons

\- `xl` — cards, modals, panels



Remove any custom radius entry.



\### Box shadow



Only two custom shadows:

\- `hii-shadow-card` — subtle, for cards and panels

\- `hii-shadow-elevated` — stronger, for modals, dropdowns, drawers



Remove every other custom shadow entry.



\### Font size



No custom sizes. Only:

\- `text-2xl` — page title

\- `text-lg` — section title

\- `text-sm` — body

\- `text-xs` — caption



\### Font family



Inter (or your chosen sans-serif) set as `theme.extend.fontFamily.sans`.



\## File 2 — `web/src/app/globals.css`



Define four component classes:



\- `.hii-card` — white, rounded-xl, neutral-200 border, hii-shadow-card,

&#x20; padding p-4 md:p-6

\- `.hii-input` — 40px or 44px height, rounded-lg, neutral-300 border,

&#x20; brand focus ring, danger error border

\- `.hii-section` — section wrapper inside a card

\- `.hii-kpi` — KPI / metric card style



Confirm one global focus-visible outline exists (2px, brand color).



Add semantic badge utilities (success, warning, danger) if the shared

Badge component does not already handle them.



\## File 3 — `web/src/components/ui/index.ts`



Verify exports exist and have variants:



\- Button: primary, secondary, danger, ghost, outline, loading state

\- Card, CardHeader, CardContent, CardFooter

\- Badge: success, warning, danger, info, neutral

\- Skeleton, TableRowSkeleton

\- EmptyState, ErrorState

\- PageHeader

\- ToastProvider, useToast

\- Modal, Drawer

\- LoadingSpinner

\- Tabs

\- ConfirmDialog

\- DropdownMenu

\- Breadcrumbs



If any variant is missing, add it now.



\## Verify D0



\- tailwind.config.js has only the semantic colors

\- No custom radius beyond lg and xl

\- Only two custom shadows

\- No custom font sizes

\- globals.css has all four hii-\* classes and one focus style

\- ui/index.ts exports all 20 components with the right variants

\- Build passes: `npm run build --workspace=web`

\- Netlify preview is visually identical to main



D0 is invisible to users. If the preview changes appearance, something

is wrong — a page was relying on a value you removed. Revert the token

change; fix that page in a later phase.



\## Done criteria



\- All three files committed and pushed

\- Build passes

\- PR merged

\- No visual change in the Netlify preview



\---



\# D1 — LOGIN AND SIGNUP



Branch: `design/d1-login-signup`

Time: 1 session (2 to 3 hours)



\## Goal



Replace the role-preview login screen with a real login form and a real

signup form. Do not wire auth yet — that is Phase 0. Just make the screens

look and feel like production.



\## Files touched



1\. `web/src/app/login/page.tsx` — full rewrite

2\. `web/src/app/signup/page.tsx` — full rewrite

3\. `web/src/components/ui/index.ts` — only if an Input component is missing



\## What to remove from /login



\- The role card grid

\- The preview warning banner

\- The "Login is temporarily disabled" text

\- Any write to `sessionStorage\['hiieko\_role\_preview']`

\- Any reference to preview-admin, preview-owner, preview-worker, etc.



\## /login layout



Desktop (over 1024px):

\- Two-column split

\- Left: brand panel (hii-500 background, white text, logo, tagline)

\- Right: form, max-width 400px, vertically centered



Mobile (under 640px):

\- Single column, full screen

\- Small logo at top

\- Form fills width with 16px padding



Tablet:

\- Centered card, max-width 480px

\- Logo above card



\## /login fields



1\. Email — label above, type=email, autocomplete=email

2\. Password — label above, type=password, autocomplete=current-password,

&#x20;  show/hide toggle

3\. Sign in button — full width, primary, 44px tall on mobile

4\. Forgot password link — right-aligned under password

5\. Sign up link — bottom of form



\## /login states



\- Loading: button shows spinner, inputs disabled

\- Error 401: toast "Wrong email or password", clear password field

\- Error 429: toast "Too many attempts. Wait a minute."

\- Error network: toast "No connection. Check your internet."

\- Validation: field-level errors under inputs

\- Success: no toast needed, redirect to role home



\## /signup layout



Same structure as login.



\## /signup fields



1\. First name + Last name (two columns on sm and above)

2\. Email

3\. Phone (optional, helper text "Used for site notifications")

4\. Requested role (select: Worker, Team Leader, Foreman, Site Manager, Admin)

5\. Password (with strength hint: Weak, Fair, Strong)

6\. Confirm password

7\. Terms checkbox

8\. Create account button



\## /signup states



\- Loading: button spinner, inputs disabled

\- Validation: field-level errors below each input

\- Success: redirect to /login with toast "Account created."

\- Error email exists: field-level error under email



\## Verify D1



\- /login shows only email, password, sign in button, forgot password,

&#x20; sign up link

\- No role cards, no preview banner

\- At 375px, form fits with no horizontal scroll

\- Password show/hide works

\- Empty submit shows field errors

\- /signup matches /login visually

\- No console errors

\- Build passes



\## Done criteria



\- Both pages responsive at 375px, 768px, 1280px

\- Both use shared Input and Button

\- Both have loading, error, validation states

\- Login preview role selector is gone

\- PR merged



\---



\# D2 — EMPTY STATES



Branch: `design/d2-empty-states`

Time: 1 session (2 to 3 hours)



\## Goal



Every list page shows a proper empty state with icon, title, description,

and an action button. No blank screens anywhere.



\## Verify the component first



Confirm `web/src/components/ui/EmptyState.tsx` exists and accepts:

\- icon

\- title

\- description

\- action (button)

\- variant ("default" or "compact")



If it does not exist, create it before starting D2.



\## Pages in scope



\- /

\- /issues

\- /pontaj

\- /rapoarte

\- /avize

\- /stocuri

\- /teams

\- /workforce

\- /santiere

\- /aprobare

\- /documente

\- /notificari

\- /profil (loading and error only, no empty state)



\## The rules for every empty state



1\. Say what is missing, not just "no data"

2\. Say what the user can do

3\. Include an action button when the user can act

4\. Distinguish "nothing exists yet" from "filters returned nothing"

5\. Center vertically in the content area

6\. Do not compete with the page header



\## Page-specific messages



`/`

\- Title: "No projects yet"

\- Description: "Your Control Tower will populate once projects exist."

\- Action: "New project" (if user has permission)



`/issues`

\- Title: "No issues reported"

\- Description: "When a blocker is reported on site, it appears here."

\- Action: "Report issue"



`/pontaj`

\- Title: "No attendance this month"

\- Description: "Attendance records appear here once workers check in."



`/rapoarte`

\- Title: "No daily reports yet"

\- Description: "Reports appear here after team leaders submit them."

\- Action: "New report" (if user can submit)



`/avize`

\- Title: "No delivery notes yet"

\- Description: "Avize appear here when deliveries are recorded."

\- Action: "New aviz"



`/stocuri`

\- Title: "No stock recorded"

\- Description: "Materials appear here once stock is received."

\- Action: "Receive stock"



`/teams`

\- Title: "No teams yet"

\- Description: "Create teams to assign work to groups of workers."

\- Action: "New team"



`/workforce`

\- Title: "No employees yet"

\- Description: "Add employees to assign them to teams and tasks."

\- Action: "Add employee"



`/santiere`

\- Title: "No sites yet"

\- Description: "Sites appear here once projects have a location set."



`/aprobare`

\- Title: "Nothing to approve"

\- Description: "You are all caught up."



`/documente`

\- Title: "No documents yet"

\- Description: "Upload project documents to keep them organized."

\- Action: "Upload document"



`/notificari`

\- Title: "You're all caught up"

\- Description: "New notifications will appear here."



\## Verify D2



\- Every page in the list shows a proper empty state when data is empty

\- Empty states look consistent across pages

\- Page header still visible above the empty state

\- Filters returning nothing show "No matching results" (not "No data exists")

\- No empty state shows during loading

\- No empty state shows when there is data

\- On mobile at 375px, empty states fit without horizontal scroll



\## Done criteria



\- All pages updated

\- One commit per page (easier rollback)

\- PR merged



\---



\# D3 — RESPONSIVE PASSES



Branch: `design/d3-responsive`

Time: 1 session (2 to 3 hours)



\## Goal



Every page that currently breaks on mobile works at 375px without

horizontal scroll.



\## Pages in scope



\- /profil — 0 responsive classes

\- /signup — 0 (partially fixed in D1, verify)

\- /cheltuieli — 3

\- /notificari — 3

\- /qa (route wrapper) — 1

\- /rapoarte/form — 2



\## Universal rules



1\. No horizontal scroll at 375px

2\. Touch targets at least 44px

3\. Page padding p-4 mobile, p-6 desktop

4\. Stack on mobile, split on desktop

5\. Tables become cards on mobile

6\. Filters collapse into a sheet on mobile

7\. Modals fit on screen with scrollable body

8\. Form fields full width on mobile

9\. Text minimum 14px

10\. Primary action thumb-reachable



\## Page-specific fixes



`/profil`

\- Wrap content in p-4 md:p-6

\- Stack fields on mobile, two columns on md

\- Avatar block centered on mobile

\- Save button full width on mobile



`/cheltuieli`

\- Filter bar to a "Filters" sheet on mobile

\- Expense list as cards on mobile

\- New expense form full width on mobile

\- Receipt upload as a large tap target

\- OCR result in a Card



`/notificari`

\- Notification cards larger on mobile

\- Unread indicator: dot or left border, not just color

\- Group headers sticky on scroll

\- Mark all read full width on mobile



`/qa`

\- Confirm child components are responsive

\- Add responsive classes inside InspectionCard if needed

\- Filter row collapses to a sheet

\- Cards single column on mobile



`/rapoarte/form`

\- Sections stack vertically

\- Fields full width on mobile

\- Numeric inputs use inputMode="numeric"

\- Submit button sticky at bottom on mobile



`/signup`

\- Confirm D1 handled it

\- If not, same rules as /profil



\## Mobile test checklist per page



\- \[ ] No horizontal scroll at 375px

\- \[ ] Page title visible without scrolling

\- \[ ] Every button at least 44px

\- \[ ] Every input at least 44px

\- \[ ] Primary action thumb-reachable

\- \[ ] Form fillable with keyboard open

\- \[ ] Modals fit and scroll internally

\- \[ ] Tables have become cards

\- \[ ] Empty state looks right

\- \[ ] Loading state looks right

\- \[ ] Error state looks right



\## Done criteria



\- Every page in scope passes the checklist

\- Tested on a real phone (not just dev tools)

\- One commit per page

\- PR merged



\---



\# D4 — MIGRATE GEN 2 PAGES ONTO THE DESIGN SYSTEM



Branch: `design/d4-migration-a` (then b, then c)

Time: 3 sessions (2 to 3 hours each)



\## Goal



Every page uses only shared components (Button, Card, Badge, Input,

Modal, Tabs, EmptyState, ErrorState, Skeleton). No hand-rolled styles.



\## Pages in scope — Group A (session 1)



1\. /tasks

2\. /rapoarte

3\. /pontaj

4\. /issues

5\. /stocuri



\## Pages in scope — Group B (session 2)



6\. /cheltuieli

7\. /avize

8\. /utilizatori

9\. /teams

10\. /workforce



\## Pages in scope — Group C (session 3)



11\. /documente

12\. /notificari

13\. /aprobare

14\. /santiere

15\. /profil



\## The migration recipe



Apply this to every page, in order.



1\. Open the page. Read it fully. Do not edit yet.

2\. Replace every <button> with <Button variant="...">

3\. Replace every card div with <Card>, <CardHeader>, <CardContent>,

&#x20;  <CardFooter>

4\. Replace every status chip with <Badge variant="...">

5\. Replace every <input> and <select> with the shared Input or .hii-input

6\. Replace every custom modal with <Modal> or <ConfirmDialog>

7\. Replace every custom tab strip with <Tabs>

8\. Replace the page title block with <PageHeader>

9\. Replace full-page spinners with <Skeleton>

10\. Replace error blocks with <ErrorState>

11\. Commit the single page.

12\. Open Netlify preview. Compare to before. Should look almost identical,

&#x20;   only cleaner.



Do not batch multiple pages in one commit.



\## Badge variant mapping



\- Completed, approved, success → variant="success"

\- Pending, waiting, warning → variant="warning"

\- Error, failed, blocked, overdue → variant="danger"

\- Info, neutral → variant="info" or variant="neutral"



\## Page-specific notes



`/tasks`

\- Task status chips → Badge (low=neutral, medium=info, high=warning,

&#x20; critical=danger)

\- Filter buttons → Button variant="outline"

\- Create and Assign modals → Modal



`/rapoarte`

\- Status badges: draft=neutral, submitted=info, approved=success,

&#x20; rejected=danger

\- Approval modal → Modal

\- Reject modal → Modal (needs reason field, not ConfirmDialog)



`/pontaj`

\- Daily and monthly tabs → Tabs component

\- Attendance rows → keep table on desktop, cards on mobile

\- Correction dialog → Modal



`/issues`

\- Severity: low=info, medium=warning, high=danger, critical=danger

&#x20; (with filled dot)

\- Status: open=warning, in\_progress=info, resolved=success, closed=neutral

\- Never color-only. Always icon and text.



`/stocuri`

\- Low stock → Badge variant="danger" with text "Low"

\- Movement type → Badge (receive=success, consume=info, transfer=neutral)

\- Receive, consume, transfer forms → Modal



`/cheltuieli`

\- Category → Badge variant="neutral"

\- Status: pending=warning, approved=success, rejected=danger

\- OCR result → Card with label/value rows



`/avize`

\- Status: pending=warning, received=success, cancelled=neutral



`/utilizatori`

\- Role chips → Badge

\- Status: active=success, inactive=neutral

\- Tabs (users / roles) → Tabs component



`/teams`

\- Delete confirmation → ConfirmDialog

\- Create and edit modals → Modal



`/workforce`

\- Create and edit → Modal

\- Delete → ConfirmDialog

\- Active status → Badge



`/documente`

\- Document rows → Card with file icon, name, size, date

\- Status: current=success, expired=danger, missing=warning

\- Version history → timeline list inside Card



`/notificari`

\- Notification cards → Card with left border for unread

\- Priority: low=neutral, normal=info, high=warning, urgent=danger



`/aprobare`

\- Each approval item → Card

\- Approve → Button variant="primary"

\- Reject → Button variant="danger"



`/santiere`

\- Geofence inputs use inputMode="decimal"

\- Save and cancel → Button



`/profil`

\- Profile card → Card

\- Fields → shared Input with labels above

\- Save → Button variant="primary", full width on mobile



\## Verify D4 per page



\- \[ ] Every button uses Button

\- \[ ] Every card uses Card

\- \[ ] Every badge uses Badge

\- \[ ] Every input uses shared Input or .hii-input

\- \[ ] Every modal uses Modal or ConfirmDialog

\- \[ ] Every tab strip uses Tabs

\- \[ ] Page header uses PageHeader

\- \[ ] Loading uses Skeleton

\- \[ ] Error uses ErrorState

\- \[ ] Empty uses EmptyState

\- \[ ] No raw color classes

\- \[ ] No raw radius classes beyond rounded-lg and rounded-xl

\- \[ ] No raw shadows beyond the two hii shadows

\- \[ ] No font sizes beyond text-2xl, text-lg, text-sm, text-xs

\- \[ ] Page still looks and behaves the same, only cleaner

\- \[ ] Mobile still works at 375px



\## Done criteria



\- All 15 pages migrated

\- Every branch merged to main



\---



\# D5 — RESOLVE DUPLICATION



Branch: `design/d5-duplication`

Time: 1 session (1 to 2 hours)



\## Goal



One QA page. One Control Tower page. No orphans.



\## Pair 1 — /qa vs /qa-qc



Decision: `/qa` is canonical.



Steps:

1\. Open `web/src/app/qa-qc/page.tsx`

2\. Replace contents with a redirect to `/qa`

3\. Search the codebase for `/qa-qc`. Every hit becomes `/qa`.

4\. Update `navigation.ts` if it points to `/qa-qc`

5\. Update `route-roles.ts` to list only `/qa`

6\. Test: /qa-qc redirects to /qa, /qa works



\## Pair 2 — / vs /control-tower



Decision: `/` is the role router. Managers see Control Tower. Workers

see their dashboard.



Steps:

1\. Open `web/src/app/page.tsx`

2\. Confirm the role routing is clear

3\. Add a comment: "/ routes by role. Managers go to Control Tower.

&#x20;  Workers go to their dashboard. Do not add another Control Tower

&#x20;  surface."

4\. Verify navigation has exactly one Control Tower entry

5\. Verify route-roles.ts has / and /control-tower as separate contracts



\## Orphan route scan



1\. List every folder under `web/src/app` with a `page.tsx`

2\. List every route in `navigation.ts`

3\. List every route in `route-roles.ts`

4\. Compare the three lists

5\. For each mismatch:

&#x20;  - In app but not in route-roles → add to route-roles

&#x20;  - In navigation but not in app → remove from navigation or create page

&#x20;  - In route-roles but not in app → remove from route-roles

6\. Fix every mismatch



\## Verify D5



\- /qa-qc redirects cleanly

\- /qa works

\- No console errors

\- No 404s in the sidebar

\- No orphan routes

\- One QA entry, one Control Tower entry in nav



\## Done criteria



\- Duplication resolved

\- Comment added to / page

\- PR merged



\---



\# D6 — MOBILE NAV DISCOVERABILITY



Branch: `design/d6-mobile-nav`

Time: 1 session (1 to 2 hours)



\## Goal



The mobile bottom nav shows the 5 most-used destinations per role.

Everything else is reachable in 2 taps via a "More" sheet.



\## Per-role bottom nav



Worker, Team Leader, Foreman:

\- Home

\- Planning

\- Tasks

\- Pontaj

\- Issues



Site Manager:

\- Home

\- Control Tower

\- Reports

\- Approvals

\- More



Project Manager, Manager, Owner:

\- Home

\- Control Tower

\- Projects

\- Reports

\- More



QA/QC:

\- Home

\- QA

\- Tasks

\- Issues

\- More



Finance:

\- Home

\- Approvals

\- Expenses

\- Reports

\- More



Admin:

\- Home

\- Users

\- Projects

\- Control Tower

\- More



\## The "More" sheet



Opens from the 5th tab. Slides up from the bottom.

Groups destinations by category:



Work: Planning, Tasks, Reports, Attendance

Field: Materials, Documents, Photos

Manage: Projects, Teams, Workforce, Suppliers, Warehouses

Quality: QA/QC, Issues, Approvals

Account: Notifications, Profile, Settings



Show only items the current role can access.



\## Files to change



1\. `web/src/components/MobilePrimaryNav.tsx` — role-aware items

2\. New component or extend Drawer — MoreSheet

3\. `web/src/config/navigation.ts` — category structure if needed



\## Verify D6



Test on a phone for at least 3 roles:



Worker:

\- Pontaj in 1 tap

\- Tasks in 1 tap

\- Reports in 2 taps (More)



Site Manager:

\- Control Tower in 1 tap

\- Approvals in 1 tap

\- QA in 2 taps



Admin:

\- Users in 1 tap

\- Every other page in 2 taps



\## Done criteria



\- Role-aware bottom nav works

\- More sheet opens and closes cleanly

\- No 403 destinations

\- Tested on real phone

\- PR merged



\---



\# D7 — FINAL POLISH PASS



Branch: `design/d7-polish`

Time: 1 session (2 to 3 hours)



\## Goal



Catch every inconsistency the earlier phases missed.



\## The audit pass (do this first — no fixing)



Scan every page under `web/src/app/\*\*` for:



1\. Font sizes: text-xl, text-base, text-\[10px], text-\[11px], text-\[1.75rem]

2\. Radius: rounded (bare), rounded-md, rounded-2xl, rounded-3xl

3\. Shadows: shadow-sm, shadow, shadow-md, shadow-lg, shadow-xl

4\. Colors: bg-emerald, text-emerald, bg-green, text-green, bg-gray,

&#x20;  bg-zinc, bg-stone, raw red and amber

5\. Hand-rolled components: any <button>, div with bg-white border

&#x20;  shadow, span with bg-\*-100 text-\*-700

6\. Mock content: lorem ipsum, sample, demo, coming soon, TODO, FIXME

7\. Button casing: "Save Changes" should be "Save changes"

8\. Date formats: pick one per context (list: DD/MM/YYYY, detail:

&#x20;  "12 May 2026", relative: "3 hours ago")

9\. Number formats: 1,000 not 1000. "1.5 kWp" with space.

10\. Icon sizes: 16, 20, 24, 32, 48 only

11\. Card padding: p-4 md:p-6

12\. Section gaps: consistent (space-y-6 or space-y-8, not mixed)

13\. EmptyState icon size: 48px full, 32px compact

14\. Loading: skeletons on full pages, spinners inline only

15\. Error state: always ErrorState with retry



Keep a list, grouped by page. Fix nothing yet.



\## The fix pass



Fix in this order:



1\. Global text replacements (font, radius, shadow, color) — commit

2\. Component swaps (buttons, cards, badges) — commit

3\. Text and label casing — commit

4\. Date and number formats — commit

5\. Icon sizes — commit

6\. Card padding and section gaps — commit

7\. Empty state consistency — commit

8\. Loading and error state consistency — commit

9\. Removal of mock, TODO, console.log — commit



\## The walkthrough



Open the Netlify preview on your phone.

Log in as worker, then site manager, then admin.

Go through every page in each role.



For each page ask:

\- Does the spacing feel intentional?

\- Same button heights?

\- Same card styles?

\- Same page header?

\- Same font sizes?

\- Same status chips?

\- Same date format within the page?

\- Same empty state style?



Anything "no" goes back on the fix list.



\## Micro-details to unify



\- Nav label capitalization

\- Page title capitalization

\- Button wording consistency

\- Status wording (In progress vs In Progress)

\- Form labels (Email, not E-mail, not email address)

\- Placeholders as examples, not instructions

\- Helper text ("Optional", not "This field is optional")

\- Apostrophes: straight or curly, pick one

\- Ellipsis: three dots or single char, pick one

\- Icon style: all outline, or all filled, not mixed



\## Verify D7



\- No text-xl, text-base, text-\[10px] anywhere

\- No rounded-md, rounded-2xl

\- No shadow-sm, shadow-md

\- No bg-emerald, text-emerald, bg-gray

\- Every date in a list uses the same format

\- Every card uses p-4 md:p-6

\- Every button label is sentence case

\- Every EmptyState uses the same icon size

\- No mock data

\- No console.log in production pages

\- Walkthrough at 3 roles passes



\## Done criteria



\- All checks pass

\- PR merged

\- Design track complete



\---



\# THE DESIGN TRACK IS DONE



After D7 merges, the frontend design is finished.

Not "good enough." Finished.



What you have after D7:



\- One design system used consistently

\- Real login and signup screens

\- Empty states everywhere

\- Mobile responsive at 375px

\- All pages on the shared component system

\- No duplication

\- Role-aware mobile navigation

\- Consistent typography, color, spacing, dates, casing



From here, go to the functional track:



\- 02-phase0-real-login.md

\- 03-phase1-routes-roles.md

\- 04-phase2-wire-apis.md

\- 05-phase3-missing-features.md

\- 06-phase4-execution-loop.md

\- 07-phase5-control-tower.md

\- 08-phase6-hardening.md

\- 09-phase7-sales.md



Design and function are separate. Design is now finished. Function is next.

