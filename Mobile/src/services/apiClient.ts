/**
 * API Client for HIIEKO Mobile
 * 
 * Communicates with NestJS backend.
 * Handles authentication, token management, and all API requests.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class MobileApiClient {
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
    return this.request<ApiResponse<any>>(`/api/attendance/${attendanceId}/check-out`, {
      method: 'POST',
      body: JSON.stringify(data),
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
    };
    if (data.supplierId) payload.supplierId = data.supplierId;
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

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  async uploadFile(file: {
    uri: string;
    type: string;
    name: string;
  }, entityType: string, entityId: string): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);

    return this.request<ApiResponse<{ url: string }>>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

// Export singleton instance
export const apiClient = new MobileApiClient();

