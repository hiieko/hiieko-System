# HIIEKO Solar Site Management System
# CLINE MASTER ROADMAP & EXECUTION ORDER

> **Purpose:** This is the master execution order for Cline. It tells Cline how to work continuously on the HIIEKO project, how to use the existing project-workflow documents, how to verify work before declaring it complete, and how to move automatically to the next non-blocked step.
>
> **Location in repository:** `Project workflow/CLINE_MASTER_ROADMAP.md`
>
> **Important:** This file is the execution policy. Dynamic project status remains in `PROGRESS.md`, `VERIFICATION.md`, `ISSUES.md`, `CURRENT_STATUS.md`, and `HANDOFF.md`. Do not duplicate changing status here unless necessary to explain the execution order.

---

## 1. PRODUCT MISSION

HIIEKO Romania SRL needs a professional solar/BESS EPC site-management system used by management, project managers, site managers, foremen, workforce, logistics, procurement, finance and O&M.

The product is not merely an admin dashboard and not merely a CRUD application. It must become the operational control system connecting:

- projects
- people and workforce
- teams
- planning
- tasks
- attendance
- daily reporting
- materials
- warehouses
- deliveries / Avize
- procurement
- suppliers
- expenses
- project costs
- documents and evidence
- quality / QA-QC
- NCR / punch lists
- HSE / safety
- RFIs / submittals
- change orders
- notifications / approvals
- project progress
- project closeout / handover
- future O&M

The guiding product principle is:

> **Every important site activity must have a clear owner, project context, status, evidence, history and next action.**

---

## 2. AUTHORITATIVE SOURCE-OF-TRUTH ORDER

At the beginning of EVERY Cline session, read these files before changing application code:

1. `Project workflow/CLINE_MASTER_ROADMAP.md` — execution order and working rules.
2. `Project workflow/PROGRESS.md` — current milestone/status.
3. `Project workflow/VERIFICATION.md` — what has actually been verified.
4. `Project workflow/ISSUES.md` — open/resolved/deferred defects.
5. `Project workflow/CURRENT_STATUS.md` — current project snapshot.
6. `Project workflow/HANDOFF.md` — handoff/maintenance context.
7. Relevant product/organization specification documents before changing role ownership or business rules.

### Precedence rule

When documents disagree:

1. actual running code + Prisma schema + migrations + tests
2. current verified behavior recorded in `VERIFICATION.md`
3. current status in `PROGRESS.md`
4. open issues in `ISSUES.md`
5. handoff/current-status documents
6. historical documentation

Historical Supabase/site-era entries are not instructions. They are history unless explicitly marked current.

Never revive a removed architecture merely because an old document mentions it.

---

## 3. CURRENT ARCHITECTURE — DO NOT REGRESS

Target runtime architecture:

```text
Web + Mobile
      ↓
   NestJS API
      ↓
    Prisma
      ↓
PostgreSQL 18
```

Supporting services:

```text
NestJS
 ├─ authentication / authorization
 ├─ project-scoped access
 ├─ documents / uploads / storage abstraction
 ├─ OCR provider abstraction (TEMPORARILY DISABLED)
 ├─ notifications
 ├─ audit logging
 └─ domain modules

Web
 ├─ Next.js
 ├─ shared types/translations
 ├─ ProjectContext
 ├─ AuthGuard / RoleGuard
 └─ responsive HIIEKO design system

Mobile
 ├─ React Native / Expo architecture
 ├─ NestJS API
 ├─ local SQLite/cache
 ├─ offline queue
 └─ background sync
```

### Mandatory architectural rules

- Supabase is NOT a runtime dependency.
- Do not add Supabase back.
- PostgreSQL is authoritative.
- Prisma migrations are authoritative for schema evolution.
- Never modify production/dev schema manually without a migration.
- Do not create duplicate legacy data paths unless explicitly approved in a documented architecture decision.
- Project access is enforced server-side.
- Frontend role checks are UX controls, not security controls.
- Backend authorization is mandatory.
- Never expose `password_hash`.
- Never silently fabricate missing data.
- Never hide API failures by substituting fake business data.
- Never introduce a frontend-only field that is not supported by the backend contract.

---

## 4. CONTINUOUS EXECUTION POLICY FOR CLINE

Cline must NOT stop after every successful phase merely to say “completed”.

### Default behavior

After a phase:

1. implement
2. run local/static checks
3. run unit tests
4. run integration/API tests where applicable
5. run database verification
6. browser-test the actual feature
7. test authorization
8. test responsive/mobile behavior
9. update `VERIFICATION.md`
10. update `PROGRESS.md`
11. update `ISSUES.md` if anything is discovered
12. re-check the changed area
13. if the acceptance gate passes, immediately continue to the next non-blocked phase

Do not wait for another user message after a successful acceptance gate unless:

- external credentials are required
- a destructive data migration requires human approval
- two legitimate architectural options have materially different consequences
- the specification is genuinely contradictory
- the next step could delete production data

Otherwise continue.

### Never claim complete because of compilation

The minimum completion standard for a functional feature is:

```text
VIEW
  ↓
ACTION
  ↓
SAVE
  ↓
RELOAD
  ↓
VERIFY PERSISTENCE
```

For workflows involving multiple entities:

```text
CREATE
 ↓
READ
 ↓
UPDATE
 ↓
READ AGAIN
 ↓
RELATED ENTITY CHECK
 ↓
AUTHORIZATION CHECK
 ↓
AUDIT CHECK
```

---

# 5. PLAN MODE vs ACT MODE

## PLAN MODE

Use Plan Mode when:

- starting a new milestone
- changing database structure
- introducing an external provider
- replacing a major subsystem
- changing authorization semantics
- changing architecture
- designing a new cross-module workflow

Plan Mode must produce:

- current-state inspection
- affected files/modules
- backend endpoints involved
- Prisma models/relations involved
- migration implications
- authorization implications
- frontend screens/components
- verification plan
- risks
- rollback/recovery approach
- exact acceptance criteria

Plan Mode should NOT perform broad implementation changes.

## ACT MODE

Use Act Mode after the plan is understood/accepted.

Act Mode must:

- implement the plan
- run verification continuously
- fix defects immediately when safely possible
- update project-workflow documentation
- continue to the next task after acceptance

### Cline execution rule

At the start of Act Mode, Cline should say internally/briefly which roadmap phase it is executing, then keep going until that phase's acceptance criteria are satisfied.

At the end of a phase, do NOT merely summarize. Update documentation and continue to the next phase.

---

# 6. DATABASE INTELLIGENCE & INTEGRITY — NON-NEGOTIABLE

The database must represent the business correctly, not merely store records.

## Core relationship model

```text
Organization
   │
   ├── Users
   │    ├── UserProfile
   │    ├── ProjectMembership
   │    └── Employee (optional link)
   │
   └── Projects
         │
         ├── Members
         ├── Teams
         │    └── TeamMembers
         ├── Tasks
         ├── DailyPlans
         ├── DailyReports
         ├── Attendance
         ├── Materials / Stock
         ├── Warehouses
         ├── Deliveries / Avize
         ├── Purchase Orders
         ├── Expenses
         ├── Costs / Budgets
         ├── Documents / Attachments
         ├── Issues / NCR / Punch List
         ├── QA/QC inspections
         ├── HSE records
         ├── Change Orders
         └── Notifications / Audit references
```

## Integrity rules

For every project-scoped record:

- its `project_id` must refer to an existing project
- the actor must have access to that project
- related project-scoped entities must belong to the SAME project
- cross-project relationships must be rejected
- organization boundaries must be respected
- historical records must not disappear because a person/team is archived

Examples:

- a Team belongs to one Project
- a TeamMember must belong to the same Project as the Team
- a Task belongs to one Project
- a Task assigned through a team must belong to the same Project
- a DailyPlan belongs to one Project
- a DailyReport belongs to one Project
- an Issue belongs to one Project
- an NCR belongs to one Project
- a QA inspection belongs to one Project
- a Document belongs to one Project where project scope applies
- an Expense belongs to one Project where project scope applies
- Stock balances/movements must not mix projects accidentally
- Procurement/PO/Aviz relations must preserve project ownership

## Database quality gates

For every schema change:

1. update Prisma schema
2. create migration
3. regenerate Prisma client
4. run typecheck
5. run backend tests
6. run `db:verify`
7. test important foreign-key/invariant cases
8. test rollback/recovery implications
9. update documentation

Expand `db:verify` over time so it verifies:

- required tables
- FK orphans
- unique constraints
- project relation consistency
- organization relation consistency
- status validity
- impossible negative stock
- duplicate membership prevention
- duplicate active team assignment prevention
- impossible cross-project assignments
- historical record retention rules
- audit coverage for critical mutations

## Transactions

Use transactions for workflows that change multiple related records.

Examples:

- create daily report + workers + tasks + production entries
- receive delivery + stock movement + balance
- approve expense + status/history/audit
- create project + creator membership
- assign team/member relationships where multiple writes must succeed together

Never leave half-written business operations.

## Soft delete / archive

Prefer archive/inactive status for business entities with historical references.

Do not hard-delete:

- employees who have historical attendance/reports
- teams referenced by historical tasks
- financial records
- audit history
- approved documents
- inspections/NCR history

---

# 7. GLOBAL PRODUCT PROTOTYPE

The prototype is a clear functional map, not decorative mockup.

## Application shell

```text
┌───────────────────────────────────────────────────────────────┐
│ HIIEKO logo | Project selector | Search | Alerts | User       │
├───────────────┬───────────────────────────────────────────────┤
│ Operations    │                                               │
│ Dashboard     │                                               │
│ Planning      │              PAGE CONTENT                     │
│ Tasks         │                                               │
│ Attendance    │                                               │
│ Daily Reports │                                               │
│ Materials     │                                               │
│ Procurement   │                                               │
│ Documents     │                                               │
│ Quality       │                                               │
│ HSE           │                                               │
│               │                                               │
│ Management    │                                               │
│ Projects      │                                               │
│ Workforce     │                                               │
│ Reports       │                                               │
│ Costs         │                                               │
│               │                                               │
│ Admin         │                                               │
│ Users         │                                               │
│ Settings      │                                               │
│ Audit         │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

Mobile:

- sidebar becomes drawer
- project selector remains accessible
- filters collapse into drawer/sheet
- tables become cards or horizontal scroll
- all primary touch targets approximately 44px or larger

## Project context

Every project-scoped page must visibly communicate:

- current project
- or All Projects, when allowed

Project context must persist and must not silently mix records.

## Main project page

```text
Project Header
 ├─ Status
 ├─ Phase
 ├─ PM
 ├─ Site Manager
 ├─ Dates
 └─ Capacity

KPI row
 ├─ Progress
 ├─ Workforce
 ├─ Tasks
 ├─ Materials
 ├─ Cost
 ├─ QA
 └─ HSE

Tabs
 ├─ Overview
 ├─ Planning
 ├─ Tasks
 ├─ People
 ├─ Materials
 ├─ Procurement
 ├─ Documents
 ├─ QA/QC
 ├─ HSE
 ├─ Costs
 └─ Activity
```

## Operational golden path

```text
Project
 → Weekly/Daily Plan
 → Task assignment
 → Attendance
 → Work execution
 → Material usage
 → Photo/evidence
 → Daily Report
 → QA/HSE findings
 → Cost update
 → Management dashboard
```

This golden path must work end-to-end before calling the product operationally complete.

---

# 8. MASTER ROADMAP

## PHASE 0 — FOUNDATION / DEFECT CONTROL

Goal: make the current foundation trustworthy before adding large workflows.

Tasks:

- preserve NestJS + Prisma + PostgreSQL architecture
- verify ProjectAccessGuard everywhere relevant
- verify `password_hash` never leaks
- finish remaining open security issues where practical
- improve `db:verify`
- establish `npm run verify:all` or equivalent verification orchestration
- reconcile stale documentation
- ensure no mock/demo data is used in production UI
- finish error/loading/empty states
- establish stable shared design system
- maintain HIIEKO brand
- finish remaining obvious UTF-8/i18n defects
- remove remaining non-HIIEKO amber accents from active pages

Acceptance:

- all workspaces typecheck
- backend tests pass
- web build passes
- db:verify passes
- authorization E2E passes
- no active Supabase runtime
- no fake data in operational screens

---

# PHASE B4 — MANAGEMENT FOUNDATION

Status: substantially complete.

Already verified/implemented:

- Projects CRUD
- Project detail
- Project memberships
- Users
- Teams
- Team members
- Workforce/Employees

Remaining/deferred areas should be explicitly tracked rather than silently abandoned:

- Applications migration
- full workforce project/team assignment if backend model requires additional work
- complete i18n sweep
- complete visual/amber cleanup

Do not return to B4 unless a regression is discovered.

---

# PHASE B5 — PLANNING + TASKS

## Planning

Implement/complete:

- weekly planning
- daily planning
- plan status
- task creation/editing
- task assignment
- team assignment
- worker assignment where supported
- dependencies
- start/end dates
- progress
- blockers
- comments/evidence where appropriate

## Tasks

Required UX:

- search
- project filter
- status filter
- team/assignee filter
- date filter
- priority
- progress
- detail page
- edit
- status transitions
- dependency visibility

Acceptance:

```text
Create Plan
 → Create Task
 → Assign
 → Save
 → Reload
 → Progress Update
 → Verify
 → Daily Report sees task
```

---

# PHASE B6 — ATTENDANCE + DAILY OPERATIONS

Attendance:

- real check-in/out
- project/geofence selection
- today's workforce
- filtering
- status
- correction workflow with authorization
- audit history
- mobile field flow

Daily reports:

- create
- edit before approval
- project
- weather
- workforce
- completed tasks
- materials
- blockers
- photos/evidence
- approval workflow
- history

Acceptance:

Attendance and Daily Report must share real project/task/person data rather than independent duplicate forms.

---

# PHASE B7 — MATERIALS + PROCUREMENT

## Stock

- stock balances
- movements
- receive
- consume
- transfer
- adjustments
- minimum stock alerts
- project allocation
- warehouse

## Procurement

```text
Material Request
 → RFQ / Supplier
 → Purchase Order
 → Delivery / Aviz
 → Receive
 → Inspect
 → Stock
 → Allocation
 → Consumption
```

Track:

- supplier
- PO
- Aviz
- quantity
- unit
- accepted/rejected/damaged quantity
- batch/serial where relevant
- project
- warehouse
- dates

Do not display a delivery as “received” unless its actual status says so.

---

# PHASE B8 — COSTS + EXPENSES

Move from a simple expense list to project cost control.

Required concepts:

- budget
- committed cost
- actual cost
- forecast
- variance
- cost categories
- supplier cost
- labor cost
- subcontractor cost
- logistics
- equipment
- travel
- other

Core relationship:

```text
Budget
 → Purchase Orders
 → Commitments
 → Invoices / Expenses
 → Actual Cost
 → Forecast
```

Acceptance:

A project manager must be able to answer:

> What have we budgeted, committed, spent and forecasted?

without exporting data manually.

---

# PHASE B9 — DOCUMENTS + FIELD EVIDENCE

Create a true project document/evidence center.

Document types:

- drawings
- method statements
- technical submittals
- approvals
- certificates
- warranties
- contracts
- reports
- inspection records
- photos

Capabilities:

- upload
- version
- revision
- approve
- supersede
- download
- project link
- entity link
- audit history

Field evidence:

- photo
- project
- task
- location/area
- user
- time
- GPS when available
- caption
- before/after

---

# PHASE B10 — QA/QC + NCR + PUNCH LIST

## Inspections

- inspection request
- inspection date
- inspector
- checklist
- acceptance criteria
- result
- evidence

## ITP

- activity
- inspection point
- acceptance criteria
- witness/hold point
- responsible party
- result

## NCR

- issue
- severity
- root cause
- corrective action
- owner
- due date
- evidence
- verification
- closure

## Punch list

- issue
- area
- photo
- owner
- priority
- due date
- status
- before/after evidence

Acceptance:

```text
Issue created
 → owner assigned
 → corrective action
 → evidence
 → verification
 → closure
```

---

# PHASE B11 — HSE / SAFETY

Add:

- incidents
- near misses
- unsafe conditions
- inspections
- toolbox talks
- permits
- corrective actions
- safety evidence

Dashboard signals:

- open high-risk issues
- overdue safety actions
- incidents this period
- near misses
- toolbox talks
- expiring permits

All safety history must be auditable.

---

# PHASE B12 — RFIs / SUBMITTALS / CHANGE ORDERS

RFI:

- number
- question
- discipline
- project
- submitter
- recipient
- due date
- response
- attachments
- status

Submittals:

- material
- document
- revision
- supplier/manufacturer
- submitted
- reviewed
- approved/rejected
- comments

Change orders:

- scope
- reason
- cost impact
- schedule impact
- approval
- history

---

# PHASE B13 — SUBCONTRACTORS + PEOPLE + EQUIPMENT

Subcontractors:

- company
- contract
- scope
- project
- workforce
- documents
- certificates
- dates
- performance

Equipment/tools/vehicles:

- asset
- serial number
- project
- location
- condition
- maintenance
- next service
- calibration
- assigned user/team

Trigger alerts for maintenance/calibration expiry.

---

# PHASE B14 — PROJECT FINANCIAL CONTROL

Management dashboard must expose:

- contract value
- budget
- committed cost
- actual cost
- forecast
- variance
- procurement exposure
- labor exposure
- subcontractor exposure

Use clear drill-down links to the underlying records.

---

# PHASE B15 — APPROVAL ENGINE + INTELLIGENT NOTIFICATIONS

Create a reusable approval concept:

```text
Submitted
 ↓
Pending Review
 ├─ Approved
 ├─ Rejected
 └─ Returned for Correction
```

Apply to:

- expenses
- daily reports
- purchase orders
- material requests
- inspections
- NCR closures
- change orders
- RFIs

Every decision records:

- user
- date/time
- decision
- comment
- previous state
- new state

Notifications should be event-driven:

- overdue task
- overdue NCR
- low material
- delayed delivery
- pending approval
- worker absent
- inspection due
- permit expiring
- RFI unanswered
- calibration expiring

Notifications must respect role + project + responsibility + urgency.

---

# PHASE B16 — PROJECT CLOSEOUT / HANDOVER

Build the project closeout workflow:

```text
Construction Complete
 → Punch List
 → Testing
 → Commissioning
 → As-Built Documents
 → Serial Numbers
 → Warranties
 → Certificates
 → Client Acceptance
 → Handover
 → O&M
```

Generate a project handover package from actual system records.

---

# PHASE B17 — MOBILE FIELD EXCELLENCE

Offline must be a visible product feature, not hidden infrastructure.

Show:

- synced
- pending
- failed
- conflict

Offline-capable actions:

- attendance
- daily report
- task progress
- photos
- material receipt
- issue creation

Sync must be:

- idempotent
- conflict-aware
- retryable
- auditable

---

# PHASE B18 — MAP / SITE PLAN

Add maps/site plans for projects.

Display:

- project boundary
- work areas
- workers/teams where permitted
- issues
- NCRs
- inspections
- deliveries
- equipment
- progress zones

For PV sites support blocks/arrays or equivalent work zones.

---

# PHASE B19 — 07:30 MORNING OPERATIONS BRIEF

Create an operational briefing generated every morning.

Example:

```text
PROJECT A
42 scheduled
38 present
2 absent
2 pending

TODAY
Structure — 14
Modules — 18
DC — 6

BLOCKED
Cable delivery
Crane maintenance

SAFETY
1 high-priority action

MATERIALS
Panels 91%
DC Cable 34%
Fasteners 8%
```

Provide the brief in dashboard form first, then add email/mobile/messaging delivery.

---

# PHASE B20 — EXECUTIVE / ROLE-BASED CONTROL TOWERS

Same database, different operational views.

## Managing Director

- active projects
- at-risk projects
- cost exposure
- major delays
- HSE risk
- quality risk

## Project Manager

- progress
- schedule
- manpower
- procurement
- cost
- QA/QC
- HSE
- blockers

## Site Manager

- today's workforce
- tasks
- materials
- deliveries
- safety
- inspections
- blockers
- daily reports

## Foreman

- own team
- attendance
- today's tasks
- material requests
- progress updates
- evidence

Do not build decorative charts. Every KPI must link to the records behind it.

---

# PHASE B21 — ROMANIAN ACCOUNTING / ERP INTEGRATIONS

Later, evaluate:

- RO e-Factura
- accounting export/import
- supplier invoice ingestion
- ERP integration

Do not implement external accounting logic prematurely. First define the required accounting workflow and data ownership.

---

# PHASE B22 — O&M FOUNDATION

After construction workflows are mature:

- asset registry
- PV equipment
- BESS equipment
- serial numbers
- warranties
- preventive maintenance
- corrective maintenance
- service tickets
- inspections
- alarms/events
- maintenance history

---

# 9. OCR — TEMPORARILY DISABLED / LAST MAJOR WORKSTREAM

## Current decision

**STOP OCR FEATURE DEVELOPMENT NOW.**

Do not spend further time tuning the current PaddleOCR extraction pipeline during the core application build.

The existing OCR architecture must remain isolated behind the provider abstraction, but the user-facing OCR feature should be disabled until the final OCR replacement milestone.

## Immediate work

Implement a feature flag, for example:

```text
OCR_ENABLED=false
```

Behavior when disabled:

- OCR scan/process UI is hidden or visibly marked unavailable
- OCR process endpoints return a clean controlled `FEATURE_DISABLED` / `503` response where appropriate
- no automatic expense extraction occurs
- uploads/documents themselves continue to work if otherwise valid
- existing OCR data remains intact
- no deletion of the old OCR code until replacement is validated

Do NOT silently fail.

## Final OCR milestone

Only after the operational system is otherwise stable:

1. define the exact receipt/invoice data contract
2. assemble a representative anonymized test set
3. benchmark multiple managed OCR/document-AI providers
4. select provider based on measured results
5. implement provider adapter
6. implement confidence/evidence mapping
7. implement human review workflow
8. connect approved extraction to Expenses
9. run regression tests
10. disable/remove old Paddle path only after replacement passes acceptance

Required structured fields may include:

- supplier/merchant
- CUI/VAT ID
- receipt/invoice number
- date
- currency
- subtotal
- VAT
- total
- payment method
- line items
- project/cost context

Never invent an unresolved value.

Every extracted field must have evidence/confidence where the provider supports it.

### OCR acceptance

No provider is considered accepted because it works on 3 sample receipts.

Require a representative test set and record:

- field accuracy
- missing-field rate
- wrong-value rate
- confidence behavior
- line-item quality
- Romanian support
- photo quality robustness
- processing time
- cost per document
- failure behavior
- privacy/data handling

---

# 10. DOCUMENTATION / HANDOFF MAINTENANCE

Every significant implementation must update the correct project-workflow document.

## `PROGRESS.md`

Update milestone state, completed work, deferred work and next step.

## `VERIFICATION.md`

Record only tests actually performed.

Never convert “should work” into PASS.

## `ISSUES.md`

Record:

- bug
- source
- severity
- reproduction
- status
- resolution
- verification

## `HANDOFF.md`

Keep operational information current for the next developer/AI.

## Historical entries

Do not delete useful history, but mark superseded architecture clearly.

---

# 11. UNIVERSAL ACCEPTANCE GATE

Before declaring ANY milestone complete, run the appropriate subset of:

### Code

- shared typecheck
- web typecheck
- mobile typecheck
- backend typecheck

### Tests

- backend unit tests
- relevant shared tests
- relevant frontend tests
- relevant integration/E2E tests

### Build

- shared build where applicable
- web production build
- backend build
- mobile build/typecheck when mobile scope changed

### Database

- Prisma migration status
- `db:verify`
- FK orphan checks
- business invariants
- migration replay/scratch DB for risky schema changes

### API

- endpoint HTTP status
- validation failures
- authorization failures
- project scoping
- persistence

### Browser

- actual authenticated browser flow
- create
- edit
- delete/archive where supported
- reload
- verify persistence
- error state
- empty state
- mobile/narrow viewport

### UX

- HIIEKO branding
- no dead buttons
- no fake records
- translated labels
- no mojibake
- accessible labels/focus
- usable touch targets

### Security

- unauthenticated → 401
- unauthorized/non-member → 403
- missing entity → 404
- cross-project access rejected
- sensitive fields excluded

### Documentation

- PROGRESS updated
- VERIFICATION updated
- ISSUES updated if needed
- HANDOFF updated if architecture/workflow changed

---

# 12. NEVER DO THESE THINGS

- Do not reintroduce Supabase.
- Do not use fake API fallback data to make a screen look populated.
- Do not mark untested behavior as verified.
- Do not invent endpoints.
- Do not invent Prisma fields.
- Do not bypass authorization to make a UI work.
- Do not expose password hashes/tokens/secrets.
- Do not hard-delete important historical records.
- Do not create cross-project relationships.
- Do not silently ignore failed writes.
- Do not hide errors behind “success” toasts.
- Do not spend the next milestone on sidebar cosmetics.
- Do not return to OCR until the final OCR milestone.
- Do not touch GitHub/push/commit unless the user explicitly asks.

---

# 13. WHEN A BACKEND GAP IS FOUND

Do not create fake frontend behavior.

Instead:

1. identify the missing domain capability
2. inspect Prisma relations
3. inspect DTO/service/controller
4. decide minimum correct backend change
5. add migration only if needed
6. add authorization
7. add unit/integration tests
8. expose API
9. wire frontend
10. verify persistence
11. document the change
12. continue to the next task

If the gap requires a significant architecture decision, stop and ask the user.

---

# 14. WHEN A BUG IS FOUND DURING VERIFICATION

Do not merely document it and continue if it is safely fixable within the current scope.

Use:

```text
Detect
 → Reproduce
 → Diagnose root cause
 → Fix
 → Regression test
 → Re-run feature acceptance
 → Update ISSUES/VERIFICATION
 → Continue
```

Do not patch symptoms that create hidden data inconsistencies.

---

# 15. END-TO-END PRODUCT DEFINITION OF DONE

HIIEKO is not ready for real operational handover until the following are true:

- all major roles can perform their real daily workflows
- every project-scoped workflow respects authorization
- data relationships are enforced by the database and service layer
- planning feeds tasks
- tasks feed daily execution
- attendance connects to people/project
- daily reports connect to tasks/materials/evidence
- materials connect procurement → delivery → stock → consumption
- costs connect budget → commitment → actual → forecast
- QA/HSE create actionable issues and closure workflows
- documents/evidence are versioned and retrievable
- notifications drive real action
- mobile offline workflows are reliable
- project closeout is supported
- dashboards are based on authoritative records
- all critical changes are auditable
- verification gates are repeatable
- documentation is synchronized with actual code
- OCR replacement passes a dedicated acceptance benchmark

---

# 16. CLINE SESSION BOOT INSTRUCTION

At the start of every session, use this exact sequence:

```text
1. Read Project workflow/CLINE_MASTER_ROADMAP.md
2. Read Project workflow/PROGRESS.md
3. Read Project workflow/VERIFICATION.md
4. Read Project workflow/ISSUES.md
5. Read Project workflow/CURRENT_STATUS.md
6. Read Project workflow/HANDOFF.md
7. Inspect the actual relevant source code and Prisma schema
8. Determine the current non-blocked roadmap phase
9. Enter PLAN MODE for that phase if architecture/design work is required
10. Enter ACT MODE and implement
11. Verify fully
12. Update workflow documentation
13. Continue to the next non-blocked phase
```

Cline should not wait for a new user prompt merely because one phase passed verification.

The user's next prompt should only be required for exceptional decisions, destructive migrations, external credentials, or ambiguous business requirements.

---

# 17. FIRST ACTIONS AFTER THIS FILE IS ADDED

The next Cline run should NOT start with more OCR work.

It should execute these actions in order:

### Step A — Establish master execution control

- read all workflow docs
- create a concise current-state section in `CURRENT_STATUS.md` if stale
- verify that `PROGRESS.md`, `VERIFICATION.md`, and `ISSUES.md` agree on current state
- mark stale historical information as superseded rather than treating it as current

### Step B — Disable OCR feature

- add OCR feature flag
- hide/disable active OCR UI
- return controlled provider-disabled response
- ensure normal uploads/documents continue to work
- record decision in PROGRESS/VERIFICATION

### Step C — Build verification orchestration

Create a safe repeatable verification command such as:

```text
npm run verify:all
```

It should run the applicable project checks without deleting data or requiring GitHub.

### Step D — Create prototype specification

Create:

```text
Project workflow/HIIEKO_PROTOTYPE.md
```

This must contain the page map, role flows, project-context model, core workflows, status transitions, mobile behavior and the golden-path workflow from project planning through daily execution.

### Step E — Continue roadmap

Then continue automatically with:

```text
Planning + Tasks
→ Attendance + Daily Reports
→ Materials + Procurement
→ Costs + Expenses
→ Documents + Evidence
→ QA/QC + NCR + Punch List
→ HSE
→ RFIs/Submittals/Change Orders
→ Subcontractors/Equipment
→ Financial Control
→ Approvals/Notifications
→ Closeout/Handover
→ Mobile Offline Excellence
→ Maps
→ Morning Operations Brief
→ Executive Control Towers
→ Integrations
→ O&M
→ FINAL OCR REPLACEMENT
```

Do not skip a phase silently. Record deferred items with reasons and keep moving on the next dependency-safe phase.

---

# 18. FINAL PRINCIPLE

The objective is not to make every page look finished.

The objective is to make the system **correct, connected, operational, auditable and maintainable**.

The database must understand the business relationships.
The backend must enforce them.
The frontend must expose them clearly.
The mobile app must support field reality.
The verification system must prove them.
The workflow documents must remember them.

When in doubt:

> **Inspect first. Implement second. Verify third. Document fourth. Continue fifth.**

---

## END OF MASTER ROADMAP
