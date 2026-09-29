/**
 * HIIEKO — Daily Report Form Types (P4.3)
 */
import type { DailyReport } from '@solar/shared';

export type FormSection =
  | 'work' | 'ohs' | 'personnel' | 'materials' | 'tasks' | 'execution' | 'review';

export const FORM_SECTIONS: FormSection[] = [
  'work', 'ohs', 'personnel', 'materials', 'tasks', 'execution', 'review',
];

export const SECTION_I18N_KEY: Record<FormSection, string> = {
  work: 'daily_report.section_work',
  ohs: 'daily_report.section_ohs',
  personnel: 'daily_report.section_personnel',
  materials: 'daily_report.section_materials',
  tasks: 'daily_report.section_tasks',
  execution: 'daily_report.section_execution',
  review: 'daily_report.section_review',
};

export interface OhsRiskItem { key: string; checked: boolean; notes?: string; }
export interface ReportWorkerEntry { id?: string; workerId: string; workerName?: string; hoursWorked: number; overtimeHours: number; mainDuties: string; ohsConfirmed: boolean; }
export interface ReportMaterialEntry { id?: string; materialId: string; materialName?: string; materialUnit?: string; quantityUsed: number; remarks?: string; }
export interface ReportTaskEntry { id?: string; taskId: string; taskTitle?: string; taskUnit?: string; quantityDone: number; notes?: string; }

export interface DailyReportFormState {
  reportId?: string;
  teamLeaderId: string;
  teamLeaderName: string;
  projectId: string;
  reportDate: string;
  startTime: string;
  endTime: string;
  proposedWork: string;
  ohsRisks: OhsRiskItem[];
  workers: ReportWorkerEntry[];
  materials: ReportMaterialEntry[];
  tasks: ReportTaskEntry[];
  weatherNotes: string;
  blockages: string;
  generalNotes: string;
  status: string;
  /** P4.4: the revision number stamped on the report row by a finalization (0 while DRAFT). */
  revisionNumber: number;
  lastSavedAt: string | null;
  isDirty: boolean;
}

export const DEFAULT_OHS_RISKS: OhsRiskItem[] = [
  { key: 'ppe', checked: false }, { key: 'adverse_weather', checked: false },
  { key: 'procedures', checked: false }, { key: 'electrical', checked: false },
  { key: 'tools_machinery', checked: false }, { key: 'fall_height', checked: false },
  { key: 'other_risks', checked: false },
];

export const OHS_RISK_I18N: Record<string, string> = {
  ppe: 'daily_report.ppe', adverse_weather: 'daily_report.adverse_weather',
  procedures: 'daily_report.procedures', electrical: 'daily_report.electrical',
  tools_machinery: 'daily_report.tools_machinery', fall_height: 'daily_report.fall_height',
  other_risks: 'daily_report.other_risks',
};
