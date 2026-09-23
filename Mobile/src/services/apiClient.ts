/**
 * API Client for HIIEKO Mobile (R1.5 Error Envelope Compliant)
 * 
 * Standardized envelope format:
 * - Success: { success: true, data: T }
 * - Error:   { success: false, statusCode: 401|403|404|422|500,
 *              code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" |
 *                    "VALIDATION_ERROR" | "INTERNAL_ERROR",
 *              message: string, details?: ErrorDetail[], ... }
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// ====================
// R1.5 ENVELOPE TYPES
// ====================

export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
}

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

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

/** Result of a successful /api/upload upload (ISSUE-014). */
export interface UploadFileResult {
  url: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  checksum: string;
}

export class ApiError extends Error {
  public readonly code: string | null;
  public readonly details: ErrorDetail[] | null;
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

    // Build combined message from validation errors
    if (this.details && this.details.length > 0) {
      const fieldSummary = this.details
        .map(d => d.field ? `${d.field}: ${d.message}` : d.message)
        .join('; ');
      this.message = `${message} — ${fieldSummary}`;
    }
  }

  isUnauthorized(): boolean { return this.statusCode === 401 || this.code === 'UNAUTHORIZED'; }
  isForbidden(): boolean { return this.statusCode === 403 || this.code === 'FORBIDDEN'; }
  isNotFound(): boolean { return this.statusCode === 404 || this.code === 'NOT_FOUND'; }
  isValidationError(): boolean { return this.statusCode === 422 || this.code === 'VALIDATION_ERROR'; }
  isInternalError(): boolean { return this.statusCode >= 500 || this.code === 'INTERNAL_ERROR'; }
  getFieldError(field: string): ErrorDetail | undefined { return this.details?.find(d => d.field === field); }
}

// ============================================================================
// MOBILE API CLIENT INTERFACE (R1.4 SEAM)
// ============================================================================
/**
 * Typed interface for Mobile API client operations.
 * Used for:
 * - NestMobileApiClient (default: direct HTTP to NestJS backend)
 * - SupabaseMobileApiClient (for dual-write/behavior-preserving migration)
 */
export interface IMobileApiClient {
  // Authentication
  setToken(token: string | null): void;
  getToken(): string | null;
  login(credentials: { email: string; password: string }): Promise<ApiResponse<{
    user: any;
    accessToken: string;
  }>>;
  getMe(): Promise<ApiResponse<any>>;

  // Projects
  getProjects(): Promise<ApiResponse<any[]>>;
  getProject(id: string): Promise<ApiResponse<any>>;

  // Attendance
  checkIn(data: {
    projectId: string;
    latitude: number;
    longitude: number;
    notes?: string;
  }): Promise<ApiResponse<any>>;
  checkOut(attendanceId: string, data: {
    latitude: number;
    longitude: number;
    notes?: string;
  }): Promise<ApiResponse<any>>;

  // Daily Reports
  createDailyReport(data: {
    projectId: string;
    reportDate: string;
    weather?: string;
    numberOfWorkers?: number;
    workPerformed?: string;
    materialsUsed?: string;
    incidents?: string;
    idempotencyKey?: string;
  }, idempotencyKey: string): Promise<ApiResponse<any>>;

  // Expenses
  createExpense(data: {
    projectId: string;
    amount: number;
    category: string;
    description?: string;
    receiptPhotoUrl?: string;
    idempotencyKey?: string;
  }, idempotencyKey: string): Promise<ApiResponse<any>>;
  getExpenses(params?: { status?: string }): Promise<ApiResponse<any[]>>;

  // Avize / Delivery Notes
  getAvize(params?: { projectId?: string }): Promise<ApiResponse<any[]>>;
  createAviz(data: {
    projectId: string;
    avizNumber: string;
    deliveryDate: string;
    supplierId?: string;
    supplierName?: string;
    notes?: string;
    idempotencyKey?: string;
    items: Array<{ materialId: string; quantity: number }>;
  }, idempotencyKey: string): Promise<ApiResponse<any>>;

  // Notifications
  getNotifications(): Promise<ApiResponse<any[]>>;
  markNotificationRead(id: string): Promise<ApiResponse<any>>;
  markAllNotificationsRead(): Promise<ApiResponse<any>>;

  // OCR & Document Recognition
  processOcr(
    file: { uri?: string; base64?: string; type: string; name: string },
    options?: { documentId?: string; expenseId?: string }
  ): Promise<ApiResponse<{ job: any; result: any }>>;
  createOcrJob(data: {
    documentId?: string;
    expenseId?: string;
    provider?: string;
    correlationId?: string;
    rawPayload?: Record<string, unknown>;
  }): Promise<ApiResponse<any>>;

  // File Upload
  uploadFile(
    file: { uri: string; type: string; name: string },
    entityType: string,
    entityId: string,
    metadata?: { documentType?: string; title?: string }
  ): Promise<ApiResponse<UploadFileResult>>;
}

/**
 * Default implementation: HTTP calls to NestJS backend directly.
 * The IMobileApiClient interface is available for future adapter implementations.
 */
export class NestMobileApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
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
        // Non-JSON responses (gateway timeouts, etc.)
      }

      if (!response.ok) {
        // Check for standardized R1.5 ErrorEnvelope
        const isEnvelope =
          data &&
          typeof data === 'object' &&
          data.success === false &&
          typeof data.code === 'string' &&
          typeof data.statusCode === 'number';

        if (isEnvelope) {
          throw new ApiError(data.message || 'Request failed', response.status, data);
        }

        // Legacy response
        throw new ApiError(
          data.message || data.error || `HTTP ${response.status}`,
          response.status,
          undefined
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
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

  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{
    user: any;
    accessToken: string;
  }>> {
    const response = await this.request<ApiResponse<{ user: any; accessToken: string }>>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );
    
    if (response.data.accessToken) {
      this.setToken(response.data.accessToken);
    }
    
    return response;
  }

  async getMe(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/auth/me');
  }

  // ============================================================================
  // PROJECTS
  // ============================================================================

  async getProjects(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/projects');
  }

  async getProject(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/projects/${id}`);
  }


  // ============================================================================
  // ATTENDANCE
  // ============================================================================

  async checkIn(data: {
    projectId: string;
    latitude: number;
    longitude: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': `checkin_${data.projectId}_${Date.now()}`,
      },
    });
  }

  async checkOut(attendanceId: string, data: {
    latitude: number;
    longitude: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({
        attendanceRecordId: attendanceId,
        ...data,
      }),
      headers: {
        'Idempotency-Key': `checkout_${attendanceId}_${Date.now()}`,
      },
    });
  }

  async getAttendanceRecords(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/attendance${queryString ? `?${queryString}` : ''}`
    );
  }

  // ============================================================================
  // DAILY REPORTS
  // ============================================================================

  async createDailyReport(data: any, idempotencyKey: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }

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

  // ============================================================================
  // MATERIALS & INVENTORY
  // ============================================================================

  async getMaterials(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/materials');
  }

  async recordMaterialConsumption(data: any, idempotencyKey: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/inventory/consume', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }

  // ============================================================================
  // EXPENSES
  // ============================================================================

  async createExpense(data: any, idempotencyKey: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }

  async getExpenses(params?: {
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/expenses${queryString ? `?${queryString}` : ''}`
    );
  }

  // ============================================================================
  // PROCUREMENT / AVIZE (Delivery Notes)
  // ============================================================================

  async getAvize(params?: {
    projectId?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);

    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/procurement/avize${queryString ? `?${queryString}` : ''}`
    );
  }

  async createAviz(data: {
    projectId: string;
    avizNumber: string;
    deliveryDate: string;
    supplierId?: string;
    supplierName?: string;
    notes?: string;
    idempotencyKey?: string;
    items: Array<{ materialId: string; quantity: number }>;
  }, idempotencyKey: string): Promise<ApiResponse<any>> {
    const payload: any = {
      projectId: data.projectId,
      avizNumber: data.avizNumber,
      deliveryDate: data.deliveryDate,
      items: data.items,
      idempotencyKey,
    };
    if (data.supplierId) payload.supplierId = data.supplierId;
    if (data.supplierName) payload.supplierName = data.supplierName;
    if (data.notes || data.supplierName) {
      payload.notes = [data.notes, data.supplierName ? `Furnizor: ${data.supplierName}` : null]
        .filter(Boolean).join(' | ');
    }

    return this.request<ApiResponse<any>>('/api/procurement/avize', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
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
    return this.request<ApiResponse<any>>('/api/notifications/read-all', {
      method: 'POST',
    });
  }

  // ============================================================================
  // OCR & DOCUMENT RECOGNITION (NestJS -> self-hosted PaddleOCR)
  // ============================================================================

  /**
   * Uploads a captured receipt/invoice image to the central API for OCR.
   * The provider credential stays server-side; the app only sends the image.
   * React Native accepts either a local file URI or a base64 data URI.
   */
  async processOcr(
    file: { uri?: string; base64?: string; type: string; name: string },
    options?: { documentId?: string; expenseId?: string }
  ): Promise<ApiResponse<{ job: any; result: any }>> {
    const formData = new FormData();
    const uri = file.uri || (file.base64 ? `data:${file.type};base64,${file.base64}` : '');

    formData.append('file', { uri, name: file.name, type: file.type } as any);
    if (options?.documentId) formData.append('documentId', options.documentId);
    if (options?.expenseId) formData.append('expenseId', options.expenseId);

    return this.request<ApiResponse<{ job: any; result: any }>>('/api/ocr/process', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Persists an OCR job linked to an expense/document WITHOUT re-running the
   * provider. Used by the receipt scan flow to attach an already-extracted
   * result to the submitted expense.
   */
  async createOcrJob(data: {
    documentId?: string;
    expenseId?: string;
    provider?: string;
    correlationId?: string;
    rawPayload?: Record<string, unknown>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/ocr/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }



  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  async uploadFile(
    file: { uri: string; type: string; name: string },
    entityType: string,
    entityId: string,
    metadata?: { documentType?: string; title?: string }
  ): Promise<ApiResponse<UploadFileResult>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (metadata?.documentType) formData.append('documentType', metadata.documentType);
    if (metadata?.title) formData.append('title', metadata.title);

    return this.request<ApiResponse<UploadFileResult>>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

// Export singleton instance (using NestMobileApiClient as default)
export const apiClient = new NestMobileApiClient();

// Export deprecated MobileApiClient alias for backwards compatibility
/** @deprecated Use NestMobileApiClient or IMobileApiClient instead */
export { NestMobileApiClient as MobileApiClient };

