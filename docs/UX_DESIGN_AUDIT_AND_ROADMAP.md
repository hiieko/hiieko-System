# HIIEKO UX Design Audit and Roadmap

**Date:** 2026-10-05  
**Compared:** `v0/hiieko-frontend-prototyping-1609cf94` and `feat/production-v0-parity-final` (PR #33)  
**Purpose:** Define a professional, responsive, production-safe product experience using v0 as a reference and HIIEKO's real workflows, roles, and data as the authority.

## Executive summary

The product should feel like one coherent EPC operations workspace on every route and for every user. The shared shell, vocabulary, status colors, form patterns, overlays, and responsive rules should be consistent. Navigation entries and actions remain permission-aware: users share the same shell structure, while seeing only the pages and actions their role can access.

The most important distinction in the code comparison is that the generic centered `Modal` is already nearly identical between the v0 branch and PR #33. PR #33 primarily changes its z-index token. `ConfirmDialog` is also a shared primitive. The larger differences are in workflow-specific contents, controls, and follow-up behavior. PR #33 additionally introduces a reusable `Drawer` for detail and session workflows. A useful audit must therefore compare each overlay by job and lifecycle, not just by its outer frame.

The v0 branch is 60 commits behind `master` and 16 commits ahead. It is a useful visual/workflow reference, but its old code and illustrative data must not be copied wholesale into production. PR #33 is the current production frontend candidate; it is open and its preview is available at [PR #33 preview](https://deploy-preview-33--clever-froyo-2b093c.netlify.app).

## What to keep, adapt, and leave out

| Decision | Recommendation | Reason |
|---|---|---|
| Keep | HIIEKO's project and site context, role-aware workspaces, real API records, lifecycle actions, and Romanian/English support | These are the product's operating model and data authority. |
| Keep | PR #33's operations shell, daily plan progress/readiness/attention summaries, mobile primary navigation, and reusable drawer | These are useful production patterns that expose project progress and support small screens. |
| Keep | v0's clear hierarchy, scannable status/priority cues, action-oriented dashboards, concise cards, and contextual modal/drawer patterns where they fit a real workflow | These reduce time-to-understand and time-to-act. |
| Adapt | v0 role-workspace layouts, KPI cards, notifications, profile, and project-overview concepts | Bind them to real endpoints, approved role visibility, meaningful empty/loading/error states, and existing HIIEKO terminology. |
| Adapt | v0 modal compositions and forms | Preserve validation, authorization, backend contracts, and exact action consequences; use a consistent HIIEKO overlay frame. |
| Leave out | Demo users, projects, metrics, queues, hard-coded progress, mock persistence, fake IDs, and prototype-only successful actions | They can imply facts or operations that do not exist in production. |
| Leave out | Duplicate destinations that repeat project/control data without a distinct audience or action | Prefer one authoritative place for a metric and a link to its detail. |
| Leave out | Extra features solely because they appear in the prototype | Add only when they support a real EPC decision or task and have a real source of data. |

## Visual direction

### Color

Use the production design tokens as the starting point and document one palette as the product standard. PR #33 defines fixed navy chrome (`#111827`), amber navigation/action accent (`#F59E0B`), and positive completion green (`#49C89E`), while content keeps HIIEKO green and semantic success/warning/critical/info colors. This is a coherent EPC palette when applied consistently:

- Navy for the shared shell and navigation.
- One amber accent for active navigation and primary shell-level emphasis.
- Green for HIIEKO content actions and successful/completed states, according to the semantic tokens.
- Red only for destructive or critical states; amber for warning; blue for information.
- Neutral surfaces, borders, and text for most of the page so operational status colors remain meaningful.

Do not use green, amber, and red interchangeably to decorate cards. A color must carry the same meaning on every page. Check normal text contrast at WCAG AA and provide a non-color cue (label/icon/pattern) for status.

### Typography, spacing, and icons

- Keep Inter, the established spacing/radius scale, and the shared `PageContainer` / page-header patterns.
- Use the existing Lucide icon family. Give each navigation destination one stable icon; avoid multiple icons for the same meaning.
- Use icons to reinforce a visible label, not replace it, except for familiar compact controls with an accessible name and tooltip.
- Use icon badges sparingly in KPI cards. Do not give every card a different accent color.
- Use consistent size/stroke, 44 px minimum touch targets, and explicit `aria-label` values for icon-only buttons.

### Dark theme

The request includes a suitable dark-mode switch. The current PR #33 design contract treats the navy shell as fixed brand chrome and explicitly does not define a user-selectable theme. Add dark mode as a deliberate design-system decision before implementation: define semantic light/dark surface, text, border, input, overlay, chart, and status tokens; decide where preference is stored; and verify contrast and charts in both modes. Put the switch in the profile/settings menu and in the mobile navigation drawer/footer, not as an extra unlabeled icon in the crowded top bar. Respect system preference until a user choice is saved. Keep status meanings stable between themes.

## Shared shell and responsive navigation

### Desktop and tablet

- Keep one shared shell on all authenticated pages: consistent brand/sidebar, header, project selector, page title/breadcrumb, content width, and footer/utility placement.
- Keep navigation data in one role-aware source. Maintain a consistent group order and active state for each user; hide inaccessible links without exposing restricted routes or actions.
- At wide widths, use the desktop sidebar and content canvas. At tablet widths, collapse the sidebar or use the drawer before content becomes cramped; keep project selection and the page title visible.
- Avoid page-specific shell colors or independent navigation implementations.

### Phone

- Keep the compact top bar, explicit current-project context, and fixed bottom bar for the five most-used operational routes. The current primary set is Home, Daily Plan, Tasks, Issues, and Attendance; validate this against actual role use before changing it.
- Put less frequent destinations, language, theme, profile, and sign-out in the hamburger drawer. Bottom-bar destinations remain role-filtered.
- Give each bottom item an icon and short visible label; use a clear active indicator. Never rely on color alone.
- Keep safe-area insets for the bottom bar, drawers, and dialogs. Reserve enough bottom padding on page content so the fixed navigation cannot cover the last action or row.
- Use horizontal scrolling only for compact tab/filter groups where the selected state remains visible. Avoid turning primary navigation into a long horizontal strip of unlabeled icons.
- Verify at 360, 375, 390, 768, 1024, and 1440 CSS px; require no unintended horizontal page overflow.

## Modal, drawer, and confirmation standard

### Shared frame

Keep one reusable modal frame for short, focused create/edit workflows and one drawer for long details or contextual work. Both should use the same typography, semantic tokens, borders, focus ring, button hierarchy, translations, and layer order.

| Overlay type | Use it for | Required behavior |
|---|---|---|
| Centered modal | Short create/edit forms and quick choices | Clear title/context, grouped fields, inline validation, sticky or clearly visible actions, sensible max-height with internal scrolling on phone. |
| Right drawer | Record details, task/issue context, attendance session | Preserve page context, allow independent scroll, provide clear close affordance, and avoid nesting dialogs. |
| Bottom sheet on phone | A compact choice/action when a side drawer would be awkward | Safe-area padding, reachable actions, close by button/backdrop/Escape where available. |
| Confirmation dialog | Publish, approve/reject, complete, cancel, delete, or other consequential transitions | State the affected record and consequence; distinguish cancel from destructive confirmation; prevent duplicate submit; show loading and backend error; close only after success or explicit cancel. |
| Toast/status feedback | Successful save, failure, or background completion | Concise translated message; use an alert/live region for accessible announcement; do not substitute for inline form errors. |

### Interaction and accessibility checklist

- Escape closes the overlay unless a save is in progress; a loading action cannot be accidentally dismissed into duplicate submission.
- Backdrop click behavior is consistent and never silently discards a dirty form. If data is dirty, ask whether to discard.
- Move focus into the overlay, trap it while open, return focus to the opener after close, and label the dialog with `aria-labelledby` / `aria-describedby`.
- Put keyboard focus on a safe first field or cancel action; do not automatically focus a destructive confirmation button.
- On phones, use nearly full-width dialogs with `max-height: calc(100dvh - safe areas)` and internal scroll. Keep primary and secondary actions reachable, stacked when needed.
- Label required and optional fields; identify invalid fields and summarize errors; preserve entered values after server errors.
- Show pending, success, no-result, permission-denied, and failure states. Real authorization and API responses are authoritative.
- Prefer contextual drawer/modal over navigating away only when the user benefits from preserving the current list and its filters.

## Page-by-page audit and planned direction

The table covers every production route family present in PR #33. “Review” means compare the live PR preview and v0 concept, then check the implementation against the design contract above; it does not assert that every breakpoint and overlay has already been visually verified.

### Verified source comparison and decisions

This comparison uses the checked-out source trees for `v0/hiieko-frontend-prototyping-1609cf94` and PR #33. It distinguishes code facts from design recommendations; it does not claim that every route has received screenshot review at every viewport.

| Area | What the code comparison shows | Best choice for production |
|---|---|---|
| Shared modal frame | The v0 modal uses a centered white panel with a fixed content region. PR #33 adds a focus trap, labelled dialog semantics, semantic surface tokens, and a viewport-limited scrolling panel. | Keep PR #33's accessible, scrollable frame. Expose header and footer slots so long forms keep their progress and actions visible. |
| Task create / assign dialogs | `TaskCreateModal.tsx` and `TaskAssignModal.tsx` are present in both branches and have no branch diff. The form workflow is already shared. | Preserve the real project stage/zone options, assignment permissions, and validation. Improve the frame and action reachability; do not replace the form with v0 demo fields. |
| Project creation | PR #33 has a bespoke seven-step overlay outside the shared modal component. Its progress and review steps are useful, but its backdrop, close behavior, and footer differ from other dialogs. | Keep the seven-step workflow and mount it in the shared modal frame, with a fixed mobile footer. This is now applied on PR #33. |
| Quick search | `GlobalQuickSearch.tsx` is a PR #33 addition, not a v0 search pattern. It filters role-visible navigation destinations only; it does not search projects or records. | Label it honestly as page navigation, show the section for each result, and keep record search inside the relevant task/project pages until a permission-safe search API exists. |
| Task list | Existing cards already expose status, schedule, work package, zone, assignment, measured quantity, dependencies, and the workflow. The first render could be blank before the loading effect runs. | Keep the richer production task card and backend lifecycle; show immediate loading, real status totals, a useful empty state, and search across fields available in the permitted task response. This is now applied on PR #33. |
| Project progress | Project detail previously showed project metadata and workspace links, but no task-derived completion summary. | Show completion as completed/verified tasks divided by tasks returned for this project. Label the measure, and show an explicit empty or API-error state instead of inventing a percentage. This is now applied on PR #33. |
| Operations home | PR #33 already promotes the API-backed v0-style operations home and preserves drilldown behavior. | Keep that page as the production base; refine its hierarchy only where real project/date scoped data supports it. Do not re-add illustrative v0 KPIs. |
| Page-specific production forms | PR #33 adds live Aviz, inspection, supplier, and warehouse forms that were absent as matching production components in the v0 tree. | Keep the production endpoints, authorization, and validation; reuse the modal frame and form layout patterns rather than importing prototype-only persistence. |

### Overlay decisions by workflow

| Route / workflow | Preferred pattern | Keep from the current production flow | Change / avoid |
|---|---|---|---|
| `/tasks` create | Centered shared modal; one-column fields on phones; persistent footer | Task code/title validation, actual project stages and zones, API submission | Do not add fake users, sample assignments, or prototype-only fields. |
| `/tasks` assign | Compact modal or bottom sheet on narrow screens | Project-member lookup, role checks, assignment result handling | Explain the no-members state and preserve the task context in the dialog heading. |
| `/projects` create | Shared modal with step progress in the fixed header and Back/Next/Create footer | Existing seven-step identity/location/technical/date/budget/members/review flow | Avoid a second hand-built backdrop/panel; keep errors next to the action and buttons reachable on phones. |
| `/planning` create | Shared modal with project/date context and scrollable task selection | API-backed task selection, validation, plan creation | Keep submit actions fixed; do not let a nested scroll area hide the footer. |
| `/issues` create/detail | Centered short create modal; drawer for long evidence/history | Severity, project/task links, server lifecycle | Do not put a long detail record in a small centered dialog. |
| `/pontaj` session | Drawer / bottom sheet for a session; focused confirmation only for consequential actions | GPS and server-owned attendance session state | Do not claim successful clock-in when location or API actions fail. |
| `/control-tower` drilldown | Drawer containing the source rows behind the selected metric | API-derived figures and existing drilldown routes | Every KPI needs its source and scope; do not invent demo values. |
| `/avize`, `/qa-qc`, `/suppliers`, `/depozite` create | Shared modal with short sections and a fixed action row | Production forms and their existing API contracts | Avoid duplicate overlay markup; keep units, evidence, and validation visible. |
| `/projects/[id]` member removal / other irreversible actions | Shared confirmation dialog | Existing authorization and server response | State the exact project/member consequence; keep routine navigation out of confirmation dialogs. |
| Long forms and editors | Dedicated page or full-height sheet when the task needs sustained work | Domain-specific controls and drafts | Do not force the solar canvas or a multi-section report into a cramped centered modal. |

### Page-level design choices

Use these choices as the route review checklist. “Adopt” means borrow the visual/workflow pattern only; production data and role rules remain authoritative.

| Route family | Best page composition | Adopt from v0 | Production-specific decision |
|---|---|---|---|
| `/`, `/control-tower` | Project-scoped health summary, completion, schedule risk, blockers, then actionable queues | Strong operations hierarchy and compact KPI cards | Preserve real API source links and loading/error states; no sample metrics. |
| `/planning` | Selected day/project summary, readiness and blockers, then a scannable task table | Day-first workflow and visible progress | Keep plan state distinct from task state; mobile rows become cards. |
| `/tasks` | Real status summary, fast filters/search, task cards with owner, due date, quantity progress, and next status action | Clear status grouping and compact task cards | This phase adds API-derived totals, record-aware filtering, and a visible first-load/empty state. |
| `/projects` | Searchable portfolio cards with status, date range, client, people count, and a clearly sourced progress indicator | Portfolio scanability and project identity | Do not invent completion; show progress only when backed by task records. Creation keeps its seven steps in the common modal. |
| `/projects/[id]` | Header with phase/status and dates, task completion summary, then Overview / Stages / Members / Settings | Clear project header and progress emphasis | This phase adds task-derived completion; no financial or physical completion estimate without its own source. |
| `/issues` | Filterable issue queue with severity, age, affected work, owner, and next action | Severity-led scanning and compact rows | Long evidence and history belongs in a drawer; preserve current workflow transitions. |
| `/qa-qc`, `/qa` | Inspection queue with result, evidence, responsible person, and follow-up | Inspection status hierarchy | Keep checklist/evidence server-backed and review whether `/qa` should route to the canonical page. |
| `/pontaj` | Site/day selector, who is present, hours, and exceptions; focused worker clock-in card | Clear attendance status at a glance | Keep geolocation/session requirements explicit; stack summaries on phones. |
| `/rapoarte`, `/rapoarte/form` | Review queue plus a guided report flow with work, people, materials, safety, evidence | Sectioned entry and status cues | Keep project/date context persistent; review before submission. |
| `/avize` | Delivery queue with supplier/date/project and item quantities; discrepancies surfaced | Structured delivery summary | Keep each quantity next to its unit and delivery evidence. |
| `/stocuri`, `/depozite` | Stock overview by warehouse/material, unit-aware low-stock cues, then movement history | At-a-glance material state | Do not aggregate unlike units; use a drawer for movement detail. |
| `/cheltuieli`, `/aprobare` | Amount, currency, receipt, requester, due age, and decision state | Approval queue clarity | Keep approve/reject consequence and reason explicit; no status color without a label. |
| `/solar-configurator` | Full-width technical canvas with compact project/tool controls | Spatial editing and clear tool grouping | Keep editor-specific undo/save/validation; do not apply a dashboard card grid to the canvas. |
| `/santiere` | Map/list split with a strong site identity and location state | Map-led site navigation | Provide a usable list alternative and phone map/list switch. |
| `/customers`, `/teams`, `/workforce`, `/utilizatori` | Searchable directory cards with relationship, role, current assignment, and status | Compact identity cards and role hierarchy | Respect role visibility; avoid duplicate people lists and prototype roles. |
| `/documents`, `/documente` | Canonical project document list with type, owner, date, and access state | File-type and project cues | Resolve the duplicate route; upload/preview errors must be honest. |
| `/notificari` | Urgency/date groups with source project and direct next action | Clear unread/priority grouping | Prefer a deep link to the record over a modal for routine detail. |
| `/profil`, `/login`, `/signup` | Account/preferences form; simple auth form outside the app shell | Clear forms and account identity | Keep theme preference separate from security and preserve all auth/session behavior. |
| `/design-review/**` | Isolated internal design lab | Prototype-only explorations | Keep out of normal navigation and never treat sample data as production records. |

### Implementation status

The current PR now includes an execution summary on `/tasks`, a task-derived progress panel on `/projects/[id]`, page-only search wording and grouped results, and the shared project-creation dialog frame. The remaining rows below are page design decisions and review targets; they are not claims that every listed page has already been redesigned.

| Page / routes | Keep or use as base | Audit focus and planned improvement | Overlay / icon / responsive notes |
|---|---|---|---|
| Home / Control Tower `/`, `/control-tower` | PR #33's production-backed operations home and drilldown behavior | Make project health and completion progress easy to scan: headline status, completed/total work, schedule risk, blockers, next actions, last-updated context. Each KPI must link to its source detail. Avoid duplicated statistics pages. | Use drawer for KPI drilldown; use concise metric icons with labels; stack KPI cards on phone without squeezing chart labels. |
| Daily Plan `/planning` | PR #33's daily task table, overlapping counters, attention list, site readiness, and date controls | Keep task progress visibly tied to the selected project/date; distinguish plan status from task status; clarify assignment, blocker, and next action. | Create-plan modal is a key reference case; retain real task selector and server validation. Table becomes stacked task cards at narrow width; counters wrap. |
| Tasks `/tasks` | Production task records and workflow/status behavior | Prioritize task name, project, owner/team, due date, progress, and blocker; filters/search should remain usable on phone. | Audit create and assign modals for grouped fields, clear assignment feedback, loading/errors, and mobile action layout. |
| Issues & Blockers `/issues` | Real issue lifecycle and severity | Make severity, affected project/task, owner, status, and unblock action immediately visible; keep filters/search and detail context. | Audit create/detail overlays; drawer is preferred for long issue detail; provide explicit destructive confirmation only where action is irreversible. |
| QA/QC `/qa-qc`, `/qa` | Inspection evidence and real inspection states | Make result, checklist/compliance status, responsible person, evidence, and follow-up visible; distinguish pass, fail, and pending. | Audit inspection creation/details; checklist fields need phone-friendly sections and clear evidence affordance. |
| Attendance `/pontaj` | Real attendance records and session workflow | Clearly show who is on site, time, team, and exceptions, scoped to the selected project/day. | Keep session work in a drawer where useful; large reachable clock-in/out controls on mobile; confirm only when consequence warrants it. |
| Daily Reports `/rapoarte`, `/rapoarte/form` | Official report record and review state | Use a guided form with progress/sections; summarize work, people, materials, safety, and evidence without creating a huge unbroken form. | Phone form sections should save/retain state; review/submit confirmation summarizes date and project. |
| Deliveries & Avize `/avize` | Real delivery and document workflow | Surface supplier, project, delivery date, material quantities, receipt/document state, and discrepancies. | Create modal field order follows real delivery workflow; use file/photo capture without hiding permissions/errors. |
| Materials & Stock `/stocuri`, `/depozite` | Stock levels, movements, and warehouses | Show unit with every quantity, low-stock state, warehouse/project context, and movement history; avoid mixing unlike units. | Use a drawer for movement/history; phone rows become cards with quantity and unit kept together. |
| Expenses `/cheltuieli` | Existing expense records and approval path | Emphasize amount/currency, category, project, submitter, receipt, and approval state; never infer totals when source data is unavailable. | Create/edit receipt flow must preserve input on error; monetary amount and currency remain adjacent on small screens. |
| Projects `/projects`, `/projects/[id]` | Project portfolio and project details | Portfolio shows status, phase, dates, completion, blockers; detail page gives one authoritative progress summary and links to execution modules. | Avoid duplicate project settings surfaces; organize project detail into responsive tabs/sections; confirm destructive settings changes. |
| Solar Configurator `/solar-configurator` | Existing solar design/build capability | Preserve domain-specific canvas tools; make project context, save state, undo/redo, and validation visible. Do not force a generic dashboard layout onto the editor. | Toolbar should adapt to compact horizontal controls on tablet/phone; use sheets for tool options and confirmation for discard/replace. |
| GIS Sites `/santiere` | Real site locations/map context | Keep map and site identity connected; provide an accessible list alternative and clear location state. | On phone, list/map toggle and full-screen map; detail in a bottom sheet/drawer. |
| Approvals `/aprobare` | Existing approval authority and state transitions | Make requested action, requester, project, age/due date, and evidence clear; show approve/reject consequences and audit result. | Confirmation dialog includes exact record and action; reject requires a reason if the workflow contract requires it. |
| Customers `/customers` | Customer/account relationships already represented in production | Show only fields useful to project delivery and account coordination; avoid prototype-only CRM scope. | Short create/edit modal; phone list cards retain customer + project relationship. |
| Documents `/documents`, `/documente` | Real document storage and project evidence | Establish one canonical route/label; show document type, project, date, owner, and access/availability state. | Upload and preview controls need phone-sized targets and real permission/error feedback. |
| Teams `/teams` | Team membership and assignment context | Show team lead, members, current project, and availability; avoid redundant people lists already owned by Workforce. | Member picker/search should work within a compact drawer; make membership changes explicit. |
| Workforce `/workforce` | Real workforce and assignment records | Separate people status from current task progress; connect person → team → project → today's work. | Filterable phone cards; profile/detail in drawer; confirm only consequential status changes. |
| Users `/utilizatori` | Admin user management and role model | Keep role and access boundaries explicit; simplify invitation and role assignment; distinguish invited, active, and suspended. | High-care invite/edit dialog; role changes explain access impact; no prototype-only roles. |
| Notifications `/notificari` | Real notifications and deep links | Group by urgency/date; mark source project and next action; link to the authoritative record. | Read/unread actions remain reachable on phone; no modal for routine notification details when a direct link is clearer. |
| Profile `/profil` | Current identity, role, locale, account details | Add theme preference here after design decision; keep identity/security settings distinct from appearance. | Theme switch has text label, accessible state, and previews remain readable. |
| Login / Signup `/login`, `/signup` | Existing auth/session/security behavior | Match the product visual language without changing login, refresh-token, registration, or authorization contracts. | Responsive single-column form; password and validation states; no shell navigation before authentication. |
| Design Review `/design-review/**` | Internal review workspace as a planning/audit tool | Keep review/demo workspace out of normal production navigation. Any future promotion requires replacing illustrative content and explicit product approval. | Treat its sample overlays as references only; they are not a production behavior contract. |

## Feature selection filter

For every v0-only concept, answer these before implementation:

1. Which HIIEKO user and EPC decision does it serve?
2. Which real endpoint/data owner supplies it?
3. Which roles can see and act on it?
4. Does it duplicate a KPI or record already owned by another route?
5. Does it work with empty, loading, stale, error, and permission-denied states?
6. Is there a mobile interaction that is as usable as desktop?

If any data/permission answer is unknown, record the gap and do not fill it with fake prototype data.

## Delivery phases

### Phase 0 — Baseline and inventory

- Capture PR #33 and v0 reference for each page family at desktop, tablet, and phone widths.
- Inventory every modal, drawer, confirmation, popover, upload, and inline edit by trigger, record, role, fields, validation, success/error, and close behavior.
- Map each KPI/progress figure to its API source and project/date scope.
- Record the route owner for duplicate destinations and decide canonical route/labels.

### Phase 1 — Shared system

- Resolve the product palette decision and document tokens/contrast; add the requested dark-mode decision and token specification.
- Standardize shell and responsive navigation, including role filtering, project switcher, bottom bar, menu drawer, locale and theme controls.
- Finish shared Modal, Drawer, ConfirmDialog, form field, status badge, button, toast, and responsive table/card contracts.
- Add reduced-motion behavior, focus restoration, dirty-form protection, safe-area sizing, and accessible names.

### Phase 2 — High-frequency operations

- Upgrade Home/Control Tower, Daily Plan, Tasks, Issues, and Attendance first.
- Prioritize operational progress, owner, due date, blockers, next action, and source-linked details.
- Align create/edit/detail overlays for these workflows to the shared overlay system.

### Phase 3 — Reporting and material control

- Upgrade Daily Reports, QA/QC, Deliveries, Stock/Warehouses, Expenses, and Approvals.
- Keep quantities with units, evidence with records, and each decision's lifecycle visible.

### Phase 4 — Project and people management

- Upgrade Projects, GIS, Customers, Documents, Teams, Workforce, Users, Notifications, and Profile.
- Consolidate duplicate routes and add user theme preference once the dark-mode decision is accepted into the product design record.

### Phase 5 — Verification and rollout

- Review role-specific screen access and actions against the authorization matrix.
- Review every route at phone/tablet/desktop sizes, including long labels, empty/loading/error states, dialogs, and drawers.
- Validate light/dark contrast and status semantics if dark mode is shipped.
- Compare final screens with the approved design contract and update the page adoption tracker.
- Ship through the existing PR workflow; do not treat a preview deployment as the production release.

## Definition of done

- Every production route follows the same shell and design tokens, with page-specific content that reflects its EPC job.
- Every progress/KPI value comes from the correct production source and identifies its project/date scope.
- Every create/edit/detail/confirmation overlay has one documented purpose and works with keyboard, touch, role boundaries, loading, validation, and server errors.
- Phone layouts have no accidental horizontal overflow, covered actions, clipped modal controls, or unlabeled icon navigation.
- The same status has the same label, color, and non-color cue throughout the product.
- v0-only demo features are omitted unless they pass the feature selection filter.
- The design system and route tracker record what has been adopted and what remains.
