\# HIIEKO — Phase 4 Functional

\# Execution Loop (Worker Day End to End)



Branch: `functional/phase-4-execution-loop`

Time: 4 to 6 hours (2 sessions)



\## What this phase does



Phases 0 through 3 made the pieces work individually.

Phase 4 makes them work together as one flow.



This is the acceptance test for the whole system.



After this phase, a real worker can:



\- Log in on a phone

\- See today's tasks

\- Check in with geofence validation

\- Update task progress

\- Attach a photo

\- Report a problem

\- Submit a daily report

\- Log out



And a real manager can:



\- Log in on a desktop

\- See the submitted report

\- Review the photos

\- Approve or reject with a comment



If this flow works end to end, HIIEKO is a real product.



\## What this phase is not



Phase 4 is not:



\- A new feature

\- A design change

\- A backend rewrite

\- A migration



Phase 4 is only: prove the entire chain works, and fix whatever breaks.



\## Why this phase matters



Every previous phase built a piece:



\- Phase 0: real login

\- Phase 1: honest navigation

\- Phase 2: real API calls

\- Phase 3: missing features



Phase 4 is where you find out whether the pieces actually fit together.



This is the audit's blocker number 10: "Run a clean end-to-end production

acceptance test."



It is the last thing standing between "the app is mostly done" and

"the app is done."



\## The flow you are testing



This is the exact sequence. Nothing more, nothing less.



\- A. Worker checks in on site

\- B. Worker sees today's tasks

\- C. Worker starts a task

\- D. Worker updates progress

\- E. Worker attaches a photo

\- F. Worker reports a blocker

\- G. Worker submits the daily report

\- H. Manager sees the report

\- I. Manager reviews the report

\- J. Manager approves or rejects

\- K. Manager sees the blocker

\- L. Manager resolves the blocker

\- M. Activity log records everything

\- N. Next morning: worker sees today's new plan



That is the full loop. If all 14 steps work, the app works.



\## Prerequisites



Before starting Phase 4, confirm:



\- Phase 0 is complete: real login works, no preview identities

\- Phase 1 is complete: navigation is role-aware, no dead links

\- Phase 2 is complete: every page reads and writes through the API

\- Phase 3 is complete: backend deployed, DB migrated, photos work

\- You have at least:

&#x20; - One admin user

&#x20; - One worker user

&#x20; - One team leader user

&#x20; - One site manager user

&#x20; - One test project with at least one zone

&#x20; - One team assigned to the project

&#x20; - Two or three tasks in the project

&#x20; - A few materials in stock



If any of these is missing, create it in the admin UI or in seed data

before starting Phase 4.



\## Pre-flight checks



Before testing the flow, verify the environment.



Check 1 — Backend is live



\- Open the Render URL

\- Hit /api/health or the root

\- Expect a response, not a timeout



Check 2 — Frontend points to backend



\- Open Netlify site

\- Open browser dev tools

\- Every API call goes to the Render URL, not localhost



Check 3 — Database is live



\- Create a task in the admin UI

\- Refresh the page

\- The task is still there



Check 4 — Login works



\- Log out of everything

\- Log in fresh with a real account

\- Expect: redirect to role home



Check 5 — Photos work



\- Upload a photo to any task

\- Refresh

\- Photo is still there



If any check fails, fix it before starting the flow test.

Do not test the flow on a broken environment.



\## The flow, step by step



\### Step A — Worker checks in on site



Device: Worker's phone

Role: Worker

Route: /pontaj



Test:



1\. Log in as worker

2\. Expect: redirected to /planning or / (worker home)

3\. Navigate to /pontaj

4\. Expect: "Not checked in" status

5\. Tap check-in button

6\. Expect: browser asks for location permission

7\. Expect: check-in succeeds

8\. Expect: status changes to "Checked in at HH:MM"



What to verify in the backend:



\- Open the manager view

\- Confirm attendance appears for the worker

\- Confirm the geofence is enforced

\- Test by mocking location outside the radius

\- Expect: the check-in is rejected with a clear message



What breaks here:



\- No location permission prompt: geolocation API is not wired

\- Check-in succeeds but does not persist: POST not called or wrong DTO

\- Geofence never rejects: geofence not configured on the project



\### Step B — Worker sees today's tasks



Device: Worker's phone

Route: /planning



Test:



1\. Tap bottom nav, Planning

2\. Expect: "My Work" section shows assigned tasks

3\. Expect: each task shows title, project, zone, planned quantity

4\. Expect: no tasks from other teams

5\. Pull to refresh

6\. Expect: same tasks, no flicker



What breaks here:



\- No tasks shown: GET /api/daily-plans/my-tasks returns empty

&#x20; Check that the daily plan for today was published by the team leader

\- Tasks from other teams shown: filter is missing on the backend

\- Task fields missing: response shape does not match the frontend



\### Step C — Worker starts a task



Device: Worker's phone

Route: /planning or /tasks



Test:



1\. Tap a task

2\. Expect: task detail opens

3\. Change status from "Not started" to "In progress"

4\. Expect: toast "Task updated"

5\. Expect: status badge changes

6\. Go back to the list

7\. Expect: the task shows "In progress"



What breaks here:



\- Status does not persist: PATCH /api/tasks/:id not called or wrong body

\- Optimistic UI shows change but refresh reverts it: persistence is fake

\- Wrong status options shown for this role: roles and statuses are mixed



\### Step D — Worker updates progress



Device: Worker's phone

Route: task detail



Test:



1\. Open the same task

2\. Find the progress or quantity field

3\. Update actual quantity from 0 to 15

4\. Save

5\. Expect: toast "Progress updated"

6\. Refresh

7\. Expect: 15 persists



What breaks here:



\- Quantity field is read-only: input not enabled for worker role

\- Save updates local state but not backend: PATCH not called

\- After refresh, value reverts: endpoint not writing to DB

\- Quantity exceeds planned: no validation, expect a warning or block



\### Step E — Worker attaches a photo



Device: Worker's phone

Route: task detail



Test:



1\. Scroll to Photos section

2\. Tap "Add photo"

3\. Expect: camera or file picker opens

4\. Take a photo or select one

5\. Expect: upload progress

6\. Expect: thumbnail appears

7\. Refresh

8\. Expect: photo still there

9\. Open same task on desktop

10\. Expect: photo visible from desktop too



What breaks here:



\- Camera does not open: input accept and capture attributes missing

\- Upload fails silently: POST /api/upload error not surfaced

\- Photo uploads but does not link to task: POST /api/attachments missing

\- Photo shows in one place but not another: attachment target\_id wrong



\### Step F — Worker reports a blocker



Device: Worker's phone

Route: task detail or /issues



Test:



1\. Tap "Report problem" or "Add issue"

2\. Fill: title, description, severity

3\. Attach a photo

4\. Submit

5\. Expect: toast "Issue reported"

6\. Expect: issue appears in /issues list

7\. Go to the project detail page

8\. Expect: the issue is listed under Issues tab



What breaks here:



\- Issue created but not linked to task: target\_id is missing

\- Issue created but not visible in project: project\_id not set

\- Severity levels inconsistent with backend enums



\### Step G — Worker submits daily report



Device: Worker's phone

Route: /rapoarte/form



Test:



1\. Navigate to new report

2\. Expect: form pre-fills date and team

3\. Select project

4\. Add workers present (with hours)

5\. Add tasks worked on (with quantities)

6\. Add materials used

7\. Add notes

8\. Add photos

9\. Submit

10\. Expect: toast "Report submitted"

11\. Expect: redirected to /rapoarte

12\. Expect: the report shows in the list with status "Submitted"



What breaks here:



\- Date or team not pre-filled: form state not initialized from context

\- Worker hours not saving: field name mismatch with DTO

\- Submit fails with validation error: required fields missing

\- Report saved as draft only: submit endpoint not called

\- Report shows as Approved: wrong default status



\### Step H — Manager sees the report



Device: Manager's desktop or phone

Role: Site manager or project manager

Route: /rapoarte



Test:



1\. Log out worker

2\. Log in as site manager

3\. Navigate to /rapoarte

4\. Expect: the report just submitted is at the top

5\. Expect: status badge shows "Submitted"

6\. Filter by "Needs my approval"

7\. Expect: the report shows



What breaks here:



\- Report not visible: project access guard blocking the manager

\- Report visible but status wrong: submit did not transition the state

\- Filter does not work: query param not passed



\### Step I — Manager reviews the report



Device: Manager's desktop

Route: /rapoarte/\[id]



Test:



1\. Open the report

2\. Expect: full detail shown

3\. Expect: workers list, tasks list, materials list

4\. Expect: photos displayed

5\. Expect: notes shown

6\. Expect: Approve and Reject buttons visible

7\. Add a comment

8\. Approve



What breaks here:



\- Photos do not display: attachment query not filtered by report id

\- Comment field missing: reviewer notes not in DTO

\- Approve button disabled: role check wrong



\### Step J — Manager approves or rejects



Same route as step I.



Test:



1\. Tap Approve

2\. Expect: confirmation dialog

3\. Confirm

4\. Expect: toast "Report approved"

5\. Expect: status badge changes to "Approved"

6\. Refresh

7\. Expect: still Approved

8\. Open the report

9\. Expect: reviewer name and timestamp shown

10\. Repeat with Reject on another report

11\. Expect: reject requires a reason



What breaks here:



\- Approve does nothing: POST /api/daily-reports/:id/review not called

\- Approve works but status reverts: backend not writing status change

\- Reviewer name missing: user relation not included in response

\- Reject allows empty comment: validation missing



\### Step K — Manager sees the blocker



Device: Manager's desktop

Route: /issues



Test:



1\. Navigate to /issues

2\. Expect: the blocker reported in step F appears

3\. Expect: severity badge shows correctly

4\. Expect: link to the source task or report

5\. Expect: reporter name shown



What breaks here:



\- Issue not visible: project access filter excludes the manager

\- Severity wrong: mapping between frontend and backend broken

\- Link dead: source id not stored



\### Step L — Manager resolves the blocker



Same route as step K.



Test:



1\. Open the issue

2\. Change status to "In progress" or "Resolved"

3\. Add a resolution note

4\. Save

5\. Expect: toast "Issue updated"

6\. Refresh

7\. Expect: status persisted

8\. Worker opens the same issue

9\. Expect: worker sees the resolution



What breaks here:



\- Status change does not persist: PATCH missing

\- Resolution note not saved: field not in DTO

\- Worker cannot see update: notifications not sent



\### Step M — Activity log records everything



Device: Manager's desktop or admin

Route: /projects/\[id], Activity tab, or /audit



Test:



1\. Open the project

2\. Go to Activity tab

3\. Expect: events listed in chronological order:

&#x20;  - Worker checked in

&#x20;  - Task started

&#x20;  - Progress updated

&#x20;  - Photo uploaded

&#x20;  - Issue reported

&#x20;  - Daily report submitted

&#x20;  - Daily report approved

&#x20;  - Issue resolved

4\. Each event shows: who, what, when

5\. Click an event

6\. Expect: navigates to the affected object



What breaks here:



\- Activity empty: AuditLog not being written

\- Only some events recorded: not all controllers write to audit

\- Timestamps wrong: timezone handling

\- Actor missing: user id not attached to audit entries



\### Step N — Next morning: worker sees new plan



Device: Worker's phone

Time: next day, or simulate by changing the date on the daily plan



Test:



1\. Log in as worker

2\. Navigate to /planning

3\. Expect: today's plan for the new day

4\. Expect: no yesterday tasks

5\. Expect: new tasks if assigned



What breaks here:



\- Yesterday's tasks still shown: date filter missing

\- No tasks for today: team leader did not publish

\- Wrong tasks: assignment query not filtered by team



\## What Phase 4 changes



Phase 4 is primarily a testing phase. It may not change any files

at all if everything works.



But it will almost certainly surface bugs. When it does:



\- Fix the bug in the relevant file

\- Add a small regression test if the codebase has tests

\- Re-run the step

\- Move on



Files that may be edited:



\- Any controller with a missing or wrong endpoint

\- Any page with a wiring bug

\- Any service with a missing business rule

\- Any DTO with a validation gap



Do not redesign. Do not refactor. Fix the specific bug and move on.



\## How to run Phase 4



Phase 4 is a series of tests, not a coding session.



Setup:



1\. Two devices or one device plus one browser:

&#x20;  - Device 1: phone (worker)

&#x20;  - Device 2: desktop (manager)

2\. A quiet environment where you can walk around if testing geofence

3\. A notes app to record every failure



Order:



1\. Pre-flight checks

2\. Steps A through G on the worker device

3\. Steps H through M on the manager device

4\. Step N the next day or by resetting the date



For each step:



\- Perform the action

\- Check the expected outcome

\- If it fails, note:

&#x20; - Step letter

&#x20; - What was expected

&#x20; - What happened

&#x20; - Any error message

&#x20; - Any console output

\- Continue to the next step even if this one failed

&#x20; (you want the full list of bugs before you start fixing)



After completing all steps:



\- Compile the failure list

\- Sort by severity: blocker, major, minor

\- Fix blockers first, one at a time

\- Re-run the full flow after each fix



Only when the entire flow passes without failures is Phase 4 done.



\## Common problems you will hit



Problem 1 — Timezone mismatch

The frontend displays a different date than the backend stores.

Fix: standardize on the company timezone (COMPANY\_TZ env var).

Every date shown to a user goes through one formatting helper.



Problem 2 — Status enums drift

Frontend uses "in\_progress", backend uses "IN\_PROGRESS".

Fix: one shared enum in shared/src/types. Import it everywhere.



Problem 3 — Project access blocks the manager

The manager is not a project member, so project guards reject them.

Fix: managers and admins should bypass project access. Confirm in

roles.guard.ts.



Problem 4 — Photo upload succeeds but attachment fails

Two separate API calls. If the second fails, the photo is orphaned.

Fix: either an endpoint that does both, or a retry, or a cleanup job.



Problem 5 — Optimistic UI lies

The UI shows success before the request completes. If the request

fails, the UI stays wrong.

Fix: either wait for the server response, or roll back on error.



Problem 6 — Toast never fires

The toast provider is not wrapped around the page.

Fix: wrap the layout, not the individual page.



Problem 7 — Refresh loses state

The page reads from local component state, not from URL params.

Fix: put filters and selections in the URL. They survive refresh.



Problem 8 — Offline queue missing

Worker loses connectivity. Actions fail silently.

Fix: queue writes in local storage, retry when online. For Phase 4,

at minimum show a clear "Offline, retry" message instead of a silent

failure.



\## What Phase 4 removes



\- Any "it works on my machine" assumption

\- Any "we will test later" assumption

\- Any "the backend is probably fine" assumption



Nothing is real until it works across devices, with real users, on

real data.



\## What Phase 4 adds



\- A passed acceptance test

\- A list of bugs that were found and fixed

\- Confidence that the system works end to end



\## Session execution (on phone)



Phase 4 is best done over 2 sessions.



Session A — Worker flow (2 to 3 hours):



1\. Run pre-flight checks

2\. Do steps A through G on the phone

3\. Record every failure



Session B — Manager flow and activity (2 hours):



1\. Do steps H through M on desktop

2\. Do step N (or simulate the next day)

3\. Compile the full failure list

4\. Fix blockers

5\. Re-run failed steps

6\. Open PR

7\. Test on preview

8\. Merge any fixes to main



\## Do not do in Phase 4



\- Do not add new features

\- Do not redesign any page

\- Do not refactor working code

\- Do not change the database schema unless required by a bug fix

\- Do not skip steps because "they probably work"



Phase 4 is only: run the flow, fix the bugs, prove it works.



\## Done criteria



Phase 4 is done when:



\- Every step A through N passes on real devices with real users

\- No step requires a workaround

\- No step leaves the system in an inconsistent state

\- A second run of the whole flow passes without new failures

\- Any bug found along the way has been fixed and the fix is merged

\- The activity log records every event

\- Cross-device consistency holds: what a worker sees is what a

&#x20; manager sees



When Phase 4 is done, HIIEKO works. Not "probably works." Works.



\## How long Phase 4 takes



Roughly 4 to 6 hours of testing plus fix time.



If the previous phases were done well, most steps pass on the first try.

If they were not, expect the full day and multiple iterations.



The time is unpredictable because it depends on how many bugs the flow

surfaces. That is the point of Phase 4: to find the bugs now, in a

controlled way, instead of in production.



\## How this connects to Phase 5



Phase 5 is Control Tower with real data.



After Phase 4, every project has real activity. The Control Tower can

now aggregate real signals:



\- Which projects are behind

\- Which have open blockers

\- Which have late reports

\- Which have missing documents



Without Phase 4, Control Tower has nothing to show.



Do Phase 4. Then Phase 5.



\## After Phase 4, the app is usable



If Phase 4 passes:



\- A worker can do a full day's work in the app

\- A manager can review and approve

\- The activity log records history

\- The data persists

\- The system is trustworthy



The remaining phases (5, 6, 7) make it better, safer, and more complete.

But after Phase 4, HIIEKO is no longer a prototype.



It is a product.

