\# HIIEKO — Phase 1 Functional

\# Route and Role Alignment



Branch: `auth/phase-1-routes-roles`

Time: 2 to 4 hours (2 sessions)



\## What this phase does



Phase 0 gave you real users with real roles.

Phase 1 makes sure the frontend navigation, the frontend route guard,

and the backend authorization all agree on who can see what.



After this phase:



\- Every menu item leads to a page the current role can actually open

\- Every route has exactly one role contract

\- Frontend guards match backend guards

\- /qa vs /qa-qc is resolved

\- /statistici is gone

\- The sidebar does not advertise pages that 403

\- A user never sees "You don't have permission" after clicking a menu

&#x20; item they were shown



\## What this phase is not



Phase 1 is not:



\- A redesign

\- A new feature

\- A backend rewrite

\- A database change



Phase 1 is only: make routes, roles, and permissions agree.



\## The three sources of truth (and why they drift)



Right now, three separate things define what a role can access:



1\. Frontend route contract

&#x20;  File: `web/src/config/route-roles.ts`

&#x20;  This lists every route with its allowed roles.

&#x20;  It also explicitly says: "backend decorators are not its source of truth."



2\. Frontend navigation

&#x20;  File: `web/src/config/navigation.ts`

&#x20;  This lists what appears in the sidebar.

&#x20;  It currently advertises /qa-qc and /statistici, which do not match

&#x20;  route-roles.ts.



3\. Backend authorization

&#x20;  Files: guards, decorators, controllers under `backend/src`

&#x20;  The backend uses `@Roles()` and `@RequireProjectAccess` decorators.

&#x20;  The backend guard is the real authority.



These three drift apart over time. Phase 1 brings them back together.



\## The fix approach



You do NOT have to make all three identical.

You have to make them consistent.



That means:



\- Every route in the sidebar exists as a page

\- Every route in the sidebar is in route-roles.ts with the right roles

\- Every route in route-roles.ts has a matching backend guard

\- The frontend hides menu items the current role cannot access

\- The frontend never shows a menu item that will 403 on click



The backend remains the true authority. The frontend just needs to

stop lying to the user.



\## Step 1 — Resolve /qa vs /qa-qc



The audit found:



\- /qa exists as a full page

\- /qa-qc exists as a wrapper around QualityWorkspace

\- route-roles.ts defines /qa

\- navigation.ts advertises /qa-qc



Decision: /qa is canonical.



What to do:



1\. Open `web/src/app/qa-qc/page.tsx`

2\. Replace its contents with a redirect to `/qa`

&#x20;  Use Next.js `redirect()` from `next/navigation`

3\. Search the whole `web/src` folder for `/qa-qc`

4\. Every hit becomes `/qa`. Fix links, notifications, buttons, cards.

5\. Open `web/src/config/navigation.ts`

6\. Change any entry pointing to /qa-qc so it points to /qa

7\. Open `web/src/config/route-roles.ts`

8\. Confirm /qa is listed with the QA roles

9\. If /qa-qc appears in route-roles.ts, remove it

10\. Commit and push

11\. Open Netlify preview, navigate to /qa-qc, confirm redirect works



\## Step 2 — Remove /statistici



The audit found:



\- /statistici is not a real page

\- It redirects to /control-tower in next.config.js

\- navigation.ts still advertises it



What to do:



1\. Open `web/src/config/navigation.ts`

2\. Remove the /statistici entry

3\. Search the whole `web/src` folder for `/statistici`

4\. Every link becomes /control-tower

5\. Commit and push



\## Step 3 — Orphan route scan



Some routes may exist as folders but not appear in navigation, and some

navigation entries may point to routes that do not exist.



Do a full scan:



1\. List every folder under `web/src/app`

&#x20;  Ignore: api, login, signup, and any internal folder

&#x20;  Every other folder with a `page.tsx` is a real route



2\. List every route in `web/src/config/navigation.ts`



3\. List every route in `web/src/config/route-roles.ts`



4\. Compare all three lists



For each route, decide:



\- In app folder, in navigation, in route-roles: GOOD, no action

\- In app folder, in route-roles, NOT in navigation:

&#x20; This is a hidden page. Either add it to navigation, or accept it as

&#x20; a page reached only from other pages. Document the decision.

\- In app folder, NOT in route-roles:

&#x20; This is a governance gap. Add it to route-roles.ts.

\- In navigation, NOT in app folder:

&#x20; This is a broken menu item. Remove from navigation or create the page.

\- In route-roles, NOT in app folder:

&#x20; This is dead contract. Remove from route-roles.ts.



Do this for every route. Keep a list.



Fix every mismatch. Commit once at the end of the scan.



\## Step 4 — Make the sidebar role-aware



Right now the sidebar probably shows all items and lets the user click

into 403s.



What to do:



1\. Open `web/src/components/Sidebar.tsx`

2\. For each menu item, check the current user's role against

&#x20;  route-roles.ts

3\. If the role is not allowed, do not render that menu item

4\. Do not render it greyed out. Do not render it with a lock icon.

&#x20;  Just hide it.

5\. Apply the same logic to the mobile nav and the hamburger drawer



After this, the sidebar for a worker shows only worker pages.

The sidebar for an admin shows admin pages.

Nobody sees a menu item they cannot open.



\## Step 5 — Verify the backend agrees



The frontend is now consistent with route-roles.ts.

But route-roles.ts is not the backend. The backend is.



Confirm the backend for every route:



1\. Open the backend controller for each route's main resource

&#x20;  Example: /tasks → `backend/src/modules/tasks/tasks.controller.ts`

2\. Check the `@Roles(...)` decorator on the list endpoint

3\. Check that the roles listed match route-roles.ts



If they do not match:



\- The backend is the authority. Change route-roles.ts to match.

\- Do not change the backend in Phase 1. Only align the frontend contract.



Edge cases to check:



\- Admin and Owner are global bypass roles per the audit. Confirm in

&#x20; `backend/src/common/auth/guards/roles.guard.ts`.

&#x20; If so, add them to every route-roles.ts entry.

\- Any route with project-level access (`@RequireProjectAccess`) has a

&#x20; second layer of authorization. route-roles.ts covers the first layer.

&#x20; Document this in a comment.



Do this for every route. Keep a list of mismatches.

Fix route-roles.ts to match the backend. Commit once.



\## Step 6 — Align the middleware guard on the frontend



Right now the frontend guard on each page probably checks route-roles.ts.

That is correct. But it may not check the same way the backend does.



Confirm:



1\. Open the frontend guard (likely `web/src/components/ProtectedRoute.tsx`

&#x20;  or a middleware file)

2\. It reads the current user's role

3\. It checks the route against route-roles.ts

4\. If not allowed, it redirects to a safe page and shows a toast

5\. It does NOT show a 403 error page unless that page is the safest UX

&#x20;  for that route



Recommended behavior:



\- If a user opens a route they cannot access by URL, redirect to their

&#x20; role home and toast "You don't have access to that page."

\- Do not show a bare 403 page. It is a dead end.



Apply this behavior consistently.



\## Step 7 — Document the contract



Create or update a file:

`docs/route-authorization.md`



This file describes:



\- The list of all production routes

\- For each route: allowed roles

\- For each route: which backend controller enforces it

\- The rule: backend is authority, frontend follows



This is not a code change. It is a one-page document.

But it prevents future drift. Six months from now, this page answers

"who can access X?"



Commit the document.



\## Step 8 — Add a CI check (optional but recommended)



The audit mentioned the CI already runs a "frontend guard check."

Confirm what it does.



If it only checks that navigation.ts and route-roles.ts agree, add a

second check:



\- Every route in route-roles.ts exists as a folder in web/src/app

\- Every route in navigation.ts exists in route-roles.ts



If any mismatch, CI fails.



This is a small script in `scripts/` and a step in

`.github/workflows/ci.yml`. Do it if time allows. It prevents this

phase from being needed again.



\## What Phase 1 changes



Files to edit:



1\. `web/src/config/navigation.ts`

&#x20;  - Remove /statistici

&#x20;  - Change /qa-qc to /qa



2\. `web/src/config/route-roles.ts`

&#x20;  - Ensure every real route is listed

&#x20;  - Align roles with backend decorators

&#x20;  - Add Admin and Owner to every entry if they are global bypass



3\. `web/src/components/Sidebar.tsx` (and mobile nav, drawer)

&#x20;  - Filter menu items by current role



4\. `web/src/app/qa-qc/page.tsx`

&#x20;  - Redirect to /qa



5\. `web/src/components/ProtectedRoute.tsx` (or middleware)

&#x20;  - Confirm consistent redirect behavior



6\. `docs/route-authorization.md`

&#x20;  - New document



7\. `.github/workflows/ci.yml` and `scripts/` (optional)

&#x20;  - Add route consistency check



Files NOT to edit in Phase 1:



\- Any backend file except to READ and confirm roles

\- Any page layout or design

\- Any API call



\## How to test Phase 1



Test every item below.



Test 1 — /qa-qc redirect



\- Open /qa-qc in the browser

\- Expect: automatic redirect to /qa

\- Expect: no console errors



Test 2 — /statistici removal



\- Open the app, look at the sidebar

\- Expect: no /statistici entry

\- Try to open /statistici directly

\- Expect: the existing redirect from next.config.js still works



Test 3 — Sidebar filtering per role



\- Log in as a worker

\- Expect: sidebar shows only worker pages

\- Log in as a site manager

\- Expect: sidebar shows manager pages

\- Log in as admin

\- Expect: sidebar shows everything



Test 4 — No 403 from menu clicks



\- Log in as each role in turn

\- Click every visible menu item

\- Expect: every page loads. No 403. No "You don't have permission."



Test 5 — Direct URL 403 handling



\- Log in as a worker

\- Enter /utilizatori in the URL bar

\- Expect: redirect to /planning with toast "You don't have access."

\- Expect: no 403 page shown



Test 6 — Orphan routes



\- Open every route in route-roles.ts as an admin

\- Expect: every route loads

\- Note any that 404



Test 7 — Broken nav links



\- Click every item in the sidebar

\- Expect: no 404 anywhere

\- Note any broken links



Test 8 — Mobile



\- Log in as a worker on mobile

\- Expect: bottom nav shows only worker pages

\- Log in as a manager on mobile

\- Expect: bottom nav shows manager pages

\- Open the hamburger

\- Expect: only allowed items are listed



\## What Phase 1 removes



\- /qa-qc as a separate page (becomes a redirect)

\- /statistici from navigation

\- Sidebar items the current role cannot open

\- Any dead contract in route-roles.ts

\- Any dead link in navigation.ts

\- Any menu item that leads to a 404



\## What Phase 1 adds



\- One canonical QA route

\- Role-aware sidebar and mobile nav

\- A consistent redirect for unauthorized access

\- `docs/route-authorization.md`

\- Optional CI check to prevent future drift



\## How long Phase 1 takes



Roughly 2 to 4 hours.

Split into two sessions if needed.



Session A (1 to 2 hours):



\- Steps 1, 2, 3

\- Commit and test



Session B (1 to 2 hours):



\- Steps 4, 5, 6

\- Steps 7 and 8 optional

\- Commit and test



\## Session execution (on phone)



Setup:



1\. Open Codespaces or OpenCode

2\. Create branch: `auth/phase-1-routes-roles`

3\. Open `web/src/app/qa-qc/page.tsx` first



Order:



1\. Redirect /qa-qc to /qa

2\. Update navigation.ts

3\. Update route-roles.ts

4\. Commit and push

5\. Test the redirect and navigation on Netlify preview

6\. Open Sidebar.tsx, add role filtering

7\. Update mobile nav the same way

8\. Confirm ProtectedRoute behavior

9\. Commit and push

10\. Test every role on phone

11\. Write docs/route-authorization.md

12\. Commit

13\. Optional: add CI check

14\. Open PR

15\. Test on preview

16\. Merge to main



\## Do not do in Phase 1



\- Do not change backend authorization

\- Do not redesign the sidebar

\- Do not add new pages

\- Do not delete pages other than /qa-qc (which becomes a redirect)

\- Do not refactor the layout

\- Do not touch the login flow (that was Phase 0)



Phase 1 is only: make routes, roles, and permissions agree.



\## Done criteria



Phase 1 is done when:



\- /qa-qc redirects to /qa

\- /statistici is removed from navigation

\- Every sidebar item leads to a page the current role can open

\- No menu click produces a 403

\- Every direct URL to a forbidden page redirects cleanly with a toast

\- Every route in navigation exists in route-roles.ts

\- Every route in route-roles.ts matches a folder in web/src/app

\- Every route in route-roles.ts matches the backend's @Roles decorator

\- `docs/route-authorization.md` exists and is accurate

\- All 8 tests pass on desktop and mobile

\- No console errors



When Phase 1 is done, the app's navigation is honest.

Users only see what they can use. Backend and frontend agree.



\## How this connects to Phase 2



Phase 2 wires pages to real APIs. It assumes:



\- Every page has a real authenticated user (Phase 0)

\- Every page has a known role (Phase 1)

\- Every API call will carry a valid JWT



Without Phase 0 and Phase 1, Phase 2 will show "Not authorized" errors

everywhere and be confusing to debug.



Do Phase 0 and Phase 1 first. Then Phase 2.

