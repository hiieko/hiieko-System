/**
 * HIIEKO API Client — Typed HTTP client for NestJS backend
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                       IApiClient interface                      │
 * │  (full method contracts for all backend endpoints)              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                      NestApiClient class                        │
 * │  (generic request<T> with interceptors, token mgmt, logging)    │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                 Per-domain API modules (lib/api/)               │
 * │  projectsApi, attendanceApi, tasksApi, etc. (typed, composable) │
 * ├─────────────────────────────────────────────────────────────────┤
 * │              apiClient singleton (backward compat)              │
 * └─────────────────────────────────────────────────────────────────┘
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

import type { Issue, CreateIssueDto } from '../features/issues/types';

/**
 * Resolve the backend base URL for the current runtime.
 *
 * `NEXT_PUBLIC_API_URL` is inlined into the browser bundle at build/dev time, so
 * a value baked as `http://localhost:4000` literally means "port 4000 on the
 * device that runs the browser". That is right on this laptop (and on the
 * server side), but wrong on a tablet or phone that opens the dev server over
 * the LAN: there `localhost` is the tablet itself, so the UI renders while every
 * API call fails with "Failed to fetch".
 *
 * Rules:
 * 1. Server-side render (no `window`)          → the configured value as-is.
 * 2. Page opened on a loopback host            → the configured value as-is
 *    (local development unchanged).
 * 3. Page opened from another host (LAN IP)    → if the configured value points
 *    at loopback, reuse its port on the hostname that served the page; an
 *    explicitly remote configured value (a real deployed API host) is always
 *    respected.
 */
export function resolveApiBaseUrl(
  configuredUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL,
  pageLocation?: { protocol: string; hostname: string }
): string {
  const DEFAULT_API_PORT = '4000';
  const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', '::1', ''];
  const fallback = `http://localhost:${DEFAULT_API_PORT}`;

  const page =
    pageLocation ?? (typeof window !== 'undefined' ? window.location : undefined);

  if (!page) return configuredUrl || fallback;
  if (LOOPBACK_HOSTNAMES.includes(page.hostname)) return configuredUrl || fallback;
  if (!configuredUrl) return `${page.protocol}//${page.hostname}:${DEFAULT_API_PORT}`;

  let apiHostname = '';
  let apiPort = DEFAULT_API_PORT;
  try {
    const parsed = new URL(configuredUrl);
    apiHostname = parsed.hostname;
    apiPort = parsed.port || DEFAULT_API_PORT;
  } catch {
    // Relative / same-origin configuration (e.g. behind a reverse proxy).
    return configuredUrl;
  }

  if (!LOOPBACK_HOSTNAMES.includes(apiHostname)) return configuredUrl;
  return `${page.protocol}//${page.hostname}:${apiPort}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

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
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    // Rate limiting (429). Already part of the shared envelope contract in
    // `shared/src/error-envelope.ts`; the local union is aligned with it here.
    | 'TOO_MANY_REQUESTS'
    | 'INTERNAL_ERROR';
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

  /**
   * Single-flight guard for the Slice 2 refresh cycle.
   *
   * When several requests fail with 401 at the same moment they all await THIS promise,
   * so exactly one `POST /api/auth/refresh` is issued and every caller retries with the
   * same rotated access token. Prevents a refresh storm (and, because the server rotates
   * on every use, prevents a self-inflicted reuse-detection logout).
   */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Endpoints that must never trigger the 401 → refresh → retry cycle:
   * refreshing off a failed refresh would recurse forever, and a 401 from
   * login/register/logout means "credentials wrong" / "nothing to refresh", not
   * "the access token expired".
   */
  private static readonly REFRESH_EXEMPT_ENDPOINTS = [
    '/api/auth/refresh',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
  ];

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
   *
   * Slice 2: on a 401 the request transparently performs ONE refresh + retry cycle
   * (see `refreshSession`). `allowRefresh` is flipped to `false` for that single retry,
   * which is what guarantees a request can never loop.
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true
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

        const apiError = isStandardEnvelope
          ? new ApiError(data.message || 'Request failed', response.status, data)
          : // Legacy / non-standard error response
            new ApiError(
              data.message || data.error || `HTTP ${response.status}: Request failed`,
              response.status,
              undefined
            );

        // Slice 2 (K-4): a short-lived access token expires mid-session. Instead of
        // surfacing a 401 (which would sign the user out), refresh once and retry.
        if (
          response.status === 401 &&
          allowRefresh &&
          !this.isRefreshExempt(endpoint)
        ) {
          const refreshed = await this.refreshSession();
          if (refreshed) {
            return this.request<T>(endpoint, options, false);
          }
          // Refresh impossible: local auth state is cleared, the 401 is surfaced.
          this.setToken(null);
        }

        throw apiError;
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

  /**
   * Slice 2 — true for the endpoints that must not start a refresh cycle.
   */
  private isRefreshExempt(endpoint: string): boolean {
    return NestApiClient.REFRESH_EXEMPT_ENDPOINTS.some((exempt) =>
      endpoint.startsWith(exempt)
    );
  }

  /**
   * Slice 2 — single-flight refresh. Concurrent 401s share one refresh call.
   */
  private refreshSession(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /**
   * Slice 2 — exchanges the httpOnly `hiieko_rt` cookie for a new access token.
   *
   * Deliberately does NOT go through `request()`: the refresh endpoint must never be
   * able to trigger another refresh (that would recurse). A failure clears local auth
   * state so the UI falls back to the login screen.
   */
  private async performRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.setToken(null);
        return false;
      }

      const payload: any = await response.json().catch(() => null);
      const accessToken = payload?.data?.accessToken ?? payload?.accessToken;

      if (!accessToken) {
        this.setToken(null);
        return false;
      }

      this.setToken(accessToken);
      return true;
    } catch {
      // Network failure: keep the existing token so a transient outage is not a logout.
      return false;
    }
  }

  // ============================================================================
  // TYPED GENERIC HELPERS (Interceptors + Convenience Methods)
  // ============================================================================

  /** Generic GET request with typed response */
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url = `${url}?${qs}`;
    }
    return this.request<ApiResponse<T>>(url);
  }

  /** Generic POST request with typed response */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** Generic PATCH request with typed response */
  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** Generic PUT request with typed response */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** Generic DELETE request with typed response */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint, { method: 'DELETE' });
  }

  /** Generic paginated GET request */
  async getPaginated<T>(
    endpoint: string,
    params?: { page?: number; pageSize?: number; [key: string]: string | number | boolean | undefined }
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    return this.get<PaginatedResponse<T>>(endpoint, params as Record<string, string | number | boolean | undefined>);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: AuthUser } & AuthTokens>> {
    const response = await this.request<ApiResponse<{ user: AuthUser; accessToken: string }>>(
      '/api/auth/login',
      {
        method: 'POST',
        // Slice 2 (L2): `client: 'web'` opts into the 15-minute access token + httpOnly
        // refresh cookie. `credentials: 'include'` is required for that cookie to be
        // accepted (and stored) by the browser.
        body: JSON.stringify({ ...credentials, client: 'web' }),
        credentials: 'include',
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

  /**
   * Slice 2 (L7) — revokes the session server-side (the refresh cookie is cleared by the
   * backend) and always clears the local token, even if the call fails: logging out must
   * never leave the user stuck in a half-authenticated state.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: this.token
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }
          : { 'Content-Type': 'application/json' },
      });
    } catch {
      // Best-effort: the local session is cleared regardless.
    } finally {
      this.setToken(null);
    }
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
  // DOCUMENTS
  // ============================================================================

  async getDocuments(projectId?: string): Promise<ApiResponse<any[]>> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request<ApiResponse<any[]>>(`/api/documents${query}`);
  }

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

  async uploadDocument(
    file: File,
    options: { projectId: string; documentType?: string; title?: string },
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.documentType) formData.append('documentType', options.documentType);
    if (options.title) formData.append('title', options.title);

    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const response = await fetch(`${this.baseUrl}/api/upload?projectId=${encodeURIComponent(options.projectId)}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data.message || data.error || 'Document upload failed', response.status, data);
    }
    return data;
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

  /**
   * POST /api/daily-reports.
   *
   * P4.4 — when the caller passes an `idempotencyKey` it travels as the `Idempotency-Key` HEADER,
   * the same channel Mobile's offline queue uses (Mobile/src/services/apiClient.ts). The backend
   * maps that header onto its existing `idempotency_key` field, so a retried submission (offline
   * replay, double click, network retry) resolves to the very same report instead of creating a
   * second one — and, because a status-SUBMITTED create is also what finalizes the report,
   * instead of consuming the reported project stock twice.
   */
  async createDailyReport(data: any, idempotencyKey?: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify(data),
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
  }

  async getDailyReport(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-reports/${id}`);
  }

  async updateDailyReport(id: string, data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * POST /api/daily-reports/:id/submit — P4.4 finalization of a DRAFT report.
   *
   * The backend decides the DRAFT → SUBMITTED transition under a `FOR UPDATE` lock, writes the
   * immutable revision, consumes the reported project stock and audits — all in one transaction.
   * No `Idempotency-Key` is needed here: the call is idempotent by STATE (a replay of an already
   * SUBMITTED report returns its existing revision and consumes nothing), which also protects
   * against a duplicated request at the network layer.
   */
  async submitDailyReport(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/api/daily-reports/${id}/submit`, {
      method: 'POST',
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
  // INVENTORY MUTATIONS (Receive / Consume / Transfer)
  // ============================================================================

  async receiveStock(data: {
    projectId?: string;
    warehouseId?: string;
    materialId: string;
    quantity: number;
    unitPrice?: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/inventory/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async consumeStock(data: {
    projectId: string;
    materialId: string;
    quantity: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/inventory/consume', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transferStock(data: {
    sourceProjectId: string;
    targetProjectId: string;
    materialId: string;
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  async getPurchaseOrders(params?: {
    projectId?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/procurement/purchase-orders${queryString ? `?${queryString}` : ''}`
    );
  }

  // ============================================================================
  // QA/QC INSPECTIONS
  // ============================================================================

  async getInspections(params?: {
    projectId?: string;
  }): Promise<ApiResponse<any[]>> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    const queryString = query.toString();
    return this.request<ApiResponse<any[]>>(
      `/api/qa-qc/inspections${queryString ? `?${queryString}` : ''}`
    );
  }

  /** Mirrors the real CreateInspectionDto (backend/src/modules/qa-qc/qa-qc.service.ts):
   *  { projectId, templateId?, inspectorName, measurements? }. The previous
   *  title/description/inspectionType/result shape never existed on the backend —
   *  the server creates status='COMPLETED' and stamps inspected_at itself. */
  async createInspection(data: {
    projectId: string;
    templateId?: string;
    inspectorName: string;
    measurements?: Array<{
      parameter: string;
      value: number;
      unit: string;
      passed?: boolean;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/qa-qc/inspections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // SUPPLIERS (org-scoped; used by receipt/avize creation)
  // ============================================================================

  /** List suppliers for the authenticated organization — GET /api/suppliers (any authenticated role). */
  async getSuppliers(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/suppliers');
  }

  /** Create a supplier — POST /api/suppliers (@Roles ADMIN/PROCUREMENT/MANAGER + OWNER bypass). */
  async createSupplier(data: {
    name: string;
    cui?: string;
    address?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // WAREHOUSES (org-scoped master data)
  // ============================================================================

  /** List warehouses for the authenticated organization — GET /api/warehouses. */
  async getWarehouses(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/api/warehouses');
  }

  /** Create a warehouse — POST /api/warehouses (@Roles ADMIN/OWNER/PROCUREMENT). */
  async createWarehouse(data: {
    name: string;
    code: string;
    address?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
  // ISSUES & BLOCKERS
  // ============================================================================

  async getIssues(params?: {
    projectId?: string;
  }): Promise<ApiResponse<Issue[]>> {
    const query = params?.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : '';
    return this.request<ApiResponse<Issue[]>>(`/api/issues${query}`);
  }

  async createIssue(data: CreateIssueDto): Promise<ApiResponse<Issue>> {
    return this.request<ApiResponse<Issue>>('/api/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
  async downloadDocument(documentId: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(`${this.baseUrl}/api/upload/${encodeURIComponent(documentId)}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      let message = 'Document download failed';
      try {
        const data = await response.json();
        message = data.message || data.error || message;
      } catch {
        // Binary/error response was not JSON.
      }
      throw new ApiError(message, response.status);
    }
    return response.blob();
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
  createDailyReport(data: any, idempotencyKey?: string): Promise<ApiResponse<any>>;
  getDailyReport(id: string): Promise<ApiResponse<any>>;
  updateDailyReport(id: string, data: any): Promise<ApiResponse<any>>;
  submitDailyReport(id: string): Promise<ApiResponse<any>>;

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

  // Inventory Mutations
  receiveStock(data: {
    projectId?: string;
    warehouseId?: string;
    materialId: string;
    quantity: number;
    unitPrice?: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>>;
  consumeStock(data: {
    projectId: string;
    materialId: string;
    quantity: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<ApiResponse<any>>;
  transferStock(data: {
    sourceProjectId: string;
    targetProjectId: string;
    materialId: string;
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<any>>;

  // Purchase Orders
  getPurchaseOrders(params?: {
    projectId?: string;
  }): Promise<ApiResponse<any[]>>;

  // QA/QC Inspections
  getInspections(params?: {
    projectId?: string;
  }): Promise<ApiResponse<any[]>>;
  createInspection(data: {
    projectId: string;
    title: string;
    description?: string;
    inspectionType?: string;
    result?: string;
    performedById?: string;
  }): Promise<ApiResponse<any>>;

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

  // Issues & Blockers
  getIssues(params?: { projectId?: string }): Promise<ApiResponse<Issue[]>>;
  createIssue(data: CreateIssueDto): Promise<ApiResponse<Issue>>;

  // OCR
  processOcrDocument(
    file: File,
    options?: { documentId?: string; expenseId?: string }
  ): Promise<ApiResponse<any>>;

  // Documents
  getDocuments(projectId?: string): Promise<ApiResponse<any[]>>;
  uploadDocument(
    file: File,
    options: { projectId: string; documentType?: string; title?: string },
  ): Promise<ApiResponse<any>>;
  downloadDocument(documentId: string): Promise<Blob>;

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
