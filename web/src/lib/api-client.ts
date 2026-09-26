/**
 * HIIEKO API Client - Typed HTTP client for NestJS backend
 * 
 * Standardized envelope format (R1.5 Error Envelope):
 * 
 * Success responses: { statusCode: number, data: T }
 * Error responses:   { success: false, statusCode: 401|403|404|422|500,
 *                      code: "UNAUTHORIZED"|"FORBIDDEN"|"NOT_FOUND"|
 *                             "VALIDATION_ERROR"|"INTERNAL_ERROR",
 *                      message: string, details?: ErrorDetail[],
 *                      timestamp: string, path: string, method: string }
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ====================
// ENVELOPE TYPES (R1.5 CONTRACT)
// ====================

/** Field-level detail for 422 VALIDATION_ERROR responses */
export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
}

/** Standardized error envelope from AllExceptionsFilter */
export interface ErrorEnvelope {
  success: false;
  statusCode: number;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  message: string;
  details?: ErrorDetail[];
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Success response envelope from NestJS TransformInterceptor.
 * Actual backend format: { statusCode: number, data: T }
 * The api-client's internal request() method unwraps this; callers see ApiResponse<T>.
 */
export interface SuccessEnvelope<T> {
  statusCode: number;
  data: T;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

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

/**
 * Typed API error that exposes the full standardized error envelope.
 */
export class ApiError extends Error {
  /** Machine-readable error code (UNAUTHORIZED, VALIDATION_ERROR, etc.) */
  public readonly code: string | null;
  /** Field-level validation details (only populated for 422 responses) */
  public readonly details: ErrorDetail[] | null;
  /** Raw ErrorEnvelope for advanced handling */
  public readonly envelope: ErrorEnvelope | null;

  constructor(
    message: string,
    public readonly statusCode: number,
    envelope?: ErrorEnvelope
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = envelope?.code || null;
    this.details = envelope?.details || null;
    this.envelope = envelope || null;

    // Build a combined user-friendly message from validation errors
    if (this.details && this.details.length > 0) {
      const fieldSummary = this.details
        .map(d => d.field ? `${d.field}: ${d.message}` : d.message)
        .join('; ');
      this.message = `${message} — ${fieldSummary}`;
    }
  }

  /** Helper: check if this is a 401 UNAUTHORIZED */
  isUnauthorized(): boolean {
    return this.statusCode === 401 || this.code === 'UNAUTHORIZED';
  }

  /** Helper: check if this is a 403 FORBIDDEN */
  isForbidden(): boolean {
    return this.statusCode === 403 || this.code === 'FORBIDDEN';
  }

  /** Helper: check if this is a 404 NOT_FOUND */
  isNotFound(): boolean {
    return this.statusCode === 404 || this.code === 'NOT_FOUND';
  }

  /** Helper: check if this is a 422 VALIDATION_ERROR */
  isValidationError(): boolean {
    return this.statusCode === 422 || this.code === 'VALIDATION_ERROR';
  }

  /** Helper: check if this is a 500 INTERNAL_ERROR */
  isInternalError(): boolean {
    return this.statusCode >= 500 || this.code === 'INTERNAL_ERROR';
  }

  /** Helper: get the first validation error for a specific field */
  getFieldError(field: string): ErrorDetail | undefined {
    return this.details?.find(d => d.field === field);
  }
}

/**
 * Default implementation: HTTP calls to NestJS backend directly.
 * The IApiClient interface is available for future adapter implementations.
 */
export class NestApiClient {
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
  public async request<T>(
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
      let data: any = {};

      try {
        data = await response.json();
      } catch (e) {
        // Non-JSON error responses (e.g., gateway timeouts, load balancer issues)
      }

      if (!response.ok) {
        // Check if this is a standardized R1.5 ErrorEnvelope
        const isStandardEnvelope =
          data &&
          typeof data === 'object' &&
          data.success === false &&
          typeof data.code === 'string' &&
          typeof data.statusCode === 'number';

        if (isStandardEnvelope) {
          throw new ApiError(data.message || 'Request failed', response.status, data);
        }

        // Legacy / non-standard error response
        throw new ApiError(
          data.message || data.error || `HTTP ${response.status}: Request failed`,
          response.status,
          undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network errors, timeouts, etc.
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        undefined
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

  async getProjectMembers(projectId: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/api/projects/${projectId}/members`);
  }

  async addProjectMember(projectId: string, userId: string, role: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  }

  async updateProjectMemberRole(projectId: string, userId: string, role: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeProjectMember(projectId: string, userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // TEAMS
  // ============================================================================

  async getTeams(projectId?: string): Promise<ApiResponse<any[]>> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<ApiResponse<any[]>>(`/api/teams${query}`);
  }

  async getTeam(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/teams/${id}`);
  }

  async createTeam(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addTeamMember(teamId: string, userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async updateTeam(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTeam(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/teams/${id}`, {
      method: 'DELETE',
    });
  }

  async removeTeamMember(teamId: string, userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // EMPLOYEES / WORKFORCE
  // ============================================================================

  async getEmployees(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/employees');
  }

  async getEmployee(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/employees/${id}`);
  }

  async createEmployee(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmployee(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteEmployee(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/employees/${id}`, {
      method: 'DELETE',
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
    status: 'APPROVED' | 'REJECTED';
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

  async getNotifications(params?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.unreadOnly) query.set('unreadOnly', 'true');

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/notifications${queryString ? `?${queryString}` : ''}`
    );
  }

  async markNotificationRead(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/notifications/read-all', {
      method: 'POST',
    });
  }

  // ============================================================================
  // OCR & DOCUMENT PROCESSING
  // ============================================================================

  async processOcrDocument(
    file: File,
    options?: { documentId?: string; expenseId?: string }
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.documentId) formData.append('documentId', options.documentId);
    if (options?.expenseId) formData.append('expenseId', options.expenseId);

    const url = `${this.baseUrl}/api/ocr/process`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data.message || data.error || 'OCR processing failed', response.status, data);
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error instanceof Error ? error.message : 'Network error', 0);
    }
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

  async updateUserRole(id: string, role: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async updateProfile(data: { fullName?: string; phone?: string; language?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
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

  async checkOut(attendanceRecordId: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({
        attendanceRecordId,
        ...data,
      }),
    });
  }

  async getMyAttendanceLogs(date?: string): Promise<ApiResponse<any>> {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request<ApiResponse<any>>(`/api/attendance/my-logs${q}`);
  }

  async checkInAttendance(data: { projectId: string; latitude: number; longitude: number; idempotencyKey?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkOutAttendance(data: { projectId?: string; latitude: number; longitude: number; notes?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-out', {
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

  async createAviz(data: {
    projectId: string;
    avizNumber: string;
    deliveryDate: string;
    supplierId?: string;
    driverName?: string;
    vehiclePlate?: string;
    notes?: string;
    idempotencyKey?: string;
    items: Array<{ materialId: string; quantity: number }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/procurement/avize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // STATISTICS & DASHBOARD
  // ============================================================================

  // ============================================================================
  // TASKS
  // ============================================================================

  async getTasks(projectId?: string): Promise<ApiResponse<any[]>> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<ApiResponse<any[]>>(`/api/tasks${query}`);
  }

  async getTask(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/tasks/${id}`);
  }

  async createTask(data: {
    projectId: string;
    title: string;
    code: string;
    description?: string;
    workPackageId?: string;
    zoneId?: string;
    plannedStart?: string;
    plannedEnd?: string;
    plannedQuantity?: number;
    unitOfMeasure?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: {
    title?: string;
    code?: string;
    description?: string;
    status?: string;
    plannedStart?: string;
    plannedEnd?: string;
    actualStart?: string;
    actualEnd?: string;
    plannedQuantity?: number;
    actualQuantity?: number;
    unitOfMeasure?: string;
    workPackageId?: string;
    zoneId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // DAILY PLANS
  // ============================================================================

  async getDailyPlans(projectId: string, date?: string): Promise<ApiResponse<any[]>> {
    let query = `?projectId=${encodeURIComponent(projectId)}`;
    if (date) query += `&date=${encodeURIComponent(date)}`;
    return this.request<ApiResponse<any[]>>(`/api/daily-plans${query}`);
  }

  async getDailyPlan(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-plans/${id}`);
  }

  async createDailyPlan(data: {
    projectId: string;
    teamId?: string;
    planDate: string;
    notes?: string;
    tasks: Array<{ taskId: string; targetQuantity: number }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/daily-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async publishDailyPlan(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-plans/${id}/publish`, {
      method: 'POST',
    });
  }

  async completeDailyPlan(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-plans/${id}/complete`, {
      method: 'POST',
    });
  }

  async cancelDailyPlan(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-plans/${id}/cancel`, {
      method: 'POST',
    });
  }

  async updatePlanTaskProgress(planTaskId: string, data: {
    actualQuantity?: number;
    completed?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-plans/tasks/${planTaskId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // TASK DEPENDENCIES
  // ============================================================================

  async getTaskDependencies(taskId: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/api/task-dependencies/${taskId}`);
  }

  async createTaskDependency(data: {
    predecessorTaskId: string;
    successorTaskId: string;
    dependencyType?: string;
    lagDays?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/task-dependencies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTaskDependency(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/task-dependencies/${id}`, {
      method: 'DELETE',
    });
  }

  async checkPrerequisites(taskId: string): Promise<ApiResponse<{ canStart: boolean; pendingTasks: any[] }>> {
    return this.request<ApiResponse<{ canStart: boolean; pendingTasks: any[] }>>(
      `/api/task-dependencies/check-prerequisites/${taskId}`
    );
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
// API CLIENT INTERFACE (R1.4 SEAM)
// ============================================================================
/**
 * Typed interface for API client operations.
 * Implemented by NestApiClient (direct HTTP to the NestJS backend).
 */
export interface IApiClient {
  // Authentication
  setToken(token: string | null): void;
  getToken(): string | null;
  isAuthenticated(): boolean;
  login(credentials: LoginCredentials): Promise<ApiResponse<{ user: AuthUser } & AuthTokens>>;
  logout(): void;
  getMe(): Promise<ApiResponse<AuthUser>>;
  register(data: RegisterData): Promise<ApiResponse<{ user: AuthUser }>>;

  // Users & Profiles
  getUsers(): Promise<ApiResponse<any[]>>;
  getUser(id: string): Promise<ApiResponse<any>>;
  updateUserStatus(id: string, isActive: boolean): Promise<ApiResponse<any>>;
  updateUserRole(id: string, role: string): Promise<ApiResponse<any>>;
  updateProfile(data: { fullName?: string; phone?: string; language?: string }): Promise<ApiResponse<any>>;

  // Projects
  getProjects(): Promise<ApiResponse<any[]>>;
  getProject(id: string): Promise<ApiResponse<any>>;
  getProjectMembers(projectId: string): Promise<ApiResponse<any[]>>;
  addProjectMember(projectId: string, userId: string, role: string): Promise<ApiResponse<any>>;
  updateProjectMemberRole(projectId: string, userId: string, role: string): Promise<ApiResponse<any>>;
  removeProjectMember(projectId: string, userId: string): Promise<ApiResponse<any>>;

  // Teams
  getTeams(projectId?: string): Promise<ApiResponse<any[]>>;
  getTeam(id: string): Promise<ApiResponse<any>>;
  createTeam(data: any): Promise<ApiResponse<any>>;
  addTeamMember(teamId: string, userId: string): Promise<ApiResponse<any>>;
  updateTeam(id: string, data: any): Promise<ApiResponse<any>>;
  deleteTeam(id: string): Promise<ApiResponse<any>>;
  removeTeamMember(teamId: string, userId: string): Promise<ApiResponse<any>>;

  // Employees / Workforce
  getEmployees(): Promise<ApiResponse<any[]>>;
  getEmployee(id: string): Promise<ApiResponse<any>>;
  createEmployee(data: any): Promise<ApiResponse<any>>;
  updateEmployee(id: string, data: any): Promise<ApiResponse<any>>;
  deleteEmployee(id: string): Promise<ApiResponse<any>>;

  // Attendance (Pontaj)
  getAttendanceRecords(params?: {
    projectId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>>;
  checkIn(data: any): Promise<ApiResponse<any>>;
  checkOut(id: string, data: any): Promise<ApiResponse<any>>;
  getMyAttendanceLogs(date?: string): Promise<ApiResponse<any>>;
  checkInAttendance(data: { projectId: string; latitude: number; longitude: number; idempotencyKey?: string }): Promise<ApiResponse<any>>;
  checkOutAttendance(data: { projectId?: string; latitude: number; longitude: number; notes?: string }): Promise<ApiResponse<any>>;

  // Daily Reports (Rapoarte)
  getDailyReports(params?: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>>;
  createDailyReport(data: any): Promise<ApiResponse<any>>;

  // Materials & Stock (Stocuri)
  getMaterials(): Promise<ApiResponse<any[]>>;
  getStockBalances(params?: {
    projectId?: string;
    materialId?: string;
  }): Promise<ApiResponse<any[]>>;
  getStockMovements(params?: {
    projectId?: string;
    materialId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>>;

  // Delivery Notes (Avize)
  getAvize(params?: {
    projectId?: string;
    status?: string;
  }): Promise<ApiResponse<any[]>>;
  getAviz(id: string): Promise<ApiResponse<any>>;
  createAviz(data: {
    projectId: string;
    avizNumber: string;
    deliveryDate: string;
    supplierId?: string;
    driverName?: string;
    vehiclePlate?: string;
    notes?: string;
    idempotencyKey?: string;
    items: Array<{ materialId: string; quantity: number }>;
  }): Promise<ApiResponse<any>>;

  // Notifications
  getNotifications(params?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }): Promise<ApiResponse<any[]>>;
  markNotificationRead(id: string): Promise<ApiResponse<any>>;
  markAllNotificationsRead(): Promise<ApiResponse<any>>;

  // Expenses (Cheltuieli)
  getExpenses(params?: { status?: string }): Promise<ApiResponse<any[]>>;
  getExpense(id: string): Promise<ApiResponse<any>>;
  createExpense(data: any): Promise<ApiResponse<any>>;
  approveExpense(id: string, data: {
    status: 'APPROVED' | 'REJECTED';
    notes?: string;
  }): Promise<ApiResponse<any>>;

  // Control Tower
  getControlTowerOverview(projectId?: string): Promise<ApiResponse<ControlTowerOverviewDto>>;
  getControlTowerDrillDown(params: DrillDownParams): Promise<ApiResponse<DrillDownResult<any>>>;
  getControlTowerRedFlags(
    projectId?: string,
    severity?: string
  ): Promise<ApiResponse<RedFlag[]>>;

  // Tasks
  getTasks(projectId?: string): Promise<ApiResponse<any[]>>;
  getTask(id: string): Promise<ApiResponse<any>>;
  createTask(data: {
    projectId: string;
    title: string;
    code: string;
    description?: string;
    workPackageId?: string;
    zoneId?: string;
    plannedStart?: string;
    plannedEnd?: string;
    plannedQuantity?: number;
    unitOfMeasure?: string;
  }): Promise<ApiResponse<any>>;
  updateTask(id: string, data: {
    title?: string;
    code?: string;
    description?: string;
    status?: string;
    plannedStart?: string;
    plannedEnd?: string;
    actualStart?: string;
    actualEnd?: string;
    plannedQuantity?: number;
    actualQuantity?: number;
    unitOfMeasure?: string;
    workPackageId?: string;
    zoneId?: string;
  }): Promise<ApiResponse<any>>;
  deleteTask(id: string): Promise<ApiResponse<any>>;

  // Daily Plans
  getDailyPlans(projectId: string, date?: string): Promise<ApiResponse<any[]>>;
  getDailyPlan(id: string): Promise<ApiResponse<any>>;
  createDailyPlan(data: {
    projectId: string;
    teamId?: string;
    planDate: string;
    notes?: string;
    tasks: Array<{ taskId: string; targetQuantity: number }>;
  }): Promise<ApiResponse<any>>;
  publishDailyPlan(id: string): Promise<ApiResponse<any>>;
  completeDailyPlan(id: string): Promise<ApiResponse<any>>;
  cancelDailyPlan(id: string): Promise<ApiResponse<any>>;
  updatePlanTaskProgress(planTaskId: string, data: {
    actualQuantity?: number;
    completed?: boolean;
  }): Promise<ApiResponse<any>>;

  // Task Dependencies
  getTaskDependencies(taskId: string): Promise<ApiResponse<any[]>>;
  createTaskDependency(data: {
    predecessorTaskId: string;
    successorTaskId: string;
    dependencyType?: string;
    lagDays?: number;
  }): Promise<ApiResponse<any>>;
  deleteTaskDependency(id: string): Promise<ApiResponse<any>>;
  checkPrerequisites(taskId: string): Promise<ApiResponse<{ canStart: boolean; pendingTasks: any[] }>>;

  // OCR
  processOcrDocument(
    file: File,
    options?: { documentId?: string; expenseId?: string }
  ): Promise<ApiResponse<any>>;

  // File Upload
  uploadFile(
    file: { uri?: string; type: string; name: string },
    entityType: string,
    entityId: string
  ): Promise<ApiResponse<{ url: string }>>;
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

// Export singleton instance (using NestApiClient as default)
export const apiClient = new NestApiClient(API_BASE_URL);

// Also export ApiClient as deprecated alias for backwards compatibility
/** @deprecated Use NestApiClient or IApiClient instead */
export { NestApiClient as ApiClient };
