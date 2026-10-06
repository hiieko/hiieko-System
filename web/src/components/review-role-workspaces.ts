export type ReviewCopy = { ro: string; en: string };
export type ReviewWorkspaceGroup = 'role' | 'persona';
export type ReviewWorkspaceMetric = { label: ReviewCopy; value: string; detail: ReviewCopy; tone: 'green' | 'blue' | 'amber' | 'slate' };
export type ReviewWorkspaceQueueItem = { code: string; title: ReviewCopy; owner: ReviewCopy; due: ReviewCopy; status: ReviewCopy; tone: 'green' | 'blue' | 'amber' | 'red' | 'slate' };
export type ReviewWorkspaceAlert = { title: ReviewCopy; detail: ReviewCopy; level: 'urgent' | 'attention' | 'info' };
export type ReviewWorkspaceActivity = { actor: ReviewCopy; action: ReviewCopy; time: ReviewCopy };
export type ReviewWorkspaceSpec = {
  id: string;
  group: ReviewWorkspaceGroup;
  roRole: string;
  enRole: string;
  roHome: string;
  enHome: string;
  secondaryRo: string[];
  secondaryEn: string[];
  intro: ReviewCopy;
  contextTitle: ReviewCopy;
  contextDetail: ReviewCopy;
  shiftLabel: ReviewCopy;
  progressLabel: ReviewCopy;
  progressValue: string;
  priorities: ReviewCopy[];
  metrics: ReviewWorkspaceMetric[];
  navigation: ReviewCopy[];
  primaryAction: ReviewCopy;
  secondaryActions: ReviewCopy[];
  queueTitle: ReviewCopy;
  queue: ReviewWorkspaceQueueItem[];
  alerts: ReviewWorkspaceAlert[];
  activity: ReviewWorkspaceActivity[];
  nextActions: ReviewCopy[];
  overlay: {
    name: ReviewCopy;
    type: ReviewCopy;
    trigger: ReviewCopy;
    purpose: ReviewCopy;
    fields: ReviewCopy[];
    actions: ReviewCopy[];
    responsive: ReviewCopy;
  };
  capabilities: ReviewCopy[];
  mobileSummary: ReviewCopy;
  tabletSummary: ReviewCopy;
  desktopSummary: ReviewCopy;
  productionBoundary: ReviewCopy;
  tree: string[];
};

const c = (ro: string, en: string): ReviewCopy => ({ ro, en });

export const reviewRoleWorkspaces: ReviewWorkspaceSpec[] = [];
export const reviewRoleWorkspaceStates = [
  { id: 'populated', ro: 'Populat', en: 'Populated' },
  { id: 'loading', ro: 'Se încarcă', en: 'Loading' },
  { id: 'empty', ro: 'Fără date', en: 'Empty' },
  { id: 'no-results', ro: 'Fără rezultate', en: 'No results' },
  { id: 'error', ro: 'Eroare', en: 'Error' },
  { id: 'permission-denied', ro: 'Acces refuzat', en: 'Permission denied' },
  { id: 'success', ro: 'Succes', en: 'Success' },
  { id: 'confirmation', ro: 'Confirmare', en: 'Confirmation' },
  { id: 'destructive-confirmation', ro: 'Confirmare ștergere', en: 'Destructive confirmation' },
] as const;

export type ReviewRoleWorkspaceState = (typeof reviewRoleWorkspaceStates)[number]['id'];
export type ReviewWorkspaceViewport = 'desktop' | 'tablet' | 'mobile';

export const reviewCopy = (copy: ReviewCopy, locale: 'ro' | 'en') => copy[locale];
