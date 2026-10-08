\# HIIEKO — Phase 5 Functional

\# Control Tower Real Data



Branch: `functional/phase-5-control-tower`

Time: 6 to 8 hours (2 to 3 sessions)



\## What this phase does



Phase 4 proved the execution loop works.

Phase 5 turns that raw activity into management visibility.



The Control Tower is the screen a manager opens every morning to answer

one question: what needs my attention today?



After this phase:



\- Control Tower shows real data from real projects

\- Red flags come from real signals, not hardcoded alerts

\- Drilldown navigates to the actual object

\- Managers see problems before they become crises

\- The screen is exception-driven: quiet when healthy, loud when not



\## What this phase is not



Phase 5 is not:



\- A new backend feature

\- A new database table

\- A design change

\- A wiring pass



Phase 5 is only: make the existing Control Tower endpoints return

meaningful data and the frontend render it clearly.



\## Why this phase matters



Right now, if the Control Tower shows anything, it is either:



\- Design mockup data

\- Basic counts (number of projects, number of tasks)

\- Raw lists that the manager has to read



None of that answers "what needs my attention."



A manager should open the app and immediately see:



\- 3 projects have tasks running late

\- 2 projects have open blockers

\- 4 daily reports are waiting for approval

\- 1 project has missing documents

\- 2 projects have material shortages



That is the Control Tower. Not a dashboard of everything. A cockpit of

what matters.



\## The audit already confirmed the endpoints exist



Backend endpoints, per the audit:



\- GET /api/control-tower/overview

\- GET /api/control-tower/drilldown

\- GET /api/control-tower/red-flags



These exist. The question is: what do they return?



Phase 5 is mostly about making these endpoints return real, meaningful

signals, and making the frontend render them clearly.



\## What the Control Tower must answer



The manager opens the screen. In 5 seconds, they should know:



1\. How many active projects are there?

2\. Which projects are on track?

3\. Which projects are at risk?

4\. Which projects are blocked?

5\. What decisions are waiting for me?

6\. What changed since yesterday?

7\. Which issues are critical?

8\. Which reports are waiting for approval?

9\. Which deadlines are at risk?

10\. Which materials are missing?



If the screen cannot answer all ten, it is not done.



\## The five sections of the Control Tower



Layout, top to bottom:



\- Section 1: Metric row

\- Section 2: Project health cards

\- Section 3: Red flags

\- Section 4: Waiting for me (decisions)

\- Section 5: Activity since yesterday



Every section pulls from real data. No section is decorative.



\### Section 1 — Metric row



Purpose: the 4 to 6 numbers that summarize the state of the business

right now.



Recommended metrics:



1\. Active projects

&#x20;  Count of projects with status "active" or "in progress"



2\. At risk

&#x20;  Count of projects with a health indicator of "at risk"



3\. Blocked

&#x20;  Count of projects with at least one critical open issue or

&#x20;  a blocker that has not been resolved



4\. Waiting approvals

&#x20;  Count of items across the system waiting for this user's approval:

&#x20;  daily reports, expenses, change orders, documents



5\. Late tasks

&#x20;  Count of tasks past their planned\_end date with status not "done"



6\. Missing information

&#x20;  Count of tasks assigned to no one, or projects without a site contact,

&#x20;  or documents required but not uploaded



Each metric card:



\- Big number

\- Label below

\- Small trend indicator (up, down, flat) compared to last week

\- Click to drill down into the list behind the number



Metric card must not be a dead end. Every number has a list behind it.



Data source: GET /api/control-tower/overview



\### Section 2 — Project health cards



Purpose: one card per active project, showing its health.



A project's health is a composite of several signals:



\- Schedule: are milestones on track?

\- Execution: are tasks progressing?

\- Workforce: are people where they should be?

\- Materials: is stock sufficient?

\- Documents: are required docs present?

\- QA/QC: are inspections passing?

\- Blockers: are there open critical issues?



Each of the seven dimensions gets a status:



\- Green: healthy

\- Amber: at risk

\- Red: blocked



The card shows:



\- Project name

\- Client

\- Progress bar (percent complete)

\- Overall health indicator (composite of the seven, weighted)

\- Top 3 dimensions that are amber or red

\- Next milestone and its date

\- Click to open project detail



If a project is fully green, the card should be quiet. Grey border,

small text, no alerts. Only unhealthy projects draw attention.



Data source: GET /api/control-tower/overview returns the list with

health data aggregated server-side. If the endpoint does not currently

return health, add it. See "Backend Work" below.



\### Section 3 — Red flags



Purpose: a prioritized list of things that need attention today.



A red flag is any signal that crosses a threshold:



\- Task 3 days past planned\_end

\- Project milestone within 5 days and progress under 50 percent

\- Critical issue open more than 24 hours

\- Daily report waiting for approval more than 48 hours

\- Material below minimum threshold and no pending order

\- Document required but missing on a project past its start date

\- Worker absent 2 days without an approved leave

\- Inspection failed more than 3 days ago, no corrective action



Each red flag shows:



\- Icon indicating type

\- Short text: what is wrong

\- Link: opens the affected object

\- Time: how long it has been in this state



Order: most urgent first. Critical above warning. Recent above old.



If there are no red flags, show a clear "All clear" message.

That is a strong signal, not an empty state.



Data source: GET /api/control-tower/red-flags



\### Section 4 — Waiting for me



Purpose: the approval and decision queue for the current user.



Show only items that require THIS user's role to act.



For a site manager:



\- Daily reports waiting review

\- Expenses waiting approval

\- Material requests waiting approval



For a project manager:



\- Same as site manager, plus

\- Change orders waiting approval

\- Budget reallocations



For an admin:



\- User role change requests

\- Invitations waiting



Each item:



\- Type icon

\- One-line summary

\- Requester name

\- How long it has been waiting

\- Quick action button: Approve, Review, Open



This section is what makes the Control Tower useful every day.

Even on a quiet day, if nothing else needs attention, "Waiting for me"

does.



Data source: a new endpoint or a combination of existing endpoints.

If it does not exist, add: GET /api/control-tower/waiting-for-me.

Returns items grouped by type. Filtered by the current user's role and

project access.



\### Section 5 — Activity since yesterday



Purpose: what changed while you were not looking.



Show a chronological feed of the last 24 hours of activity across

all projects the user can see:



\- Worker checked in

\- Task started or completed

\- Progress updated

\- Photo uploaded

\- Issue reported or resolved

\- Report submitted or approved

\- Material received

\- Document uploaded

\- Project stage completed



Group by time:



\- Last hour

\- Today

\- Yesterday



Each entry shows: who, what, when, and a link to the object.



This is the "company memory" concept from the original backlog.

It is what makes the Control Tower feel alive.



Data source: GET /api/audit filtered to the last 24 hours, filtered

by project access. Or a dedicated endpoint:

GET /api/control-tower/activity?since=24h.



\## The health calculation



The hardest part of Phase 5 is defining "project health."



Recommended approach:



For each project, compute seven sub-scores:



1\. Schedule

&#x20;  Ratio of milestones on time to total milestones

&#x20;  Green if 100 percent, amber if over 80 percent, red below



2\. Execution

&#x20;  Ratio of tasks completed to tasks planned for this week

&#x20;  Green if over 90 percent, amber if over 70 percent, red below



3\. Workforce

&#x20;  Ratio of expected attendance to actual today

&#x20;  Green if over 90 percent, amber if over 75 percent, red below



4\. Materials

&#x20;  Count of materials below minimum threshold that are needed for

&#x20;  upcoming tasks

&#x20;  Green if zero, amber if 1 to 2, red if 3 or more



5\. Documents

&#x20;  Count of required documents missing or expired

&#x20;  Green if zero, amber if 1 to 2, red if 3 or more



6\. QA/QC

&#x20;  Count of failed inspections with open corrective actions

&#x20;  Green if zero, amber if 1, red if 2 or more



7\. Blockers

&#x20;  Count of critical open issues

&#x20;  Green if zero, amber if 1, red if 2 or more



Overall project health:



\- Red if any sub-score is red

\- Amber if any sub-score is amber, and none red

\- Green only if all seven are green



This is a design choice. You can weight dimensions differently. But

pick one definition, document it in `docs/project-health.md`, and use

it consistently.



Do not let the definition drift between pages.



\## Backend work needed



Most of the data exists in the database. The backend work is:



1\. Extend GET /api/control-tower/overview to return:

&#x20;  - Metric numbers from Section 1

&#x20;  - Project list with health data from Section 2



2\. Confirm GET /api/control-tower/red-flags returns:

&#x20;  - A real list of flags from Section 3

&#x20;  - Not hardcoded alerts

&#x20;  - Filtered by project access for the current user



3\. Add GET /api/control-tower/waiting-for-me

&#x20;  - Returns approval items for the current user's role

&#x20;  - Grouped by type



4\. Add GET /api/control-tower/activity

&#x20;  - Returns the last 24 hours of audit events

&#x20;  - Filtered by project access



5\. Add a project health calculator

&#x20;  - Either as a scheduled job that updates a health field on Project

&#x20;  - Or computed on demand in the control-tower service

&#x20;  - Recommend on-demand for simplicity. If it is slow, cache for 5 min.



The calculator should be a pure function: takes project id, returns

health object. Unit testable. No side effects.



Do not put health calculation logic inside controllers. It belongs in

a service or a shared module.



\## Frontend work needed



The Control Tower page already exists at:



\- `web/src/app/control-tower/page.tsx` (wrapper)

\- `web/src/app/page.tsx` (the / variant for managers)

\- `web/src/components/ControlTowerSurface.tsx` (the main UI)



Update ControlTowerSurface to render the five sections.



For each section:



\- Skeleton while loading

\- Real data when loaded

\- Empty or quiet state when nothing to show

\- Error state with retry



Order matters:



\- Metrics first

\- Project cards second

\- Red flags third

\- Waiting for me fourth

\- Activity fifth



On mobile:



\- Metrics in a horizontal scroll

\- Project cards stacked

\- Red flags at top if there are any critical ones

\- Waiting for me collapsed but prominent

\- Activity collapsed



On desktop:



\- Metrics in a row of 4 to 6

\- Project cards in a grid of 2 or 3 columns

\- Red flags in a side panel or below metrics

\- Waiting for me and Activity side by side or stacked



\## Drilldown behavior



Clicking any metric, project card, or red flag must navigate to the

relevant page, filtered.



Examples:



\- Click "At risk: 3" → /projects?health=at-risk

\- Click a project card → /projects/\[id]

\- Click "Late tasks: 12" → /tasks?overdue=true

\- Click a red flag "Task B-04-12 overdue" → /tasks/\[id]

\- Click "Waiting approvals: 4" → /aprobare



Drilldown endpoints already exist in the backend:

GET /api/control-tower/drilldown



Confirm it returns the correct object or list for each type of click.



If not, either extend it or route the click directly to the filtered

list page. Simpler is better.



\## Performance



The Control Tower runs 4 to 6 queries per load (overview, red flags,

waiting for me, activity, plus aggregation).



For each:



\- Add proper database indexes on the fields used in filters

&#x20; - Task.project\_id and Task.status

&#x20; - Issue.project\_id and Issue.status and Issue.severity

&#x20; - DailyReport.status and DailyReport.project\_id

&#x20; - Attendance.date and Attendance.project\_id

&#x20; - AuditLog.created\_at and AuditLog.project\_id

\- Keep queries scoped by project access from the start

\- Cap activity to last 100 events

\- Cap red flags to top 50

\- Cap project cards to active projects only



The overview endpoint should respond in under 500ms with 50 projects

and 5000 tasks. If not, the indexes are missing or the query is wrong.



Do not optimize prematurely. Measure first. Add indexes only if slow.



\## Caching (optional, later)



If Control Tower is slow with many projects:



\- Cache the overview response per user for 60 seconds

\- Invalidate on any write to a task, issue, report, or project

\- Or compute health once per hour in a scheduled job and store on

&#x20; the Project row



Do not do this in Phase 5. Do it in Phase 6 if performance demands it.



\## What Phase 5 changes



Backend:



\- Extend ControlTowerService with overview aggregation

\- Add health calculation service

\- Add waiting-for-me endpoint

\- Add activity endpoint

\- Add database indexes on hot filter fields



Frontend:



\- Update ControlTowerSurface to render all 5 sections

\- Add drilldown links

\- Add mobile layout for the Control Tower



Docs:



\- `docs/project-health.md` describing the health formula

\- `docs/control-tower.md` describing each section and data source



\## What Phase 5 removes



\- Any hardcoded red flags

\- Any placeholder metrics

\- Any "coming soon" sections in the Control Tower

\- Any health indicator that is not based on real data



\## How to test Phase 5



Precondition: Phase 4 has been run, so there is real activity in the

database.



Test 1 — Overview metrics are real



\- Open Control Tower

\- Note the numbers

\- Open the projects list page

\- Count the projects manually

\- The "Active projects" number must match

\- If not, the overview query is wrong



Test 2 — Project health



\- Pick a project that is clearly healthy

\- Its card should be green

\- Pick a project with a known blocker

\- Its card should be amber or red on the Blockers dimension



Test 3 — Red flags



\- Create a task with planned\_end 5 days in the past

\- Refresh the Control Tower

\- Expect: a red flag "Task X overdue" appears

\- Fix the task (mark done or update the date)

\- Refresh

\- Expect: the flag disappears



Test 4 — Waiting for me



\- Log in as site manager

\- Submit a daily report as a worker

\- Refresh Control Tower as manager

\- Expect: the report appears in "Waiting for me"

\- Approve it

\- Refresh

\- Expect: it disappears from the list



Test 5 — Activity feed



\- As any user, create a task

\- Refresh Control Tower

\- Expect: "Task created by \[user]" appears in Activity

\- Do another action: upload a photo, submit a report

\- Refresh

\- Expect: all appear in chronological order



Test 6 — Drilldown



\- Click a metric number

\- Expect: navigates to a filtered list matching the number

\- Click a project card

\- Expect: navigates to project detail

\- Click a red flag

\- Expect: navigates to the source object



Test 7 — Mobile



\- Open Control Tower on a phone

\- Expect: metrics scroll horizontally, project cards stack,

&#x20; red flags accessible, waiting for me and activity visible

\- Expect: no horizontal scroll

\- Expect: tap targets are at least 44px



Test 8 — Performance



\- With at least 20 projects, 500 tasks, and 2000 audit events,

&#x20; the Control Tower loads in under 2 seconds

\- If not, add indexes and re-test



Test 9 — Role filtering



\- Log in as site manager for project A only

\- Control Tower shows only project A

\- Log in as owner

\- Control Tower shows all projects

\- Confirm role filtering is applied server-side, not client-side



\## Session execution (on phone or laptop)



Phase 5 is best done over 2 to 3 sessions.



Session A — Backend (2 to 3 hours):



1\. Read ControlTowerService

2\. Add or extend the overview aggregation

3\. Add the health calculation service

4\. Add the waiting-for-me endpoint

5\. Add the activity endpoint

6\. Add database indexes via a migration

7\. Commit and test each endpoint with a REST client

&#x20;  (Postman, Insomnia, or curl from Codespaces terminal)



Session B — Frontend sections 1, 2, 3 (2 to 3 hours):



1\. Open ControlTowerSurface.tsx

2\. Add section 1: metric row

3\. Add section 2: project health cards

4\. Add section 3: red flags

5\. Commit

6\. Open Netlify preview, test on phone



Session C — Frontend sections 4, 5 plus drilldown (2 hours):



1\. Add section 4: waiting for me

2\. Add section 5: activity

3\. Add drilldown links

4\. Commit

5\. Full test on phone and desktop

6\. Open PR

7\. Test on preview

8\. Merge to main



Do not attempt all of Phase 5 in one session.

The backend and frontend are each substantial.



\## Do not do in Phase 5



\- Do not add real-time updates (WebSocket). Refresh is fine.

\- Do not add AI-based risk prediction. Simple thresholds first.

\- Do not add charts without a specific decision they support.

\- Do not add a second Control Tower page.

\- Do not touch the design system.

\- Do not redesign the individual project cards. D4 already did that.

\- Do not add new metrics beyond the six listed.



Phase 5 is only: real Control Tower data.



\## Done criteria



Phase 5 is done when:



\- The six metrics are computed from real data

\- Project health is calculated and shown per project

\- Red flags come from real thresholds

\- Waiting for me shows real approval items for the current role

\- Activity shows the last 24 hours of real audit events

\- Every metric and card drills down to the relevant list

\- The screen loads in under 2 seconds with 20 projects

\- Mobile layout works at 375px

\- No mock data anywhere

\- `docs/project-health.md` exists and describes the formula

\- All 9 tests pass



\## How long Phase 5 takes



Roughly 6 to 8 hours of focused work over 2 to 3 sessions.

Backend is the heavier part. Frontend is mostly layout and links.



\## How this connects to Phase 6



Phase 6 is hardening: rate limiting, backups, logging, security audit,

performance.



After Phase 5, the system is feature-complete for the core use case.

Phase 6 makes it safe to run in production with real users at scale.



You can run Phase 5 and Phase 6 in either order, but Phase 5 first

means Phase 6 has more to protect. Recommended: Phase 5, then Phase 6.



\## How this connects to Phase 7



Phase 7 is Sales expansion: lead intake, field sales, negotiation,

contract to project handoff.



That is a new product surface, not a fix. It should only start after

Phases 0 through 6 are done.



Control Tower will eventually extend to show sales pipeline health.

But not in Phase 7. Phase 7 builds the sales module. Extending Control

Tower to show it comes later.

