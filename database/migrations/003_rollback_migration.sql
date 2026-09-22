-- ============================================================================
-- HIIEKO Solar Site Management - Target Schema Rollback
-- Migration: 003_rollback_migration.sql
-- Idempotent rollback of migration 001 + 002 TARGET objects.
--
-- SAFETY GUARANTEES
--   * Only public-schema objects created by 001 are dropped (reverse order).
--   * The legacy staging schema (legacy.*) is NEVER touched - legacy Supabase
--     data is preserved exactly as staged (migration 002 is non-destructive
--     by design).
--   * Reruns cleanly: every statement uses IF EXISTS / DROP TYPE IF EXISTS.
-- ============================================================================

-- 1. Drop target tables (reverse dependency order; CASCADE makes it safe)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.cost_entries CASCADE;
DROP TABLE IF EXISTS public.budget_lines CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.change_orders CASCADE;
DROP TABLE IF EXISTS public.ncrs CASCADE;
DROP TABLE IF EXISTS public.issues CASCADE;
DROP TABLE IF EXISTS public.measurements CASCADE;
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.inspection_templates CASCADE;
DROP TABLE IF EXISTS public.ocr_extractions CASCADE;
DROP TABLE IF EXISTS public.ocr_jobs CASCADE;
DROP TABLE IF EXISTS public.document_versions CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.reimbursements CASCADE;
DROP TABLE IF EXISTS public.expense_approvals CASCADE;
DROP TABLE IF EXISTS public.expense_lines CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.aviz_items CASCADE;
DROP TABLE IF EXISTS public.avize CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.invoice_lines CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.deliveries CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.consumptions CASCADE;
DROP TABLE IF EXISTS public.project_allocations CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_balances CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.material_lots CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.production_entries CASCADE;
DROP TABLE IF EXISTS public.daily_report_materials CASCADE;
DROP TABLE IF EXISTS public.daily_report_tasks CASCADE;
DROP TABLE IF EXISTS public.daily_report_workers CASCADE;
DROP TABLE IF EXISTS public.daily_reports CASCADE;
DROP TABLE IF EXISTS public.daily_plan_tasks CASCADE;
DROP TABLE IF EXISTS public.daily_plans CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.task_assignments CASCADE;
DROP TABLE IF EXISTS public.task_dependencies CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.location_zones CASCADE;
DROP TABLE IF EXISTS public.work_packages CASCADE;
DROP TABLE IF EXISTS public.project_stages CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
-- 2. Drop target enums (idempotent)
DROP TYPE IF EXISTS public.user_role_enum;
DROP TYPE IF EXISTS public.attendance_status_enum;
DROP TYPE IF EXISTS public.project_status_enum;
DROP TYPE IF EXISTS public.task_status_enum;
DROP TYPE IF EXISTS public.dependency_type_enum;
DROP TYPE IF EXISTS public.stock_movement_type_enum;
DROP TYPE IF EXISTS public.expense_status_enum;
DROP TYPE IF EXISTS public.expense_category_enum;
DROP TYPE IF EXISTS public.payment_method_enum;
DROP TYPE IF EXISTS public.document_type_enum;
DROP TYPE IF EXISTS public.issue_severity_enum;
DROP TYPE IF EXISTS public.issue_status_enum;
DROP TYPE IF EXISTS public.ncr_status_enum;
DROP TYPE IF EXISTS public.change_order_status_enum;
DROP TYPE IF EXISTS public.notification_priority_enum;
DROP TYPE IF EXISTS public.notification_channel_enum;
DROP TYPE IF EXISTS public.ocr_job_state_enum;

-- 3. Summary notice (expected: 0 target tables remain in public)
DO $$
DECLARE
    v_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_remaining
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
        'organizations','users','user_profiles','roles','permissions',
        'role_permissions','employees','teams','team_members','clients',
        'projects','project_stages','work_packages','location_zones',
        'project_members','tasks','task_dependencies','task_assignments',
        'attendance_records','daily_plans','daily_plan_tasks','daily_reports',
        'daily_report_workers','daily_report_tasks','daily_report_materials',
        'production_entries','materials','material_lots','warehouses',
        'stock_balances','stock_movements','project_allocations','consumptions',
        'suppliers','purchase_orders','purchase_order_items','deliveries',
        'invoices','invoice_lines','receipts','avize','aviz_items','expenses',
        'expense_lines','expense_approvals','reimbursements','documents',
        'document_versions','ocr_jobs','ocr_extractions','inspection_templates',
        'inspections','measurements','issues','ncrs','change_orders','budgets',
        'budget_lines','cost_entries','commitments','payments','notifications',
        'notification_preferences','attachments','audit_logs'
    );
    RAISE NOTICE 'Rollback finished. % target tables remain in public (0 expected).', v_remaining;
END $$;
DROP TABLE IF EXISTS public.organizations CASCADE;