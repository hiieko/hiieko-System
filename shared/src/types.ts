// ============================================================================
// Solar Site Management System — Shared Domain Types
// Conforms to HIIEKO ROMANIA Product Spec
// ============================================================================

// HIIEKO Role Model (aligned with database UserRoleEnum)
export type UserRole = 
  | 'admin'              // Administrator - Full system access
  | 'owner'              // Owner - Organization ownership
  | 'manager'            // Manager - Project oversight, financial approval
  | 'pm'                 // Project Manager - Schedule, budget, risk, variation
  | 'site_manager'       // Site Manager - Daily execution, work planning, approval authority
  | 'team_leader'        // Team Leader - Team supervision (legacy alias for foreman)
  | 'foreman'            // Foreman - Daily workforce execution, task assignment
  | 'technician'         // Technician - Technical execution
  | 'procurement'        // Procurement - Sourcing, quotations, purchase orders
  | 'finance'            // Finance - Financial approval, reimbursement
  | 'qa_qc'              // QA/QC - Quality assurance, inspections
  | 'worker'             // Worker - Task completion
  | 'viewer'             // Viewer - Read-only access
  | 'site_logistics'     // Site Logistics - Attendance, receipts, stock, tools
  | 'maintenance_director'  // Maintenance Director - Portfolio maintenance oversight
  | 'technical_director';     // Technical Director - Technical governance

export type AttendanceStatus = 
  | 'present'       // Prezent
  | 'late'          // Intarziat
  | 'early_leave'   // Plecare timpurie
  | 'absent'        // Absent nemotivat
  | 'sick_leave'    // Concediu medical
  | 'vacation';     // Concediu de odihna

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
  assigned_project_ids?: string[];
  team_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Project (authoritative entity — R2.1) ────────────────────────────────
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  installed_capacity_mwp?: number;
  status: string;
  start_date?: string;
  target_end_date?: string;
  budget_total?: number;
  currency?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  assigned_at: string;
}

export interface Team {
  id: string;
  name: string;
  project_id?: string;
  team_leader_id: string;
  member_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  user_id: string;
  project_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // ISO 8601
  check_out?: string | null; // ISO 8601
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_distance_meters?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  status: AttendanceStatus;
  normal_hours_worked: number;
  overtime_minutes: number;
  rest_minutes: number;
  notes?: string;
  is_offline_created?: boolean;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAttendanceSummary {
  user_id: string;
  user_name: string;
  month: string; // YYYY-MM
  total_days_present: number;
  total_normal_hours: number;
  total_overtime_hours: number;
  total_sick_days: number;
  total_absent_days: number;
  daily_entries: { [day: number]: { status: AttendanceStatus; hours: number; overtime: number } };
}

export interface Material {
  id: string;
  code: string;
  name: string;
  unit: 'buc' | 'm' | 'kg' | 'role' | 'set' | 'l';
  barcode?: string;
  category?: string;
  description?: string;
  supplier?: string;
  unit_cost?: number;
  min_stock_threshold?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryNoteItem {
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  quantity: number;
  unit_price?: number;
}

export interface DeliveryNote {
  id: string;
  invoice_or_aviz_number: string;
  supplier: string;
  project_id: string;
  receiver_user_id: string;
  delivery_date: string;
  photo_url?: string;
  items: DeliveryNoteItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReportTask {
  description: string;
  quantity: number;
  unit: string;
}

export interface DailyReportMaterialUsage {
  material_id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
}

export interface DailyReport {
  id: string;
  project_id: string;
  team_id?: string;
  team_leader_id: string;
  report_date: string; // YYYY-MM-DD
  present_worker_ids: string[];
  tasks: DailyReportTask[];
  materials_used: DailyReportMaterialUsage[];
  photos: string[];
  notes?: string;
  status: ReportStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  is_offline_created?: boolean;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Daily Work Planning (GAP-02)
// ============================================================================

export type DailyPlanStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

export interface DailyPlanTask {
  id: string;
  daily_plan_id: string;
  task_id: string;
  task?: {
    id: string;
    title: string;
    code: string;
    status: string;
    unit_of_measure?: string;
    planned_quantity?: number;
  };
  target_quantity: number;
  actual_quantity?: number;
  completed: boolean;
}

export interface DailyPlan {
  id: string;
  project_id: string;
  team_id?: string;
  team?: {
    id: string;
    name: string;
    description?: string;
  };
  plan_date: string; // YYYY-MM-DD
  status: DailyPlanStatus;
  notes?: string;
  created_by?: string;
  creator?: {
    id: string;
    email: string;
    profile?: { full_name?: string; first_name?: string; last_name?: string };
  };
  tasks: DailyPlanTask[];
  created_at: string;
  updated_at: string;
}

export type StockMovementType =
  | 'delivery'      // Receptie aviz (+)
  | 'daily_usage'   // Consum raport zilnic (-)
  | 'transfer_in'   // Transfer intrat (+)
  | 'transfer_out'  // Transfer iesit (-)
  | 'adjustment';   // Ajustare inventar (+/-)

export interface ProjectStock {
  project_id: string;
  material_id: string;
  current_quantity: number;
  last_updated_at: string;
}

export interface StockMovement {
  id: string;
  project_id: string;
  material_id: string;
  quantity: number; // positive for additions, negative for consumptions
  movement_type: StockMovementType;
  reference_id?: string; // delivery_note_id or daily_report_id
  performed_by_user_id: string;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  project_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface OfflineSyncQueueItem {
  id: string;
  action_type: 'time_log_checkin' | 'time_log_checkout' | 'daily_report_submit' | 'delivery_note_submit' | 'expense_submit' | 'stock_consumption_submit';
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retry_count: number;
  last_error?: string;
  created_at: string;
  synced_at?: string;
}

// ============================================================================
// Account Application (Spec §7)
// ============================================================================

export type AccountApplicationStatus = 'pending' | 'approved' | 'rejected' | 'correction_requested';

export interface AccountApplication {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_code?: string;
  requested_role: UserRole;
  requested_project_id?: string;
  requested_team_id?: string;
  status: AccountApplicationStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  correction_notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Expense System (Spec §9–§16)
// ============================================================================

export type ExpenseStatus =
  | 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  | 'needs_correction' | 'reimbursement_pending' | 'reimbursed' | 'cancelled';

export type ExpenseCategory =
  | 'fuel' | 'accommodation' | 'food' | 'transport' | 'parking'
  | 'tolls' | 'materials' | 'tools' | 'equipment' | 'phone_internet' | 'other';

export type PaymentMethod = 'personal' | 'company_card' | 'company_cash' | 'other';

export type DocumentType = 'bon_fiscal' | 'factura' | 'receipt' | 'other';

export interface Expense {
  id: string;
  user_id: string;
  project_id: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  document_type: DocumentType;
  payment_method: PaymentMethod;
  amount: number;
  reimbursable_amount: number;
  currency: string;
  receipt_photo_url?: string;
  ocr_result?: OcrResult;
  description?: string;
  notes?: string;
  mileage?: number;
  vehicle?: string;
  participants?: string[];
  related_work_order?: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  correction_notes?: string;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseDocument {
  id: string;
  expense_id: string;
  document_type: DocumentType;
  original_image_url: string;
  thumbnail_url?: string;
  ocr_result?: OcrResult;
  corrected_values?: Partial<OcrResult>;
  approval_status?: string;
  uploaded_by: string;
  /** Scan-pipeline metadata (migration 07). */
  file_name?: string;
  mime_type?: string;
  size_bytes?: number;
  storage_bucket?: string;
  ocr_status?: string;
  ocr_provider?: string;
  low_confidence_fields?: string[];
  document_state?: 'uploaded' | 'processing' | 'ocr_completed' | 'needs_review' | 'confirmed' | 'posted' | 'failed';
  raw_ocr_result?: OcrResult;
  normalized_fields?: OcrResult;
  employee_corrections?: Record<string, unknown>;
  processing_error?: string;
  correlation_id?: string;
  processed_at?: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_at: string;
}

export interface OcrResult {
  document_type?: 'BON_FISCAL' | 'FACTURA' | 'OTHER';
  merchant_name?: string;
  merchant_cui?: string;
  document_number?: string;
  invoice_series?: string;
  document_date?: string;
  due_date?: string;
  subtotal?: number;
  vat?: number;
  total?: number;
  currency?: string;
  items?: Array<{ description: string; quantity?: number; unit_price?: number; total?: number }>;
  recognition?: Array<{ text: string; confidence?: number; box?: number[][] }>;
  /** Optional full text dump of the document, when a provider returns it. */
  raw_text?: string;
  /** OCR provider that produced this result (server-side name). */
  provider?: string;
  /** Overall confidence in [0,1]. */
  confidence?: number;
  /** Optional address extracted from the document. */
  address?: string;
  /** Optional payment method extracted from the document (free text). */
  payment_method?: string;
  vat_rates?: number[];
  description?: string;
  review_required?: boolean;
  validation_errors?: string[];
  document_hash?: string;
  /** Per-field confidence, keyed by OCR_FIELD_KEYS, in [0,1]. */
  fields?: Record<string, { value?: string | number; confidence?: number }>;
}

export interface ExpenseApproval {
  id: string;
  expense_id: string;
  approver_user_id: string;
  action: 'approved' | 'rejected' | 'correction_requested';
  reason?: string;
  created_at: string;
}

// ============================================================================
// Notifications (Spec §32–§34)
// ============================================================================

export type NotificationType =
  | 'account_application' | 'account_approved' | 'account_rejected'
  | 'expense_submitted' | 'expense_approved' | 'expense_rejected'
  | 'expense_correction_requested' | 'reimbursement_pending' | 'reimbursement_completed'
  | 'daily_report_submitted' | 'report_approved' | 'report_rejected'
  | 'aviz_new' | 'aviz_update' | 'stock_received' | 'low_stock'
  | 'team_assignment' | 'admin_message';

export interface Notification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  title_ro: string;
  title_en: string;
  body_ro: string;
  body_en: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  read_at?: string;
  priority?: 'low' | 'normal' | 'high';
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Warehouse & Stock Expansion (Spec §18–§25)
// ============================================================================

export type StockUnit = 'buc' | 'm' | 'kg' | 'role' | 'set' | 'box' | 'pallet' | 'l' | 'other';
export type StockReceiptStatus = 'draft' | 'submitted' | 'review' | 'approved' | 'stock_posted';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  project_id?: string;
  address?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockReceipt {
  id: string;
  aviz_number: string;
  supplier: string;
  project_id: string;
  warehouse_id?: string;
  receiver_user_id: string;
  delivery_date: string;
  photo_url?: string;
  status: StockReceiptStatus;
  document_type: DocumentType;
  ocr_result?: OcrResult;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  is_offline_created?: boolean;
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

export interface StockReceiptItem {
  id: string;
  stock_receipt_id: string;
  material_id: string;
  quantity: number;
  unit_cost?: number;
  unit: StockUnit;
  created_at: string;
}

export interface StockConsumption {
  id: string;
  daily_report_id: string;
  material_id: string;
  project_id: string;
  quantity: number;
  consumed_by_user_id: string;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

// ============================================================================
// Statistics (Spec §41–§46)
// ============================================================================

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  pending_applications: number;
  active_projects: number;
  present_today: number;
  absent_today: number;
  overtime_today_hours: number;
  overtime_month_hours: number;
  expenses_today: number;
  expenses_this_week: number;
  expenses_this_month: number;
  pending_expenses: number;
  pending_reimbursements: number;
  monthly_reimbursed: number;
  low_stock_items: number;
  total_stock_value: number;
  open_reports: number;
}

export interface ProjectCostSummary {
  project_id: string;
  project_name: string;
  labor_hours: number;
  overtime_hours: number;
  employee_expenses: number;
  material_cost: number;
  other_costs: number;
  total_tracked_cost: number;
}

export interface ExpenseSummaryByCategory {
  category: ExpenseCategory;
  label_ro: string;
  label_en: string;
  total_amount: number;
  count: number;
}
