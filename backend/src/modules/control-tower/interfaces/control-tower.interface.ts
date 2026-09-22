export interface ControlTowerOverviewDto {
  projects: ProjectsMetrics;
  workforce: WorkforceMetrics;
  production: ProductionMetrics;
  materials: MaterialsMetrics;
  finance: FinanceMetrics;
  quality: QualityMetrics;
  documentation: DocumentationMetrics;
  redFlags: RedFlag[];
}

export interface ProjectsMetrics {
  activeProjects: number;
  projectsByStage: Record<string, number>;
  upcomingDeadlines: number;
  overdueProjects: number;
  activeProjectsList: ActiveProjectSummary[];
  upcomingDeadlinesList: DeadlineItem[];
  overdueProjectsList: OverdueProjectItem[];
}

export interface ActiveProjectSummary {
  id: string;
  name: string;
  code: string;
  stage: string;
  targetEndDate: string | null;
  budgetTotal: number | null;
  currency: string;
  progressPercent: number;
}

export interface DeadlineItem {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  stage: string;
  targetDate: string;
  daysUntilDeadline: number;
  responsiblePerson: string;
}

export interface OverdueProjectItem {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  stage: string;
  targetEndDate: string;
  daysOverdue: number;
  responsiblePerson: string;
}

export interface WorkforceMetrics {
  scheduledToday: number;
  checkedIn: number;
  missing: number;
  overtimeMinutes: number;
  scheduledTodayList: ScheduledWorker[];
  missingList: MissingWorker[];
  overtimeList: OvertimeWorker[];
}

export interface ScheduledWorker {
  id: string;
  userId: string;
  fullName: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  role: string;
  checkInTime: string | null;
  isWithinGeofence: boolean | null;
}

export interface MissingWorker {
  userId: string;
  fullName: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  role: string;
  expectedAt: string;
  responsiblePerson: string;
}

export interface OvertimeWorker {
  userId: string;
  fullName: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  overtimeMinutes: number;
  overtimeHours: string;
}

export interface ProductionMetrics {
  plannedToday: number;
  actualToday: number;
  completionPercentage: number;
  blockedProduction: number;
  plannedTasksList: PlannedTaskItem[];
  actualTasksList: ActualTaskItem[];
  blockedTasksList: BlockedTaskItem[];
}

export interface PlannedTaskItem {
  id: string;
  taskCode: string;
  title: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  zoneName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedQuantity: number | null;
  unitOfMeasure: string | null;
  assignedWorkers: string[];
}

export interface ActualTaskItem {
  id: string;
  taskCode: string;
  title: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  actualStart: string | null;
  actualEnd: string | null;
  actualQuantity: number | null;
  completionPercent: number;
  assignedWorkers: string[];
}

export interface BlockedTaskItem {
  id: string;
  taskCode: string;
  title: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  zoneName: string | null;
  blockedReason: string;
  blockingTasks: string[];
  assignedWorkers: string[];
  responsiblePerson: string;
}

export interface MaterialsMetrics {
  lowStock: number;
  missingRequired: number;
  overconsumption: number;
  pendingDeliveries: number;
  lowStockList: LowStockItem[];
  missingRequiredList: MissingRequiredItem[];
  overconsumptionList: OverconsumptionItem[];
  pendingDeliveriesList: PendingDeliveryItem[];
}

export interface LowStockItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  currentQuantity: number;
  minThreshold: number;
  projectId: string | null;
  projectName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  deficit: number;
}

export interface MissingRequiredItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortfall: number;
  taskId: string | null;
  taskCode: string | null;
}

export interface OverconsumptionItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  plannedQuantity: number;
  actualConsumed: number;
  overconsumptionQuantity: number;
  overconsumptionPercent: number;
}

export interface PendingDeliveryItem {
  id: string;
  avizNumber: string;
  supplierName: string;
  deliveryDate: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  items: PendingDeliveryLine[];
  status: string;
}

export interface PendingDeliveryLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface FinanceMetrics {
  budget: number;
  actual: number;
  committed: number;
  forecast: number;
  variance: number;
  variancePercent: number;
  budgetByProject: ProjectFinanceItem[];
}

export interface ProjectFinanceItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  budget: number;
  actual: number;
  committed: number;
  forecast: number;
  variance: number;
  variancePercent: number;
  currency: string;
}

export interface QualityMetrics {
  failedInspections: number;
  openNCRs: number;
  pendingCorrections: number;
  failedInspectionsList: FailedInspectionItem[];
  openNCRsList: OpenNCRItem[];
  pendingCorrectionsList: PendingCorrectionItem[];
}

export interface FailedInspectionItem {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  inspectorName: string;
  inspectedAt: string;
  failedParameters: FailedParameter[];
  responsiblePerson: string;
}

export interface FailedParameter {
  parameter: string;
  value: number;
  unit: string;
  passed: boolean;
}

export interface OpenNCRItem {
  id: string;
  ncrNumber: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  description: string;
  status: string;
  createdAt: string;
  responsiblePerson: string;
}

export interface PendingCorrectionItem {
  id: string;
  ncrNumber: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  description: string;
  proposedCorrection: string;
  status: string;
  responsiblePerson: string;
  dueDate: string | null;
}

export interface DocumentationMetrics {
  missingDocuments: number;
  awaitingApproval: number;
  supersededDocuments: number;
  missingDocumentsList: MissingDocumentItem[];
  awaitingApprovalList: AwaitingApprovalItem[];
  supersededDocumentsList: SupersededDocumentItem[];
}

export interface MissingDocumentItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  requiredDocumentType: string;
  reason: string;
  responsiblePerson: string;
}

export interface AwaitingApprovalItem {
  id: string;
  title: string;
  documentType: string;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  currentVersion: number;
  submittedAt: string;
  submittedBy: string;
  responsiblePerson: string;
}

export interface SupersededDocumentItem {
  id: string;
  title: string;
  documentType: string;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  currentVersion: number;
  latestVersion: number;
  supersededAt: string;
  responsiblePerson: string;
}

export interface RedFlag {
  id: string;
  category: 'PROJECTS' | 'WORKFORCE' | 'PRODUCTION' | 'MATERIALS' | 'FINANCE' | 'QUALITY' | 'DOCUMENTATION';
  affectedEntity: string;
  entityId: string;
  reason: string;
  responsiblePerson: string;
  responsiblePersonId: string | null;
  timestamp: string;
  sourceRecord: string;
  sourceRecordId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface DrillDownParams {
  category: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface DrillDownResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}