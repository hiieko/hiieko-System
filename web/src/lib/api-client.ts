/**
 * HIIEKO API Client - Typed HTTP client for NestJS backend
 * 
 * Replaces direct Supabase calls with RESTful API requests.
 * All endpoints return standardized response envelopes.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  fullName?: string;
  organizationId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Try to load token from localStorage on initialization (client-side only)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('api_token');
    }
  }

  /**
   * Set the authentication token for subsequent requests
   */
  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('api_token', token);
      } else {
        localStorage.removeItem('api_token');
      }
    }
  }

  /**
   * Get the current authentication token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Internal request helper
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || data.error || 'Request failed',
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: AuthUser } & AuthTokens>> {
    const response = await this.request<ApiResponse<{ user: AuthUser; accessToken: string }>>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );
    
    // Store token automatically on successful login
    if (response.data.accessToken) {
      this.setToken(response.data.accessToken);
    }
    
    return response;
  }

  async register(data: RegisterData): Promise<ApiResponse<{ user: AuthUser } & AuthTokens>> {
    const response = await this.request<ApiResponse<{ user: AuthUser; accessToken: string }>>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    
    // Store token automatically on successful registration
    if (response.data.accessToken) {
      this.setToken(response.data.accessToken);
    }
    
    return response;
  }

  async getMe(): Promise<ApiResponse<AuthUser>> {
    return this.request<ApiResponse<AuthUser>>('/api/auth/me');
  }

  async logout(): Promise<void> {
    this.setToken(null);
  }

  // ============================================================================
  // PROJECTS (Santiere)
  // ============================================================================

  async getProjects(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/projects');
  }

  async getProject(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${id}`);
  }

  async createProject(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // EXPENSES (Cheltuieli)
  // ============================================================================

  async getExpenses(params?: {
    projectId?: string;
    userId?: string;
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.status) query.set('status', params.status);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/expenses${queryString ? `?${queryString}` : ''}`
    );
  }

  async getExpense(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/expenses/${id}`);
  }

  async createExpense(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveExpense(id: string, data: {
    approved: boolean;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/expenses/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  async getNotifications(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  // ============================================================================
  // USERS & PROFILES
  // ============================================================================

  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/users');
  }

  async getUser(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/users/${id}`);
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  // ============================================================================
  // ATTENDANCE (Pontaj)
  // ============================================================================

  async getAttendanceRecords(params?: {
    projectId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/attendance${queryString ? `?${queryString}` : ''}`
    );
  }

  async checkIn(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkOut(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/attendance/${id}/check-out`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // DAILY REPORTS (Rapoarte)
  // ============================================================================

  async getDailyReports(params?: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/daily-reports${queryString ? `?${queryString}` : ''}`
    );
  }

  async createDailyReport(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // MATERIALS & STOCK (Stocuri)
  // ============================================================================

  async getMaterials(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/materials');
  }

  async getStockBalances(params?: {
    projectId?: string;
    materialId?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.materialId) query.set('materialId', params.materialId);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/inventory/stock${queryString ? `?${queryString}` : ''}`
    );
  }

  async getStockMovements(params?: {
    projectId?: string;
    materialId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.materialId) query.set('materialId', params.materialId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/inventory/movements${queryString ? `?${queryString}` : ''}`
    );
  }

  // ============================================================================
  // DELIVERY NOTES (Avize)
  // ============================================================================

  async getAvize(params?: {
    projectId?: string;
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.status) query.set('status', params.status);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/procurement/delivery-notes${queryString ? `?${queryString}` : ''}`
    );
  }

  async getAviz(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/procurement/delivery-notes/${id}`);
  }

  // ============================================================================
  // STATISTICS & DASHBOARD
  // ============================================================================

  async getDashboardStats(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/dashboard/stats');
  }

  async getProjectStats(projectId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${projectId}/stats`);
  }

  // ============================================================================
  // CONTROL TOWER (Management Turn de Control)
  // ============================================================================

  async getControlTowerOverview(projectId?: string): Promise<ApiResponse<ControlTowerOverviewDto>> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<ApiResponse<ControlTowerOverviewDto>>(`/api/control-tower/overview${query}`);
  }

  async getControlTowerDrillDown(params: DrillDownParams): Promise<ApiResponse<DrillDownResult<any>>> {
    const query = new URLSearchParams();
    query.set('category', params.category);
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return this.request<ApiResponse<DrillDownResult<any>>>(
      `/api/control-tower/drilldown?${query.toString()}`
    );
  }

  async getControlTowerRedFlags(
    projectId?: string,
    severity?: string
  ): Promise<ApiResponse<RedFlag[]>> {
    const query = new URLSearchParams();
    if (projectId) query.set('projectId', projectId);
    if (severity) query.set('severity', severity);

    const queryString = query.toString();
    return this.request<ApiResponse<RedFlag[]>>(
      `/api/control-tower/red-flags${queryString ? `?${queryString}` : ''}`
    );
  }
}

// ============================================================================
// CONTROL TOWER INTERFACES (Matching NestJS Backend)
// ============================================================================

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

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export the class for testing
export { ApiClient, ApiError };
