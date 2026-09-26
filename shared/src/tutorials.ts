// ============================================================================
// In-App Tutorial / Page Introduction System (HIIEKO Camera/OCR spec §9–§15)
//
// A single, reusable definition of the introduction for every meaningful Web
// page and Mobile screen. Each section answers: What is this? What is it for?
// What do I do here? What happens next? Who can use it? + Important rules.
//
// IMPORTANT: All copy lives in `translations.ts` under translation keys so the
// same content is fully localised (ro + en) and never hardcoded in UI. This
// file only declares WHICH keys each section uses (and their structure).
// ============================================================================

import { UserRole } from './types';

export type TutorialSectionId =
  | 'dashboard'
  | 'attendance'
  | 'reports'
  | 'deliveries'
  | 'stock'
  | 'sites'
  | 'expenses'
  | 'approvals'
  | 'users'
  | 'statistics'
  | 'notifications'
  | 'profile'
  | 'scan'
  | 'expenseReview'
  | 'login'
  | 'projects'
  | 'project-detail'
  | 'workforce'
  | 'teams';

export interface TutorialRoleNote {
  role: UserRole;
  noteKey: string;
}

export interface TutorialHelpItem {
  /** Short label (e.g. "Supplier") — translation key. */
  labelKey: string;
  /** Help text — translation key. */
  textKey: string;
}

export interface TutorialContent {
  id: TutorialSectionId;
  /** "What is this?" heading. */
  titleKey: string;
  /** Concise one-line summary visible by default (progressive disclosure). */
  shortKey: string;
  /** "What is it for?" */
  purposeKey: string;
  /** "What do I do here?" ordered steps. */
  steps: string[];
  /** Role-specific guidance. */
  roles: TutorialRoleNote[];
  /** "Important rules" warning. */
  importantKey?: string;
  /** Optional field-level help/tooltips. */
  helpItems?: TutorialHelpItem[];
}

/** Per-section prefix used to build translation keys. */
const K = (id: TutorialSectionId) => `tutorial.${id}`;

/**
 * Canonical tutorial content for every meaningful page/screen.
 * Steps/role notes are referenced by translation key; see translations.ts.
 */
export const TUTORIALS: Record<TutorialSectionId, TutorialContent> = {
  dashboard: {
    id: 'dashboard',
    titleKey: `${K('dashboard')}.title`,
    shortKey: `${K('dashboard')}.short`,
    purposeKey: `${K('dashboard')}.purpose`,
    steps: [
      `${K('dashboard')}.step1`,
      `${K('dashboard')}.step2`,
      `${K('dashboard')}.step3`,
    ],
    roles: [
      { role: 'worker', noteKey: `${K('dashboard')}.role.worker` },
      { role: 'manager', noteKey: `${K('dashboard')}.role.manager` },
      { role: 'admin', noteKey: `${K('dashboard')}.role.admin` },
    ],
    importantKey: `${K('dashboard')}.important`,
  },
  attendance: {
    id: 'attendance',
    titleKey: `${K('attendance')}.title`,
    shortKey: `${K('attendance')}.short`,
    purposeKey: `${K('attendance')}.purpose`,
    steps: [
      `${K('attendance')}.step1`,
      `${K('attendance')}.step2`,
      `${K('attendance')}.step3`,
    ],
    roles: [
      { role: 'worker', noteKey: `${K('attendance')}.role.worker` },
      { role: 'manager', noteKey: `${K('attendance')}.role.manager` },
    ],
    importantKey: `${K('attendance')}.important`,
  },
  reports: {
    id: 'reports',
    titleKey: `${K('reports')}.title`,
    shortKey: `${K('reports')}.short`,
    purposeKey: `${K('reports')}.purpose`,
    steps: [
      `${K('reports')}.step1`,
      `${K('reports')}.step2`,
      `${K('reports')}.step3`,
    ],
    roles: [
      { role: 'team_leader', noteKey: `${K('reports')}.role.team_leader` },
      { role: 'manager', noteKey: `${K('reports')}.role.manager` },
    ],
    importantKey: `${K('reports')}.important`,
  },
  deliveries: {
    id: 'deliveries',
    titleKey: `${K('deliveries')}.title`,
    shortKey: `${K('deliveries')}.short`,
    purposeKey: `${K('deliveries')}.purpose`,
    steps: [
      `${K('deliveries')}.step1`,
      `${K('deliveries')}.step2`,
      `${K('deliveries')}.step3`,
    ],
    roles: [
      { role: 'team_leader', noteKey: `${K('deliveries')}.role.team_leader` },
      { role: 'manager', noteKey: `${K('deliveries')}.role.manager` },
    ],
    importantKey: `${K('deliveries')}.important`,
  },
  stock: {
    id: 'stock',
    titleKey: `${K('stock')}.title`,
    shortKey: `${K('stock')}.short`,
    purposeKey: `${K('stock')}.purpose`,
    steps: [
      `${K('stock')}.step1`,
      `${K('stock')}.step2`,
      `${K('stock')}.step3`,
    ],
    roles: [
      { role: 'team_leader', noteKey: `${K('stock')}.role.team_leader` },
      { role: 'admin', noteKey: `${K('stock')}.role.admin` },
    ],
    importantKey: `${K('stock')}.important`,
  },
  sites: {
    id: 'sites',
    titleKey: `${K('sites')}.title`,
    shortKey: `${K('sites')}.short`,
    purposeKey: `${K('sites')}.purpose`,
    steps: [
      `${K('sites')}.step1`,
      `${K('sites')}.step2`,
      `${K('sites')}.step3`,
    ],
    roles: [
      { role: 'manager', noteKey: `${K('sites')}.role.manager` },
      { role: 'admin', noteKey: `${K('sites')}.role.admin` },
    ],
    importantKey: `${K('sites')}.important`,
  },
  expenses: {
    id: 'expenses',
    titleKey: `${K('expenses')}.title`,
    shortKey: `${K('expenses')}.short`,
    purposeKey: `${K('expenses')}.purpose`,
    steps: [
      `${K('expenses')}.step1`,
      `${K('expenses')}.step2`,
      `${K('expenses')}.step3`,
      `${K('expenses')}.step4`,
    ],
    roles: [
      { role: 'worker', noteKey: `${K('expenses')}.role.worker` },
      { role: 'manager', noteKey: `${K('expenses')}.role.manager` },
    ],
    importantKey: `${K('expenses')}.important`,
    helpItems: [
      { labelKey: 'help.supplier', textKey: 'help.supplier' },
      { labelKey: 'help.cui', textKey: 'help.cui' },
      { labelKey: 'help.total', textKey: 'help.total' },
      { labelKey: 'help.vat', textKey: 'help.vat' },
      { labelKey: 'help.category', textKey: 'help.category' },
      { labelKey: 'help.site', textKey: 'help.site' },
      { labelKey: 'help.purpose', textKey: 'help.purpose' },
      { labelKey: 'help.document', textKey: 'help.document' },
    ],
  },
  approvals: {
    id: 'approvals',
    titleKey: `${K('approvals')}.title`,
    shortKey: `${K('approvals')}.short`,
    purposeKey: `${K('approvals')}.purpose`,
    steps: [
      `${K('approvals')}.step1`,
      `${K('approvals')}.step2`,
      `${K('approvals')}.step3`,
    ],
    roles: [
      { role: 'manager', noteKey: `${K('approvals')}.role.manager` },
      { role: 'admin', noteKey: `${K('approvals')}.role.admin` },
    ],
    importantKey: `${K('approvals')}.important`,
  },
  users: {
    id: 'users',
    titleKey: `${K('users')}.title`,
    shortKey: `${K('users')}.short`,
    purposeKey: `${K('users')}.purpose`,
    steps: [
      `${K('users')}.step1`,
      `${K('users')}.step2`,
      `${K('users')}.step3`,
    ],
    roles: [{ role: 'admin', noteKey: `${K('users')}.role.admin` }],
    importantKey: `${K('users')}.important`,
  },
  statistics: {
    id: 'statistics',
    titleKey: `${K('statistics')}.title`,
    shortKey: `${K('statistics')}.short`,
    purposeKey: `${K('statistics')}.purpose`,
    steps: [
      `${K('statistics')}.step1`,
      `${K('statistics')}.step2`,
      `${K('statistics')}.step3`,
    ],
    roles: [
      { role: 'manager', noteKey: `${K('statistics')}.role.manager` },
      { role: 'admin', noteKey: `${K('statistics')}.role.admin` },
    ],
    importantKey: `${K('statistics')}.important`,
  },
  notifications: {
    id: 'notifications',
    titleKey: `${K('notifications')}.title`,
    shortKey: `${K('notifications')}.short`,
    purposeKey: `${K('notifications')}.purpose`,
    steps: [
      `${K('notifications')}.step1`,
      `${K('notifications')}.step2`,
      `${K('notifications')}.step3`,
    ],
    roles: [
      { role: 'worker', noteKey: `${K('notifications')}.role.worker` },
      { role: 'manager', noteKey: `${K('notifications')}.role.manager` },
    ],
    importantKey: `${K('notifications')}.important`,
  },
  profile: {
    id: 'profile',
    titleKey: `${K('profile')}.title`,
    shortKey: `${K('profile')}.short`,
    purposeKey: `${K('profile')}.purpose`,
    steps: [
      `${K('profile')}.step1`,
      `${K('profile')}.step2`,
      `${K('profile')}.step3`,
    ],
    roles: [{ role: 'worker', noteKey: `${K('profile')}.role.worker` }],
    importantKey: `${K('profile')}.important`,
  },
  scan: {
    id: 'scan',
    titleKey: `${K('scan')}.title`,
    shortKey: `${K('scan')}.short`,
    purposeKey: `${K('scan')}.purpose`,
    steps: [
      `${K('scan')}.step1`,
      `${K('scan')}.step2`,
      `${K('scan')}.step3`,
      `${K('scan')}.step4`,
      `${K('scan')}.step5`,
    ],
    roles: [{ role: 'worker', noteKey: `${K('scan')}.role.worker` }],
    importantKey: `${K('scan')}.important`,
  },
  expenseReview: {
    id: 'expenseReview',
    titleKey: `${K('expenseReview')}.title`,
    shortKey: `${K('expenseReview')}.short`,
    purposeKey: `${K('expenseReview')}.purpose`,
    steps: [
      `${K('expenseReview')}.step1`,
      `${K('expenseReview')}.step2`,
      `${K('expenseReview')}.step3`,
    ],
    roles: [{ role: 'worker', noteKey: `${K('expenseReview')}.role.worker` }],
    importantKey: `${K('expenseReview')}.important`,
  },
  login: {
    id: 'login',
    titleKey: `${K('login')}.title`,
    shortKey: `${K('login')}.short`,
    purposeKey: `${K('login')}.purpose`,
    steps: [
      `${K('login')}.step1`,
      `${K('login')}.step2`,
      `${K('login')}.step3`,
    ],
    roles: [],
    importantKey: `${K('login')}.important`,
  },
  projects: {
    id: 'projects',
    titleKey: `${K('projects')}.title`,
    shortKey: `${K('projects')}.short`,
    purposeKey: `${K('projects')}.purpose`,
    steps: [
      `${K('projects')}.step1`,
      `${K('projects')}.step2`,
      `${K('projects')}.step3`,
    ],
    roles: [
      { role: 'admin', noteKey: `${K('projects')}.role_admin` },
      { role: 'manager', noteKey: `${K('projects')}.role_manager` },
      { role: 'pm', noteKey: `${K('projects')}.role_pm` },
      { role: 'worker', noteKey: `${K('projects')}.role_worker` },
      { role: 'viewer', noteKey: `${K('projects')}.role_viewer` },
    ],
    importantKey: `${K('projects')}.important`,
  },
  'project-detail': {
    id: 'project-detail',
    titleKey: `${K('project-detail')}.title`,
    shortKey: `${K('project-detail')}.short`,
    purposeKey: `${K('project-detail')}.purpose`,
    steps: [
      `${K('project-detail')}.step1`,
      `${K('project-detail')}.step2`,
      `${K('project-detail')}.step3`,
    ],
    roles: [
      { role: 'admin', noteKey: `${K('project-detail')}.role_admin` },
      { role: 'manager', noteKey: `${K('project-detail')}.role_manager` },
      { role: 'pm', noteKey: `${K('project-detail')}.role_pm` },
      { role: 'worker', noteKey: `${K('project-detail')}.role_worker` },
      { role: 'viewer', noteKey: `${K('project-detail')}.role_viewer` },
    ],
    importantKey: `${K('project-detail')}.important`,
  },
  workforce: {
    id: 'workforce',
    titleKey: `${K('workforce')}.title`,
    shortKey: `${K('workforce')}.short`,
    purposeKey: `${K('workforce')}.purpose`,
    steps: [
      `${K('workforce')}.step1`,
      `${K('workforce')}.step2`,
    ],
    roles: [
      { role: 'admin', noteKey: `${K('workforce')}.role_admin` },
      { role: 'manager', noteKey: `${K('workforce')}.role_manager` },
    ],
  },
  teams: {
    id: 'teams',
    titleKey: `${K('teams')}.title`,
    shortKey: `${K('teams')}.short`,
    purposeKey: `${K('teams')}.purpose`,
    steps: [
      `${K('teams')}.step1`,
      `${K('teams')}.step2`,
    ],
    roles: [
      { role: 'admin', noteKey: `${K('teams')}.role_admin` },
      { role: 'manager', noteKey: `${K('teams')}.role_manager` },
    ],
  },
};

/** Ordered list of every tutorial section, used for coverage checks. */
export const TUTORIAL_SECTION_IDS = Object.keys(TUTORIALS) as TutorialSectionId[];

/** Camera framing tips — translation keys (spec §15). */
export const CAMERA_TIPS_KEYS: string[] = [
  'camera.tip1',
  'camera.tip2',
  'camera.tip3',
  'camera.tip4',
  'camera.tip5',
  'camera.tip6',
];

/** Get a tutorial section by id (safe lookup). */
export function getTutorial(id: TutorialSectionId): TutorialContent | undefined {
  return TUTORIALS[id];
}

