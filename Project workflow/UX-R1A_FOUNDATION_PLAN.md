# HIIEKO UX-R1A — Frontend Foundation Plan

**Project:** HIIEKO Solar Site Management System  
**Repository:** `hiieko-System-main`  
**Purpose:** Correct frontend architecture and terminology problems before the larger visual redesign.

---

## 1. Why this file exists

This is the implementation contract for **UX-R1A**.

The goal is not to redesign the whole product yet. The goal is to remove correctness problems that would otherwise make a later redesign unstable.

### UX-R1A scope

1. Fix the root route / hook-order problem.
2. Fix stale task rendering in role dashboards.
3. Fix route/nav/role-guard mismatches.
4. Repair translation corruption and missing keys.
5. Establish one translation mechanism and one terminology vocabulary.
6. Set the document language correctly.
7. Add guardrails so the same problems do not return.

### Explicitly out of scope

- Large visual redesign
- New business modules
- Database migrations unless strictly required by an already-existing frontend contract
- New backend business logic
- Replacing working APIs with invented APIs
- Figma implementation
- Mobile feature expansion

---

# 2. Current product principles

These must remain true during UX work:

- **Do not break the working backend.**
- Preserve existing API contracts unless a real defect is proven.
- Do not invent data that the backend does not provide.
- Keep business workflows intact.
- Separate source-of-truth modules instead of duplicating records.
- Worker and field roles must see operational information relevant to their actual work.
- Project context must be explicit rather than guessed.

Core domain model:

| Concept | Meaning |
|---|---|
| Project | Site/project context |
| Daily Planning | What should happen today |
| Tasks | Who is responsible and task state |
| Attendance | Who is physically on site |
| Issues | Problems/blockers |
| Stock | Material availability and movement |
| QA/QC + HSE | Compliance/safety |
| Photos/Documents | Evidence |
| Daily Report | Official workday record |
| Project Control | Whether the project is under control |

---

# 3. Critical findings from UX-R0

## A1 — Root/dashboard duplication

There are currently several routes representing overlapping concepts:

- `/`
- `/control-tower`
- `/statistici`

`/` is currently overloaded between worker home, dashboard, and control-tower behavior.

### Required direction

Do not create another dashboard.

Create a clear route model:

- `/` = role-specific home/workspace entry
- `/control-tower` = management/site control surface when explicitly needed
- `/statistici` = remove/merge when the information is already owned by Control Tower

Do not duplicate KPI data simply to produce another page.

---

## A2 — Rules of Hooks violation on `/`

The root page currently returns different role UIs before all hooks have been called.

This can cause hook-order failures when authentication resolves or the role changes.

### Required fix

Refactor `/` so hooks are called unconditionally.

Preferred structure:

```tsx
function HomePage() {
  const auth = useAuth()
  const workspace = useWorkspace()
  const data = useWhateverIsRequired()

  if (auth.loading) {
    return <LoadingState />
  }

  return <RoleHome role={auth.user?.role} ... />
}
```

Role-specific rendering happens **after** hooks are established.

Do not use conditional early returns before hooks.

---

## A3 — WorkerDashboard stale task contract

Current `WorkerDashboard` logic uses an old task shape:

- `assigned_to_id`
- `TODO`
- `DONE`

Those are not the current task assignment/status contract.

The current task model uses:

- `TaskAssignment.user_id`
- `PLANNED`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`
- `VERIFIED`
- `CANCELLED`

Field roles should obtain their personal daily tasks from:

`GET /api/daily-plans/my-tasks?date=...`

### Required fix

Do not repair this by inventing a new endpoint.

Use the current daily-plan personal-task contract.

The worker/team execution experience should consume the same source of truth as the backend domain model.

---

## A4 — Translation corruption

Known examples include corrupted Romanian strings such as:

- `general.retry`
- `general.close`
- attendance heading typo/corruption
- corrupted expense/report strings
- replacement-character/lossy `?` strings

### Required fix

Treat Romanian as the canonical source-language text.

English is the translation.

Do not preserve corrupted source strings merely because they already exist.

Every user-visible translation must be valid UTF-8 text.

---

## A5 — Too many localization mechanisms

The application currently mixes:

1. `t()` calls
2. inline locale ternaries such as `locale === "ro" ? ... : ...`
3. hardcoded visible strings

This makes terminology drift inevitable.

### Required direction

One mechanism:

```tsx
t("semantic.key")
```

Visible text should not be built with locale ternaries inside page/components.

Example:

**Bad**

```tsx
locale === "ro" ? "Pontaj" : "Attendance"
```

**Good**

```tsx
t("attendance.title")
```

---

# 4. Canonical terminology

Use a stable domain vocabulary.

## English canonical concept names

- Projects
- Sites
- Teams
- Workforce
- Tasks
- Daily Planning
- Daily Reports
- Attendance
- Issues
- Stock
- Deliveries
- Expenses
- Documents
- Photos / Evidence
- QA/QC
- HSE
- Notifications
- Users
- Settings

## Romanian UI terminology

Use consistent Romanian business terminology throughout the product.

Examples:

| Concept | Romanian UI |
|---|---|
| Project | Proiect |
| Site | Șantier |
| Team | Echipă |
| Workforce | Personal |
| Task | Sarcină |
| Daily Planning | Planificare zilnică |
| Daily Report | Raport zilnic |
| Attendance | Pontaj / Prezență (choose by context and keep consistent) |
| Issue | Problemă / Blocaj (choose by context and keep consistent) |
| Stock | Stoc |
| Delivery | Livrare |
| Expense | Cheltuială |
| Documents | Documente |
| Photos / Evidence | Fotografii / Dovezi |
| QA/QC | QA/QC |
| HSE | SSM / HSE depending on established product terminology |
| Notifications | Notificări |
| Users | Utilizatori |
| Settings | Setări |

Do not casually introduce multiple synonyms for the same UI concept.

---

# 5. Translation architecture

## Canonical key rules

Translation keys should be:

- semantic
- stable
- English-slugged
- grouped by domain

Examples:

```text
general.retry
general.close
general.loading

nav.projects
nav.teams
nav.workforce
nav.tasks
nav.planning
nav.daily_reports
nav.attendance
nav.issues
nav.stock
nav.expenses
nav.documents
nav.notifications

attendance.title
attendance.today
attendance.present
attendance.absent

daily_report.title
daily_report.submit
daily_report.submit_confirm_message

planning.title
planning.confirm_complete_dismiss
```

Avoid component-specific keys that describe implementation rather than meaning.

---

# 6. Translation inventory work

Before implementing the broader redesign:

1. Identify all translation keys.
2. Remove duplicate definitions.
3. Remove dead keys where safe.
4. Add missing referenced keys.
5. Remove inline locale ternaries.
6. Move visible hardcoded strings into translation keys.
7. Validate both RO and EN.
8. Make missing translation behavior fail visibly during development rather than silently returning the key.

Known audit figures to use as the cleanup baseline:

- ~969 unique translation keys
- ~352 referenced keys
- ~623 apparently dead keys
- 13 duplicate keys
- 6 referenced-but-undefined keys

These numbers are an audit baseline, not a reason to delete keys blindly.

Deletion must be based on actual repository references.

---

# 7. Route / guard alignment

Review:

- `/workforce`
- `/santiere`
- `/statistici`
- `/aprobare`

and all navigation items.

For every route answer:

1. Who can see it?
2. Who can enter it directly?
3. Does navigation show it to the same users?
4. Is the page still needed?
5. Is it a duplicate of an existing surface?
6. Does the role have a meaningful action there?

Navigation and page authorization must describe the same product model.

---

# 8. Workspace context foundation

The product needs a stronger frontend context than just an in-memory selected project.

Future workspace state should be able to resolve:

- active project
- active site
- active team
- team leader
- crew
- work date
- user capabilities

Use existing APIs/data where possible.

Do not invent a new backend hierarchy simply to support the frontend.

This foundation is important for:

- Worker My Day
- Team Leader Team Day
- Foreman Site Day
- Site Manager Site Control
- PM Project Control

---

# 9. Accessibility / semantics baseline

As part of R1A cleanup:

- `html lang` must reflect the active locale.
- Every icon-only action needs an accessible label.
- Buttons need visible/busy states where async work occurs.
- Form fields need labels.
- Tables must have a mobile-safe strategy.
- Do not rely on color alone for status.
- Preserve existing modal focus behavior and keyboard support.
- Add meaningful `alt` text to informative images.
- Keep touch targets practical on mobile.

This is a baseline, not the complete accessibility project.

---

# 10. Component discipline

Existing reusable UI components should be reused.

Do not add another parallel button/card/modal system.

Before creating a raw HTML control, check whether the shared UI layer already provides it.

Target:

```text
page
  -> PageHeader
  -> context / filters
  -> content sections
  -> shared UI primitives
```

Avoid large pages implementing their own visual language independently.

---

# 11. UX-R1A implementation sequence

## R1A.1 — Correctness first

Fix:

- root hook-order problem
- WorkerDashboard stale task contract
- obvious route/guard mismatch
- `html lang`

## R1A.2 — Translation source cleanup

Fix:

- corrupted Romanian strings
- duplicate translation definitions
- missing referenced keys
- hardcoded visible strings
- inline locale ternaries

## R1A.3 — Terminology normalization

Normalize:

- navigation labels
- page titles
- common actions
- status labels
- role labels
- Project/Site/Team terminology

## R1A.4 — Guardrails

Add development checks where practical for:

- missing translation keys
- duplicate translation keys
- invalid locale usage
- unsupported task statuses
- accidental legacy task fields

---

# 12. Acceptance criteria

UX-R1A is complete only when all of the following are true.

## Functional

- `/` does not violate Rules of Hooks.
- Worker/Team Leader/Foreman/Site Manager/Technician task views no longer depend on `assigned_to_id`, `TODO`, or `DONE`.
- Worker personal tasks come from the current daily-plan API contract.
- Navigation visibility and route guards agree.
- No known translation corruption remains in active UI.
- No referenced translation key is undefined.
- Active locale updates the document `lang`.

## Quality

- Shared UI components are used instead of unnecessary raw controls.
- No new visual subsystem is introduced.
- No working business module is removed.
- No backend contract is changed without evidence and a documented reason.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run web:typecheck
npm run web:build
npm run db:verify
```

Also perform a browser role sweep for:

- Worker
- Team Leader
- Foreman
- Site Manager
- PM
- Manager
- Admin

And verify at:

- 375px mobile
- 768px tablet
- 1440px desktop

---

# 13. What comes after UX-R1A

Do not turn this file into the full redesign specification.

After R1A is green:

### UX-R1B
Translation architecture and terminology hardening.

### UX-R2
Navigation + Workspace/Project/Team context.

### UX-R3
Worker + Team Leader home redesign.

### UX-R4
Tasks + Planning UX.

### UX-R5
Daily Report UX.

### UX-R6
Foreman + Site Manager.

### UX-R7
PM + Manager + Admin.

### UX-R8
People / Profiles / Teams.

### UX-R9
Documents / Photos / Evidence.

### UX-R10
Expenses / Receipts / Fuel.

### UX-R11
Mobile hardening.

### UX-R12
Integration + full UX verification.

---

# 14. Figma Make strategy

The visual redesign should not be generated randomly inside implementation.

Use Figma Make to establish approved interaction/visual references for these four representative workspaces:

1. Worker My Day
2. Team Leader Team Day
3. Site Manager Site Control
4. PM Project Control

The approved prototype becomes the implementation reference.

Cline then implements the approved structure using the existing HIIEKO UI primitives and real API contracts.

Acceptance should include:

- visual hierarchy match
- responsive behavior
- real data states
- loading/empty/error states
- role correctness
- RO/EN
- 375px and 1440px verification

---

# 15. Non-negotiable rule

**Do not redesign around broken contracts.**

First make the product internally coherent.

Then design the polished experience.

Then implement it without changing the business truth underneath.
