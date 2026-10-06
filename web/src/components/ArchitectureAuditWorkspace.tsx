'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronDown, Download, Search } from 'lucide-react';
import { designReviewModules } from './DesignReviewWorkspace';
import { roleWorkspaceSpecs } from './RoleWorkspacePreview';

type ModuleAudit = { id: string; route: string | null; component: string; file: string; audience: string; access: string; sections: string[]; children: string[]; data: string; readiness: string; name?: string };

const moduleAudit: Record<string, Omit<ModuleAudit, 'id'>> = {
  'control-tower': { route: '/', component: 'ControlTowerDashboardPage', file: 'web/src/app/page.tsx', audience: 'Operational portfolio overview.', access: 'Home route branches on user.role: worker → WorkerMyDay; team_leader, technician, foreman, site_manager → WorkerDashboard; otherwise dashboard. This is rendering logic, not a permission policy.', sections: ['Portfolio KPI cards', 'Red flags / attention summary', 'Project overview and activity', 'Selected-category drilldown'], children: ['PageTutorial', 'ControlTowerRedFlagsCard', 'ControlTowerDrilldownDrawer', 'WorkerDashboard', 'WorkerMyDay'], data: 'Review module uses local sample values. Product page imports apiClient and owns overview state.', readiness: 'DESIGN ONLY in review; a separate API-dependent product route exists.', name: 'Control Tower' },
  'worker-day': { route: '/', component: 'WorkerMyDay', file: 'web/src/components/WorkerMyDay.tsx', audience: 'Field day view, per module/component name.', access: 'Rendered by ControlTowerDashboardPage when user.role === worker. No separate permission model inferred.', sections: ['Welcome / day context', 'Today metrics and assignments', 'Schedule / upcoming work'], children: ['WorkerMyDay'], data: 'Review branch is local sample data. Product component is separate; this audit does not infer its data source from the name.', readiness: 'DESIGN ONLY in review; named product component exists.', name: 'Worker My Day' },
  tasks: { route: '/tasks', component: 'TasksPage', file: 'web/src/app/tasks/page.tsx', audience: 'Task assignment and execution.', access: 'NAV_GROUPS lists admin, owner, manager, pm, site_manager, foreman, team_leader, technician, worker. Navigation visibility is not authorization.', sections: ['Task metrics', 'Search/status filters', 'Task cards and progress/status actions'], children: ['TaskFilters', 'TaskCard', 'TaskCreateModal', 'TaskAssignModal', 'TaskStatusWorkflow', 'TaskProgressBar', 'TaskQuantityEditor', 'TaskDependencyChips'], data: 'Review branch is mock data. Product page imports getTasks/updateTask from features/tasks/api.', readiness: 'DESIGN ONLY in review; product UI and API module exist separately.', name: 'Tasks' },
  planning: { route: '/planning', component: 'PlanningPage', file: 'web/src/app/planning/page.tsx', audience: 'Planning; source defines route guard.', access: 'RoleGuard allowedRoles: admin, owner, manager, pm, site_manager, foreman, team_leader, technician, worker.', sections: ['Date navigation', 'Day summary / My Work', 'Status chips', 'Plan cards', 'Create-plan form'], children: ['PageTutorial', 'PlanningDateBar', 'PlanningDaySummary', 'MyWorkList', 'PlanningStatusChips', 'PlanningSkeleton', 'PlanCard', 'CreatePlanModal', 'TaskSelector', 'PlanTaskRow'], data: 'Review branch uses static values. Product page contains API/data hooks; source presence does not guarantee service availability.', readiness: 'DESIGN ONLY in review; separate product implementation exists.', name: 'Planning' },
  problems: { route: '/issues', component: 'IssuesPage', file: 'web/src/app/issues/page.tsx', audience: 'Issue/blocker tracking.', access: 'NAV_GROUPS lists operational roles; route-specific RoleGuard: NOT FOUND IN CURRENT SOURCE scan.', sections: ['Issue metrics', 'Active issue list', 'Create/detail flows'], children: ['IssueCard', 'IssueCreateModal', 'IssueDetailModal'], data: 'Review branch uses local rows. Product page and issues feature components are separate.', readiness: 'DESIGN ONLY in review; product route/components exist.', name: 'Issues' },
  attendance: { route: '/pontaj', component: 'PontajPage', file: 'web/src/app/pontaj/page.tsx', audience: 'Attendance and timekeeping.', access: 'A dedicated role-specific variant is NOT FOUND IN CURRENT SOURCE review.', sections: ['Attendance metrics', 'Crew/time entries', 'Correction request concept'], children: ['AttendanceSessionDrawer'], data: 'Review says correction is prototype/local only. Product drawer action says "Pregătește solicitarea (prototip)" and does not persist.', readiness: 'DESIGN ONLY; correction drawer is explicitly prototype.', name: 'Attendance' },
  reports: { route: '/rapoarte', component: 'RapoartePage', file: 'web/src/app/rapoarte/page.tsx', audience: 'Daily report authors/reviewers; dedicated role map not established.', access: 'Report-specific roles: NOT FOUND IN CURRENT SOURCE review.', sections: ['Report-state metrics', 'Daily report list', 'Separate /rapoarte/form route'], children: ['DailyReportForm', 'DailyReportExecutionSection', 'DailyReportMaterialsSection', 'DailyReportOhsSection', 'DailyReportPersonnelSection', 'DailyReportReviewSection', 'DailyReportTasksSection', 'DailyReportWorkSection'], data: 'Review is local sample data. Product report components/routes are distinct source.', readiness: 'DESIGN ONLY in review; separate report workflow source exists.', name: 'Reports' },
  deliveries: { route: '/avize', component: 'AvizePage', file: 'web/src/app/avize/page.tsx', audience: 'Deliveries/procurement concept.', access: 'Exact role assignment: NOT FOUND IN CURRENT SOURCE scan.', sections: ['Delivery metrics', 'Receipts/suppliers list', 'Selected delivery context'], children: [], data: 'Review branch uses local sample rows. Product route exists separately.', readiness: 'DESIGN ONLY in review.', name: 'Deliveries' },
  stock: { route: '/stocuri', component: 'StocuriPage', file: 'web/src/app/stocuri/page.tsx', audience: 'Stock/material operations.', access: 'RoleGuard: admin, owner, manager, pm, site_manager, foreman, team_leader, technician, worker.', sections: ['Stock/reorder metrics', 'Inventory table', 'Movement context'], children: ['PageTutorial'], data: 'Review is local sample data. Product page imports apiClient.', readiness: 'DESIGN ONLY in review; separate API-dependent product route exists.', name: 'Stock' },
  projects: { route: '/projects', component: 'ProjectsPage', file: 'web/src/app/projects/page.tsx', audience: 'Project portfolio.', access: 'Management navigation group includes admin, owner, manager, pm, site_manager, foreman, team_leader; exact page guard must be read separately.', sections: ['Project portfolio cards / rows', 'Status, progress, location and lead'], children: [], data: 'Review uses local data; product route is separate.', readiness: 'DESIGN ONLY in review.', name: 'Projects' },
  'project-workspace': { route: '/projects/[id]', component: 'ProjectDetailPage', file: 'web/src/app/projects/[id]/page.tsx', audience: 'Project detail and membership.', access: 'Uses RoleGuard; exact allowedRoles are in the source JSX and are not inferred here.', sections: ['Project identity/status header', 'Tabs', 'Overview and details', 'Stages and settings'], children: ['PageTutorial', 'ProjectSettingsPanel', 'ProjectStagesPanel', 'ConfirmDialog'], data: 'Product page uses apiClient and project/member/user state. Review tabs are static examples.', readiness: 'DESIGN ONLY in review; API-dependent product route exists.', name: 'Project Detail' },
  customers: { route: '/customers', component: 'CustomersPage → CustomersWorkspace', file: 'web/src/app/customers/page.tsx; web/src/features/customers/CustomersWorkspace.tsx', audience: 'Customer directory.', access: 'RoleGuard: admin, owner, manager, pm, site_manager, foreman, team_leader.', sections: ['Customer search', 'Customer cards', 'Add form', 'Delete confirmation'], children: ['CustomersWorkspace'], data: 'Review branch explicitly labels its data prototype/local. Product workspace is a separate implementation.', readiness: 'DESIGN ONLY in review; separate product component exists.', name: 'Customers' },
  documents: { route: '/documents', component: 'DocumentsPage → DocumentsWorkspace', file: 'web/src/app/documents/page.tsx; web/src/features/documents/DocumentsWorkspace.tsx', audience: 'Project documents and revisions.', access: 'RoleGuard: admin, owner, manager, pm, site_manager, foreman, team_leader.', sections: ['Folder list', 'Document/revision list', 'Upload', 'Delete confirmation'], children: ['DocumentsWorkspace'], data: 'Review explicitly says files are not uploaded or persisted. Product workspace is separate.', readiness: 'DESIGN ONLY in review; separate product component exists.', name: 'Documents' },
  'qa-qc': { route: '/qa-qc', component: 'QualityPage → QualityWorkspace', file: 'web/src/app/qa-qc/page.tsx; web/src/features/quality/QualityWorkspace.tsx', audience: 'Inspection and quality follow-up.', access: 'mayRecordInspection() explicitly accepts admin, qa_qc, pm, site_manager; page uses AuthGuard.', sections: ['Inspection search/status filter', 'Loading/error/empty states', 'Inspection records', 'New inspection dialog'], children: ['QualityWorkspace'], data: 'Product component calls apiClient.getInspections and POST /api/qa-qc/inspections. Review values are local.', readiness: 'DESIGN ONLY in review; API-backed product implementation exists.', name: 'QA/QC' },
  solar: { route: '/solar-configurator', component: 'SolarConfiguratorPage', file: 'web/src/app/solar-configurator/page.tsx', audience: 'Solar configuration.', access: 'NAV_GROUPS lists admin, owner, manager, pm, site_manager, foreman, technician; page has RoleGuard.', sections: ['Project/roof context', 'Editor toolbar', 'Roof/obstacle editor', '2D/3D views', 'Summary and BOM'], children: ['ProjectSelector', 'EditorToolbar', 'ModuleSelector', 'ObstacleEditor', 'RoofEditor', 'RoofPlan2D', 'SolarScene', 'SummaryPanel', 'BomPanel', 'ConfirmDialog'], data: 'Review says design saved locally in this presentation. Product route imports solar API/editor modules.', readiness: 'DESIGN ONLY in review; separate product editor/API route exists.', name: 'Solar Config' },
  approvals: { route: '/aprobare', component: 'AprobarePage', file: 'web/src/app/aprobare/page.tsx', audience: 'Approval queue concept.', access: 'Approver-only role policy: NOT FOUND IN CURRENT SOURCE review.', sections: ['Pending/approved/rejected metrics', 'Queue', 'History action'], children: [], data: 'Review branch is local sample status data; preview actions do not prove a real approval mutation.', readiness: 'DESIGN ONLY; end-to-end approval parity NOT FOUND IN CURRENT SOURCE.', name: 'Approvals' },
  workforce: { route: '/workforce', component: 'WorkforcePage', file: 'web/src/app/workforce/page.tsx', audience: 'Workforce administration.', access: 'RoleGuard: admin, owner, manager, pm.', sections: ['Workforce metrics', 'Team/availability list', 'Page-local forms/dialogs'], children: ['PageTutorial'], data: 'Review uses sample rows. Product page imports apiClient.', readiness: 'DESIGN ONLY in review; separate API-dependent product route exists.', name: 'Workforce' },
  'app-shell': { route: null, component: 'AppShell → Sidebar + Header + MobilePrimaryNav', file: 'web/src/components/AppShell.tsx; web/src/components/Sidebar.tsx; web/src/components/Header.tsx; web/src/components/MobilePrimaryNav.tsx', audience: 'Shared application frame, not a business-role page.', access: 'AppShell wraps product pages with AuthGuard; design-review subtree is an explicit bypass. Sidebar uses NAV_GROUPS.', sections: ['Sidebar/project context', 'Header', 'Main route content', 'Mobile primary navigation'], children: ['AppShell', 'Sidebar', 'Header', 'MobilePrimaryNav'], data: 'Review shell is illustrative; these named components are the actual shared product shell.', readiness: 'Review visual only; reusable product infrastructure exists.', name: 'App Shell' },
  'mobile-navigation': { route: null, component: 'MobilePrimaryNav (product); phone mock is inline JSX', file: 'web/src/components/DesignReviewWorkspace.tsx; web/src/components/MobilePrimaryNav.tsx', audience: 'Mobile navigation concept.', access: 'The phone mock does not define role permissions.', sections: ['Phone-frame header/content illustration', 'Illustrated bottom navigation'], children: ['MobilePrimaryNav'], data: 'Review phone is local static JSX; product component is mounted by AppShell.', readiness: 'DESIGN ONLY in review; actual shared component exists separately.', name: 'Mobile Nav' },
  'responsive-states': { route: null, component: 'DesignReviewWorkspace → ModuleContent', file: 'web/src/components/DesignReviewWorkspace.tsx', audience: 'Engineering review only.', access: 'Not applicable.', sections: ['Viewport selector', 'Breakpoint illustration', 'Review state selector'], children: ['ModuleContent', 'StatePreview'], data: 'Local React state and CSS only; no API.', readiness: 'Review utility only; not a product workflow.', name: 'Responsive States' },
};

const routes = [
  ['/', 'ControlTowerDashboardPage'], ['/control-tower', 'ControlTowerDedicatedPage'], ['/login', 'LoginPage'], ['/signup', 'SignupPage'], ['/design-review', 'DesignReviewPage'], ['/design-review/global', 'GlobalExperiencePage'], ['/design-review/architecture', 'FrontendArchitecturePage'],
  ['/tasks', 'TasksPage'], ['/planning', 'PlanningPage'], ['/issues', 'IssuesPage'], ['/pontaj', 'PontajPage'], ['/rapoarte', 'RapoartePage'], ['/rapoarte/form', 'RapoarteFormPage'], ['/avize', 'AvizePage'], ['/stocuri', 'StocuriPage'], ['/cheltuieli', 'CheltuieliPage'], ['/projects', 'ProjectsPage'], ['/projects/[id]', 'ProjectDetailPage'], ['/customers', 'CustomersPage'], ['/documents', 'DocumentsPage'], ['/qa-qc', 'QualityPage'], ['/solar-configurator', 'SolarConfiguratorPage'], ['/aprobare', 'AprobarePage'], ['/workforce', 'WorkforcePage'], ['/teams', 'TeamsPage'], ['/santiere', 'SantierePage'], ['/statistici', 'StatisticiPage'], ['/utilizatori', 'UtilizatoriPage'], ['/notificari', 'NotificariPage'], ['/profil', 'ProfilPage'],
];

const globalExperienceAudit = [
  ['Global App Shell', 'GlobalExperienceWorkspace', 'web/src/app/design-review/global/page.tsx; web/src/components/GlobalExperienceWorkspace.tsx', 'Open /design-review/global; choose Application shell in the global-experience navigator.', 'Illustrates persistent project sidebar, role-labelled navigation, project/site selector, header controls, profile menu, and mobile primary navigation.', 'Project/site selection and active navigation preview; no business-record fields.', 'Desktop persistent sidebar; tablet compact sidebar with visible project context; 390px mobile top bar, menu drawer and bottom navigation.', 'DESIGN ONLY · local React state; no auth session or API.', 'Existing production patterns: AppShell, Sidebar, Header, MobilePrimaryNav. Prototype shell is a separate review implementation.'],
  ['User Profile & Account Menu', 'GlobalExperienceWorkspace · profile surface and account menu', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select profile avatar → View profile / Account settings; select Profile preview.', 'Shows user details, role, organization, project/site context and account actions.', 'Full name, email, phone, language, theme, notification preference.', 'Responsive profile card and stacked preference rows on mobile; account menu anchored to header.', 'DESIGN ONLY · mock profile and local-only preference state.', 'Existing production components: Header account dropdown and /profil route, which loads and updates through apiClient.'],
  ['Language Switcher', 'GlobalExperienceWorkspace · LanguageControl', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select RO or EN in the preview toolbar, shell header, account menu, profile, or auth card.', 'Switches all new global-experience copy between paired Romanian and English strings.', 'RO / EN selection only.', 'Header language control moves to the account menu at mobile widths; auth preview keeps a compact selector.', 'DESIGN ONLY · preview-local React state; no preference persistence.', 'Existing production components: LocaleProviderClient and LanguageSwitcher; this prototype does not alter their contracts.'],
  ['Theme Selector', 'GlobalExperienceWorkspace · ThemeControl', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select Light, Dark, or System from the preview toolbar, account menu, or profile.', 'Shows purpose-built light and dark surface, border, status, form and navigation tokens.', 'Light / Dark / System.', 'Compact theme controls at desktop; account-menu/profile selection on mobile; System follows the OS color-scheme preference.', 'DESIGN ONLY · local state; no production theme provider is present in this implementation.', 'No existing global production theme selector was established by source review.'],
  ['Contextual Tutorial / Help', 'GlobalExperienceWorkspace · tutorial dialog', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select Help in the global header or More menu.', 'Introduces the page, actions, first-use guidance, role tip, close and do-not-show-again controls.', 'Dismiss preference checkbox only; no business data.', 'Centered keyboard-trapped dialog on larger screens; bottom sheet on narrow screens.', 'DESIGN ONLY · local preview state.', 'Existing production component: PageTutorial, currently used by selected product pages; prototype follows its contextual help pattern.'],
  ['Notifications', 'GlobalExperienceWorkspace · notifications surface', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select notification bell, account-menu Notifications, or the notification preview.', 'Displays unread count and task, planning, attendance, report, blocker, document and system notices; can mark items read.', 'Notification filters and selectable populated/loading/empty/error preview states.', 'Responsive list, stacked filter/actions and accessible status/error messages.', 'DESIGN ONLY · local mock notices and local read state.', 'Existing production surface: /notificari reads and updates via apiClient; prototype does not call it.'],
  ['Support Center', 'GlobalExperienceWorkspace · support surface', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select Help & support from the account menu, contextual help, auth support link, or support preview.', 'Search help, browse FAQs, contact HIIEKO support, open Report a problem, and inspect local system information.', 'FAQ search query only.', 'Desktop two-column support and FAQ layout; one-column mobile and touch-sized contact action.', 'DESIGN ONLY · local FAQ filtering; mail link is illustrative.', 'A dedicated production support center was not found in the inspected source.'],
  ['Report a Problem', 'GlobalExperienceWorkspace · report form', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Select Report a problem from the account menu or Support Center.', 'Collects a report with explicit local-only success and simulated error states.', 'Category, subject, description, severity, current page, project/site, optional file selection, contact email.', 'Responsive grid becomes single-column; optional attachment is named in UI only and never uploaded.', 'DESIGN ONLY · local form validation and state; no issue endpoint is called.', 'Backend dependency: a production issue-submission contract is required before this flow can send reports.'],
  ['Login', 'GlobalExperienceWorkspace · sign-in surface', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Choose Sign in in the global-experience navigator.', 'Shows HIIEKO sign-in design, password visibility, remember-me, forgot-password link, invalid credentials and loading states.', 'Email/username, password, remember-me.', 'Standalone centered auth panel, language switch, support and theme controls; responsive on mobile.', 'DESIGN ONLY · submit simulates invalid credentials; no auth request is sent.', 'Existing production route: /login uses apiClient.login and refreshes AuthContext. This prototype does not replace it.'],
  ['Signup / Pending Activation', 'GlobalExperienceWorkspace · registration surface', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Choose Create account in the global-experience navigator or the sign-in link.', 'Validates required fields, password rules, matching confirmation and consent; success explicitly remains pending approval.', 'Full name, email, password, confirmation, phone and terms consent.', 'Single-column standalone form with responsive controls; success view clearly says no automatic sign-in.', 'DESIGN ONLY · local validation and pending-activation state; no user is registered.', 'Existing production route: /signup calls apiClient.register. Production authentication/activation behavior remains outside this mock design.'],
  ['Forgot Password / Access Help', 'GlobalExperienceWorkspace · reset surface', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Choose Forgot password from the sign-in form.', 'Shows reset request, sent confirmation, invalid/expired-link state and return-to-sign-in path.', 'Work email; expired-link state is an explicit preview control.', 'Standalone responsive form and state card; compact mobile layout.', 'DESIGN ONLY · simulated delivery; no reset service is called.', 'Backend dependency: production reset-request and token-validation contracts are not implemented here.'],
  ['User Administration', 'GlobalExperienceWorkspace · organization user table and create dialog', 'web/src/components/GlobalExperienceWorkspace.tsx', 'Choose User administration; select Create user or Add site personnel.', 'Shows people, email, existing role labels, Pending/Active/Suspended status, project assignment and invitation concept.', 'Name, email, existing role, project/site and status; no new backend role.', 'Scrollable table at narrow widths, responsive create-user bottom sheet, filter and site-personnel concept.', 'DESIGN ONLY · mock records and local invite result; no production permissions are inferred.', 'Existing production route: /utilizatori uses apiClient.getUsers behind AuthGuard/RoleGuard. Invitation creation is a separate backend dependency.'],
];

const globalExperienceSurfaces = [
  'Application shell / page', 'Profile page + anchored account popover', 'Inline RO / EN toggle', 'Inline theme selection group', 'Contextual dialog / mobile bottom sheet', 'Notification center page + inline states', 'Support page + FAQ accordions', 'Report form page + success / error alerts', 'Standalone login page + invalid/loading states', 'Registration page + pending-activation state', 'Password-reset page + success / expired-link states', 'User directory page + create-user dialog / mobile bottom sheet',
];

const overlays = [
  ['Dashboard drilldown', 'ControlTowerDrilldownDrawer', 'web/src/components/ControlTowerDrilldownDrawer.tsx', 'Drawer', 'Dashboard drilldown state (isOpen); exact card trigger is in app/page.tsx.', 'Displays category items and rule explanation.', 'No editable fields.', 'Close button, backdrop and Escape close.', 'Authenticated dashboard route; narrower permission NOT FOUND IN CURRENT SOURCE.', 'Product drawer receives page-owned data; right-side panel.'],
  ['Attendance correction request', 'AttendanceSessionDrawer', 'web/src/features/attendance/components/AttendanceSessionDrawer.tsx', 'Drawer', 'Open attendance session, then correction action.', 'Prepare correction request for a session.', 'Corrected arrival, corrected departure, reason.', 'Prepare request (prototip), close, backdrop and Escape.', 'Permission mapping: NOT FOUND IN CURRENT SOURCE.', 'Explicit local prototype; full width on narrow screens and max-width panel on desktop.'],
  ['Create task', 'TaskCreateModal', 'web/src/features/tasks/components/TaskCreateModal.tsx', 'Modal', 'TasksPage sets showCreateModal from create action.', 'Collect task details.', 'Title, code, description, project, assignee, quantity, unit (source inputs).', 'Submit, cancel/close.', 'Inherited from caller; no overlay-specific permission.', 'Shared Modal; mobile-specific sheet conversion NOT FOUND IN CURRENT SOURCE.'],
  ['Assign task', 'TaskAssignModal', 'web/src/features/tasks/components/TaskAssignModal.tsx', 'Modal', 'Task assignment action.', 'Assign task; fields are defined in component.', 'Assignment controls; exact field inventory NOT TRANSCRIBED.', 'Submit/close controls in component.', 'Inherited from task page.', 'Shared Modal.'],
  ['Cancel task confirmation', 'ConfirmDialog', 'web/src/components/ui/ConfirmDialog.tsx; caller: features/tasks/components/TaskCard.tsx', 'Confirmation dialog', 'Task cancellation control.', 'Confirm cancellation callback.', 'None.', 'Confirm/cancel; labels supplied by caller.', 'Caller logic.', 'Shared primitive; destructive callback is caller-owned.'],
  ['Create plan', 'CreatePlanModal', 'web/src/features/planning/components/CreatePlanModal.tsx', 'Modal', 'PlanningPage sets showCreate=true.', 'Create a daily plan entry.', 'Project/task/team/date/notes controls; inspect source for exact labels.', 'Create/cancel; close disabled while submitting.', 'Planning RoleGuard applies to route.', 'Shared Modal; submitting state.'],
  ['Create issue', 'IssueCreateModal', 'web/src/features/issues/components/IssueCreateModal.tsx', 'Modal', 'Issues create action.', 'Create blocker/issue.', 'Title, description, severity.', 'Submit/cancel.', 'Issue route audience; distinct overlay permission NOT FOUND IN CURRENT SOURCE.', 'Shared Modal; onCreated callback.'],
  ['Issue detail', 'IssueDetailModal', 'web/src/features/issues/components/IssueDetailModal.tsx', 'Modal', 'Select an issue.', 'Inspect issue and source-defined follow-up.', 'Editable fields: NOT FOUND IN CURRENT SOURCE audit.', 'Close and component-defined actions.', 'Inherited from issues route.', 'Shared Modal.'],
  ['Inspection form', 'Inline dialog (no named modal component)', 'web/src/features/quality/QualityWorkspace.tsx', 'Dialog / bottom-aligned small-screen surface', 'Record inspection; shown when mayRecordInspection and a project exists.', 'Submit QA/QC inspection.', 'Inspector name; repeated measurement parameter, numeric value, unit.', 'Add/remove measurement, submit, cancel; Escape closes unless saving; focus trap.', 'admin, qa_qc, pm, site_manager predicate.', 'API call in source: getInspections and POST /api/qa-qc/inspections; bottom-aligned on small screens, centered at sm+.'],
  ['Add customer', 'Inline dialog (unnamed)', 'web/src/features/customers/CustomersWorkspace.tsx', 'Dialog / bottom-aligned small-screen surface', '"Adaugă client".', 'Add customer.', 'Form is inline; exact fields NOT TRANSCRIBED in this audit.', 'Submit/close; backdrop close.', 'Customers route guard: admin, owner, manager, pm, site_manager, foreman, team_leader.', 'Centered at sm+; product workspace differs from review mock.'],
  ['Delete customer', 'Inline alertdialog (unnamed)', 'web/src/features/customers/CustomersWorkspace.tsx', 'Confirmation dialog', 'Customer delete action.', 'Confirm removal; visible copy says "din prototip".', 'None.', 'Confirm/cancel; Escape/backdrop NOT FOUND IN CURRENT SOURCE.', 'Inherited customers route guard.', 'Local prototype wording; mobile adaptation NOT FOUND IN CURRENT SOURCE.'],
  ['Upload document', 'Inline dialog (unnamed)', 'web/src/features/documents/DocumentsWorkspace.tsx', 'Dialog / bottom-aligned small-screen surface', 'Upload action.', 'Document upload UI.', 'Upload fields inline; exact list NOT TRANSCRIBED here.', 'Submit/close.', 'Documents route guard: admin, owner, manager, pm, site_manager, foreman, team_leader.', 'Centered at sm+; design-review branch itself never uploads.'],
  ['Delete document', 'Inline alertdialog (unnamed)', 'web/src/features/documents/DocumentsWorkspace.tsx', 'Confirmation dialog', 'Document delete action.', 'Confirm removal from prototype.', 'None.', 'Confirm/cancel.', 'Inherited documents route guard.', 'Mobile adaptation NOT FOUND IN CURRENT SOURCE.'],
  ['Global quick search', 'GlobalQuickSearch', 'web/src/components/GlobalQuickSearch.tsx', 'Dialog', 'Global search keyboard/button trigger; exact shortcut in source.', 'Search/navigation palette.', 'Search query.', 'Select result or dismiss.', 'Mounted in authenticated shell.', 'Dialog; separate mobile sheet NOT FOUND IN CURRENT SOURCE.'],
];

const roles = [
  ['WORKER', 'Dashboard chooses WorkerMyDay; Tasks/Planning/Issues appear in NAV_GROUPS.', 'Dedicated day component exists; full task, attendance, report and materials workflow parity NOT FOUND IN CURRENT SOURCE.'],
  ['TEAM_LEADER', 'Dashboard chooses WorkerDashboard; operational and management navigation.', 'Dedicated role workspace NOT FOUND IN CURRENT SOURCE.'],
  ['FOREMAN', 'Dashboard chooses WorkerDashboard; solar, operations and management nav.', 'Dedicated end-to-end foreman workflow NOT FOUND IN CURRENT SOURCE.'],
  ['SITE_MANAGER', 'Dashboard chooses WorkerDashboard; QA/QC and management nav.', 'Dedicated end-to-end role workflow NOT FOUND IN CURRENT SOURCE.'],
  ['PM', 'Management/operations nav and multiple role-guarded routes.', 'No unified PM experience; actions vary by route.'],
  ['MANAGER', 'Management group and selected route guards.', 'Dedicated manager workspace NOT FOUND IN CURRENT SOURCE.'],
  ['ADMIN', 'RoleGuard grants admin superset; admin navigation includes user administration.', 'Admin users route exists; complete admin operations coverage NOT FOUND IN CURRENT SOURCE.'],
  ['OWNER', 'RoleGuard grants owner superset; management navigation.', 'Dedicated owner workspace NOT FOUND IN CURRENT SOURCE.'],
  ['TECHNICIAN', 'Tasks/Planning/Issues/Solar nav; dashboard chooses WorkerDashboard.', 'Dedicated technician workflow NOT FOUND IN CURRENT SOURCE.'],
  ['QA_QC', 'QA/QC nav and mayRecordInspection predicate.', 'Quality workspace/inspection form exists; complete role workflow parity NOT FOUND IN CURRENT SOURCE.'],
  ['VIEWER', 'No mapping found in NAV_GROUPS or inspected route guards.', 'MISSING / NOT DEDICATED.'],
];

const roleProductionStatus: Record<string, string> = {
  'role-worker': 'WorkerMyDay and worker task routes exist separately; end-to-end attendance, reporting, notifications, and blocker parity is not established.',
  'role-team-leader': 'WorkerDashboard and team/operational routes exist; a unified team-leader workflow and action-level policy are not established.',
  'role-foreman': 'Task, planning, stock, and report sources exist; a complete foreman site-day workflow is not established.',
  'role-site-manager': 'Site, QA/QC, workforce, and report sources exist; site-level control and escalation parity is not established.',
  'role-pm': 'Project, planning, report, document, and approval sources exist; a unified PM control experience is not established.',
  'role-manager': 'Management and portfolio routes exist; a unified manager workspace and financial-control backend are not established.',
  'role-admin': 'User administration and role guards exist; complete organization configuration, audit, and administration coverage is not established.',
  'role-owner': 'Owner role and management routes exist; dedicated executive oversight and financial reporting are not established.',
  'role-technician': 'Task, planning, and solar sources exist; technical measurement, asset, evidence, and commissioning parity is not established.',
  'role-qa-qc': 'QualityWorkspace and inspection API exist separately; corrective-action verification and complete QA/QC role parity are not established.',
  'role-viewer': 'No dedicated production viewer route or read-only authorization policy was established in the inspected sources.',
  'persona-technical-director': 'Design concept only. Existing technical/product routes do not establish portfolio engineering oversight or standards governance.',
  'persona-site-logistics': 'Design concept only. Attendance, delivery, and stock routes exist independently; integrated site logistics administration is not established.',
  'persona-procurement': 'Design concept only. Delivery/avize sources do not establish quotation comparison, purchase orders, or supplier confirmation end to end.',
  'persona-finance-admin': 'Design concept only. Expenses and workforce sources do not establish cost control, payment workflow, or HR/payroll administration.',
  'persona-om': 'Design concept only. Asset, preventive maintenance, warranty, and service-provider workflows are not established in inspected production sources.',
};

const roleGaps = [
  ['TECHNICAL DIRECTOR', 'Design-review workspace added; production capability remains DESIGN ONLY.'], ['SITE LOGISTICS / ADMINISTRATION', 'Design-review workspace added; production capability remains DESIGN ONLY.'], ['PROCUREMENT', 'Design-review workspace added; existing delivery sources do not establish end-to-end procurement parity.'], ['FINANCE / ADMINISTRATION', 'Design-review workspace added; expenses source does not establish finance/payroll administration parity.'], ['O&M / MAINTENANCE', 'Design-review workspace added; production capability remains DESIGN ONLY.'],
];

const reusable = [
  ['APP SHELL', 'AppShell', 'web/src/components/AppShell.tsx', 'All authenticated routes; shell + AuthGuard', 'Yes', 'No', 'mobileSidebarOpen', 'Sidebar/header/mobile-nav composition'],
  ['NAVIGATION', 'Sidebar', 'web/src/components/Sidebar.tsx', 'Authenticated routes; NAV_GROUPS', 'Yes', 'No', 'Source-owned', 'Mobile sidebar via AppShell'],
  ['PAGE HEADER', 'Header', 'web/src/components/Header.tsx', 'Authenticated routes', 'Yes', 'No', 'Menu callback', 'Opens mobile sidebar'],
  ['MOBILE NAVIGATION', 'MobilePrimaryNav', 'web/src/components/MobilePrimaryNav.tsx', 'AppShell', 'Yes', 'No', 'Navigation links', 'Separate mobile bottom nav'],
  ['HELP', 'PageTutorial', 'web/src/components/PageTutorial.tsx', 'Dashboard/planning/stock/workforce/project callers', 'Yes', 'No', 'Component-owned', 'One implementation; responsive details in source'],
  ['DIALOGS', 'Modal', 'web/src/components/ui/Modal.tsx', 'Task/planning/issues/search and other call sites', 'Yes', 'No', 'Caller controls open', 'Shared surface; no universal sheet conversion'],
  ['CONFIRMATIONS', 'ConfirmDialog', 'web/src/components/ui/ConfirmDialog.tsx', 'Task/project/solar and other consumers', 'Yes', 'No', 'Caller controls open', 'Shared surface'],
  ['DRAWERS', 'ControlTowerDrilldownDrawer', 'web/src/components/ControlTowerDrilldownDrawer.tsx', 'Dashboard', 'Yes', 'No', 'Dashboard owns open/data state', 'Right-side drawer'],
  ['DESIGN REVIEW', 'RoleWorkspacePreview', 'web/src/components/RoleWorkspacePreview.tsx', '16 role/persona mock workspaces driven by one design tree', 'Yes', 'No', 'Local viewport, state, locale, navigation and mock overlay state', 'Desktop/tablet/mobile patterns; no production data'],
  ['DESIGN REVIEW', 'RoleWorkspaceDirectory', 'web/src/components/RoleWorkspacePreview.tsx', 'Separated role-workspace and business-persona navigation', 'Yes', 'No', 'Open selected design-review module', 'Reuses the existing design-review module-card visual pattern'],
];

const interactions = [
  ['Open module', 'DesignReviewWorkspace', 'Open card → selected ModuleContent', 'activeModuleId', 'Local UI; history.replaceState updates ?module=…', 'Query string only', 'No API result'],
  ['Previous / next module', 'DesignReviewWorkspace', 'Toolbar action → adjacent module', 'activeModuleId', 'Local UI', 'None', 'No API result'],
  ['Viewport / review state', 'DesignReviewWorkspace', 'Select option → resize or StatePreview', 'viewport / reviewState', 'Local UI', 'None', 'Illustrative state, not server result'],
  ['Search preview', 'ModuleContent task branch', 'Type → filter sample tasks', 'search state', 'Derived local state', 'None', 'No API error/success'],
  ['Prototype attendance correction', 'DesignReviewWorkspace', 'Correction action → temporary notice', 'notice state', 'Local mock; source says nothing is saved', 'None', 'Temporary prototype notice'],
  ['Create/assign/update task', 'TasksPage + task feature components', 'Action → modal/status workflow', 'TasksPage and child state', 'getTasks/updateTask imported; inspect each mutation handler for exact persistence', 'Stays on /tasks', 'Route/feature-specific'],
  ['Create plan', 'PlanningPage + CreatePlanModal', 'Create → plan form', 'showCreate/submitting', 'Product planning flow; inspect handler/API module', 'Stays on /planning', 'Submitting state; exact errors per handler'],
  ['Submit inspection', 'QualityWorkspace', 'Submit → close on success', 'QualityWorkspace form state', 'POST /api/qa-qc/inspections', 'Stays on /qa-qc', 'Validation, formError, success and request error states'],
  ['Prepare attendance correction', 'AttendanceSessionDrawer', 'Prototype action → local success state', 'Drawer-local state', 'Local only', 'None', 'Prototype confirmation; no persistence'],
  ['Approve / reject', 'AprobarePage / review branch', 'Preview status only; real mutation handler NOT FOUND IN CURRENT SOURCE review', 'Product page state unverified', 'Review does not call API', 'Unknown', 'Do not claim a real workflow'],
  ['Upload / delete document', 'DocumentsWorkspace', 'Inline dialog/alertdialog', 'Workspace state', 'Review module explicitly has no upload/persistence; product workspace separate', 'Stays on /documents', 'Consumer-specific'],
  ['Role workspace navigation', 'RoleWorkspaceDirectory + DesignReviewWorkspace', 'Select a role or persona card → local design-review branch', 'activeModuleId', 'Mock data only; no API, session, authorization, or persistence', 'Replace query parameter ?module=…', 'Prototype notice / local success state'],
  ['Role/persona actions and overlays', 'RoleWorkspacePreview', 'Quick action → mock dialog/drawer → local confirmation/success', 'Preview-local React state', 'Illustrative only; action never mutates production data', 'Stay in design-review module', 'All nine UI states are selectable locally'],
  ['Role locale and responsive controls', 'RoleWorkspacePreview', 'RO/EN and Desktop/Tablet/Mobile controls update the preview', 'Preview-local React state', 'No locale preference persistence or backend calls', 'Stay in design-review module', '390px mobile navigation and bottom sheets'],
];

const readiness = [
  ['Control Tower', 'Review mock; product route separate.'], ['Worker My Day', 'Review mock; WorkerMyDay component exists separately.'], ['Tasks', 'Product page, feature components and API module exist separately.'], ['Daily Planning', 'Product page/components/API exist separately.'], ['Problems / Blockers', 'Product issues page/components exist separately.'], ['Attendance / Timesheet', 'Review mock; correction drawer explicitly prototype.'], ['Daily Reports', 'Review queue static; product report pages/components separate.'], ['Deliveries / Avize', 'Product route exists; review uses local data.'], ['Materials / Stock', 'Product route/API exists; review is static.'], ['Projects', 'Product route exists; review cards local.'], ['Project Workspace', 'Product detail route exists; review tabs static.'], ['Customers', 'Review explicitly local; product workspace separate.'], ['Documents', 'Review says no upload/persistence; product workspace separate.'], ['QA/QC', 'Review static; QualityWorkspace API-backed in source.'], ['Solar Configuration', 'Review editor local; product editor/API separate.'], ['Approvals', 'Review queue static; real approval parity NOT FOUND IN CURRENT SOURCE.'], ['Workforce', 'Review cards local; product route/API separate.'], ['Shared Application Shell', 'Illustration only; AppShell/sidebar/header/mobile nav are reusable.'], ['Mobile Navigation', 'Phone mock inline; MobilePrimaryNav exists separately.'], ['Responsive States', 'Review utility, not business workflow.'],
];

function markdownTable(headers: string[], rows: string[][]) {
  const formatCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  return [
    `| ${headers.map(formatCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(formatCell).join(' | ')} |`),
  ].join('\n');
}

function buildAuditMarkdown(modules: ModuleAudit[]) {
  const sections = [
    '# HIIEKO — Frontend Architecture Audit',
    '',
    '> Read-only, source-grounded engineering handoff. This report exports every section and complete inventory from the architecture audit, regardless of current search filters or collapsed panels.',
    '',
    '## Summary',
    '',
    markdownTable(['Inventory', 'Count'], [
      ['Page routes / page exports', String(routes.length)],
      ['Design-review entries · 20 modules + roles/personas', String(modules.length)],
      ['Global experience design documents', String(globalExperienceAudit.length)],
      ['Reusable components inventoried', String(reusable.length)],
      ['Modal / dialog workflows', '12'],
      ['Drawer workflows', '2'],
      ['Popover implementations identified', '0'],
      ['Review-only component definitions', '9'],
      ['Overlay workflows documented', String(overlays.length)],
      ['Role workspaces', String(roleWorkspaceSpecs.filter((workspace) => workspace.category === 'role').length)],
      ['Business persona concepts', String(roleWorkspaceSpecs.filter((workspace) => workspace.category === 'persona').length)],
    ]),
    '',
    '## How to read this audit',
    '',
    '- **Review prototype:** The 20 original module cards plus 11 role workspaces and 5 business personas are branches of `DesignReviewWorkspace` under `/design-review?module=…`, not independent product routes. Mock records and preview states are not live API responses.',
    '- **Product source:** Actual routes, page exports, named feature components, route guards and API evidence are listed separately. Imports show implementation wiring, not that a service is available.',
    '- **Naming accuracy:** Most design-review content is inline JSX, not named React components. Trees label that accurately instead of inventing section components. “NOT FOUND IN CURRENT SOURCE” means no source evidence was identified.',
    '',
    '## Page → section → component trees',
    '',
    'The route and role filter in the interactive page do not limit this export.',
    '',
    ...modules.flatMap((module) => [
      `### ${module.name ?? module.id} (\`${module.id}\`)`,
      '',
      `- **Review branch:** \`/design-review?module=${module.id}\``,
      `- **Production route:** ${module.route ? `\`${module.route}\`` : 'No standalone product route'}`,
      `- **Component:** \`${module.component}\``,
      `- **Source file(s):** \`${module.file}\``,
      `- **Audience:** ${module.audience}`,
      `- **Access evidence:** ${module.access}`,
      `- **Sections / capabilities:** ${module.sections.join('; ')}`,
      `- **Named child components:** ${module.children.length ? module.children.map((child) => `\`${child}\``).join(', ') : 'No named children listed; rendered inline.'}`,
      `- **Data boundary:** ${module.data}`,
      `- **Readiness:** ${module.readiness}`,
      '',
    ]),
    '## Global product experience · design and source boundaries',
    '',
    'The separate `/design-review/global` page documents the global shell, profile/account, language, theme, tutorial, notifications, support, problem report, authentication concepts and user-administration prototype. It does not add to or rename the existing 36 business-module and role/persona entries.',
    '',
    markdownTable(['Experience', 'Component', 'File', 'Trigger / entry', 'Modal / drawer / dialog', 'Purpose', 'Fields', 'Responsive behavior', 'Data boundary', 'Existing production source / dependency'], globalExperienceAudit.map((row, index) => [...row.slice(0, 4), globalExperienceSurfaces[index], ...row.slice(4)])),
    '',
    '## Current route inventory',
    '',
    'Page export names map to current `page.tsx` files. Preview module IDs are query/local-state branches and are not separate routes. Root layout is `RootLayout → AppShell`. The audit route remains in the existing public design-review subtree.',
    '',
    markdownTable(['Route', 'Page component'], routes),
    '',
    '## Dialogs, modals, drawers and confirmations',
    '',
    'RoleWorkspacePreview includes 32 documented mock modal/drawer concepts (2 per each of 16 experiences), all controlled by local state and never persisted. StatePreview confirmation states are separate illustrations. The product overlay inventory below describes existing production components and API boundaries.',
    '',
    markdownTable(['Workflow', 'Component', 'Actual file', 'Type', 'Triggered by', 'Purpose', 'Fields', 'Buttons / actions', 'Who can use it', 'Close / responsive / data notes'], overlays),
    '',
    '## Component reuse map',
    '',
    'Review primitives are file-local; product shell and overlay primitives are separate, reusable infrastructure.',
    '',
    markdownTable(['Group', 'Component', 'Actual file', 'Used by / purpose', 'Reusable?', 'Page-specific?', 'State', 'Responsive / overlay notes'], reusable),
    '',
    '### Reuse patterns',
    '',
    '- **Cards:** Metric and SectionCard in review source.',
    '- **Tables:** Review TableFrame retains a minimum width; mobile uses horizontal scrolling, not cards.',
    '- **Filters / forms:** TaskFilters is named; several product feature forms are inline in their workspace.',
    '- **Status / states:** Review StatusBadge and StatePreview; product pages have route-specific markup.',
    '',
    '## Interaction map',
    '',
    markdownTable(['Button / control', 'Component', 'Trigger → result', 'State owner', 'Local / API evidence', 'Navigation', 'Success / error'], interactions),
    '',
    '## Responsive architecture',
    '',
    markdownTable(['Area', 'Source-backed behavior'], [
      ['Review browser', 'Same DesignReviewWorkspace/ModuleContent. Desktop has module navigator; mobile ≤720px hides it and keeps a sticky toolbar.'],
      ['Review tables', 'Same TableFrame; minimum width remains and content scrolls horizontally rather than transforming into cards.'],
      ['App navigation', 'AppShell owns mobileSidebarOpen; Sidebar/Header use it, while MobilePrimaryNav is a separate bottom-navigation component.'],
      ['Inline dialogs', 'QualityWorkspace, CustomersWorkspace, DocumentsWorkspace use bottom-aligned rounded dialogs on small screens and centered dialogs at sm+.'],
      ['Attendance drawer', 'AttendanceSessionDrawer is a right-side full-width narrow drawer and max-width panel on larger screens.'],
      ['Sheets / popovers / toolbars', 'No dedicated Sheet or Popover implementation found in this audit. No universal toolbar-collapse or table-to-card rule is established.'],
    ]),
    '',
    '## Role and business-persona workspaces · design only',
    '',
    'The following 11 role workspaces and 5 organizational personas are frontend-only branches under `/design-review?module=…`. Persona concepts do not add backend enum roles. No backend, permissions, API contracts, persistence, or production workflows were changed.',
    '',
    ...roleWorkspaceSpecs.flatMap((workspace) => [
      `### ${workspace.role.ro} · ${workspace.home.ro} (${workspace.category.toUpperCase()})`,
      '',
      `- **PRIMARY WORKSPACE:** ${workspace.home.ro} / ${workspace.home.en} · ${workspace.project.ro} · ${workspace.context.ro}`,
      `- **SECONDARY WORKSPACES:** ${workspace.navigation.map((item) => `${item.ro} / ${item.en}`).join('; ')}`,
      `- **COMPONENT TREE:** RoleHome → Header → Project/Site Context → Summary → Work Queue → Alerts → Activity → Primary Actions → Overlays`,
      `- **MODALS / DRAWERS:** ${workspace.overlays.map((overlay) => `${overlay.title.ro} (${overlay.type.ro}); trigger: primary/secondary action; purpose: ${overlay.purpose.ro}; fields: ${overlay.fields.ro}; actions: ${overlay.actions.ro}; responsive: ${overlay.responsive.ro}; state: ${overlay.state.ro}`).join(' | ')}`,
      `- **RESPONSIVE:** Desktop uses role navigation and split panels; tablet uses compact navigation and two-column content; mobile (~390px) uses bottom navigation, stacked cards, touch-sized actions, and bottom-sheet overlays with sticky actions.`,
      `- **BUSINESS CAPABILITIES:** ${[...workspace.navigation.map((item) => item.ro), workspace.queueTitle.ro, workspace.alertTitle.ro, workspace.focusTitle.ro, workspace.nextTitle.ro].join('; ')}`,
      `- **DESIGN-ONLY / PRODUCTION-EXISTS:** Design-review content is local mock data. ${roleProductionStatus[workspace.id]}`,
      '',
    ]),
    '## Production role evidence and remaining gaps',
    '',
    'Evidence sources: `web/src/config/navigation.ts`, explicit RoleGuard lists and component-level predicates. Design workspaces above do not alter these source capabilities; no capability is inferred solely from navigation visibility.',
    '',
    markdownTable(['Role', 'Primary workspace / visible navigation', 'Coverage / remaining production gaps'], roles),
    '',
    '### Additional target personas',
    '',
    markdownTable(['Persona', 'Gap result'], roleGaps),
    '',
    'Approval, attendance, task, planning, report, material, QA/QC, document and project actions are not consolidated into a role-specific capability matrix in current source. Action-level permission coverage beyond cited guards/predicate: **NOT FOUND IN CURRENT SOURCE**.',
    '',
    '## State architecture and data boundaries',
    '',
    '### DesignReviewWorkspace state',
    '',
    'Source: `web/src/components/DesignReviewWorkspace.tsx` · `useState`.',
    '',
    '- **State:** `activeModuleId`, `viewport`, `reviewState`, `search`, `notice`.',
    '- **Loading, empty, no-results, error, permission-denied, success, confirmation, destructive-confirmation:** StatePreview illustrations, not fetched states or actual permission checks.',
    '- **Populated:** StatePreview returns null.',
    '- **Search:** Local filter state in selected preview branch.',
    '- **Module selection:** Local state plus `history.replaceState` query parameter.',
    '- **Business data:** Local constants/arrays in review source; no API/fetch import found there.',
    '',
    '### Product-state evidence (examples)',
    '',
    '- **QA/QC:** loading, refreshing, error, query, statusFilter, openForm, inspectorName, measurements, saving, success, formError; `getInspections` + `POST /api/qa-qc/inspections`.',
    '- **Tasks:** tasks/loading/error/search/status/onlyMine and modal/update state; imports `getTasks`/`updateTask`.',
    '- **Project detail:** project/member/user/loading/error/success/tab/add/remove state; imports `apiClient`.',
    '- **Attendance correction:** Local prototype state; no persistence.',
    '- **Other route states:** Inspect each route; no global product state contract is claimed.',
    '',
    '## Implementation readiness',
    '',
    markdownTable(['Readiness category', 'Source-backed finding'], [
      ['READY FOR REAL FRONTEND IMPLEMENTATION', 'Shared shell, navigation, modal/confirmation primitives and product page/feature sources where cited. Verify each route contract before extension.'],
      ['DESIGN ONLY', 'The 20 original modules plus 11 role workspaces and 5 business-persona concepts are local mock views, not complete production workflows.'],
      ['MISSING / NOT FOUND', 'Production role-scoped authentication/authorization, end-to-end approvals, viewer-safe data access, finance/procurement/O&M backends, and complete action/overlay permission mapping remain unverified or absent. Implement these later in the real app only after source-of-truth workflows and permission contracts are defined.'],
    ]),
    '',
    markdownTable(['Module / role / persona', 'Readiness', 'Source distinction'], [...readiness.map(([name, note]) => [name, 'DESIGN ONLY', note]), ...roleWorkspaceSpecs.map((workspace) => [`${workspace.role.ro} · ${workspace.home.ro}`, 'DESIGN ONLY', roleProductionStatus[workspace.id]])]),
    '',
    '### Reusable infrastructure',
    '',
    'AppShell, Sidebar, Header, MobilePrimaryNav, Modal, ConfirmDialog and product API modules where explicitly cited.',
    '',
    '### Page-specific / review-only',
    '',
    'DesignReviewWorkspace and its original file-local helpers, plus shared RoleWorkspacePreview and RoleWorkspaceDirectory. One data-driven component renders the 16 role/persona mock experiences.',
    '',
    '### Prototype interactions',
    '',
    'Module browsing, viewport/state selection, local sample search, bilingual role previews, mock overlay specifications, and local confirmation interactions. No role sessions, persisted edits, real uploads, real approvals, or production authorization are implemented.',
    '',
    '---',
    '',
    'HIIEKO · source audit · read only',
    '',
  ];

  return sections.join('\n');
}

function downloadAuditMarkdown(modules: ModuleAudit[]) {
  const blob = new Blob([buildAuditMarkdown(modules)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'hiieko-frontend-architecture-audit.md';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'amber' | 'slate' | 'red' }) {
  const palette = { green: 'border-emerald-200 bg-emerald-50 text-emerald-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', slate: 'border-slate-200 bg-slate-100 text-slate-700', red: 'border-rose-200 bg-rose-50 text-rose-800' };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${palette[tone]}`}>{children}</span>;
}

function AuditSection({ id, title, eyebrow, children }: { id: string; title: string; eyebrow: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2></div>{children}</section>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="break-all rounded bg-slate-100 px-1.5 py-1 font-mono text-xs text-slate-700">{children}</code>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-max border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-slate-100 align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function ArchitectureAuditWorkspace({ autoDownload = false }: { autoDownload?: boolean }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const modules = useMemo<ModuleAudit[]>(() => designReviewModules.map((module) => {
    const workspace = roleWorkspaceSpecs.find((item) => item.id === module.id);
    if (workspace) return {
      id: module.id,
      name: workspace.home.ro,
      route: null,
      component: 'RoleWorkspacePreview',
      file: 'web/src/components/RoleWorkspacePreview.tsx',
      audience: `${workspace.role.ro} · ${workspace.home.ro}`,
      access: 'Design-review prototype only; no authentication or role authorization is implemented. Business personas are not backend roles.',
      sections: [workspace.queueTitle.ro, workspace.alertTitle.ro, workspace.activityTitle.ro, workspace.nextTitle.ro],
      children: ['RoleWorkspacePreview', 'RoleWorkspaceDirectory'],
      data: 'Illustrative constants and local React state only; no API, persistence, authentication, or database connection.',
      readiness: 'DESIGN ONLY. This entry is a design-review concept, not an independent product route or complete production workflow.',
    };
    return { id: module.id, name: module.name || module.id, ...moduleAudit[module.id] };
  }), []);

  useEffect(() => {
    if (autoDownload) downloadAuditMarkdown(modules);
  }, [autoDownload, modules]);
  const visibleModules = useMemo(() => modules.filter((module) => {
    const matchesQuery = `${module.id} ${module.name ?? ''} ${module.route ?? ''} ${module.component} ${module.file} ${module.audience} ${module.access} ${module.sections.join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || `${module.audience} ${module.access}`.toUpperCase().includes(roleFilter);
    return matchesQuery && matchesRole;
  }), [modules, query, roleFilter]);

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Link href="/design-review" aria-label="Return to Design Review" className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft className="size-4" /></Link><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">HIIEKO · Engineering handoff</p><p className="truncate text-sm font-semibold">Frontend Architecture</p></div></div><div className="flex flex-wrap items-center justify-end gap-2"><Link href="/design-review/architecture?download=1" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"><Download aria-hidden="true" className="size-4" /><span>Download full report <span className="max-[420px]:hidden">(.md)</span></span></Link><Badge tone="green">Read-only source audit</Badge></div></div></header>
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-7 sm:py-8">
      <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-9"><div className="flex flex-wrap gap-2"><Badge tone="green">Actual source</Badge><Badge>Not a UI redesign</Badge><Badge>No product-data changes</Badge></div><h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Frontend Architecture</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">A source-grounded map of the current review prototype and the real product routes/components it references. Review mockups are not product routes. Capabilities not established by source are marked explicitly.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[[String(routes.length), 'page routes / page exports'], [String(reusable.length), 'shared components inventoried'], ['12', 'modal / dialog workflows'], ['2', 'drawer workflows · no sheets found'], ['0', 'popover implementations identified'], ['1', 'separate mobile component: MobilePrimaryNav'], ['9', 'review-only component definitions'], [String(overlays.length), 'overlay workflows documented']].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs leading-5 text-slate-300">{label}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-400">Counts reflect the source-backed inventories below: the 14 overlay entries comprise 12 dialog/modal and 2 drawer workflows. Nine review-only component definitions include DesignReviewWorkspace, RoleWorkspacePreview, RoleWorkspaceDirectory, and six existing file-local helpers. No product Sheet or Popover implementation was identified.</p></section>

      <nav aria-label="Architecture audit sections" className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto border-y border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-3">{[['summary','Summary'],['global-experience','Global UX'],['modules','Module trees'],['role-workspaces','Role workspaces'],['routes','Routes'],['overlays','Overlays'],['reuse','Reuse map'],['interactions','Interactions'],['responsive','Responsive'],['roles','Roles & gaps'],['states','States & data'],['readiness','Readiness']].map(([id,label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-950">{label}</a>)}</nav>

      <AuditSection id="summary" title="How to read this audit" eyebrow="Scope and evidence"><div className="grid gap-4 lg:grid-cols-3"><article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-semibold text-emerald-950">Review prototype</h3><p className="mt-2 text-sm leading-6 text-emerald-900">The 20 original module cards plus 11 role workspaces and 5 business personas are branches of <Code>DesignReviewWorkspace</Code> under <Code>/design-review?module=…</Code>, not independent product routes. Mock records and preview states are not live API responses.</p></article><article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold">Product source</h3><p className="mt-2 text-sm leading-6 text-slate-700">Actual routes, page exports, named feature components, route guards and API evidence are listed separately. Imports show implementation wiring, not that a service is available.</p></article><article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Naming accuracy</h3><p className="mt-2 text-sm leading-6 text-amber-950">Most design-review content is inline JSX, not named React components. Trees label that accurately instead of inventing section components. "NOT FOUND IN CURRENT SOURCE" means no source evidence was identified.</p></article></div></AuditSection>

      <AuditSection id="global-experience" title="Global product experience · design, production components and backend boundaries" eyebrow="12 documented global UX surfaces · design-review only"><p className="mb-4 text-sm leading-6 text-slate-600">Each entry identifies the review component and file, activation trigger, panel or dialog, fields, responsive behavior, data boundary, and any current production component or backend dependency. These concepts remain separate from the original 36 module and role/persona entries.</p><DataTable headers={['Experience', 'Component', 'Source file', 'Trigger / entry', 'Modal / drawer / dialog', 'Purpose', 'Fields', 'Responsive behavior', 'Data boundary', 'Production source / dependency']} rows={globalExperienceAudit.map((row, index) => [...row.slice(0, 4), globalExperienceSurfaces[index], ...row.slice(4)])} /><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><b>Implementation boundary:</b> DESIGN ONLY interactions are local. EXISTING PRODUCTION COMPONENTS are named for reference but remain unchanged. BACKEND DEPENDENCY entries require a real service contract before production behavior.</p></AuditSection>

      <AuditSection id="modules" title="Page → section → component trees" eyebrow="36 design-review entries · 20 existing modules · 16 role/persona experiences"><div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]"><label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3"><Search className="size-4 text-slate-400" /><span className="sr-only">Search architecture</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search module, route, component, role…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm"><span className="sr-only">Filter by role evidence</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none"><option value="ALL">All role evidence</option>{roles.map(([role]) => <option key={role}>{role}</option>)}</select></label></div><p className="mb-4 text-xs text-slate-500">Showing {visibleModules.length} / {modules.length}. Role filter matches source-evidence text; it does not simulate authorization.</p><div className="flex flex-col gap-3">{visibleModules.map((module, index) => <details key={module.id} className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-800">{String(index + 1).padStart(2,'0')}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{module.name}</span><span className="mt-1 block truncate font-mono text-xs text-slate-500">{module.route ?? 'No standalone product route'} · {module.id}</span></span><Badge tone={module.route ? 'slate' : 'amber'}>{module.route ? 'Product route mapped' : 'Review-only concept'}</Badge><ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><div className="grid gap-5 border-t border-slate-100 p-4 sm:p-5 xl:grid-cols-2"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Review-rendered tree</p><div className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-100"><div>DesignReviewPage · web/src/app/design-review/page.tsx</div><div>└─ DesignReviewWorkspace · web/src/components/DesignReviewWorkspace.tsx</div><div>   ├─ review-header · inline JSX</div><div>   └─ ModuleContent [id="{module.id}"]</div><div>      ├─ branch sections · inline JSX (unnamed)</div>{module.children.length ? module.children.map((child) => <div key={child}>      ├─ {child} · named component in source</div>) : <div>      ├─ no named feature child in this branch</div>}<div>      └─ optional StatePreview · shared state illustration</div></div><div className="mt-4"><p className="text-xs font-semibold text-slate-500">Actual product page component</p><p className="mt-1 text-sm font-semibold">{module.component}</p><Code>{module.file}</Code><p className="mt-4 text-xs font-semibold text-slate-500">Inline page sections</p><ul className="mt-2 flex flex-col gap-1.5">{module.sections.map((section) => <li key={section} className="text-sm leading-5 text-slate-700">• {section}</li>)}</ul></div></div><div className="flex flex-col gap-4"><div><p className="text-xs font-semibold text-slate-500">Audience and role evidence</p><p className="mt-1 text-sm leading-6 text-slate-700">{module.audience}</p><p className="mt-2 text-xs leading-5 text-slate-500">{module.access}</p></div><div><p className="text-xs font-semibold text-slate-500">Data boundary</p><p className="mt-1 text-sm leading-6 text-slate-700">{module.data}</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone="amber">{module.readiness.split(';')[0]}</Badge>{module.route && !module.route.includes('[') && <Link href={module.route} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open product route <ArrowUpRight className="size-3" /></Link>}</div><p className="text-xs leading-5 text-slate-500">Readiness: {module.readiness}</p></div></div></details>)}</div></AuditSection>

      <AuditSection id="routes" title="Current route inventory" eyebrow="Next.js page source"><p className="mb-4 text-sm leading-6 text-slate-600">Page export names map to current page.tsx files. Preview module IDs are query/local-state branches and are not separate routes.</p><DataTable headers={['Route','Page component']} rows={routes} /><p className="mt-4 text-xs leading-5 text-slate-500">Source: web/src/app/**/page.tsx. Root layout is RootLayout → AppShell. The audit route remains in the existing public design-review subtree.</p></AuditSection>

      <AuditSection id="overlays" title="Dialogs, modals, drawers and confirmations" eyebrow="Product source inventory"><div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">RoleWorkspacePreview documents 32 mock modal/drawer concepts (2 for each of 16 role/persona experiences), all controlled by local state and never persisted. StatePreview confirmation states are separate illustrations. The inventory below describes existing production components and clearly separates local prototypes from API calls.</div><div className="flex flex-col gap-3">{overlays.map(([name,component,file,type,trigger,purpose,fields,actions,who,responsive]) => <details key={name} className="group rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4"><span className="font-semibold">{name}</span><Badge>{type}</Badge><span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">{component}</span><ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><div className="grid gap-x-6 gap-y-3 border-t border-slate-100 p-4 text-sm sm:grid-cols-2"><p><b>Actual file</b><br /><Code>{file}</Code></p><p><b>Triggered by</b><br /><span className="text-slate-600">{trigger}</span></p><p><b>Purpose</b><br /><span className="text-slate-600">{purpose}</span></p><p><b>Who can use it</b><br /><span className="text-slate-600">{who}</span></p><p><b>Fields</b><br /><span className="text-slate-600">{fields}</span></p><p><b>Buttons / actions</b><br /><span className="text-slate-600">{actions}</span></p><p className="sm:col-span-2"><b>Destructive / confirmation / close / Escape / desktop and mobile</b><br /><span className="text-slate-600">{responsive}</span></p></div></details>)}</div></AuditSection>

      <AuditSection id="reuse" title="Component reuse map" eyebrow="Named components and real files"><p className="mb-4 text-sm text-slate-600">Review primitives are file-local; product shell and overlay primitives are separate, reusable infrastructure.</p><DataTable headers={['Group','Component','Actual file','Used by / purpose','Reusable?','Page-specific?','State / overlay / responsive']} rows={reusable.map(([group,name,file,uses,reuse,pageSpecific,state]) => [group,name,file,uses,`${reuse} · ${pageSpecific}`,state,''])} /><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['CARDS','Metric and SectionCard in review source.'],['TABLES','Review TableFrame retains a minimum width; mobile uses horizontal scrolling, not cards.'],['FILTERS / FORMS','TaskFilters is named; several product feature forms are inline in their workspace.'],['STATUS / STATES','Review StatusBadge and StatePreview; product pages have route-specific markup.']].map(([title,text]) => <div key={title} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>)}</div></AuditSection>

      <AuditSection id="interactions" title="Interaction map" eyebrow="Trigger → state → data boundary"><DataTable headers={['Button / control','Component','Trigger → result','State owner','Local / API evidence','Navigation','Success / error']} rows={interactions} /></AuditSection>

      <AuditSection id="responsive" title="Responsive architecture" eyebrow="Same component vs separate mobile component"><div className="grid gap-3 md:grid-cols-2">{[['Review browser','Same DesignReviewWorkspace/ModuleContent. Desktop has module navigator; mobile ≤720px hides it and keeps a sticky toolbar.'],['Review tables','Same TableFrame; minimum width remains and content scrolls horizontally rather than transforming into cards.'],['App navigation','AppShell owns mobileSidebarOpen; Sidebar/Header use it, while MobilePrimaryNav is a separate bottom-navigation component.'],['Inline dialogs','QualityWorkspace, CustomersWorkspace, DocumentsWorkspace use bottom-aligned rounded dialogs on small screens and centered dialogs at sm+.'],['Attendance drawer','AttendanceSessionDrawer is a right-side full-width narrow drawer and max-width panel on larger screens.'],['Role workspaces','RoleWorkspacePreview exposes desktop, tablet, and 390px layouts. Desktop has role navigation and split work panels; tablet compacts navigation and keeps two columns; mobile uses role-specific bottom navigation, stacked cards, touch-sized actions, and bottom-sheet overlays with sticky actions.'],['Sheets / popovers / toolbars','No dedicated Sheet or Popover implementation found in this audit. No universal toolbar-collapse or table-to-card rule is established.']].map(([title,text]) => <article key={title} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></AuditSection>

      <AuditSection id="role-workspaces" title="Role and business-persona design coverage" eyebrow="Design-only frontend concepts · no new backend roles"><p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Every workspace below is a local design-review prototype. These screens do not add production routes, permissions, API contracts, authentication, or database behavior. The existing 20 modules remain unchanged.</p><div className="flex flex-col gap-3">{roleWorkspaceSpecs.map((workspace) => {
        const overlayRows = workspace.overlays.map((overlay) => `${overlay.title.ro} · ${overlay.type.ro}; trigger: quick action; purpose: ${overlay.purpose.ro}; fields: ${overlay.fields.ro}; actions: ${overlay.actions.ro}; responsive: ${overlay.responsive.ro}; state: ${overlay.state.ro}`).join(' | ');
        const componentTree = `RoleHome → Header → Project/Site Context → Summary (${workspace.metrics.length} metrics) → Work Queue → Alerts → Activity → Primary Actions → Overlays`;
        const responsive = 'Desktop: full role navigation and split work panels. Tablet: compact navigation, two-column content. Mobile (~390px): role-specific bottom navigation, stacked cards, touch-sized actions, scrollable content, bottom-sheet overlays with sticky actions.';
        const capabilities = [...workspace.navigation.map((item) => item.ro), workspace.queueTitle.ro, workspace.alertTitle.ro, workspace.focusTitle.ro, workspace.nextTitle.ro].join(' · ');
        return <details key={workspace.id} className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 sm:p-5"><span className="min-w-0 flex-1"><span className="block font-semibold">{workspace.role.ro} · {workspace.home.ro}</span><span className="mt-1 block text-xs text-slate-500">{workspace.role.en} · {workspace.home.en} · {workspace.id}</span></span><Badge tone={workspace.category === 'persona' ? 'amber' : 'green'}>{workspace.category === 'persona' ? 'BUSINESS PERSONA · NO BACKEND ROLE' : 'ROLE WORKSPACE · DESIGN ONLY'}</Badge><ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary><div className="border-t border-slate-100 p-4 sm:p-5"><DataTable headers={['Architecture field','Design-review coverage']} rows={[
          ['ROLE / PERSONA', `${workspace.role.ro} / ${workspace.role.en} · ${workspace.category === 'persona' ? 'Organizational function only; not a backend enum.' : 'Frontend-only view; no permission enforcement.'}`],
          ['PRIMARY WORKSPACE', `${workspace.home.ro} / ${workspace.home.en} · ${workspace.project.ro} · ${workspace.context.ro}`],
          ['SECONDARY WORKSPACES', workspace.navigation.map((item) => `${item.ro} / ${item.en}`).join(' · ')],
          ['COMPONENT TREE', componentTree],
          ['MODALS / DRAWERS / SHEETS', overlayRows],
          ['RESPONSIVE BEHAVIOR', responsive],
          ['BUSINESS CAPABILITIES', capabilities],
          ['DESIGN-ONLY / PRODUCTION-EXISTS', `Design review: ${workspace.home.ro} is entirely mock and local. Production source distinction: ${roleProductionStatus[workspace.id]}`],
        ]} /></div></details>;
      })}</div></AuditSection>

      <AuditSection id="roles" title="Production role evidence and remaining gaps" eyebrow="Menu evidence is not authorization"><p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">Evidence sources: web/src/config/navigation.ts, explicit RoleGuard lists and component-level predicates. Design workspaces above do not alter these source capabilities; no capability is inferred solely from navigation visibility.</p><div className="flex flex-col gap-3">{roles.map(([role,evidence,gap]) => <details key={role} className="rounded-xl border border-slate-200 bg-white p-4"><summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 font-semibold"><span className="font-mono">{role}</span><Badge tone="green">Design workspace added · source evidence below</Badge><ChevronDown className="ml-auto size-4 text-slate-400" /></summary><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><b>Primary workspace / visible navigation</b><br /><span className="text-slate-600">{evidence}</span></p><p><b>Coverage / missing workflows</b><br /><span className="text-slate-600">{gap}</span></p><p className="sm:col-span-2"><b>Approval, attendance, task, planning, report, material, QA/QC, document and project actions</b><br /><span className="text-slate-600">Not consolidated into a role-specific capability matrix in current source. Action-level permission coverage beyond cited guards/predicate: NOT FOUND IN CURRENT SOURCE.</span></p></div></details>)}</div><div className="mt-5"><DataTable headers={['Business persona','Production distinction']} rows={roleGaps} /></div></AuditSection>

      <AuditSection id="states" title="State architecture and data boundaries" eyebrow="Local preview vs product code"><div className="grid gap-4 xl:grid-cols-2"><article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">DesignReviewWorkspace state</h3><p className="mt-1 text-xs text-slate-500">web/src/components/DesignReviewWorkspace.tsx · useState</p><p className="mt-3 text-sm leading-6 text-slate-700"><Code>activeModuleId</Code>, <Code>viewport</Code>, <Code>reviewState</Code>, <Code>search</Code>, <Code>notice</Code>.</p><ul className="mt-3 flex flex-col gap-2 text-sm leading-5 text-slate-700"><li><b>Loading, empty, no-results, error, permission-denied, success, confirmation, destructive-confirmation:</b> StatePreview illustrations, not fetched states or actual permission checks.</li><li><b>Populated:</b> StatePreview returns null.</li><li><b>Search:</b> local filter state in selected preview branch.</li><li><b>Module selection:</b> local state plus history.replaceState query parameter.</li><li><b>Role/persona previews:</b> each workspace has local locale, viewport, navigation, overlay, and state-demo controls; none persists data or calls an API.</li><li><b>Business data:</b> local constants/arrays in review source; no API/fetch import found there.</li></ul></article><article className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">Product-state evidence (examples)</h3><ul className="mt-3 flex flex-col gap-2 text-sm leading-5 text-slate-700"><li><b>QA/QC:</b> loading, refreshing, error, query, statusFilter, openForm, inspectorName, measurements, saving, success, formError; getInspections + POST inspection.</li><li><b>Tasks:</b> tasks/loading/error/search/status/onlyMine and modal/update state; imports getTasks/updateTask.</li><li><b>Project detail:</b> project/member/user/loading/error/success/tab/add/remove state; imports apiClient.</li><li><b>Attendance correction:</b> local prototype state; no persistence.</li><li><b>Other route states:</b> inspect each route; no global product state contract is claimed.</li></ul></article></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['LOCAL MOCK','Hardcoded review arrays and sample values.'],['DERIVED LOCAL STATE','Filtered lists/counts derived from local React state.'],['UI STATE','Selected module, viewport, preview state, temporary notice.'],['API-BACKED DESIGN','A status label is not evidence of a request; require an actual API call in source.']].map(([title,text]) => <div key={title} className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold tracking-wide">{title}</p><p className="mt-2 text-xs leading-5 text-slate-600">{text}</p></div>)}</div></AuditSection>

      <AuditSection id="readiness" title="Implementation readiness" eyebrow="Engineering handoff"><div className="mb-4 grid gap-3 md:grid-cols-3">{[['READY FOR REAL FRONTEND IMPLEMENTATION','Shared shell, navigation, modal/confirmation primitives and product page/feature sources where cited. Verify each route contract before extension.'],['DESIGN ONLY','The 20 original module branches plus 11 role workspaces and 5 business-persona concepts are local-data visuals; none is a complete production workflow.'],['MISSING / NOT FOUND','Production role-scoped authentication/authorization, end-to-end approvals, viewer-safe data access, finance/procurement/O&M backends, and complete action/overlay permission mapping remain unverified or absent.']].map(([title,text]) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div><DataTable headers={['Module / role / persona','Readiness','Source distinction']} rows={[...readiness.map(([name,note]) => [name,'DESIGN ONLY',note]), ...roleWorkspaceSpecs.map((workspace) => [`${workspace.role.ro} · ${workspace.home.ro}`, 'DESIGN ONLY', roleProductionStatus[workspace.id]])]} /><div className="mt-5 rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-200"><p className="font-semibold text-white">Reusable infrastructure</p><p>AppShell, Sidebar, Header, MobilePrimaryNav, Modal, ConfirmDialog and product API modules where explicitly cited.</p><p className="mt-3 font-semibold text-white">Page-specific / review-only</p><p>DesignReviewWorkspace and its original file-local helpers, plus shared RoleWorkspacePreview and RoleWorkspaceDirectory. One data-driven component renders all 16 role/persona mock experiences.</p><p className="mt-3 font-semibold text-white">Prototype interactions</p><p>Module browsing, viewport/state selection, local sample search and temporary notice. The review does not implement role-specific sessions, persisted mock edits, real uploads or a real approval mutation. All 16 new role/persona experiences remain DESIGN ONLY. Production gaps still include role-scoped authentication and authorization, complete task/attendance/report workflows, approvals, procurement and purchasing, finance/payroll administration, asset maintenance, audit trails, and viewer-safe data access. These should be implemented later in the real web application only after backend contracts, permission policy, and source-of-truth workflows are defined.</p></div></AuditSection>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-500"><span>HIIEKO · source audit · read only</span><Link href="/design-review" className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950">Return to Design Review <ArrowLeft className="size-3" /></Link></footer>
    </div>
  </main>;
}

export default ArchitectureAuditWorkspace;
