\# HIIEKO Web Frontend — UI/UX Design Audit



Scope: `web/src/app/\*\*` only, plus shared frontend components needed to

assess reuse and visual consistency.



Excluded: backend, API correctness, database, server functionality,

deployment.



Important: "Implemented" below means UI/code exists in the page. It

does not mean the underlying workflow is functionally correct.



\---



\## 1. Page-by-page audit



\### 1. `/` — Operations / Control Tower



File: `web/src/app/page.tsx`



\#### What is implemented



\- Control Tower / Operations dashboard

\- KPI/overview data

\- Drilldown drawer

\- Red-flags card

\- Page tutorial

\- Role-specific worker dashboard / My Day

\- Project context integration

\- Refresh/update handling



Source: `web/src/app/page.tsx:54-103, 132-180`



Uses:



\- ControlTowerDrilldownDrawer

\- ControlTowerRedFlagsCard

\- PageTutorial

\- WorkerDashboard

\- WorkerMyDay



Source: `web/src/app/page.tsx:8-14`



\#### Design states



| State | Status |

|---|---|

| Loading | YES — spinner |

| Empty | MISSING / not clearly represented as a dedicated empty state |

| Error | YES — error state exists in data layer; rendered error presentation should be standardized |

| Success | YES — live overview state |



Loading is explicitly rendered at 132-140.



\#### Responsiveness



YES. Uses md: responsive classes.



Source: `web/src/app/page.tsx:162-180`



Mobile shell is supplied globally by AppShell.



Source: `web/src/components/AppShell.tsx:1-53`



\#### Component reuse



GOOD. Uses several dedicated components rather than putting everything

in one page.



\#### Visual consistency



Main concern: this page has a different visual language from several

CRUD pages.



Examples:



\- rounded-2xl

\- custom Control Tower heading

\- emerald status treatment

\- bespoke shadows



Source: `web/src/app/page.tsx:162-175`



while global design tokens define standard card radius/shadows.



Source: `web/src/app/globals.css:70-121`



\#### Mock/placeholder



No obvious mock data detected in the page.



\#### Accessibility



Positive:



\- spinner exists

\- semantic headings

\- child components handle much of the interaction



Potential issue:



\- KPI/status meaning relies substantially on color and iconography.



\#### Top 3 fixes



1\. Standardize Control Tower cards against the shared Card/token system.

2\. Add a deliberate dashboard empty/no-project-data state.

3\. Normalize status colors to semantic success/warning/critical/info

&#x20;  tokens rather than page-specific combinations.



\---



\### 2. `/control-tower`



File: `web/src/app/control-tower/page.tsx`



\#### Implemented



Thin route/authorization wrapper around ControlTowerSurface.



Source: `web/src/app/control-tower/page.tsx:1-43`



\#### States



| State | Status |

|---|---|

| Loading | YES — spinner |

| Empty | MISSING at wrapper level |

| Error | MISSING at wrapper level |

| Success | Delegated to ControlTowerSurface |



Source: `web/src/app/control-tower/page.tsx:23-36`



\#### Responsiveness



No responsive classes in this wrapper.



Source: `web/src/app/control-tower/page.tsx:1-43`



The actual responsive UI belongs to ControlTowerSurface.



\#### Reuse



GOOD — deliberately delegates UI to shared surface.



\#### Consistency



Good architectural separation.



\#### Top 3 fixes



1\. Keep wrapper intentionally thin.

2\. Ensure loading/error visuals match ControlTowerSurface.

3\. Avoid maintaining two visually separate Control Tower entry points

&#x20;  unless / is explicitly meant to redirect.



\---



\### 3. `/solar-configurator`



File: `web/src/app/solar-configurator/page.tsx`



\#### Implemented



Large interactive solar-design workspace:



\- project selection

\- design selection

\- roof editor

\- roof sections

\- obstacles

\- module placement

\- layout calculation

\- 2D roof plan

\- BOM

\- summary

\- editor toolbar

\- undo/history

\- confirmation dialogs



Source: `web/src/app/solar-configurator/page.tsx:77-101`



Imports show the feature decomposition.



Source: `web/src/app/solar-configurator/page.tsx:26-45`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES — no project/design/layout conditions |

| Error | YES |

| Success | YES |

| Saving | YES |



Source: `web/src/app/solar-configurator/page.tsx:77-101, 151-162`



\#### Responsiveness



YES. 18 responsive utility occurrences.



However, this is a desktop-heavy application surface.



\#### Reuse



Uses:



\- ConfirmDialog

\- feature components

\- SummaryPanel

\- BomPanel

\- RoofEditor

\- RoofPlan2D

\- EditorToolbar



Good componentization.



\#### Visual consistency



Potentially inconsistent.



The configurator is a specialized application inside the application

and uses many custom editor styles rather than the standard CRUD/card

system.



\#### Mock/placeholder



The source contains EMPTY\_MEASURE, previewPlacements, etc., but these

are editor states, not evidence of fake demo data.



Source: `web/src/app/solar-configurator/page.tsx:50,100-101`



\#### Accessibility red flags



Dense interactive canvas/editor controls need keyboard/focus audit.



UNCLEAR from the page alone whether every canvas operation is keyboard

accessible.



\#### Top 3 fixes



1\. Establish a consistent responsive mobile strategy for the editor

&#x20;  rather than simply stacking desktop controls.

2\. Standardize editor tool buttons/focus states.

3\. Ensure the BOM/summary panels have consistent mobile hierarchy.



\---



\### 4. `/tasks`



File: `web/src/app/tasks/page.tsx`



\#### Implemented



\- Task list

\- Search

\- status filters

\- "only mine"

\- create modal

\- assignment modal

\- status updates

\- quantity updates

\- toast feedback



Source: `web/src/app/tasks/page.tsx:91-105`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success/live data | YES |

| Action loading | YES |



Source: `web/src/app/tasks/page.tsx:91-127, 201-211`



\#### Responsiveness



YES, but relatively limited. Only 3 responsive utility occurrences.



\#### Reuse



Uses:



\- Toast

\- EmptyState

\- ErrorState

\- feature API



Source: `web/src/app/tasks/page.tsx:24-32`



\#### Visual consistency



Mixed.



The page hand-rolls many classes instead of consistently using Card,

Button, Badge, etc.



\#### Mock data



The page contains terms matching mock/demo detection, but the state/API

structure is clearly live-data oriented.



UNCLEAR whether every visual sample shown in the JSX is live-derived.



\#### Accessibility



Potential issue:



\- status may rely on colored chips/icons

\- dense task rows need keyboard interaction verification



\#### Top 3 fixes



1\. Replace hand-rolled buttons/cards/status styles with shared

&#x20;  components.

2\. Add standardized skeleton rows instead of generic loading treatment.

3\. Standardize task status/severity presentation.



\---



\### 5. `/planning`



File: `web/src/app/planning/page.tsx`



\#### Implemented



One of the more substantial operational screens:



\- plans

\- My Work

\- project tasks

\- readiness

\- task filters

\- search

\- status filters

\- create plan

\- publish/complete/cancel actions

\- task progress

\- action confirmations



Source: `web/src/app/planning/page.tsx:83-119`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success | YES |

| Action loading | YES |

| Readiness loading | YES |



Source: `web/src/app/planning/page.tsx:83-108, 142-155`



\#### Responsiveness



YES. 10 responsive utility occurrences.



\#### Reuse



Uses:



\- EmptyState

\- ErrorState

\- PageTutorial

\- Toast

\- task feature components/types



\#### Visual consistency



Better than older CRUD pages, but still mixes local classes with shared

design primitives.



\#### Mock



No obvious mock data.



\#### Accessibility



Good foundation from stateful UI.



Potential issue: task filters/status controls need consistent focus

treatment.



\#### Top 3 fixes



1\. Standardize planning cards/filters around shared UI components.

2\. Improve mobile density for plan/task rows.

3\. Make the "My Work / Plans" hierarchy visually stronger.



\---



\### 6. `/issues`



File: `web/src/app/issues/page.tsx`



\#### Implemented



\- Issues/blockers list

\- Search

\- severity filter

\- issue creation

\- validation

\- success/error feedback

\- project-scoped loading



Source: `web/src/app/issues/page.tsx:58-101`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING / no dedicated shared EmptyState imported |

| Error | YES |

| Success | YES |

| Form validation | YES |



\#### Responsiveness



YES, 13 responsive classes.



Source: `web/src/app/issues/page.tsx:119-126`



\#### Reuse



Uses PageTutorial, but does not use the shared Button, Card, EmptyState,

or ErrorState.



\#### Visual consistency



Weak-to-medium.



This page hand-rolls:



\- buttons

\- cards

\- filters

\- status treatments



\#### Mock



Mock detection finds sample-related patterns.



UNCLEAR which values are illustrative versus data-driven without

executing the UI.



\#### Accessibility



Status/severity presentation needs checking for color-only

communication.



\#### Top 3 fixes



1\. Add shared EmptyState.

2\. Use shared Button and Badge.

3\. Create one standardized issue severity/status visual language.



\---



\### 7. `/pontaj`



File: `web/src/app/pontaj/page.tsx`



\#### Implemented



\- attendance dashboard

\- daily/monthly tabs

\- month selector

\- attendance records

\- worker list

\- today summary

\- correction dialog

\- worker-specific attendance view



Source: `web/src/app/pontaj/page.tsx:42-52`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated empty component |

| Error | YES |

| Success | YES |

| Correction saving | YES |



\#### Responsiveness



YES, 11 responsive utilities.



Source: `web/src/app/pontaj/page.tsx:179-191`



\#### Reuse



Uses:



\- WorkerAttendanceView

\- AttendanceCorrectionDialog

\- PageTutorial



\#### Visual consistency



Medium.



The page uses many locally defined Tailwind styles.



\#### Accessibility



Attendance status should not rely only on color.



\#### Top 3 fixes



1\. Add standardized attendance empty state.

2\. Use shared table/card primitives.

3\. Standardize daily/monthly tab treatment with global Tabs.



\---



\### 8. `/rapoarte`



File: `web/src/app/rapoarte/page.tsx`



\#### Implemented



\- daily reports list

\- search

\- status filter

\- submit action

\- review action

\- approval/rejection modal state

\- comments

\- toast feedback



Source: `web/src/app/rapoarte/page.tsx:35-57, 104-151`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING explicit shared empty component |

| Error | YES |

| Success | YES |

| Submit/review processing | YES |



\#### Responsiveness



YES, 12 responsive utilities.



\#### Reuse



Uses components/ui, but the page also hand-rolls substantial UI.



\#### Visual consistency



Medium.



\#### Mock



Mock/demo detector returns true.



UNCLEAR exactly which displayed report data is hardcoded versus live.



\#### Accessibility



Approval actions need strong focus and confirmation handling.



\#### Top 3 fixes



1\. Remove/centralize any remaining sample report data.

2\. Add EmptyState.

3\. Use standardized approval/status badges.



\---



\### 9. `/rapoarte/form`



File: `web/src/app/rapoarte/form/page.tsx`



\#### Implemented



Very thin route wrapper around the Daily Reports feature.



Source: `web/src/app/rapoarte/form/page.tsx:1-23`



\#### States



| State | Status |

|---|---|

| Loading | MISSING |

| Empty | MISSING |

| Error | MISSING |

| Success | Delegated |



\#### Responsiveness



Only 2 responsive classes.



Source: `web/src/app/rapoarte/form/page.tsx:17`



\#### Reuse



Feature component handles the actual UI.



\#### Visual consistency



Dependent on the feature component.



\#### Top 3 fixes



1\. Ensure the feature form itself owns consistent page header/container

&#x20;  styling.

2\. Add explicit form loading/error states if not already provided by

&#x20;  the feature.

3\. Standardize mobile form spacing/tap targets.



\---



\### 10. `/avize`



File: `web/src/app/avize/page.tsx`



\#### Implemented



\- delivery notes / avize list

\- project context

\- search

\- refresh

\- loading

\- error state

\- responsive filter/search area



Source: `web/src/app/avize/page.tsx:24-33, 99-121`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated empty state |

| Error | YES |

| Success | YES |



\#### Responsiveness



YES, 16 responsive utilities.



\#### Reuse



Mostly hand-rolled.



PageTutorial is reused, but shared UI primitives are not strongly used.



\#### Visual consistency



This page is one of the clearer examples of the older HIIEKO page

style:



\- text-2xl

\- bg-white

\- border-slate-200

\- local button classes

\- rounded-lg



Source: `web/src/app/avize/page.tsx:99-121`



\#### Top 3 fixes



1\. Add shared empty state.

2\. Replace custom refresh/button styles with Button.

3\. Standardize table/card presentation.



\---



\### 11. `/stocuri`



File: `web/src/app/stocuri/page.tsx`



\#### Implemented



\- materials

\- balances

\- movements

\- search

\- movement filters

\- receive/consume/transfer actions

\- form validation



Source: `web/src/app/stocuri/page.tsx:46-60, 121-140`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated state |

| Error | YES |

| Success | YES |

| Form error | YES |

| Saving | YES |



\#### Responsiveness



YES, 13 responsive utilities.



\#### Reuse



Only explicit shared UI import is Button.



Source: `web/src/app/stocuri/page.tsx:8`



\#### Visual consistency



Medium/weak.



Large amount of locally styled UI.



\#### Mock



Mock detector returns true.



UNCLEAR whether sample values are still rendered.



\#### Top 3 fixes



1\. Remove/verify all static stock examples.

2\. Standardize stock status badges.

3\. Use shared Card/Table/Modal components.



\---



\### 12. `/cheltuieli`



File: `web/src/app/cheltuieli/page.tsx`



\#### Implemented



\- expense list

\- filters/search

\- new expense form

\- receipt upload

\- OCR processing

\- OCR result

\- validation/error states

\- submit state



Source: `web/src/app/cheltuieli/page.tsx:18-38, 64-104`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success | YES |

| OCR processing | YES |

| Submit processing | YES |



\#### Responsiveness



Only 3 responsive utilities.



This is a concern for a form-heavy page.



\#### Reuse



Mostly local styling.



FieldHelp is reused.



\#### Visual consistency



The page uses local styling rather than shared Button/Card/Input

components.



\#### Mock



Mock detector returns true.



\#### Top 3 fixes



1\. Major mobile responsive pass.

2\. Standardize forms using shared input/button/modal primitives.

3\. Remove/verify remaining mock expense values.



\---



\### 13. `/projects`



File: `web/src/app/projects/page.tsx`



\#### Implemented



\- project list

\- search

\- status filter

\- project creation wizard

\- 7-step wizard:

&#x20; - identity

&#x20; - location

&#x20; - technical

&#x20; - dates

&#x20; - budget

&#x20; - members

&#x20; - confirmation



Source: `web/src/app/projects/page.tsx:45-75`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success | YES |

| Wizard saving | YES |

| Wizard error | YES |



\#### Responsiveness



YES, 7 responsive utilities.



\#### Reuse



GOOD.



Explicitly uses:



\- PageHeader

\- Button

\- Card

\- Badge

\- EmptyState

\- ErrorState

\- LoadingSpinner

\- Toast



Source: `web/src/app/projects/page.tsx:28-38`



This is one of the best examples of the intended design-system

architecture.



\#### Mock



Mock detector returns true.



UNCLEAR whether that is only placeholder wizard defaults or actual fake

project records.



\#### Top 3 fixes



1\. Remove/verify remaining static sample project values.

2\. Increase responsive handling for wizard steps.

3\. Make wizard progress/navigation visually consistent with global

&#x20;  Tabs/stepper patterns.



\---



\### 14. `/projects/\[id]`



File: `web/src/app/projects/\[id]/page.tsx`



\#### Implemented



\- project overview

\- members

\- users

\- tabs

\- add member

\- remove member

\- confirmation dialog

\- project settings

\- project stages



Source: `web/src/app/projects/\[id]/page.tsx:76-110`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated project-empty state |

| Error | YES |

| Success | YES |

| Add/remove processing | YES |



\#### Responsiveness



YES, 17 responsive utilities.



\#### Reuse



Uses:



\- ConfirmDialog

\- ProjectSettingsPanel

\- ProjectStagesPanel

\- PageTutorial



\#### Visual consistency



Better responsive implementation than several older pages.



Still contains substantial hand-rolled visual classes.



\#### Top 3 fixes



1\. Standardize tabs using shared Tabs.

2\. Standardize member/project cards.

3\. Add explicit empty states for members/stages.



\---



\### 15. `/teams`



File: `web/src/app/teams/page.tsx`



\#### Implemented



\- teams list

\- search

\- selected team

\- create

\- edit

\- delete

\- add/remove member

\- confirmation states



Source: `web/src/app/teams/page.tsx:40-62`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated state |

| Error | YES |

| Success | YES |

| Action loading | YES |



\#### Responsiveness



YES, but only 6 responsive utilities.



\#### Reuse



Very little shared UI.



\#### Visual consistency



Weak/medium.



This is another page with extensive local Tailwind styling.



\#### Mock



Mock detector returns true.



\#### Top 3 fixes



1\. Standardize team cards/table.

2\. Add shared empty state.

3\. Replace local modal/action styling with shared components.



\---



\### 16. `/furnizori`



File: `web/src/app/furnizori/page.tsx`



\#### Implemented



\- supplier list

\- search

\- create modal

\- refresh

\- loading/error/empty states



Source: `web/src/app/furnizori/page.tsx:21-44, 60-84`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success | YES |



\#### Responsiveness



YES, 5 responsive utilities.



\#### Reuse



GOOD.



Uses:



\- Button

\- EmptyState

\- ErrorState

\- SupplierCreateModal



\#### Visual consistency



Better than older pages, but refresh button remains hand-rolled.



\#### Top 3 fixes



1\. Use shared Button for refresh.

2\. Use shared Card/table structure.

3\. Increase mobile layout refinement for supplier rows.



\---



\### 17. `/depozite`



File: `web/src/app/depozite/page.tsx`



\#### Implemented



\- warehouse list

\- search

\- create

\- refresh

\- loading/error/empty states



Source: `web/src/app/depozite/page.tsx:21-44, 59-83`



\#### States



All major states present.



\#### Responsiveness



YES, 5 responsive utilities.



\#### Reuse



Uses:



\- Button

\- EmptyState

\- ErrorState

\- WarehouseCreateModal



\#### Visual consistency



Similar to suppliers.



\#### Top 3 fixes



1\. Shared refresh button.

2\. Standardize warehouse cards/list.

3\. Improve mobile list density.



\---



\### 18. `/workforce`



File: `web/src/app/workforce/page.tsx`



\#### Implemented



\- employee list

\- search

\- create employee

\- edit employee

\- delete employee

\- confirmation

\- user association



Source: `web/src/app/workforce/page.tsx:23-50`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated empty state |

| Error | YES |

| Success | YES |

| Create/edit/delete processing | YES |



\#### Responsiveness



YES, 7 responsive utilities.



\#### Reuse



useFocusTrap, PageTutorial, API client.



Shared UI primitives are not strongly used.



\#### Mock



Mock detector returns true.



\#### Top 3 fixes



1\. Add shared empty/error/card system.

2\. Replace hand-built dialogs with shared Modal/ConfirmDialog.

3\. Verify and remove sample employee values.



\---



\### 19. `/santiere`



File: `web/src/app/santiere/page.tsx`



\#### Implemented



\- solar site list

\- geofence settings

\- latitude

\- longitude

\- radius

\- edit flow

\- validation



Source: `web/src/app/santiere/page.tsx:23-87`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated state |

| Error | YES |

| Success | YES |

| Edit saving | YES |

| Validation error | YES |



\#### Responsiveness



YES, 4 responsive utilities.



\#### Reuse



Mostly local UI.



\#### Visual consistency



Older/local styling.



\#### Top 3 fixes



1\. Use shared form/input primitives.

2\. Add explicit empty state.

3\. Improve mobile editing experience.



\---



\### 20. `/qa`



File: `web/src/app/qa/page.tsx`



\#### Implemented



\- QA inspections

\- PageHeader

\- inspection count

\- refresh

\- create inspection

\- inspection cards

\- skeleton

\- empty state

\- error state



Source: `web/src/app/qa/page.tsx:35-59, 72-102`



\#### States



Excellent state coverage.



| State | Status |

|---|---|

| Loading | YES — skeleton |

| Empty | YES |

| Error | YES |

| Success | YES |



\#### Responsiveness



Only 1 responsive utility in the route page.



Source: `web/src/app/qa/page.tsx:72`



The child components may provide more.



\#### Reuse



GOOD.



Uses:



\- PageHeader

\- EmptyState

\- ErrorState

\- Skeleton

\- Button

\- InspectionCard

\- InspectionCreateModal



\#### Top 3 fixes



1\. Improve mobile responsive layout.

2\. Standardize inspection status visuals with Badge.

3\. Check inspection cards for color-only status meaning.



\---



\### 21. `/qa-qc`



File: `web/src/app/qa-qc/page.tsx`



\#### Implemented



This is essentially a wrapper:



\- AuthGuard

\- QualityWorkspace



Source: `web/src/app/qa-qc/page.tsx:1-9`



\#### States



All states are delegated. UNCLEAR at this route level.



\#### Responsiveness



No responsive classes in wrapper.



\#### Reuse



High — feature component.



\#### Design concern



There are two QA routes:



\- /qa

\- /qa-qc



The former has a complete page-level design; the latter delegates to

QualityWorkspace.



This is a clear design-maintenance risk.



\#### Top 3 fixes



1\. Decide which QA route is canonical.

2\. Avoid maintaining two different QA visual systems.

3\. Move the canonical responsive/state design into one workspace.



\---



\### 22. `/aprobare`



File: `web/src/app/aprobare/page.tsx`



\#### Implemented



Expense approval workspace:



\- pending count

\- filters

\- search

\- approve/reject

\- notes

\- processing state



Source: `web/src/app/aprobare/page.tsx:20-28, 113-128`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated empty state |

| Error | YES |

| Success | YES |

| Action processing | YES |



\#### Responsiveness



YES, 9 utilities.



\#### Visual consistency



Uses hand-built amber/red statuses.



Source: `web/src/app/aprobare/page.tsx:117-128`



\#### Mock



Mock detector returns true.



\#### Top 3 fixes



1\. Add standardized empty state.

2\. Use semantic Badge.

3\. Standardize approval actions with shared Button/ConfirmDialog.



\---



\### 23. `/utilizatori`



File: `web/src/app/utilizatori/page.tsx`



\#### Implemented



\- users tab

\- roles tab

\- search

\- role filter

\- status filter

\- role updates

\- account status updates



Source: `web/src/app/utilizatori/page.tsx:59-95`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | YES |

| Error | YES |

| Success | YES |

| Role loading | YES |

| Status action loading | YES |



\#### Responsiveness



YES, 7 utilities.



\#### Reuse



Mostly hand-rolled.



\#### Mock



Mock detector returns true.



\#### Visual consistency



Local user-management UI rather than shared table/badge components.



\#### Top 3 fixes



1\. Standardize user table.

2\. Use shared Badge for roles/status.

3\. Add stronger mobile table transformation/card mode.



\---



\### 24. `/documente`



File: `web/src/app/documente/page.tsx`



\#### Implemented



\- project selector

\- document list

\- document type

\- title

\- file selection

\- upload

\- download

\- success/error messages



Source: `web/src/app/documente/page.tsx:44-53, 77-136`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING explicit shared empty state |

| Error | YES |

| Success | YES |

| Uploading | YES |



\#### Responsiveness



YES, 10 utilities.



\#### Reuse



Mostly hand-built.



\#### Visual consistency



Needs standardization.



\#### Accessibility



File input errors are communicated textually, which is good.



Potential issue: file type acceptance should also be visible in the UI,

not only validation.



\#### Top 3 fixes



1\. Add shared empty state.

2\. Use standardized upload component/dropzone.

3\. Improve document row mobile design.



\---



\### 25. `/notificari`



File: `web/src/app/notificari/page.tsx`



\#### Implemented



\- notification list

\- all/unread filtering

\- unread count

\- mark read

\- mark all read

\- refresh

\- error handling



Source: `web/src/app/notificari/page.tsx:31-87`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING dedicated empty component |

| Error | YES |

| Success | YES |



\#### Responsiveness



Only 3 responsive utilities.



\#### Reuse



PageTutorial, but notification cards/list are locally styled.



\#### Visual consistency



Uses hardcoded priority color treatment:



`bg-red-100 text-red-700`



Source: `web/src/app/notificari/page.tsx:92`



\#### Top 3 fixes



1\. Add notification-specific empty state.

2\. Standardize priority badges.

3\. Improve mobile notification density and grouping.



\---



\### 26. `/profil`



File: `web/src/app/profil/page.tsx`



\#### Implemented



\- profile loading

\- avatar/initials

\- name

\- email

\- phone

\- locale

\- save

\- success/error feedback



Source: `web/src/app/profil/page.tsx:12-62`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING |

| Error | YES |

| Success | YES |



\#### Responsiveness



NO responsive Tailwind classes detected.



Source: `web/src/app/profil/page.tsx:84-109`



This is a clear responsive weakness.



\#### Reuse



Almost entirely hand-built.



\#### Visual consistency



Uses:



\- bg-white

\- rounded-xl

\- border-slate-200

\- shadow-sm



instead of shared Card.



\#### Top 3 fixes



1\. Add mobile responsive spacing/layout.

2\. Use shared Card, Button, Input patterns.

3\. Add accessible field/error messaging.



\---



\### 27. `/login`



File: `web/src/app/login/page.tsx`



\#### Implemented



Visually:



\- HIIEKO branding

\- centered login-like container

\- role cards

\- warning/preview banner

\- responsive two-column role grid



Source: `web/src/app/login/page.tsx:105-147`



\#### States



| State | Status |

|---|---|

| Loading | MISSING |

| Empty | MISSING |

| Error | MISSING |

| Success | MISSING |

| Preview selection | YES |



This page is visually a role selection screen, not a conventional

login form.



\#### Responsiveness



Minimal:



`sm:grid-cols-2`



Source: `web/src/app/login/page.tsx:129`



\#### Reuse



Almost none.



\#### Visual consistency



Uses the correct HIIEKO green token but also amber preview-warning

styling.



\#### Placeholder/mock



YES — explicitly preview-mode UI.



Source: `web/src/app/login/page.tsx:117-122`



\#### Accessibility



Role cards are buttons, which is correct.



\#### Top 3 fixes



1\. Replace preview-role UI with the intended real login design.

2\. Add real loading/error/success presentation.

3\. Use shared Button/form components.



\---



\### 28. `/signup`



File: `web/src/app/signup/page.tsx`



\#### Implemented



\- registration form

\- first/last name

\- email

\- phone

\- requested role

\- password

\- terms acceptance

\- success screen



Source: `web/src/app/signup/page.tsx:11-36, 41-66`



\#### States



| State | Status |

|---|---|

| Loading | YES |

| Empty | MISSING |

| Error | YES |

| Success | YES |



\#### Responsiveness



Very weak.



No sm:, md:, or lg: responsive utility detected.



Source: `web/src/app/signup/page.tsx:55-66`



\#### Reuse



Mostly hand-built.



\#### Visual consistency



Looks similar to login but not based on shared form primitives.



\#### Top 3 fixes



1\. Responsive form layout.

2\. Standardize inputs/buttons.

3\. Add proper focus/error/field-level validation visuals.



\---



\### 29. Missing routes



`/forgot-password`



MISSING.



No `web/src/app/forgot-password/page.tsx` was found.



`/statistici`



MISSING as a page file.



The previous audit identified `/statistici` as redirected/deprecated

rather than a current page.



No current `web/src/app/statistici/page.tsx` was found.



\---



\## A. Pages fully designed with live-data UI



From a design implementation perspective (not a backend/functionality

certification), the strongest pages are:



1\. /

2\. /control-tower

3\. /solar-configurator

4\. /tasks

5\. /planning

6\. /pontaj

7\. /rapoarte

8\. /projects

9\. /projects/\[id]

10\. /furnizori

11\. /depozite

12\. /qa



These have substantial UI and state handling.



\---



\## B. Pages designed but containing mock/placeholder indicators



The source scan identified mock/demo/placeholder-related patterns in:



\- /solar-configurator

\- /tasks

\- /issues

\- /rapoarte

\- /avize

\- /stocuri

\- /cheltuieli

\- /projects

\- /teams

\- /furnizori

\- /depozite

\- /workforce

\- /aprobare

\- /utilizatori

\- /documente

\- /login

\- /signup



This does not mean all of these pages are fake.



It means the source contains identifiers/text matching

mock/placeholder/demo patterns.



The clearest confirmed mock surface is:



`/login`



Source: `web/src/app/login/page.tsx:117-122`



The page explicitly presents preview-mode role selection.



\---



\## C. Designed but missing states



Missing/dedicated empty state:



Most notable:



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

\- /profil



Some may display an inline "no records" message, but they do not

consistently use the shared EmptyState.



Missing loading/error state at route wrapper level:



\- /control-tower

\- /rapoarte/form

\- /qa-qc



These delegate their actual state handling to child components.



\---



\## D. Barely started or broken from a design perspective



\### 1. /login



The UI is explicitly a preview role selector rather than the final

login experience.



Source: `web/src/app/login/page.tsx:117-147`



\### 2. /qa-qc



Only a wrapper around QualityWorkspace.



Source: `web/src/app/qa-qc/page.tsx:1-9`



This is not inherently bad, but creates duplication with /qa.



\### 3. /rapoarte/form



Only a wrapper.



Source: `web/src/app/rapoarte/form/page.tsx:1-23`



Again, acceptable architecture if the feature component is the actual

screen.



\---



\## E. Shared design system



File: `web/src/components/ui/index.ts`



The repository has a real shared UI system.



Source: `web/src/components/ui/index.ts:1-27`



Reusable UI components:



1\. Button

2\. Card

3\. CardHeader

4\. CardContent

5\. CardFooter

6\. Badge

7\. Skeleton

8\. TableRowSkeleton

9\. EmptyState

10\. ErrorState

11\. PageHeader

12\. ToastProvider

13\. useToast

14\. Modal

15\. Drawer

16\. LoadingSpinner

17\. Tabs

18\. ConfirmDialog

19\. DropdownMenu

20\. Breadcrumbs



Source: `web/src/components/ui/index.ts:7-27`



Shell components:



File: `web/src/components/shell/index.ts:1-14`



1\. ShellBrand

2\. ProjectContextChip

3\. ShellNotificationsButton

4\. PageContainer



Global application shell:



File: `web/src/components/AppShell.tsx`



Uses:



\- Sidebar

\- Header

\- MobilePrimaryNav



Source: `web/src/components/AppShell.tsx:1-53`



Navigation:



Sidebar.tsx



\- desktop sidebar

\- mobile drawer

\- focus trap

\- responsive breakpoint at lg

\- role-aware navigation

\- real user identity



Source: `web/src/components/Sidebar.tsx:1-160+`



Header.tsx



Contains:



\- mobile hamburger

\- project selector

\- language switcher

\- notifications

\- user menu

\- desktop quick search



Source: `web/src/components/Header.tsx:1-130+`



Mobile navigation:



MobilePrimaryNav.tsx



Five primary destinations:



\- /

\- planning

\- tasks

\- issues

\- pontaj



Source: `web/src/components/MobilePrimaryNav.tsx:8-48`



Other reusable components found:



\- PageTutorial

\- FieldHelp

\- WorkerAttendanceView

\- WorkerDashboard

\- WorkerMyDay

\- ControlTowerSurface

\- ControlTowerDrilldownDrawer

\- ControlTowerRedFlagsCard

\- LanguageSwitcher



Evidence:



\- `web/src/components/PageTutorial.tsx:1-106`

\- `web/src/components/FieldHelp.tsx:1-43`

\- `web/src/components/WorkerAttendanceView.tsx:1-320`

\- `web/src/components/WorkerDashboard.tsx:1-260`

\- `web/src/components/WorkerMyDay.tsx:1-210`

\- `web/src/components/ControlTowerSurface.tsx:1-817`

\- `web/src/components/ControlTowerDrilldownDrawer.tsx:1-512`

\- `web/src/components/ControlTowerRedFlagsCard.tsx:1-210`



\---



\## F. Global design inconsistencies



\### 1. Brand color inconsistency



The design system has HIIEKO green:



\- hii-500 #188C51

\- hii-600 #0f7040

\- hii-700 #0c5935



Source: `web/tailwind.config.js`



But there is also a major amber system:



\- amber-500 #f59e0b



Source: `web/tailwind.config.js`



And shell accent tokens reference amber:



Source: `web/src/app/globals.css`



This produces three competing visual signals:



\- HIIEKO green

\- Solar amber

\- Emerald/green



Example:



\- `web/src/app/page.tsx:165` uses emerald.

\- `web/src/app/aprobare/page.tsx:122` uses amber.

\- `web/src/app/notificari/page.tsx:92` uses red.



Fix: define strict semantic meanings:



\- Brand/action → HIIEKO green

\- Attention → amber

\- Critical → red

\- Success → green

\- Info → blue



\### 2. Shared UI system is underused



The repository has:



\- Button

\- Card

\- Badge

\- EmptyState

\- ErrorState

\- Skeleton

\- LoadingSpinner

\- Tabs

\- Modal

\- Drawer

\- ConfirmDialog



Source: `web/src/components/ui/index.ts:7-27`



Yet many pages directly write:



\- bg-white

\- border-slate-200

\- rounded-lg

\- shadow-sm

\- px-3

\- py-2



This is particularly visible in:



\- Tasks

\- Issues

\- Attendance

\- Reports

\- Avize

\- Stock

\- Expenses

\- Teams

\- Workforce

\- Sites

\- Users

\- Notifications



This creates visual drift.



\### 3. Card style inconsistency



Global:



`globals.css:70-90`



defines:



\- hii-card

\- hii-section

\- hii-kpi



But pages frequently create their own:



`bg-white rounded-xl border border-slate-200 shadow-sm`



This is visually similar but not centrally controlled.



\### 4. Button inconsistency



Shared:



`Button.tsx:1-93`



has:



\- primary

\- secondary

\- danger

\- ghost

\- outline



But pages still hand-roll buttons.



Example:



\- `web/src/app/avize/page.tsx:108-110`

\- `web/src/app/notificari/page.tsx:112-114`



This creates small differences in:



\- height

\- radius

\- font size

\- icon spacing

\- hover

\- disabled state



\### 5. Empty-state inconsistency



The application has a dedicated:



`EmptyState.tsx`



Yet many pages do not use it.



This is one of the biggest UX inconsistencies.



\### 6. Loading-state inconsistency



The app has:



\- LoadingSpinner

\- Skeleton

\- TableRowSkeleton



Source: `web/src/components/ui/index.ts:8-20`



But pages use:



\- spinner

\- centered text + spinner

\- skeleton

\- custom loading markup



inconsistently.



QA is relatively strong:



`web/src/app/qa/page.tsx:98-102`



while several older pages use generic spinners.



\### 7. Typography inconsistency



Global typography is based on Inter:



`web/tailwind.config.js`



But pages mix:



\- text-2xl

\- text-xl

\- text-base

\- text-sm

\- text-xs

\- text-\[10px]

\- text-\[11px]

\- text-\[1.75rem]



Examples:



\- `web/src/app/page.tsx:172`

\- `web/src/app/issues/page.tsx:123`

\- `web/src/app/aprobare/page.tsx:117`



The issue is not the sizes themselves; it is the absence of a

consistently enforced page/type scale.



\### 8. Responsive inconsistency



Some pages are heavily responsive:



\- Solar Configurator

\- Projects

\- Project detail

\- Avize

\- QA-related screens



Others have almost no responsive classes:



\- Profile

\- Signup

\- Control Tower wrapper

\- QA-QC wrapper

\- Reports form



Source: `web/src/app/profil/page.tsx:84-109`,

`web/src/app/signup/page.tsx:55-66`



\### 9. Mobile shell is actually strong



The shared shell has a clear mobile strategy:



\- hamburger

\- project selector

\- RO/EN

\- notification

\- user menu

\- bottom navigation



Source:



\- `web/src/components/Header.tsx`

\- `web/src/components/MobilePrimaryNav.tsx`

\- `web/src/components/Sidebar.tsx`



The problem is that individual pages don't all match that quality.



\### 10. Desktop sidebar and mobile bottom navigation have different information architecture



Desktop exposes the complete navigation hierarchy through NAV\_GROUPS.



Mobile exposes only:



\- /

\- planning

\- tasks

\- issues

\- pontaj



Source: `web/src/components/MobilePrimaryNav.tsx:8`



This is intentional, but users need an obvious way to reach:



\- Materials

\- Documents

\- Reports

\- Projects

\- QA/QC

\- Workforce

\- Notifications

\- Profile



The hamburger provides this, so the architecture is defensible. It

should nevertheless be tested for discoverability.



\---



\## G. Top 20 design fixes — ranked



\### P0 — Highest impact



1\. Replace the preview login UI with the final login experience



&#x20;  `web/src/app/login/page.tsx:117-147`



&#x20;  This is currently visibly different from the intended production

&#x20;  product.



2\. Establish one canonical design-token system



&#x20;  Unify:



&#x20;  - HIIEKO green

&#x20;  - amber

&#x20;  - emerald

&#x20;  - red

&#x20;  - blue



&#x20;  through semantic tokens.



&#x20;  `web/tailwind.config.js`, `web/src/app/globals.css`



3\. Force all production pages to use shared Button/Card/Badge



&#x20;  The shared system already exists.



&#x20;  `web/src/components/ui/index.ts:7-27`



&#x20;  The problem is adoption, not absence.



4\. Standardize empty states



&#x20;  Every data list should use EmptyState.



&#x20;  `web/src/components/ui/EmptyState.tsx`



5\. Standardize loading states



&#x20;  Prefer:



&#x20;  - page skeleton

&#x20;  - table skeleton

&#x20;  - card skeleton



&#x20;  over inconsistent spinner-only loading.



&#x20;  `web/src/components/ui/Skeleton.tsx`



\### P1 — Major UX consistency



6\. Standardize page headers



&#x20;  Use PageHeader rather than repeating:



&#x20;  - text-2xl font-bold text-slate-900

&#x20;  - text-sm text-slate-500



&#x20;  `web/src/components/ui/PageHeader.tsx`



7\. Standardize status badges



&#x20;  Use Badge rather than combinations of:



&#x20;  - bg-emerald-100

&#x20;  - bg-amber-100

&#x20;  - bg-red-100

&#x20;  - bg-blue-100



&#x20;  `web/src/components/ui/Badge.tsx`



8\. Standardize table/list components



&#x20;  Current pages independently implement list/table layouts.



&#x20;  Most affected:



&#x20;  - Tasks

&#x20;  - Attendance

&#x20;  - Reports

&#x20;  - Stock

&#x20;  - Users

&#x20;  - Teams

&#x20;  - Workforce

&#x20;  - Documents



9\. Fix /qa vs /qa-qc visual duplication



&#x20;  Choose one canonical QA workspace.



&#x20;  `web/src/app/qa/page.tsx`

&#x20;  `web/src/app/qa-qc/page.tsx`



10\. Bring Profile to responsive parity



&#x20;   `web/src/app/profil/page.tsx:84-109`



&#x20;   Currently no responsive utility classes.



\### P1 — Mobile



11\. Responsive pass for Signup



&#x20;   `web/src/app/signup/page.tsx:55-66`



12\. Responsive pass for Expenses



&#x20;   Only 3 responsive utilities.



&#x20;   `web/src/app/cheltuieli/page.tsx`



13\. Responsive pass for Notifications



&#x20;   Only 3 responsive utilities.



&#x20;   `web/src/app/notificari/page.tsx`



14\. Responsive pass for QA



&#x20;   Route page itself has only one responsive utility.



&#x20;   `web/src/app/qa/page.tsx:72`



15\. Mobile density pass for tables



&#x20;   Convert dense desktop tables into:



&#x20;   - horizontal scroll where appropriate

&#x20;   - stacked cards where appropriate

&#x20;   - priority-first mobile information hierarchy



\### P2 — Visual polish



16\. Remove arbitrary one-off radii



&#x20;   There are many combinations of:



&#x20;   - rounded-lg

&#x20;   - rounded-xl

&#x20;   - rounded-2xl



&#x20;   The design system already defines:



&#x20;   `globals.css:45-49`



17\. Standardize shadows



&#x20;   Use the global:



&#x20;   - hii-shadow-card

&#x20;   - hii-shadow-elevated



&#x20;   rather than repeated shadow-sm.



&#x20;   `globals.css:51-54`



18\. Standardize form inputs



&#x20;   Global:



&#x20;   `globals.css:153-164`



&#x20;   defines `.hii-input`.



&#x20;   Many pages still hand-roll inputs.



19\. Standardize confirmation dialogs



&#x20;   The shared ConfirmDialog is robust:



&#x20;   `web/src/components/ui/ConfirmDialog.tsx:1-176`



&#x20;   It should replace local confirmation implementations wherever

&#x20;   possible.



20\. Standardize focus/keyboard behavior



&#x20;   Global focus exists:



&#x20;   `web/src/app/globals.css:60-67`



&#x20;   and shared dialogs use useFocusTrap.



&#x20;   `web/src/components/ui/ConfirmDialog.tsx:1-7`



&#x20;   But every page-level interactive control should consistently rely

&#x20;   on this system rather than local focus behavior.



\---



\## Overall design assessment



The frontend has a real design system, not just scattered CSS.



The strongest architectural pieces are:



\- AppShell

\- Sidebar

\- Header

\- MobilePrimaryNav

\- PageContainer

\- shared UI primitives

\- semantic color tokens

\- global typography

\- responsive shell

\- skeleton/error/empty-state primitives



The main design problem is adoption consistency.



The repository currently has roughly two generations of UI:



\### Newer/system-oriented UI



Examples:



\- Projects

\- QA

\- Planning

\- Control Tower

\- shared shell

\- shared UI primitives



\### Older/local-styling UI



Examples:



\- Avize

\- Issues

\- Stock

\- Expenses

\- Teams

\- Workforce

\- Notifications

\- Profile

\- parts of Reports/Attendance



They are not necessarily visually bad individually, but they use

different levels of abstraction and therefore drift in:



\- spacing

\- card radius

\- button dimensions

\- typography

\- status colors

\- empty states

\- loading states

\- responsive behavior



The biggest design opportunity is therefore not creating more

components. It is migrating the existing pages onto the components and

tokens that already exist.

