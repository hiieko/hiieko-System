\# HIIEKO — Phase 2 Functional

\# Wire Pages to Real APIs



Branch: `functional/phase-2-wire-apis`

Time: 8 to 12 hours (4 to 6 sessions)



\## What this phase does



Phase 0 gave you real users.

Phase 1 gave you honest navigation.



Phase 2 makes every page read and write through the real backend.



After this phase:



\- Every page shows real data from the database

\- Every form submits to the real API

\- No page shows invented, mocked, or hardcoded data

\- Refreshing a page shows the same data every time

\- Data created on one device shows up on another



\## What this phase is not



Phase 2 is not:



\- A design change (that was D0 to D7)

\- A backend change

\- A database change

\- A new feature

\- A performance optimization



Phase 2 is only: replace mock data with real API calls.



\## The problem



The audit found the backend is substantially complete. The frontend

has pages. But many pages either:



\- Show hardcoded sample data

\- Show no data at all (empty because the API is never called)

\- Call the API but ignore the response

\- Call the wrong endpoint

\- Show a spinner forever because the response shape is wrong

\- Show local state changes that never persist



The audit's section 7.3 flagged `ArchitectureAuditWorkspace.tsx` as

containing design-only surfaces. That is fine for a review surface.

But every page under `web/src/app/` that a user can reach in production

must use real data.



\## The rule



Every production page must follow this chain:



```

UI action

&#x20; ↓

apiClient method

&#x20; ↓

NestJS endpoint

&#x20; ↓

Prisma

&#x20; ↓

PostgreSQL

&#x20; ↓

persisted result

&#x20; ↓

back to UI

```



If any link in that chain is missing, the page is not done.



No exceptions. No shortcuts. No "we will wire it later."



\## The pages in scope



Every production page under `web/src/app` EXCEPT:



\- /login (wired in Phase 0)

\- /signup (wired in Phase 0)

\- /qa-qc (now a redirect)



Pages to wire:



1\. /

2\. /control-tower

3\. /projects

4\. /projects/\[id]

5\. /tasks

6\. /planning

7\. /pontaj

8\. /rapoarte

9\. /rapoarte/form

10\. /issues

11\. /qa

12\. /stocuri

13\. /cheltuieli

14\. /documente

15\. /notificari

16\. /utilizatori

17\. /profil

18\. /santiere

19\. /workforce

20\. /teams

21\. /furnizori

22\. /depozite

23\. /avize

24\. /aprobare

25\. /solar-configurator



That is a lot. Do them in the order below. Do not try to do all of them

in one session.



\## The order



Do them in this order. Highest value first.



Group A — Core execution loop (do first)



1\. /tasks

2\. /planning

3\. /pontaj

4\. /rapoarte

5\. /rapoarte/form



Group B — Visibility and oversight



6\. /control-tower

7\. /

8\. /projects

9\. /projects/\[id]

10\. /issues



Group C — Resources



11\. /stocuri

12\. /documente

13\. /teams

14\. /workforce

15\. /santiere



Group D — Admin and finance



16\. /cheltuieli

17\. /aprobare

18\. /utilizatori

19\. /furnizori

20\. /depozite

21\. /avize



Group E — Quality and configuration



22\. /qa

23\. /solar-configurator

24\. /notificari

25\. /profil



\## The wiring recipe



This is the repeatable pattern. Apply it to every page.



\### Step 1 — Read the page



Open the file. Read it fully. Do not edit yet.



Note:



\- Where does data come from right now?

\- Is it an array literal, a useState with a hardcoded initial value,

&#x20; or an API call?

\- What does the page render when the data is empty?

\- What does the page do when the user takes an action (create, edit,

&#x20; delete, submit)?

\- Are those actions currently persisting anywhere?



\### Step 2 — Identify the correct API endpoints



Look at the audit's endpoint list. For this page, find:



\- The list endpoint (GET)

\- The detail endpoint (GET by id)

\- The create endpoint (POST)

\- The update endpoint (PATCH or PUT)

\- The delete endpoint (DELETE)



If the endpoint is unclear, check the backend controller directly:

`backend/src/modules/<resource>/<resource>.controller.ts`



Do not guess. Read the controller.



\### Step 3 — Replace the data source



If the page currently uses local state with hardcoded data:



\- Remove the hardcoded array

\- Add a useEffect that calls the API on mount

\- Add loading state (true while fetching, false when done)

\- Add error state (null or an error message)

\- Store the response in state

\- Render the state as before, but now with real data



If the page already calls the API but the shape is wrong:



\- Log the raw response once (temporarily)

\- Compare against the DTO in the backend

\- Adjust the shape mapping

\- Remove the log



\### Step 4 — Wire every action



For every button, form, and interaction on the page:



\- Button that creates → POST to the create endpoint

\- Button that updates → PATCH to the update endpoint

\- Button that deletes → DELETE to the delete endpoint

\- Form submit → validates, then posts, then on success refreshes the

&#x20; list or navigates



Every action must:



\- Show a loading state while the request is in flight

\- Show a toast on success

\- Show a toast on error

\- Refresh the affected data (or optimistically update with rollback)



\### Step 5 — Handle the four states



Every page must handle:



\- Loading: skeleton (already added in D2, verify)

\- Empty: EmptyState (already added in D2, verify)

\- Error: ErrorState with retry

\- Success: real data



If a page never hits one of these states, the API is probably wrong.



\### Step 6 — Verify no mock data remains



Search the file for:



\- Array literals with objects

\- "sample"

\- "mock"

\- "demo"

\- Hardcoded names, dates, or numbers



Remove every hit. If something needs to be there for design (e.g. an

icon list), it should be constants, not fake data.



\### Step 7 — Test the round trip



On your phone:



1\. Log in as the right role

2\. Open the page

3\. Confirm data loads from the API

4\. Create a new item. Confirm it appears.

5\. Refresh the page. Confirm the item is still there.

6\. Open the same page on a different browser or device. Confirm the

&#x20;  item shows there too.

7\. Edit an item. Confirm the change persists.

8\. Delete an item. Confirm it disappears after refresh.



If any of these fails, the page is not wired.



\### Step 8 — Commit



One page per commit. Not multiple pages per commit.



\## Page-by-page notes



\### 1. /tasks



Endpoints:



\- GET /api/tasks

\- GET /api/tasks/:id

\- POST /api/tasks

\- PATCH /api/tasks/:id

\- POST /api/tasks/:id/assign



What to wire:



\- Task list from GET /api/tasks

\- Filters pass as query params

\- Create modal posts to POST /api/tasks

\- Status change patches PATCH /api/tasks/:id

\- Assign modal posts to POST /api/tasks/:id/assign



Watch for: the create modal likely has a hardcoded empty array. Replace

with real submit handler.



\### 2. /planning



Endpoints:



\- GET /api/daily-plans

\- GET /api/daily-plans/my-tasks

\- POST /api/daily-plans

\- POST /api/daily-plans/:id/publish

\- POST /api/daily-plans/:id/complete

\- POST /api/daily-plans/:id/cancel

\- PATCH /api/daily-plans/tasks/:planTaskId/progress



What to wire:



\- Today's plan from GET /api/daily-plans

\- My tasks from GET /api/daily-plans/my-tasks

\- Publish, complete, cancel actions

\- Progress update on a task



Watch for: progress updates may be local state only. Must persist.



\### 3. /pontaj



Endpoints:



\- GET /api/attendance

\- GET /api/attendance/today

\- GET /api/attendance/my-logs

\- POST /api/attendance/check-in

\- POST /api/attendance/check-out

\- PATCH /api/attendance/:id



What to wire:



\- Today's status from GET /api/attendance/today

\- Check-in button posts to POST /api/attendance/check-in

\- Check-out button posts to POST /api/attendance/check-out

\- History from GET /api/attendance/my-logs

\- Correction dialog patches PATCH /api/attendance/:id



Watch for: geofence. The check-in request may need lat/long.

Confirm the DTO in `backend/src/modules/attendance`.



\### 4. /rapoarte



Endpoints:



\- GET /api/daily-reports

\- GET /api/daily-reports/:id

\- POST /api/daily-reports/:id/submit

\- POST /api/daily-reports/:id/review



What to wire:



\- List from GET /api/daily-reports

\- Detail view from GET /api/daily-reports/:id

\- Submit action

\- Approve and reject actions from review endpoint



\### 5. /rapoarte/form



Endpoints:



\- POST /api/daily-reports

\- PATCH /api/daily-reports/:id (for drafts)



What to wire:



\- Form submit posts to POST /api/daily-reports

\- Draft auto-save patches if the endpoint supports it

\- After submit, redirect to /rapoarte



Watch for: the form may have hardcoded worker lists. Those come from

GET /api/employees or GET /api/teams.



\### 6. /control-tower



Endpoints:



\- GET /api/control-tower/overview

\- GET /api/control-tower/drilldown

\- GET /api/control-tower/red-flags



What to wire:



\- Metrics from overview

\- Project cards from overview

\- Red flags from red-flags

\- Drilldown on click



Watch for: this page may be showing design data. Replace everything.



\### 7. /



Endpoints:



\- Same as /control-tower for managers

\- Different for workers



What to wire:



\- Confirm role routing reads the real role from AuthContext

\- Managers: real overview

\- Workers: real my-tasks, real attendance today



\### 8. /projects



Endpoints:



\- GET /api/projects

\- POST /api/projects



What to wire:



\- List from GET /api/projects

\- Create wizard posts to POST /api/projects

\- Wizard steps must all persist correctly



Watch for: the 7-step wizard may only persist the last step. Confirm

each step's data is included in the create payload.



\### 9. /projects/\[id]



Endpoints:



\- GET /api/projects/:id

\- GET /api/projects/:projectId/members

\- POST /api/projects/:projectId/members

\- PATCH /api/projects/:projectId/members/:userId

\- DELETE /api/projects/:projectId/members/:userId

\- GET /api/projects/:projectId/stages

\- POST /api/projects/:projectId/stages



What to wire:



\- Project detail from GET /api/projects/:id

\- Members tab

\- Stages tab

\- Add, edit, remove member actions

\- Add stage action



\### 10. /issues



Endpoints:



\- GET /api/issues

\- POST /api/issues

\- POST /api/issues/ncrs



What to wire:



\- List from GET /api/issues

\- Create form posts to POST /api/issues

\- Severity and status filters as query params



\### 11. /stocuri



Endpoints:



\- GET /api/inventory/balance

\- GET /api/inventory/movements

\- GET /api/inventory/stock

\- POST /api/inventory/receive

\- POST /api/inventory/consume

\- POST /api/inventory/transfer



What to wire:



\- Balance table from balance

\- Movements tab from movements

\- Receive, consume, transfer forms



\### 12. /documente



Endpoints:



\- GET /api/documents

\- GET /api/documents/:id

\- POST /api/documents

\- POST /api/documents/:id/versions

\- POST /api/upload



What to wire:



\- Document list from GET /api/documents

\- Upload flow: POST /api/upload then POST /api/documents

\- Version upload flow



\### 13. /teams



Endpoints:



\- GET /api/teams

\- GET /api/teams/:id

\- POST /api/teams

\- POST /api/teams/:id/members

\- PATCH /api/teams/:id

\- DELETE /api/teams/:id

\- DELETE /api/teams/:id/members/:userId



What to wire:



\- List, detail, create, edit, delete

\- Add and remove members



\### 14. /workforce



Endpoints:



\- GET /api/employees

\- GET /api/employees/:id

\- POST /api/employees

\- PATCH /api/employees/:id

\- DELETE /api/employees/:id



What to wire:



\- Employee list

\- Create, edit, delete

\- User association



Watch for: this page may show mock employees. Replace.



\### 15. /santiere



Endpoints:



\- GET /api/projects (filtered to those with location)

\- PATCH /api/projects/:id (for geofence changes)



What to wire:



\- Site list from projects with lat/long

\- Geofence edit patches the project



\### 16. /cheltuieli



Endpoints:



\- GET /api/expenses

\- GET /api/expenses/:id

\- POST /api/expenses

\- POST /api/expenses/:id/approve

\- POST /api/ocr/jobs (for receipt OCR)



What to wire:



\- Expense list

\- New expense form

\- Receipt upload triggers OCR

\- OCR result fills the form

\- Approve action



\### 17. /aprobare



Endpoints:



\- GET /api/expenses (filtered to pending)

\- POST /api/expenses/:id/approve

\- GET /api/daily-reports (filtered to pending review)

\- POST /api/daily-reports/:id/review



What to wire:



\- Approval queue from expenses and reports

\- Approve and reject actions



\### 18. /utilizatori



Endpoints:



\- GET /api/users

\- GET /api/users/:id

\- PATCH /api/users/:id/role

\- PATCH /api/users/:id/status

\- GET /api/roles

\- GET /api/permissions



What to wire:



\- User list

\- Role change

\- Status change

\- Roles tab from GET /api/roles



\### 19. /furnizori



Endpoints:



\- GET /api/suppliers

\- GET /api/suppliers/:id

\- POST /api/suppliers



What to wire:



\- Supplier list

\- Create modal



\### 20. /depozite



Endpoints:



\- GET /api/warehouses

\- GET /api/warehouses/:id

\- POST /api/warehouses



What to wire:



\- Warehouse list

\- Create modal



\### 21. /avize



Endpoints:



\- GET /api/procurement/avize

\- GET /api/procurement/avize/:id

\- POST /api/procurement/avize



What to wire:



\- Avize list

\- Create form

\- Receive action updates stock



\### 22. /qa



Endpoints:



\- GET /api/qa-qc/inspections

\- POST /api/qa-qc/inspections



What to wire:



\- Inspection list

\- Create inspection form

\- Checklist submission



\### 23. /solar-configurator



Endpoints:



\- All /api/solar/\* endpoints



What to wire:



\- Design list

\- Design editor save

\- Layout calculation

\- BOM generation



Note: this is a heavy page. Wire only if the endpoints are returning

data correctly. Test each solar endpoint with a REST client first.



\### 24. /notificari



Endpoints:



\- GET /api/notifications

\- POST /api/notifications/:id/read

\- POST /api/notifications/read-all



What to wire:



\- Notification list

\- Mark read

\- Mark all read



\### 25. /profil



Endpoints:



\- GET /api/users/profile

\- PATCH /api/users/profile

\- Change password: check if endpoint exists, else skip



What to wire:



\- Load profile

\- Save profile

\- Change password if endpoint exists



\## What Phase 2 changes



Files edited:



\- Every `page.tsx` under `web/src/app` except login, signup, qa-qc



Common patterns added per page:



\- useEffect that fetches on mount

\- Loading state

\- Error state

\- Real submit handlers

\- Real action handlers

\- Toast on success and error



\## What Phase 2 removes



\- Every hardcoded array of sample data

\- Every mock object

\- Every "coming soon" placeholder

\- Every silently-swallowed API error

\- Every action that only changed local state and never persisted



\## What Phase 2 adds



\- Real API calls on every page

\- Real persistence for every action

\- Proper error handling on every request

\- Proper loading state on every fetch



\## How to test Phase 2



After wiring each page, run this test on your phone:



\### Test 1 — Load



\- Open the page

\- Expect: real data from the backend, not samples

\- Expect: loading skeleton first, then data



\### Test 2 — Empty



\- If the backend has no data for this resource, expect EmptyState

\- Expect: no invented items



\### Test 3 — Error



\- Disconnect the network (airplane mode)

\- Refresh the page

\- Expect: ErrorState with retry button

\- Reconnect and retry

\- Expect: data loads



\### Test 4 — Create



\- Create a new item through the UI

\- Expect: toast on success

\- Expect: the item appears in the list

\- Refresh the page

\- Expect: the item is still there



\### Test 5 — Edit



\- Edit an existing item

\- Expect: toast on success

\- Expect: the change is visible

\- Refresh

\- Expect: the change persists



\### Test 6 — Delete



\- Delete an item

\- Expect: confirmation dialog

\- Expect: toast on success

\- Expect: item disappears

\- Refresh

\- Expect: item still gone



\### Test 7 — Cross-device



\- Open the same page on another browser or device

\- Expect: the same data

\- This proves the data is stored server-side, not in local state



\## Session execution (on phone)



Setup:



1\. Open Codespaces or OpenCode

2\. Create branch: `functional/phase-2-wire-apis`

3\. Open the first page in Group A



Order:



1\. /tasks — read the file, find mock data, wire the list, wire create,

&#x20;  wire status change, wire assign

2\. Commit and push

3\. Open Netlify preview on phone, run all 7 tests for /tasks

4\. Fix what breaks

5\. Move to the next page



Do not batch. One page per commit. One page per test.



At the end of the session:



\- Open PR

\- Test on preview

\- Merge

\- Continue with the next group in the next session



\## Do not do in Phase 2



\- Do not redesign pages

\- Do not add new features

\- Do not change the backend

\- Do not change the database

\- Do not change the design system

\- Do not optimize performance

\- Do not touch Phase 0 or Phase 1 files



Phase 2 is only: wire pages to real APIs.



\## Done criteria



Phase 2 is done when:



\- Every page in scope loads real data

\- Every action persists to the backend

\- Every page shows loading, empty, error, and success states correctly

\- No hardcoded sample data remains anywhere in `web/src/app`

\- No action is local-only

\- Cross-device test passes for every page

\- All 7 tests pass for every page

\- No console errors



\## How long Phase 2 takes



Roughly 8 to 12 hours of focused work.

Split into 4 to 6 sessions.



\- Group A: 2 to 3 hours (the core loop)

\- Group B: 2 to 3 hours

\- Group C: 2 hours

\- Group D: 2 hours

\- Group E: 2 hours



Some pages will be faster. Some slower.

Do not skip the tests. The tests are what prove the page is wired.



\## How this connects to Phase 3



Phase 3 adds missing features:



\- Password reset

\- Photo workflow

\- Backend hosting (if not already live)

\- Production migration



Phase 3 assumes every page is already talking to the backend. If a

page is still mocking, Phase 3 will be confusing because you will not

know whether a bug is in the feature or in the wiring.



Do Phase 2 completely. Then Phase 3.

