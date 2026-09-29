# HIIEKO FRONTEND MASTER SPECIFICATION
## Product, UX, UI, Roles, Workflows, Components and Implementation Contract

**Product:** HIIEKO Solar Site Management System  
**Company:** Hiieko Romania SRL  
**Languages:** Romanian (RO) and English (EN)  
**Frontend:** Existing HIIEKO Next.js + React + TypeScript + Tailwind frontend  
**Backend:** Existing NestJS + Prisma + PostgreSQL backend — preserve it.  

> **This is the master frontend contract.** Any AI coding assistant receiving this file must treat it as the product specification, inspect the existing repository and backend contracts, and implement the frontend against the existing system. Do not invent backend capabilities merely to satisfy the UI.

---

# 1. PRODUCT PURPOSE

HIIEKO is the digital site office for a Romanian industrial solar PV/BESS construction company.

It connects:

**Project → Site → Plan → People → Tasks → Materials → Quality/HSE → Issues → Reports → Control**

The frontend must make this chain understandable without exposing the database structure.

The core promise is:

> **Everyone sees the information they need for the work they are responsible for today.**

HIIEKO must feel like professional construction operations software: calm, industrial, reliable, fast to understand, role-specific and operational.

It must NOT feel like:

- a generic SaaS admin template;
- a spreadsheet with buttons;
- an accounting application;
- an AI dashboard;
- a collection of unrelated CRUD pages.

---

# 2. MOST IMPORTANT IMPLEMENTATION RULE

Do **not** build the frontend page-by-page from database tables.

Build it around real employee workflows.

The primary experiences are:

1. **My Day** — personal execution;
2. **Team Day** — team coordination;
3. **Site Day** — field coordination;
4. **Site Control** — site management;
5. **Project Control** — project management;
6. **Portfolio** — management;
7. **Organization** — administration.

The same backend modules can support these experiences, but users must not see every module.

---

# 3. ROLE EXPERIENCE MODEL

## WORKER — My Day
Primary question:

> What do I need to do today?

Home must show only what the worker needs:

- today/date;
- current project/site;
- attendance state;
- today's assigned tasks;
- task progress;
- relevant site notices;
- own blockers/issues;
- notifications.

Worker actions:

- check in;
- check out;
- open assigned task;
- update supported task status/progress;
- report blocker/problem;
- view notifications;
- profile.

Do not expose finance, organization administration, procurement, portfolio controls, other employees' private data, or complex project controls.

## TEAM LEADER — My Team
Primary question:

> What is my team doing today?

Show:

- team;
- today's plan;
- members;
- team tasks;
- progress;
- attendance where authorized;
- blockers;
- daily report;
- relevant notifications.

## FOREMAN — Site Day
Primary question:

> What is happening across my work areas today?

Show:

- project/site;
- today's plan;
- crews;
- work areas/zones;
- task progress;
- blockers;
- workforce summary;
- material warnings where relevant;
- reports.

## SITE MANAGER — Site Control
Primary question:

> Is the site under control today?

Priority order:

1. critical blockers;
2. today's plan status;
3. workforce;
4. task progress;
5. material readiness;
6. quality/HSE alerts;
7. daily reporting;
8. recent activity.

## PM — Project Control
Primary question:

> Is the project progressing according to plan?

Show:

- project status;
- schedule/planning status;
- milestones where supported;
- execution progress;
- workforce;
- issues;
- quality/HSE;
- materials/procurement signals;
- reports;
- cost information where supported.

## MANAGER — Portfolio
Primary question:

> Which projects need attention?

Show projects with:

- name;
- location;
- capacity;
- status;
- progress;
- schedule signal;
- critical blockers;
- workforce signal;
- financial signal where supported;
- last activity.

Management sees exceptions first.

## ADMIN — Organization
Primary question:

> Is the organization and system configured correctly?

Admin can access:

- users;
- roles;
- projects;
- teams;
- organization settings;
- operational modules as authorized;
- notifications;
- administration.

Specialist roles such as SITE_LOGISTICS, PROCUREMENT, FINANCE, QA_QC and TECHNICIAN receive specialist workflows rather than an admin clone.

---

# 4. INFORMATION ARCHITECTURE

Use role-aware navigation. Never expose all modules to every role.

## WORK

- My Day / Team Day / Site Day / appropriate role home
- Tasks
- Planning

## SITE

- Issues & Blockers
- Attendance
- Materials / Stock
- Daily Reports
- Quality / HSE

## PROJECT

- Project / Projects
- Project Control
- Reports
- Costs / Expenses

## CONTROL

- Portfolio
- Notifications

## ADMINISTRATION

- Users
- Teams
- Organization
- Settings

The actual sidebar must be derived from real role authorization.

A worker should normally have about 4–6 useful destinations, not 20.

---

# 5. GLOBAL APP SHELL

Desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ HIIEKO │ Project/Site │ Breadcrumb │ Notifications │ User   │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│ Role-aware   │ Page header                                   │
│ sidebar      │                                               │
│              │ Main content                                  │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

Mobile:

- compact header;
- visible project/site context;
- drawer navigation;
- touch-friendly controls;
- no accidental horizontal overflow;
- sticky primary action where useful.

The existing AppShell, Sidebar, Header and shared UI components should be reused/refactored rather than replaced blindly.

---

# 6. PROJECT/SITE CONTEXT

Project context is global state.

Every project-sensitive screen must make the current project obvious.

Example:

**Parc Solar Cluj**  
Cluj County · 12.4 MWp

Do not show only “Project 1”.

When the project changes, refresh all project-scoped information.

Never silently mix:

- global information;
- project information;
- site information;
- user information;
- team information.

Every page should have an explicit scope.

---

# 7. VISUAL DIRECTION

## HIIEKO character

The product should communicate:

- engineering;
- reliability;
- industrial execution;
- safety;
- clarity;
- accountability;
- professionalism.

It should NOT communicate:

- consumer app;
- gaming;
- flashy startup;
- generic AI product;
- decorative analytics.

## Construction-software reference

OpenConstructionERP is a **pattern reference only**. Its useful ideas include:

- project-centric context;
- modular construction workflows;
- dense but readable information;
- planning/task relationships;
- project dashboards;
- drill-down from management views to records;
- responsive construction-oriented layouts.

Do NOT copy its source code, exact CSS, assets, logo, text, screenshots or visual identity. Reimplement useful patterns in HIIEKO's own visual language.

The current HIIEKO frontend already has an `hii-*` green palette and semantic aliases. Preserve and consolidate that system rather than inventing a second brand palette.

---

# 8. COLOR SYSTEM

Use semantic tokens, not random hardcoded colors.

Primary brand:

- `hii-600` — primary action;
- `hii-500` — supporting brand tone;
- `hii-700` — strong/hover brand;
- `hii-50` / `hii-100` — subtle brand surfaces.

The exact hex values must come from the repository Tailwind configuration. Do not invent new HIIEKO hex values if the repository already defines them.

Semantic aliases:

- `surface`
- `content`
- `border`
- `success`
- `warning`
- `critical`
- `info`
- `neutral`

Status must never be communicated by color alone. Use text and/or icons as well.

---

# 9. TYPOGRAPHY AND SPACING

Use the existing repository typography stack.

Rules:

- page titles are strong but not enormous;
- section titles are clear and compact;
- body text is highly readable;
- metadata is muted;
- important numbers are visually aligned;
- page spacing is consistent;
- cards have comfortable but not excessive padding.

Avoid huge marketing headings inside operational pages.

Recommended rhythm:

- page padding: comfortable desktop, reduced mobile;
- section gaps: approximately 24–32px;
- card padding: approximately 16–24px;
- compact gaps: 8–12px.

---

# 10. COMPONENT LANGUAGE

Build and reuse a coherent component system:

- AppShell
- Sidebar
- Header
- Breadcrumbs
- ProjectSwitcher
- PageHeader
- SectionHeader
- Button
- IconButton
- Badge
- StatusBadge
- Card
- Metric
- DataTable
- List
- TaskCard
- TaskStatus
- ProgressBar
- Avatar
- UserChip
- EmptyState
- ErrorState
- LoadingSkeleton
- Modal
- Drawer
- DropdownMenu
- Tabs
- FilterBar
- DatePicker
- Select
- TextInput
- Textarea
- Checkbox
- Toast
- ConfirmDialog
- Timeline
- ActivityItem

Do not create multiple visually different versions of the same component.

---

# 11. BUTTONS

Primary:

- solid HIIEKO green;
- concise verb;
- only one primary action per major section.

Examples:

- Planifică
- Salvează
- Publică
- Check-in
- Check-out
- Raportează problema
- Actualizează
- Adaugă task

Secondary:

- outline/neutral.

Tertiary:

- ghost/text.

Danger:

- critical semantic color;
- confirmation for destructive/irreversible actions.

Icon-only controls must have accessible names.

Do not make every button primary.

---

# 12. CARDS, TABLES AND DENSITY

Cards are for grouping information or surfacing a decision. Do not put every field inside a card.

Tables are for management/admin information. Field users should usually get cards/lists.

Do not duplicate filters or status tabs.

Density varies by role:

- Worker: low;
- Team Leader/Foreman: medium;
- Site Manager/PM: medium-high;
- Admin/Finance/Procurement: high where appropriate.

---

# 13. FORMS, MODALS AND DRAWERS

Forms:

- visible labels;
- correct input types;
- concise groups;
- inline validation;
- preserve values on error;
- human-readable server errors.

Use a modal for a focused short action.
Use a drawer for inspecting details while keeping the list visible.
Use a page for complex workflows.

Never put a complex workflow into a tiny modal merely because a modal is easy to implement.

Modal structure:

1. title;
2. one-sentence purpose;
3. fields;
4. validation/error area;
5. cancel;
6. primary action.

---

# 14. STATUS SYSTEM

Canonical task statuses:

- `PLANNED`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`
- `VERIFIED`
- `CANCELLED`

Display them as human-readable RO/EN labels.

Do NOT invent `TODO`, `DONE`, `REVIEW` or other replacements.

Suggested display:

| Backend | English | Romanian |
|---|---|---|
| PLANNED | Planned | Planificat |
| READY | Ready | Pregătit |
| IN_PROGRESS | In progress | În lucru |
| BLOCKED | Blocked | Blocat |
| COMPLETED | Completed | Finalizat |
| VERIFIED | Verified | Verificat |
| CANCELLED | Cancelled | Anulat |

---

# 15. TASK EXPERIENCE

Tasks answer:

- What?
- Where?
- Which project?
- Who?
- When?
- How much?
- What status?
- What blocks it?
- What depends on it?

## Task list

Default hierarchy:

1. title;
2. status;
3. project/site/work area;
4. assignee/team;
5. planned date;
6. progress;
7. quantity where applicable.

## Task card

```text
[STATUS] TASK CODE

Install mounting structure
Parc Solar Cluj · Zone A

Assigned to: Ion Popescu
Today · 08:00–16:00

Progress
████████░░ 80 / 100 m

[Open]
```

The task identity must be visible without expanding the card.

## Task detail

Show where supported:

- title/code;
- project;
- work package;
- zone;
- planned start/end;
- actual start/end;
- planned quantity;
- actual quantity;
- calculated progress;
- assignees;
- prerequisites;
- dependents;
- status;
- activity/history where available.

---

# 16. TASK WORKFLOW

Normal supported flow:

```text
PLANNED → READY → IN_PROGRESS → COMPLETED → VERIFIED
                     ↓
                  BLOCKED
                     ↓
                   READY
```

Cancellation is a separate supported transition where the backend permits it.

Cancellation requires confirmation.

Never show a transition that the backend rejects.

---

# 17. TASK PROGRESS

When planned and actual quantities exist:

`progress = actualQuantity / plannedQuantity`

Display:

**80 / 100 m — 80%**

The progress bar must be clearly visible and useful, not a tiny decorative line.

If quantity is unavailable, do not invent a percentage.

---

# 18. TASK FILTERS

Default useful filters:

- project/site;
- status;
- search;
- assigned to me.

Optional:

- work package;
- zone;
- date.

Mobile: use a filter drawer/sheet.

Never render the same filter system twice on one page.

---

# 19. DAILY PLANNING

Planning answers:

> What are we trying to accomplish on this site today?

Daily Plan header:

- project/site;
- date;
- plan status.

Supported plan lifecycle should reflect the backend, e.g.:

- DRAFT;
- PUBLISHED;
- COMPLETED;
- CANCELLED.

Do not invent additional states.

Plan structure:

### Summary

- planned tasks;
- active tasks;
- completed tasks;
- blocked tasks;
- workforce;
- key notes.

### Timeline

Show work in a readable time sequence.

### Work areas

Group by zone/work package/team where data supports it.

### Blockers

Show blockers next to affected work.

---

# 20. DAILY PLAN WORKFLOW

Site Manager:

1. create plan;
2. add/select today's work;
3. review workforce;
4. review blockers;
5. publish;
6. monitor execution;
7. complete/cancel according to backend rules.

Foreman:

- view plan;
- coordinate execution;
- report blockers;
- monitor progress.

Worker:

- see only the portion relevant to their own work.

The worker must never be confronted with the full project schedule.

---

# 21. ATTENDANCE / PONTAJ

Attendance is an operational workflow, not a spreadsheet first.

## Worker

Before check-in:

```text
TODAY
Not checked in
[Check in]
```

After check-in:

```text
TODAY
08:03
CHECKED IN
Parc Solar Cluj
[Check out]
```

Show recent attendance where useful.

## Supervisor

Show authorized workforce summary:

- present;
- not checked in;
- absent;
- checked out;
- exceptions.

Never expose unnecessary private information.

---

# 22. ISSUES & BLOCKERS

Issues exist to prevent work from silently failing.

Example:

```text
CRITICAL
Inverter delivery delayed

Zone B
Affects task INV-014

Reported 09:35
Ion Popescu

[View issue]
```

Where supported, show:

- title;
- description;
- project;
- zone;
- severity;
- reporter;
- created time;
- affected task;
- status.

Do not invent issue resolution if the backend does not support it.

---

# 23. DAILY REPORTS

Daily reports are the site's operational diary.

Show/collect supported fields such as:

- date;
- project/site;
- author;
- work completed;
- workforce;
- delays;
- issues;
- materials;
- notes;
- evidence where supported.

List should emphasize date, author, project and important issue information.

---

# 24. MATERIALS / STOCK

Stock answers:

> Do we have what today's work needs?

Show:

- material;
- available quantity;
- unit;
- alert state;
- location;
- recent movement.

For authorized roles only:

- receive;
- consume;
- transfer.

Do not expose mutation actions to read-only roles.

---

# 25. QUALITY / HSE

Quality/HSE is exception-oriented.

Show:

- inspections;
- findings;
- critical issues;
- outstanding actions;
- recent activity.

Workers should see only relevant notices/actions.

---

# 26. PROJECT SCREEN

The project screen is the project's operational home, not a database editor.

Header:

- name;
- site/location;
- status;
- capacity;
- dates.

Main sections:

### Project health

- schedule;
- execution;
- workforce;
- issues;
- materials;
- quality;
- HSE;
- cost where supported.

### Current work

- active tasks;
- today's plan;
- blockers.

### Project information

- project details;
- contacts;
- documents where supported.

---

# 27. PROJECTS LIST

PM/Manager/Admin view should communicate:

- name;
- location;
- capacity;
- status;
- execution signal;
- blocker signal;
- last activity.

Do not expose a wall of raw database fields.

---

# 28. CONTROL / MANAGEMENT DASHBOARDS

Management screens must be exception-first.

Hierarchy:

1. What needs attention?
2. What is happening?
3. Why?
4. What action can I take?

Example:

```text
3 critical blockers
      ↓
Parc Solar Cluj — inverter delivery
      ↓
Issue INV-014
      ↓
Affected task
      ↓
Responsible person
```

Important metrics should drill down to useful records.

Do not create meaningless KPI cards.

---

# 29. HOME SCREENS

The root route is role-specific, not a generic dashboard.

Recommended:

- WORKER → My Day
- TEAM_LEADER → Team Day
- FOREMAN → Site Day
- SITE_MANAGER → Site Control
- PM → Project Control
- MANAGER → Portfolio
- ADMIN → Organization / Control
- specialist roles → specialist home

Each home screen should answer one primary daily question.

---

# 30. HOME SCREEN RULE

The home screen is not a dumping ground.

Show only information required for the user's main job.

Everything else belongs behind navigation.

---

# 31. NOTIFICATIONS

Notifications are for action, not noise.

Prioritize:

- assigned task;
- task change relevant to user;
- blocker affecting user/team;
- daily plan publication;
- approval requiring action;
- important site alert.

Do not notify users about every database mutation.

---

# 32. SEARCH

Use search only where it solves a real workflow.

Search actual backend fields.

Debounce input.

Preserve project context.

Do not invent fuzzy results.

---

# 33. EMPTY STATES

Empty state must match the user's role and permissions.

Worker:

> No tasks assigned to you today.

Team Leader:

> No tasks are assigned to your team today.

Admin:

> No tasks exist for this project yet.

Never tell a Worker to create a task if the Worker cannot create tasks.

---

# 34. ERROR STATES

Never expose raw technical errors such as:

- `Failed to fetch`;
- `Network Error`;
- stack traces;
- Prisma errors;
- raw 500 messages.

Use human language:

> We couldn't load today's tasks. Try again.

Provide retry where appropriate.

403:

> You don't have permission to perform this action.

401:

> Your session has expired. Please sign in again.

404:

> This record is no longer available.

---

# 35. LOADING AND MUTATIONS

Initial load:

- skeletons;
- preserve page structure.

Mutation:

- local button spinner;
- preserve filters;
- preserve expanded state;
- preserve scroll;
- do not blank the whole page.

Never reload an entire page for a small local mutation unless technically necessary.

---

# 36. TOASTS

Use toasts for meaningful completed actions:

- Task updated.
- Plan published.
- Check-in recorded.
- Issue reported.

Do not toast every filter change or unchanged value.

Toasts must not cover dialogs.

---

# 37. INTERNATIONALIZATION

RO and EN are first-class.

No hardcoded visible strings.

No hardcoded `ro-RO` formatting.

Use locale-aware date/number formatting.

Romanian must preserve:

- ă;
- â;
- î;
- ș;
- ț.

No mojibake.

---

# 38. ACCESSIBILITY

Every interactive control must be keyboard accessible.

Do not use clickable `<div>` elements for actions.

Use semantic `<button>` / `<a>`.

All icon-only buttons require accessible names.

Dialogs need:

- accessible title;
- focus handling;
- predictable close;
- keyboard support.

Status cannot rely on color alone.

Visible focus is mandatory.

---

# 39. RESPONSIVE DESIGN

Desktop:

- persistent sidebar;
- multi-column layouts;
- tables where useful.

Tablet:

- reduced navigation;
- fewer columns;
- stacked secondary content.

Mobile:

- drawer navigation;
- cards instead of wide tables where possible;
- touch targets at least approximately 44px;
- concise headers;
- no clipped tab bars;
- no accidental horizontal overflow.

Worker and field workflows should be interaction-first for mobile.

---

# 40. MOBILE FIELD PRINCIPLES

Assume a worker may have:

- one hand occupied;
- gloves;
- poor connectivity;
- sunlight;
- small screen;
- limited time.

Therefore:

- large controls;
- short labels;
- minimal typing;
- obvious current state;
- no hover-only interactions;
- no tiny controls;
- no dense desktop tables.

---

# 41. OFFLINE / NETWORK UX

If offline functionality is not implemented, do not pretend it is.

On failure:

- explain what happened;
- preserve entered data where practical;
- allow retry;
- never claim a save before server confirmation.

---

# 42. TASK + PLANNING + ISSUE + ATTENDANCE RELATIONSHIP

This is the core operating model:

### Planning
**What should happen today?**

### Tasks
**What work exists and what is its state?**

### Issues
**What is preventing work?**

### Attendance
**Who is available?**

### Stock
**Do we have the required resources?**

### Reports
**What actually happened?**

The UI should make these relationships easy to navigate.

---

# 43. SITE DAY MODEL

A Site Manager should see:

```text
TODAY
│
├── People
│   └── Attendance
│
├── Plan
│   └── Daily Plan
│
├── Work
│   └── Tasks
│
├── Problems
│   └── Issues / Blockers
│
├── Resources
│   └── Stock
│
├── Quality / HSE
│
└── Record
    └── Daily Report
```

This conceptual model is more important than the sidebar.

---

# 44. VISUAL EXAMPLES

## Worker My Day

```text
GOOD MORNING, ION
24 SEPTEMBER 2026

PARC SOLAR CLUJ
Zone A

ATTENDANCE
08:03 · Checked in
[Check out]

TODAY'S WORK

Install mounting structure
Zone A · 80 / 100 m
IN PROGRESS
[Open task]

PROBLEMS
No blockers reported
[Report problem]
```

## Foreman Site Day

```text
SITE DAY
Parc Solar Cluj · Today

WORKFORCE
24 present · 3 not checked in

TODAY'S PLAN
8 tasks · 2 blocked · 4 active

ZONE A
Mounting structure     80%
Pile driving           100%

ZONE B
DC cabling             45%

BLOCKERS
⚠ Inverter delivery delayed

[Open site control]
```

## Site Manager

```text
SITE CONTROL
Parc Solar Cluj · Today

ATTENTION
3 blocked tasks
1 material shortage
2 quality findings

TODAY'S PLAN
Published · 18 tasks

WORKFORCE
24 / 27 present

EXECUTION
████████░░ 78%

[Open blockers] [Open plan]
```

## Manager

```text
PORTFOLIO

ATTENTION
3 projects need review

Parc Solar Cluj
12.4 MWp · 78% execution
3 blockers

Bucharest BESS
20 MWh · 42% execution
1 blocker
```

---

# 45. PROJECT HEALTH

Only calculate an overall health score if the backend has a defined calculation.

Otherwise show individual signals:

- schedule;
- execution;
- blockers;
- workforce;
- materials;
- quality;
- HSE;
- cost.

Never invent a green/yellow/red score from arbitrary UI guesses.

---

# 46. WORK AREAS / ZONES

Where supported, zones are a first-class physical concept.

Example:

```text
Zone A
4 tasks · 1 blocked

Zone B
7 tasks · 0 blocked
```

Use human-readable zone names, not database IDs.

---

# 47. WORK PACKAGES

Where supported, use work packages to group construction activity.

Possible examples:

- pile driving;
- mounting structure;
- module installation;
- DC cabling;
- inverters;
- AC works;
- fencing;
- roads;
- BESS;
- testing/commissioning.

Only render categories that actually exist in the project's data.

---

# 48. NO INVENTED DATA

Production UI must use real backend data.

Do not create fake progress, fake workers, fake tasks or fake KPIs just to make a page look full.

Demo seed data belongs in the backend/development seed process, not in UI constants.

---

# 49. PROJECT CREATION

For authorized roles:

- project name;
- code;
- location;
- capacity;
- dates;
- budget where supported;
- active state.

After creation, navigate to the project context instead of dropping the user into an unrelated list.

Use the actual backend field names and DTO contract.

---

# 50. USER MANAGEMENT

Admin view should prioritize:

- name;
- role;
- status;
- project access;
- activity;
- supported actions.

Do not expose credentials or sensitive internal fields.

---

# 51. TEAM MANAGEMENT

Team page answers:

- What team is this?
- Who is in it?
- Which project/site?
- Who leads it?
- What work is assigned?

---

# 52. SPECIALIST EXPERIENCES

## SITE LOGISTICS

Focus:

- workforce;
- deliveries;
- stock;
- tools;
- records.

## PROCUREMENT

Focus:

- purchase orders;
- suppliers;
- pending deliveries;
- procurement status.

## FINANCE

Focus:

- expenses;
- approvals;
- project costs.

## QA/QC

Focus:

- inspections;
- findings;
- quality evidence;
- outstanding actions.

## TECHNICIAN

Focus:

- assigned technical tasks;
- issues;
- technical project context.

---

# 53. NOTIFICATIONS DESIGN

Notification item:

```text
Task updated
INV-014 is now blocked
09:35
```

Group by Today / Earlier.

Unread state must be clear but restrained.

---

# 54. PROFILE

Keep profile simple:

- name;
- email;
- role;
- language;
- account/session actions.

Do not turn Profile into a hidden HR module.

---

# 55. ROUTING

The root route is role-specific.

Recommended:

```text
WORKER       → /
TEAM_LEADER  → /
FOREMAN      → /
SITE_MANAGER → /
PM           → /
MANAGER      → /
ADMIN        → /
```

Each resolves to the correct role home.

Existing module routes may remain, but there must not be multiple competing routes for the same conceptual feature.

---

# 56. CODE ORGANIZATION

Prefer existing repository structure:

```text
web/src/
  app/
  components/
  components/ui/
  config/
  contexts/
  features/
  lib/
  types/
```

Feature logic belongs in `features/`.

Shared visual primitives belong in `components/ui/`.

Pages should orchestrate rather than contain giant business components.

---

# 57. API CONTRACT RULE

Before implementing a screen:

1. inspect backend controller;
2. inspect DTO;
3. inspect service;
4. inspect role guard/authorization;
5. inspect frontend API client;
6. confirm response shape.

Never infer API behavior from route names alone.

---

# 58. PERMISSION RULE

Backend authorization remains authoritative.

Frontend permissions exist to improve UX.

The frontend should hide impossible actions and handle 401/403 gracefully, but must never assume UI hiding is security.

If backend denies an action, do not crash the page.

---

# 59. KNOWN BACKEND/FRONTEND CONTRACT PRINCIPLES

The existing system contains working modules for:

- projects;
- tasks;
- teams;
- workforce;
- attendance;
- daily reports;
- daily planning;
- issues;
- stock/materials;
- expenses/costs;
- notifications;
- quality/inspections;
- authorization/project access.

The frontend must use the actual implementation as source of truth.

Known task principles:

- GET task list with project scope;
- POST task for authorized roles;
- PATCH task for supported fields/status/progress;
- assignment for authorized roles;
- prerequisites/dependents;
- canonical statuses listed above.

Known planning principles:

- create;
- publish;
- complete;
- cancel;
- role restrictions.

Known attendance principles:

- own logs;
- check-in;
- check-out;
- authorized workforce views.

Known issue principles:

- list;
- project scope;
- create;
- only supported status/resolution behavior.

If the current backend differs, trust the actual backend and document the gap.

---

# 60. SECURITY UX

Never expose:

- tokens;
- passwords;
- stack traces;
- unnecessary internal database IDs.

Humanize errors.

---

# 61. DATA FRESHNESS

Refresh after meaningful mutations.

Avoid stale counts.

Preserve user context.

Do not claim real-time behavior unless real-time updates are actually implemented.

---

# 62. REPORTING MODEL

Keep these concepts distinct:

### Planning
What should happen?

### Tasks
What work exists?

### Issues
What is stopping work?

### Attendance
Who was available?

### Reports
What happened?

### Control
What needs attention?

This separation is essential to the product's mental model.

---

# 63. DAILY PLAN VISUAL

Preferred:

```text
TODAY — 24 SEPTEMBER
Plan status: PUBLISHED

08:00 ─────────────────────
PILE DRIVING
Zone A · Team 1
████████░░ 80%

10:30 ─────────────────────
MOUNTING STRUCTURE
Zone B · Team 2
██████░░░░ 60%

BLOCKERS
⚠ Inverter delivery delayed
```

This is preferable to a spreadsheet-first field layout.

---

# 64. TASK VISUAL

```text
INSTALL MOUNTING STRUCTURE
Zone B · WP-02

IN PROGRESS

80 / 100 m
████████░░

Assigned
Ion Popescu · Team 2

Today
08:00–16:00

[Open task]
```

---

# 65. MANAGEMENT CONTROL VISUAL

```text
PARC SOLAR CLUJ
12.4 MWp · Cluj County

EXECUTION
████████░░ 78%

ATTENTION
3 blocked tasks
1 material shortage
2 quality findings

TODAY
24 workers
18 active tasks

[Open project]
```

Only use actual values.

---

# 66. FORMS: TASK CREATION

Required/important first:

- project;
- title;
- planned dates;
- work package/zone where required.

Then:

- quantity;
- unit;
- description.

Do not place low-value fields before core fields.

---

# 67. TASK ASSIGNMENT

Assignment UI must know the task's project.

It should:

- use task project context automatically;
- show valid project members;
- show names/roles;
- show current assignee.

Never say “Select a project first” if the task already has a project.

If unassignment is not supported by backend, do not fabricate an Unassign action.

---

# 68. PLAN CREATION

Start with:

- date;
- project/site.

Then:

- select/add work;
- teams where supported;
- workforce review;
- notes;
- preview;
- publish.

The user should understand what will be published before clicking Publish.

---

# 69. CONFIRMATIONS

Require confirmation for:

- cancel plan;
- cancel task;
- destructive delete where supported;
- potentially destructive inventory action;
- destructive admin changes.

Do not require confirmation for simple navigation or safe filters.

---

# 70. ANTI-CRUD RULES

Never begin a screen with “all database fields”.

Start with the user job.

Never make a generic table just because data is tabular.

Never create a button because an API endpoint exists.

Never show a module because a database table exists.

---

# 71. ANTI-DASHBOARD RULE

Never start with 8–12 KPI cards.

Start with:

> What needs attention?

Then show only the metrics that help answer that question.

---

# 72. ANTI-AI-SLOP RULE

Remove:

- purple/blue AI gradients;
- glassmorphism everywhere;
- giant rounded rectangles;
- excessive shadows;
- decorative blobs;
- random colors;
- giant headings;
- meaningless charts;
- repeated identical cards;
- excessive pills;
- excessive animation.

The interface should look intentionally designed, not generated from a template.

---

# 73. ANTI-PILL / ICON RULE

Use badges only for compact state/status/category.

Do not turn every value into a colored pill.

Icons should communicate meaning, not decorate every label.

Use one consistent icon family already present in the repository.

---

# 74. ANTI-MODAL RULE

Do not put complex workflows in tiny dialogs.

Use a page or drawer when the workflow needs space.

---

# 75. ANTI-REFRESH RULE

Do not blank the whole page for a local mutation.

Preserve:

- filters;
- expanded cards;
- scroll position;
- selected context.

---

# 76. DESIGN REVIEW BEFORE CODING

Before implementing any major page, answer:

1. Who is using it?
2. What are they trying to accomplish?
3. What must they see first?
4. What is the primary action?
5. What can be removed?
6. What could confuse a field worker?
7. What could confuse a manager?
8. Is project/site context obvious?
9. Does the screen still make sense on a phone?
10. Is this a real construction workflow rather than a generic CRUD screen?

If these are not clear, redesign before coding.

---

# 77. USER JOURNEY — WORKER

```text
Login
 ↓
My Day
 ↓
See project/site
 ↓
Check in
 ↓
See today's tasks
 ↓
Open task
 ↓
Work
 ↓
Update progress
 ↓
Report blocker if needed
 ↓
Continue/complete
 ↓
Check out
```

The worker should be able to complete the main flow with minimal typing and navigation.

---

# 78. USER JOURNEY — FOREMAN

```text
Login
 ↓
Site Day
 ↓
Review today's plan
 ↓
Check crews
 ↓
Review task status
 ↓
Identify blocker
 ↓
Coordinate/report
 ↓
Update progress
 ↓
Daily report
```

---

# 79. USER JOURNEY — SITE MANAGER

```text
Login
 ↓
Site Control
 ↓
Review exceptions
 ↓
Review workforce
 ↓
Review today's plan
 ↓
Review blocked tasks
 ↓
Review materials
 ↓
Coordinate supported actions
 ↓
Publish/update plan
 ↓
Daily report
```

---

# 80. USER JOURNEY — PM

```text
Login
 ↓
Project Control
 ↓
Select project
 ↓
Review schedule/progress
 ↓
Review exceptions
 ↓
Drill into issue/task
 ↓
Review workforce/resources
 ↓
Review report/cost
 ↓
Take supported management action
```

---

# 81. USER JOURNEY — MANAGER

```text
Login
 ↓
Portfolio
 ↓
See exceptions
 ↓
Select project
 ↓
Review project health
 ↓
Drill down
```

---

# 82. SPECIALIST HOME QUESTIONS

SITE_LOGISTICS:
> Are people, deliveries and materials ready?

PROCUREMENT:
> Which orders or deliveries need attention?

FINANCE:
> Which expenses/cost approvals need action?

QA_QC:
> Which inspections/findings require attention?

TECHNICIAN:
> What technical work is assigned and what is blocked?

---

# 83. DEVELOPMENT ORDER

## Phase 1 — Foundation

- shell;
- design tokens;
- shared components;
- project context;
- role routing;
- navigation;
- loading/error/empty primitives.

## Phase 2 — Worker

- My Day;
- attendance;
- assigned tasks;
- task detail;
- blocker reporting;
- notifications;
- profile.

## Phase 3 — Team Leader

- Team Day;
- team members;
- team tasks;
- attendance;
- daily report;
- blockers.

## Phase 4 — Foreman

- Site Day;
- daily plan;
- work areas;
- team workload;
- blockers;
- reports;
- materials visibility.

## Phase 5 — Site Manager

- Site Control;
- plan creation/publishing;
- workforce;
- tasks;
- issues;
- materials;
- quality;
- reports.

## Phase 6 — PM

- Project Control;
- project execution;
- milestones where supported;
- issues;
- workforce;
- reports;
- cost visibility.

## Phase 7 — Manager

- Portfolio;
- project health;
- exceptions;
- drill-down.

## Phase 8 — Admin/Specialists

- Users;
- Teams;
- Organization;
- Procurement;
- Finance;
- QA/QC;
- Settings.

---

# 84. BACKEND MUST NOT BE REBUILT

Do not:

- migrate the database;
- replace Prisma;
- replace NestJS;
- restore Supabase runtime;
- invent a new authorization architecture;
- change role enums without a real requirement;
- invent endpoints.

The frontend may be substantially refactored.

It is acceptable to:

- reorganize page components;
- introduce feature components;
- replace poor layouts;
- consolidate UI components;
- improve navigation;
- improve role routing;
- improve translations;
- rebuild presentation-layer screens.

---

# 85. AI IMPLEMENTATION PROCESS

When an AI receives this file:

## Step 1 — Inspect

Read this file and inspect:

- repository structure;
- existing design system;
- Tailwind config;
- AppShell;
- navigation;
- translations;
- API clients;
- backend controllers;
- DTOs;
- role guards;
- relevant services.

## Step 2 — Map

Create:

```text
SPEC SCREEN
→ existing route
→ existing component
→ API endpoint
→ backend authorization
→ missing capability
```

## Step 3 — Implement one vertical slice

Do not implement 20 pages in one pass.

## Step 4 — Verify

Run:

- typecheck;
- build;
- relevant tests;
- browser acceptance;
- desktop inspection;
- mobile inspection;
- at least two role checks.

## Step 5 — Continue only after visible quality is acceptable.

---

# 86. AI MUST NOT CHANGE SCOPE SILENTLY

If a backend gap appears:

- document it;
- preserve the UI contract honestly;
- do not invent an action;
- do not change product meaning silently.

If a design decision is ambiguous, prefer the role/workflow principles in this document.

---

# 87. IMPLEMENTATION REPORT REQUIRED AFTER EACH PHASE

The AI should report:

### Changed
Files and screens changed.

### Verified
- typecheck;
- build;
- tests;
- browser.

### Remaining
Real limitations or backend gaps.

Do not claim “everything is done” merely because compilation passes.

---

# 88. BROWSER ACCEPTANCE

For every major screen:

1. login;
2. select project;
3. open screen;
4. inspect populated state;
5. inspect empty state;
6. inspect error state if possible;
7. perform primary action;
8. reload;
9. verify persistence;
10. inspect mobile;
11. inspect another role.

Look specifically for:

- duplicate controls;
- broken layout;
- misleading text;
- weak hierarchy;
- clipped content;
- inaccessible controls;
- raw errors;
- wrong role actions;
- stale data.

---

# 89. SCREEN QUALITY GATE

A page is not complete because it compiles.

### Functional

- correct data;
- correct API;
- correct permissions;
- correct persistence.

### UX

- purpose understood in 2–3 seconds;
- primary action obvious;
- correct hierarchy;
- no unnecessary complexity.

### Visual

- consistent spacing;
- consistent typography;
- no duplicate filters/tabs;
- correct mobile layout;
- HIIEKO identity.

### Accessibility

- keyboard;
- focus;
- semantic controls;
- contrast;
- dialog behavior.

### i18n

- RO;
- EN;
- correct Romanian diacritics;
- locale-aware dates/numbers.

### Error handling

- loading;
- empty;
- error;
- retry;
- mutation feedback.

---

# 90. KNOWN FRONTEND FAILURE MODES — DO NOT REPEAT

Previous implementation attempts revealed the following problems. These are explicitly forbidden:

- duplicated task filters;
- duplicated status tabs;
- weak progress bars;
- generic admin-list appearance for field workflows;
- low-information headers;
- misleading Worker empty-state instructions;
- raw `Failed to fetch` errors;
- task assignment asking for a project when the task already has one;
- tiny/narrow forms that make normal work difficult;
- whole-page blanking during mutations;
- expanded task state disappearing after mutation;
- toast spam for unchanged values;
- uncontrolled numeric quantity inputs;
- no confirmation for cancellation;
- hardcoded `ro-RO` dates;
- stale/non-canonical status labels;
- clipped mobile tab strips;
- weak mobile cards;
- keyboard-inaccessible clickable divs;
- no live feedback for important state changes;
- weak project identity.

These are product-quality failures, not acceptable “polish later” items when the affected screen is part of a demo or primary workflow.

---

# 91. DEMO JOURNEY FOR MANAGEMENT

The product must be demoable as one story rather than a random tour of pages.

## Demo 1 — Worker

Login → My Day → project → check-in → today's task → progress → blocker.

## Demo 2 — Foreman

Switch user → Site Day → crews → today's plan → task progress → blocker.

## Demo 3 — Site Manager

Site Control → plan → workforce → blocked tasks → materials → daily report.

## Demo 4 — PM/Manager

Project/Portfolio Control → project health → exceptions → drill-down.

The demonstration should communicate:

> Planning becomes field work; field work produces progress and problems; the same information becomes management control.

---

# 92. PRIORITY IF TIME IS LIMITED

If only a few screens can be made excellent, build them in this order:

1. **Worker My Day**
2. **Task experience**
3. **Daily Planning**
4. **Issues / Blockers**
5. **Attendance**
6. **Foreman Site Day**
7. **Site Manager Site Control**
8. PM / Manager control
9. specialist/admin screens

A smaller number of excellent screens is better than 25 mediocre pages.

---

# 93. FINAL PRODUCT FEEL

When finished:

### Worker
> I know what I need to do today.

### Team Leader
> I know what my team is doing today.

### Foreman
> I know what is happening across my work areas.

### Site Manager
> I know what is going wrong on the site and what needs attention.

### PM
> I know whether the project is progressing according to plan.

### Manager
> I know which project needs attention.

### Admin
> I can control the organization and system.

That is the product.

---

# 94. DEFINITION OF DONE

The frontend is complete when:

## Product

- [ ] every role has a meaningful home;
- [ ] every major screen belongs to a real workflow;
- [ ] project/site context is consistent;
- [ ] planning/tasks/issues/attendance/reports/materials connect logically.

## UI

- [ ] one visual language;
- [ ] HIIEKO green brand;
- [ ] semantic status colors;
- [ ] consistent buttons/forms/cards/tables/dialogs;
- [ ] no AI-slop styling.

## UX

- [ ] worker is simple;
- [ ] field roles are operational;
- [ ] management is exception-first;
- [ ] admin is configuration-focused;
- [ ] unnecessary modules are hidden.

## Technical

- [ ] existing backend preserved;
- [ ] real API contracts used;
- [ ] real permissions used;
- [ ] no fake data;
- [ ] no fake actions;
- [ ] no duplicate requests/UI;
- [ ] no console errors.

## Accessibility

- [ ] keyboard navigation;
- [ ] focus;
- [ ] semantic controls;
- [ ] accessible dialogs;
- [ ] sufficient contrast.

## Internationalization

- [ ] Romanian;
- [ ] English;
- [ ] correct diacritics;
- [ ] locale-aware dates/numbers;
- [ ] no hardcoded visible UI strings.

## Responsive

- [ ] desktop;
- [ ] tablet;
- [ ] mobile;
- [ ] field-friendly interaction.

---

# 95. MASTER OPERATING PRINCIPLE

Do not ask:

> “What page can we build next?”

Ask:

> **“What real HIIEKO employee workflow becomes easier after this change?”**

Then build that workflow.

---

# 96. FINAL SUMMARY

HIIEKO is not a collection of pages for tasks, attendance, stock and reports.

HIIEKO is:

> **a role-based digital site office that turns project plans into coordinated daily construction work and turns field activity back into project control.**

Build the user's workday first.

Build the database screens second.

**End of HIIEKO Frontend Master Specification.**

