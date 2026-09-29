HIIEKO Frontend Product Blueprint

Purpose: Master product and UX specification for the HIIEKO Solar Site Management System frontend.

Scope: Frontend product experience only. Existing backend/database are the working foundation and should be preserved unless a documented frontend requirement cannot be fulfilled by existing APIs.

Working principle: HIIEKO should feel like a professional construction/site operations application, not a collection of database CRUD pages.

1. Product Goal

HIIEKO helps construction teams run a solar PV/BESS project day by day and gives management the right level of control without overwhelming users.

The frontend must show each user what they need for their current responsibility:

Worker: what I need to do today.

Team Leader: what my team needs to do today.

Foreman: what the crews/site need to accomplish today.

Site Manager: how the site is operating today and what needs attention.

Project Manager: how the project is progressing and where intervention is needed.

Manager: portfolio/project health and exceptions.

Admin: organization, users, permissions and system administration.

Do not expose every module equally to every role.

2. Product Experience Model

The main experience areas are:

My Day – personal work and attendance.

My Team – team-level daily execution.

Site Day – site/foreman operations.

Site Control – site manager operational control.

Project Control – PM project management.

Portfolio – management-level overview.

Organization – admin and system administration.

Existing modules such as Tasks, Planning, Teams, Attendance, Inventory, Issues, Reports, Expenses, Projects, Quality, etc. should support these experiences rather than appearing as disconnected primary destinations.

3. Role Experiences

3.1 Worker — My Day

Primary objective: understand today's assigned work immediately.

Primary screen:

Today/date

Current project/site

Today's assigned tasks

Task status

Planned quantity and actual quantity where available

Simple progress indication

Attendance state

Blockers/issues affecting the worker

Important site notices

Worker actions:

Start/stop or record attendance according to existing backend capabilities

Open assigned task

Update allowed task status/progress fields

Report a blocker/issue where permitted

View relevant notifications

Worker should not see project administration, procurement, financial approval, user administration, or unrelated management controls.

Mobile-first is critical.

3.2 Team Leader — My Team

Primary objective: coordinate the assigned team for today.

Primary screen:

Today's team members

Attendance/team presence

Team tasks

Team progress

Assignment/status controls allowed by backend

Blockers

Daily plan context

Relevant team/site notices

The Team Leader should understand who is working, what the team is doing, and what is blocked without navigating through several CRUD pages.

3.3 Foreman — Site Day

Primary objective: manage crews and daily execution.

Primary screen:

Site/project context

Today's plan

Crews/teams

Task progress

Blockers/issues

Workforce visibility

Daily report status

Relevant materials/site information

Foreman is operational, not a portfolio/admin user.

3.4 Site Manager — Site Control

Primary objective: control site execution and intervene where needed.

Primary screen:

Site status summary

Today's plan

Workforce

Planned vs actual progress

Open blockers/issues

Materials/inventory status

Quality/HSE attention items

Daily reports

Upcoming work

Alerts/exceptions

This should be the operational command center for site execution.

3.5 Project Manager — Project Control

Primary objective: control the project after handover and understand whether execution is on track.

Primary screen:

Project health

Overall progress

Milestones/planning

Site status

Risks/issues

Procurement/Avize/financial visibility according to permissions

Reports

Important exceptions requiring action

The PM should not be forced to operate through low-level worker/task screens for normal project oversight.

3.6 Manager — Portfolio

Primary objective: see the state of active projects and exceptions.

Primary screen:

Active projects

Project health/status

Key progress indicators

Site issues/exceptions

Upcoming milestones

Management-level alerts

Do not overload with operational detail by default.

3.7 Admin — Organization

Primary objective: administer the system.

Primary areas:

Users

Roles/permissions

Teams/organization

Projects/configuration

System settings

Administrative records

Admin can access operational areas when permitted, but the default experience should emphasize administration rather than site execution.

4. Navigation Principles

Navigation is role-aware.

The sidebar/header must prioritize the user's main job, not list every API resource.

Recommended high-level navigation pattern:

Worker:

My Day

My Tasks

Notifications

Profile

Team Leader:

My Team

Planning

Tasks

Issues

Notifications

Foreman:

Site Day

Planning

Tasks

Teams

Issues

Daily Reports

Notifications

Site Manager:

Site Control

Planning

Tasks

Workforce/Teams

Issues

Inventory

Quality/HSE

Reports

PM:

Project Control

Planning

Tasks/Progress

Issues/Risks

Procurement/Costs

Reports

Manager:

Portfolio

Projects

Exceptions/Issues

Reports

Admin:

Organization

Projects

Users/Access

Administration

Use existing navigation configuration as the implementation foundation where possible.

5. Common App Shell

The common shell must provide:

Desktop sidebar

Mobile navigation/drawer

Header

Current project/site context

Breadcrumbs where useful

User menu

Notifications access

Consistent page title/subtitle

Main content region

Accessible skip link/focus management

Avoid overly large decorative headers.

The page should establish context within the first viewport.

6. Dashboard Philosophy

Avoid generic dashboards made of many disconnected cards.

Every landing screen should answer:

Where am I?

What matters today?

What do I need to do?

What is blocked or abnormal?

What happens next?

Use progressive disclosure: show the most important information first, then details on demand.

7. Daily Site Operating Model

The frontend should support a coherent site-day lifecycle:

Review today's plan.

Confirm workforce/attendance context.

Execute assigned work.

Update progress.

Record blockers/issues.

Record relevant material/logistics events.

Record quality/HSE events where applicable.

Complete/report the day.

The exact controls shown at each step must respect backend permissions.

8. Planning Model

Planning should not be presented only as a database list.

Users should be able to understand:

date

project/site

planned activities

responsible team/people when supported

status

progress

blockers

what is next

Daily planning views should emphasize today's execution and upcoming work.

Where the backend supports only part of a workflow, do not invent unsupported actions.

9. Task Model

Tasks should be presented as work to be executed, not merely records.

Task UI should clearly group:

Task title/code

Project/site

Work package/zone where available

Planned dates

Planned quantity

Actual quantity

Derived progress when possible

Status

Assignees

Prerequisites/dependents

Use clear status labels and consistent semantic styling.

Do not invent fields such as priority or percentage progress if the backend does not provide them.

10. Issues / Blockers

Issues should be treated as operational exceptions.

The UI should make clear:

what is blocked

where

when

who reported it

status

what action is needed

Where resolution/update APIs do not exist, the frontend must not pretend that resolution is possible.

11. Responsive Design

Mobile is a primary operating context for workers, team leaders and field staff.

Requirements:

touch-friendly controls

no clipped tabs

no horizontal overflow unless intentionally designed

important actions reachable near the main content

readable task cards

compact but legible metadata

sticky/action areas only when useful

modals/dialogs usable on small screens

Desktop should optimize for overview and multi-information work.
Mobile should optimize for execution and quick updates.

12. Visual Design Language

The visual language should communicate:

professional

modern

calm

operational

trustworthy

clear

Avoid:

dashboard clutter

excessive cards

excessive rounded containers

gratuitous gradients

giant empty hero sections

tiny progress indicators

dense tables as the default for field users

generic admin-template appearance

Use the existing HIIEKO design system tokens/components as the starting point and extend them consistently.

13. Status Semantics

Use semantic status treatment consistently across the application:

neutral: informational/planned

info: active/in-progress

warning: attention/blocked/risk

success: completed/healthy/approved

critical: error/escalation/cancelled where appropriate

Do not use color as the only means of communicating status.

14. Internationalization

Romanian and English are required.

Do not hardcode user-facing strings in page components.

Dates, quantities and labels should use locale-aware formatting.

Translations must describe actual HIIEKO concepts and statuses; avoid stale generic placeholders.

15. Accessibility

Every interactive element must be keyboard reachable.

Requirements include:

semantic buttons/links

visible focus states

appropriate labels

accessible dialogs

accessible tabs

accessible expandable task sections

aria-live/status announcements where appropriate

sufficient contrast

no information conveyed by color alone

Do not use clickable divs for primary interactions.

16. Data and Backend Rules

Existing backend is the source of truth for capabilities and permissions.

Frontend must:

use real API contracts

respect backend RoleGuard behavior

avoid fake records

avoid fake status transitions

avoid fake permissions

avoid inventing unsupported fields

Backend/database changes require explicit justification and must not be introduced merely to make a frontend mock easier.

17. Existing Backend Capability Baseline

The existing system already contains capabilities relevant to the frontend including, where authorized:

authentication and role-based access

projects/site context

tasks and task assignment

task status/progress through quantity fields

teams and team membership

daily planning

daily reports

attendance

notifications

issues/blockers

inventory/stock operations

Avize/procurement-related functionality

QA/QC inspections

expenses

project management capabilities

The frontend should reuse these capabilities rather than recreate them.

18. Current Frontend Technical Foundation

Preserve and build on the existing frontend foundations where sound:

AppShell/AuthGuard

role-aware navigation configuration

existing design-system tokens/components

Breadcrumbs

DropdownMenu

responsive sidebar/header

existing API client patterns

existing type-safe frontend API structures

existing role guards

existing i18n infrastructure

Refactor or replace page-level UI where needed to match this blueprint.

19. Implementation Strategy

DO NOT redesign the entire application in one coding task.

Build in vertical slices.

Phase 0 — Product/UX foundation

Confirm blueprint

Audit existing frontend

Identify reusable components

Establish common page patterns

Confirm role navigation

No speculative feature implementation

Phase 1 — Worker: My Day

Build the first complete vertical slice.

The Worker should be able to open the application and immediately understand today's work.

Minimum flow:

Login

My Day

See today's project/site context

See assigned work

Open a task

Update allowed task state/progress

See attendance state

See/report blocker where supported

Return to My Day

Must include real loading, empty and error states.

Phase 2 — Team Leader: My Team

Build team-level daily execution using the same patterns.

Phase 3 — Foreman: Site Day

Build crew/site daily coordination.

Phase 4 — Site Manager: Site Control

Build operational control center.

Phase 5 — PM: Project Control

Build project oversight.

Phase 6 — Manager: Portfolio

Build multi-project overview.

Phase 7 — Admin: Organization

Build administrative experience.

Phase 8 — Integration/Polish

cross-role consistency

navigation cleanup

responsive pass

accessibility pass

i18n pass

visual QA

performance cleanup

20. First Implementation Target

The first implementation target is Worker — My Day.

Before coding it, the developer must inspect the existing worker permissions/API contracts and reuse existing functionality.

The first screen should prioritize today's work rather than generic dashboard statistics.

Recommended structure:

Header/context

date

current project/site

user identity

Today summary

attendance state

number of assigned tasks

active task/progress summary

Today's work

A clear list of assigned tasks, each showing only useful execution information:

task name/code

zone/work package where available

planned dates if useful

quantity/progress if available

status

primary action

Attention

blockers/issues affecting the worker

important notifications

No-work state

Do not tell a Worker they should "create a task" when they have no assigned tasks.
Instead explain that no work is assigned yet and, where appropriate, tell them to contact the Team Leader/Foreman.

Mobile

The task list and primary actions must work comfortably on a phone.

21. Acceptance Criteria for Every Vertical Slice

A slice is not complete merely because the code builds.

It must pass:

Functional

correct role access

real backend data

correct actions

correct status transitions

no fake capabilities

UX

clear hierarchy

obvious primary action

no duplicated controls

useful empty state

useful error state

understandable loading behavior

no accidental content loss after mutation

Visual

desktop inspected

mobile inspected

spacing consistent

typography consistent

semantic status treatment

no clipped/overflowing controls

Accessibility

keyboard-accessible interactions

visible focus

semantic controls

accessible dialogs/tabs/expanders

i18n

Romanian

English

locale-aware dates/numbers

Technical

typecheck passes

relevant tests pass

build passes

no unrelated backend changes

22. Cline Operating Rules

Cline is the implementation agent, not the product owner.

For every task:

Read this blueprint.

Inspect the existing code before changing it.

State exactly what slice is being implemented.

Implement only that slice.

Do not invent product requirements.

Do not continue to later phases automatically.

Do not change backend/database unless explicitly justified.

Verify with build/typecheck/tests.

Browser-check the affected experience.

Report files changed and deviations.

Stop.

The next task is provided only after the previous slice has been visually reviewed.

23. Product Quality Rule

Technical correctness is necessary but not sufficient.

A page is not considered successful simply because:

TypeScript passes

the route returns 200

the API call works

the component renders

The experience must make sense to the person doing the job.

The frontend should feel like one coherent HIIEKO product across all roles.