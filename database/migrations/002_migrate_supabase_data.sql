-- ============================================================================
-- HIIEKO Solar Site Management - Supabase to Target PostgreSQL ETL Migration
-- Migration: 002_migrate_supabase_data.sql
-- Non-destructive, repeatable data migration from legacy Supabase tables.
--
-- TWO-SCHEMA MODEL (required - avoids name collisions)
-- 10 target tables share names with legacy tables (teams, materials,
-- stock_movements, daily_reports, daily_report_workers,
-- daily_report_materials, warehouses, notifications, audit_logs, team_members).
-- Therefore the legacy Supabase data MUST be staged in a SEPARATE schema named
--   legacy
-- (created by run_migration.ts prep step, or by the operator via:
--   CREATE SCHEMA IF NOT EXISTS legacy;
--   pg_restore --schema=legacy <dump>  |  apply migrations 01-08 with search_path=legacy)
-- All legacy SOURCE reads below use legacy.* ; all TARGET writes use public.*.
--
-- SOURCE OF TRUTH for legacy columns: supabase/full_setup.sql (migrations 01-08).
-- Column names below MATCH the real legacy schema (verified 2026-09-19), e.g.:
--   time_logs.check_in/check_out/check_in_lat/check_in_lng/normal_hours_worked
--   expenses.user_id/submitted_at      notifications.recipient_user_id/body_ro
--   audit_logs.actor_user_id/entity_type/details
--
-- Requires migration 001 to have run first (target tables must exist).
-- Skips each section gracefully when its legacy table/column is absent.
-- ============================================================================

DO $$
DECLARE
    default_org_id UUID;
    v_migrated_users INTEGER := 0;
    v_migrated_projects INTEGER := 0;
    v_migrated_attendance INTEGER := 0;
    v_migrated_stock INTEGER := 0;
    v_migrated_expenses INTEGER := 0;
    v_migrated_notifications INTEGER := 0;
    v_migrated_audit INTEGER := 0;
BEGIN
    RAISE NOTICE '=== STARTING DATA MIGRATION FROM SUPABASE TO TARGET SCHEMA ===';

    -- 1. Default Organization
    INSERT INTO public.organizations (id, name, cui, address)
    VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'HIIEKO Solar EPC Romania',
        'RO12345678',
        'Bucuresti, Sector 1, Calea Floreasca 100'
    )
    ON CONFLICT (id) DO NOTHING;
    default_org_id := '00000000-0000-0000-0000-000000000001'::uuid;

    -- 2. Migrate System Roles Baseline
    INSERT INTO public.roles (id, name, code, description)
    VALUES
        ('00000000-0000-0000-0001-000000000001'::uuid, 'Administrator', 'ADMIN', 'Full system control'),
        ('00000000-0000-0000-0001-000000000002'::uuid, 'Manager', 'MANAGER', 'Operations and reporting management'),
        ('00000000-0000-0000-0001-000000000003'::uuid, 'Sef Echipa', 'TEAM_LEADER', 'Field team leader'),
        ('00000000-0000-0000-0001-000000000004'::uuid, 'Muncitor', 'WORKER', 'Field construction worker'),
        ('00000000-0000-0000-0001-000000000005'::uuid, 'Project Manager', 'PM', 'Project delivery lead'),
        ('00000000-0000-0000-0001-000000000006'::uuid, 'Site Manager', 'SITE_MANAGER', 'On-site construction manager'),
        ('00000000-0000-0000-0001-000000000007'::uuid, 'Responsabil Achizitii', 'PROCUREMENT', 'Supply chain and logistics'),
        ('00000000-0000-0000-0001-000000000008'::uuid, 'Financiar', 'FINANCE', 'Expense and budget approvals'),
        ('00000000-0000-0000-0001-000000000009'::uuid, 'Responsabil Calitate', 'QA_QC', 'Quality assurance and inspection'),
        ('00000000-0000-0000-0001-000000000010'::uuid, 'Proprietar Proiect', 'OWNER', 'Client & investor oversight'),
        ('00000000-0000-0000-0001-000000000011'::uuid, 'Vizitator', 'VIEWER', 'Read-only access')
    ON CONFLICT (code) DO NOTHING;

    -- 3. Migrate Users + Profiles (public.profiles)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'profiles') THEN
        INSERT INTO public.users (id, organization_id, email, role, is_active, created_at, updated_at)
        SELECT
            p.id,
            default_org_id,
            p.email,
            CASE p.role::text
                WHEN 'admin' THEN 'ADMIN'::user_role_enum
                WHEN 'manager' THEN 'MANAGER'::user_role_enum
                WHEN 'team_leader' THEN 'TEAM_LEADER'::user_role_enum
                WHEN 'worker' THEN 'WORKER'::user_role_enum
                ELSE 'WORKER'::user_role_enum
            END,
            p.is_active,
            p.created_at,
            p.updated_at
        FROM legacy.profiles p
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at;

        GET DIAGNOSTICS v_migrated_users = ROW_COUNT;
        RAISE NOTICE 'Migrated % users from public.profiles', v_migrated_users;

        INSERT INTO public.user_profiles (id, user_id, full_name, phone, employee_code, avatar_url, language, created_at, updated_at)
        SELECT
            p.id,
            p.id,
            p.full_name,
            p.phone_number,
            p.employee_code,
            p.avatar_url,
            COALESCE(p.preferred_language, 'ro'),
            p.created_at,
            p.updated_at
        FROM legacy.profiles p
        ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            employee_code = EXCLUDED.employee_code,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = EXCLUDED.updated_at;
    END IF;

-- 4. Migrate Sites to Projects (UUID-stable: sites.id -> projects.id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'sites') THEN
        INSERT INTO public.projects (
            id, organization_id, name, code, address, latitude, longitude,
            geofence_radius_meters, is_active, currency, created_at, updated_at
        )
        SELECT
            s.id,
            default_org_id,
            s.name,
            s.code,
            s.address,
            s.latitude::numeric(10, 7),
            s.longitude::numeric(10, 7),
            s.geofence_radius_meters,
            s.is_active,
            'RON',
            s.created_at,
            s.updated_at
        FROM legacy.sites s
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            code = EXCLUDED.code,
            address = EXCLUDED.address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            geofence_radius_meters = EXCLUDED.geofence_radius_meters,
            is_active = EXCLUDED.is_active;

        GET DIAGNOSTICS v_migrated_projects = ROW_COUNT;
        RAISE NOTICE 'Migrated % sites to projects', v_migrated_projects;
    END IF;

    -- 5. Migrate User Site Assignments -> Project Members
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'user_site_assignments') THEN
        INSERT INTO public.project_members (id, project_id, user_id, role, assigned_at)
        SELECT
            usa.id,
            usa.site_id,
            usa.user_id,
            CASE u.role::text
                WHEN 'admin' THEN 'ADMIN'::user_role_enum
                WHEN 'manager' THEN 'MANAGER'::user_role_enum
                WHEN 'team_leader' THEN 'TEAM_LEADER'::user_role_enum
                WHEN 'worker' THEN 'WORKER'::user_role_enum
                ELSE 'WORKER'::user_role_enum
            END,
            usa.assigned_at
        FROM legacy.user_site_assignments usa
        JOIN public.users u ON u.id = usa.user_id
        JOIN public.projects p ON p.id = usa.site_id
        ON CONFLICT DO NOTHING;
    END IF;

    -- 6. Migrate site_assignments (04b variant with explicit role/dates) -> Project Members
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'site_assignments') THEN
        INSERT INTO public.project_members (id, project_id, user_id, role, assigned_at)
        SELECT
            sa.id,
            sa.site_id,
            sa.user_id,
            CASE sa.role::text
                WHEN 'admin' THEN 'ADMIN'::user_role_enum
                WHEN 'manager' THEN 'MANAGER'::user_role_enum
                WHEN 'team_leader' THEN 'TEAM_LEADER'::user_role_enum
                WHEN 'worker' THEN 'WORKER'::user_role_enum
                ELSE 'WORKER'::user_role_enum
            END,
            sa.created_at
        FROM legacy.site_assignments sa
        JOIN public.users u ON u.id = sa.user_id
        JOIN public.projects p ON p.id = sa.site_id
        ON CONFLICT DO NOTHING;
    END IF;

    -- 7. Migrate Teams & Team Members (legacy teams has NO is_active column)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'teams') THEN
        INSERT INTO public.teams (id, name, code, leader_id, project_id, created_at, updated_at)
        SELECT
            t.id,
            t.name,
            'TEAM-' || SUBSTRING(t.id::text, 1, 8),
            t.team_leader_id,
            t.site_id,
            t.created_at,
            t.updated_at
        FROM legacy.teams t
        JOIN public.users u ON u.id = t.team_leader_id
        ON CONFLICT (id) DO NOTHING;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'team_members') THEN
            INSERT INTO public.team_members (id, team_id, user_id, joined_at)
            SELECT
                tm.id,
                tm.team_id,
                tm.user_id,
                tm.created_at
            FROM legacy.team_members tm
            JOIN legacy.teams t ON t.id = tm.team_id
            JOIN public.users u ON u.id = tm.user_id
            ON CONFLICT (team_id, user_id) DO NOTHING;
        END IF;
    END IF;

-- 8. Migrate Attendance (time_logs -> attendance_records)
    -- Legacy columns: check_in/check_out, check_in_lat/check_in_lng,
    -- check_out_lat/check_out_lng, normal_hours_worked, is_offline_created.
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'time_logs') THEN
        INSERT INTO public.attendance_records (
            id, user_id, project_id, date, check_in_time, check_out_time,
            status, check_in_latitude, check_in_longitude, check_in_distance_m, is_within_geofence,
            check_out_latitude, check_out_longitude,
            regular_hours, overtime_minutes, is_offline_sync, idempotency_key, notes,
            created_at, updated_at
        )
        SELECT
            tl.id,
            tl.user_id,
            tl.site_id,
            tl.date,
            tl.check_in,
            tl.check_out,
            CASE tl.status::text
                WHEN 'present' THEN 'PRESENT'::attendance_status_enum
                WHEN 'late' THEN 'PRESENT'::attendance_status_enum
                WHEN 'early_leave' THEN 'PRESENT'::attendance_status_enum
                WHEN 'absent' THEN 'ABSENT'::attendance_status_enum
                WHEN 'sick_leave' THEN 'MEDICAL_LEAVE'::attendance_status_enum
                WHEN 'vacation' THEN 'REST'::attendance_status_enum
                ELSE 'PRESENT'::attendance_status_enum
            END,
            tl.check_in_lat::numeric(10, 7),
            tl.check_in_lng::numeric(10, 7),
            tl.check_in_distance_meters::numeric(8, 2),
            (tl.check_in_distance_meters IS NULL OR tl.check_in_distance_meters <= s.geofence_radius_meters),
            tl.check_out_lat::numeric(10, 7),
            tl.check_out_lng::numeric(10, 7),
            COALESCE(tl.normal_hours_worked, 0)::numeric(5, 2),
            COALESCE(tl.overtime_minutes, 0),
            tl.is_offline_created,
            tl.idempotency_key,
            tl.notes,
            tl.created_at,
            tl.updated_at
        FROM legacy.time_logs tl
        JOIN public.users u ON u.id = tl.user_id
        JOIN public.projects p ON p.id = tl.site_id
        JOIN legacy.sites s ON s.id = tl.site_id
        ON CONFLICT (id) DO NOTHING;

        GET DIAGNOSTICS v_migrated_attendance = ROW_COUNT;
        RAISE NOTICE 'Migrated % attendance records from time_logs to attendance_records', v_migrated_attendance;
    END IF;

    -- 9. Migrate Materials, Stock Balances and Stock Movements
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'materials') THEN
        INSERT INTO public.materials (
            id, code, name, unit, category, barcode, min_stock_threshold, is_active, created_at, updated_at
        )
        SELECT
            m.id,
            m.code,
            m.name,
            m.unit,
            m.category,
            m.barcode,
            m.min_stock_threshold::numeric(12, 3),
            m.is_active,
            m.created_at,
            m.updated_at
        FROM legacy.materials m
        ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            unit = EXCLUDED.unit,
            category = EXCLUDED.category;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'site_stock') THEN
            INSERT INTO public.stock_balances (
                id, material_id, project_id, current_quantity, updated_at
            )
            SELECT
                ss.id,
                ss.material_id,
                ss.site_id,
                ss.current_quantity::numeric(12, 3),
                ss.last_updated_at
            FROM legacy.site_stock ss
            JOIN legacy.materials m ON m.id = ss.material_id
            JOIN public.projects p ON p.id = ss.site_id
            ON CONFLICT (id) DO NOTHING;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'stock_movements') THEN
            INSERT INTO public.stock_movements (
                id, material_id, project_id, movement_type, quantity,
                reference_id, reference_type, notes, created_by_id, created_at
            )
            SELECT
                sm.id,
                sm.material_id,
                sm.site_id,
                CASE sm.movement_type::text
                    WHEN 'delivery' THEN 'RECEIPT'::stock_movement_type_enum
                    WHEN 'daily_usage' THEN 'CONSUMPTION'::stock_movement_type_enum
                    WHEN 'transfer_in' THEN 'TRANSFER'::stock_movement_type_enum
                    WHEN 'transfer_out' THEN 'TRANSFER'::stock_movement_type_enum
                    WHEN 'adjustment' THEN 'ADJUSTMENT'::stock_movement_type_enum
                    ELSE 'ADJUSTMENT'::stock_movement_type_enum
                END,
                sm.quantity::numeric(12, 3),
                sm.reference_id::text,
                CASE
                    WHEN dn.id IS NOT NULL THEN 'delivery_notes'
                    WHEN dr.id IS NOT NULL THEN 'daily_reports'
                    WHEN sm.reference_id IS NOT NULL THEN 'transfer'
                    ELSE NULL
                END,
                sm.notes,
                sm.performed_by_user_id,
                sm.created_at
            FROM legacy.stock_movements sm
            JOIN legacy.materials m ON m.id = sm.material_id
            LEFT JOIN public.projects p ON p.id = sm.site_id
            LEFT JOIN legacy.delivery_notes dn ON dn.id = sm.reference_id
            LEFT JOIN legacy.daily_reports dr ON dr.id = sm.reference_id
            ON CONFLICT (id) DO NOTHING;
        END IF;
-- 10. Migrate Daily Reports (legacy notes/photos -> general_notes; no task linkage in legacy)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'daily_reports') THEN
        INSERT INTO public.daily_reports (
            id, project_id, team_id, team_leader_id, report_date,
            weather_notes, blockages, general_notes, status, idempotency_key, created_at, updated_at
        )
        SELECT
            dr.id,
            dr.site_id,
            dr.team_id,
            dr.team_leader_id,
            dr.report_date,
            NULL,
            NULL,
            COALESCE(dr.notes, ''),
            UPPER(dr.status::text),
            dr.idempotency_key,
            dr.created_at,
            dr.updated_at
        FROM legacy.daily_reports dr
        JOIN public.projects p ON p.id = dr.site_id
        JOIN public.users u ON u.id = dr.team_leader_id
        ON CONFLICT (id) DO NOTHING;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'daily_report_workers') THEN
            INSERT INTO public.daily_report_workers (id, daily_report_id, worker_id, hours_worked, overtime_hours, notes)
            SELECT
                drw.id,
                drw.daily_report_id,
                drw.worker_id,
                0::numeric(5, 2),
                0::numeric(5, 2),
                NULL
            FROM legacy.daily_report_workers drw
            JOIN legacy.daily_reports dr ON dr.id = drw.daily_report_id
            ON CONFLICT (id) DO NOTHING;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'daily_report_materials') THEN
            INSERT INTO public.daily_report_materials (id, daily_report_id, material_id, quantity_used, notes)
            SELECT
                drm.id,
                drm.daily_report_id,
                drm.material_id,
                drm.quantity::numeric(12, 3),
                NULL
            FROM legacy.daily_report_materials drm
            JOIN legacy.daily_reports dr ON dr.id = drm.daily_report_id
            JOIN legacy.materials m ON m.id = drm.material_id
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;

    -- 11. Migrate Delivery Notes (Avize) + Items
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'delivery_notes') THEN
        INSERT INTO public.avize (
            id, project_id, aviz_number, delivery_date, notes, idempotency_key, created_at
        )
        SELECT
            dn.id,
            dn.site_id,
            dn.invoice_or_aviz_number,
            dn.delivery_date,
            dn.notes,
            dn.idempotency_key,
            dn.created_at
        FROM legacy.delivery_notes dn
        JOIN public.projects p ON p.id = dn.site_id
        ON CONFLICT (id) DO NOTHING;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'delivery_note_items') THEN
            INSERT INTO public.aviz_items (id, aviz_id, material_id, quantity)
            SELECT
                dni.id,
                dni.delivery_note_id,
                dni.material_id,
                dni.quantity::numeric(12, 3)
            FROM legacy.delivery_note_items dni
            JOIN public.avize a ON a.id = dni.delivery_note_id
            JOIN legacy.materials m ON m.id = dni.material_id
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;

    -- 12. Migrate Expenses, Approvals & Reimbursements
    -- Legacy (04a) columns: user_id, submitted_at; category/payment_method/status
    -- enum values differ from target and are mapped explicitly below.
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'expenses') THEN
        INSERT INTO public.expenses (
            id, project_id, submitted_by_id, category, payment_method, amount,
            currency, expense_date, description, status, idempotency_key,
            created_at, updated_at
        )
        SELECT
            e.id,
            e.site_id,
            e.user_id,
            CASE e.category::text
                WHEN 'fuel' THEN 'FUEL'::expense_category_enum
                WHEN 'accommodation' THEN 'SUBSISTENCE_ACCOMMODATION'::expense_category_enum
                WHEN 'food' THEN 'SUBSISTENCE_ACCOMMODATION'::expense_category_enum
                WHEN 'transport' THEN 'TRANSPORT_LOGISTICS'::expense_category_enum
                WHEN 'parking' THEN 'TRANSPORT_LOGISTICS'::expense_category_enum
                WHEN 'tolls' THEN 'TRANSPORT_LOGISTICS'::expense_category_enum
                WHEN 'materials' THEN 'MATERIALS_EMERGENCY'::expense_category_enum
                WHEN 'tools' THEN 'TOOLS_CONSUMABLES'::expense_category_enum
                WHEN 'equipment' THEN 'EQUIPMENT_RENTAL'::expense_category_enum
                WHEN 'phone_internet' THEN 'SERVICES_SUBCONTRACTORS'::expense_category_enum
                ELSE 'OTHER'::expense_category_enum
            END,
            CASE e.payment_method::text
                WHEN 'company_card' THEN 'COMPANY_CARD'::payment_method_enum
                WHEN 'company_cash' THEN 'CASH'::payment_method_enum
                WHEN 'personal' THEN 'PERSONAL_CARD'::payment_method_enum
                WHEN 'other' THEN 'OTHER'::payment_method_enum
                ELSE 'COMPANY_CARD'::payment_method_enum
            END,
            e.amount::numeric(12, 2),
            COALESCE(e.currency, 'RON'),
            COALESCE(e.submitted_at::date, e.created_at::date),
            COALESCE(e.description, ''),
            CASE e.status::text
                WHEN 'draft' THEN 'DRAFT'::expense_status_enum
                WHEN 'submitted' THEN 'SUBMITTED'::expense_status_enum
                WHEN 'under_review' THEN 'UNDER_REVIEW'::expense_status_enum
                WHEN 'approved' THEN 'APPROVED'::expense_status_enum
                WHEN 'rejected' THEN 'REJECTED'::expense_status_enum
                WHEN 'needs_correction' THEN 'UNDER_REVIEW'::expense_status_enum
                WHEN 'reimbursement_pending' THEN 'UNDER_REVIEW'::expense_status_enum
                WHEN 'reimbursed' THEN 'REIMBURSED'::expense_status_enum
                WHEN 'cancelled' THEN 'CANCELLED'::expense_status_enum
                ELSE 'SUBMITTED'::expense_status_enum
            END,
            e.idempotency_key,
            e.created_at,
            e.updated_at
        FROM legacy.expenses e
        JOIN public.users u ON u.id = e.user_id
        LEFT JOIN public.projects p ON p.id = e.site_id
        ON CONFLICT (id) DO NOTHING;

        GET DIAGNOSTICS v_migrated_expenses = ROW_COUNT;
        RAISE NOTICE 'Migrated % expenses from public.expenses', v_migrated_expenses;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'expense_approvals') THEN
            INSERT INTO public.expense_approvals (id, expense_id, approver_id, status, notes, created_at)
            SELECT
                ea.id,
                ea.expense_id,
                ea.approver_user_id,
                UPPER(ea.action::text),
                ea.reason,
                ea.created_at
            FROM legacy.expense_approvals ea
            JOIN legacy.expenses e ON e.id = ea.expense_id
            JOIN public.users u ON u.id = ea.approver_user_id
            ON CONFLICT (id) DO NOTHING;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'reimbursements') THEN
            INSERT INTO public.reimbursements (id, expense_id, amount, payment_ref, processed_at)
            SELECT
                r.id,
                r.expense_id,
                r.amount::numeric(12, 2),
                r.reference_note,
                r.reimbursement_date
            FROM legacy.reimbursements r
            JOIN legacy.expenses e ON e.id = r.expense_id
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;

    -- 13. Migrate Expense Documents -> documents / document_versions / ocr_jobs
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'expense_documents') THEN
        INSERT INTO public.documents (
            id, project_id, document_type, title, storage_path, current_version, created_at, updated_at
        )
        SELECT
            ed.id,
            e.site_id,
            CASE ed.document_type::text
                WHEN 'bon_fiscal' THEN 'BON_FISCAL'::document_type_enum
                WHEN 'factura' THEN 'FACTURA'::document_type_enum
                WHEN 'receipt' THEN 'OTHER'::document_type_enum
                ELSE 'OTHER'::document_type_enum
            END,
            COALESCE(ed.file_name, 'expense-document-' || ed.id::text),
            COALESCE(ed.original_image_url, ''),
            1,
            ed.created_at,
            ed.created_at
        FROM legacy.expense_documents ed
        JOIN legacy.expenses e ON e.id = ed.expense_id
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.document_versions (
            id, document_id, version, storage_path, file_size, checksum, uploaded_by, created_at
        )
        SELECT
            ed.id,
            ed.id,
            1,
            COALESCE(ed.original_image_url, ''),
            GREATEST(COALESCE(ed.size_bytes, 0), 0)::integer,
            NULL,
            ed.uploaded_by::text,
            ed.created_at
        FROM legacy.expense_documents ed
        JOIN legacy.expenses e ON e.id = ed.expense_id
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.ocr_jobs (
            id, expense_id, document_id, provider, state, correlation_id,
            raw_payload, error_message, created_at, updated_at
        )
        SELECT
            ed.id,
            ed.expense_id,
            ed.id,
            COALESCE(ed.ocr_provider, 'PADDLE_OCR'),
            CASE ed.document_state::text
                WHEN 'uploaded' THEN 'PENDING'::ocr_job_state_enum
                WHEN 'processing' THEN 'PROCESSING'::ocr_job_state_enum
                WHEN 'ocr_completed' THEN 'REVIEW_REQUIRED'::ocr_job_state_enum
                WHEN 'needs_review' THEN 'REVIEW_REQUIRED'::ocr_job_state_enum
                WHEN 'confirmed' THEN 'COMPLETED'::ocr_job_state_enum
                WHEN 'posted' THEN 'COMPLETED'::ocr_job_state_enum
                WHEN 'failed' THEN 'FAILED'::ocr_job_state_enum
                ELSE 'PENDING'::ocr_job_state_enum
            END,
            ed.correlation_id,
            jsonb_build_object(
                'raw_ocr_result', ed.raw_ocr_result,
                'normalized_fields', ed.normalized_fields,
                'corrected_values', ed.corrected_values,
                'ocr_result', ed.ocr_result
            ),
            ed.processing_error,
            COALESCE(ed.processed_at, ed.created_at),
            NOW()
        FROM legacy.expense_documents ed
        JOIN legacy.expenses e ON e.id = ed.expense_id
        ON CONFLICT (id) DO NOTHING;
    END IF;

-- 14. Migrate Warehouses (legacy site-linked warehouses -> global with default org)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'warehouses') THEN
        INSERT INTO public.warehouses (id, organization_id, name, code, address, is_active, created_at, updated_at)
        SELECT
            w.id,
            default_org_id,
            w.name,
            w.code,
            w.address,
            w.is_active,
            w.created_at,
            w.updated_at
        FROM legacy.warehouses w
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 15. Migrate Notifications
    -- Legacy (04b): recipient_user_id, body_ro/body_en, priority TEXT(low|normal|high).
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'notifications') THEN
        INSERT INTO public.notifications (
            id, user_id, title_ro, title_en, message_ro, message_en,
            priority, action_url, metadata, is_read, read_at, created_at
        )
        SELECT
            n.id,
            n.recipient_user_id,
            n.title_ro,
            n.title_en,
            n.body_ro,
            n.body_en,
            CASE n.priority::text
                WHEN 'low' THEN 'LOW'::notification_priority_enum
                WHEN 'high' THEN 'HIGH'::notification_priority_enum
                WHEN 'urgent' THEN 'URGENT'::notification_priority_enum
                ELSE 'NORMAL'::notification_priority_enum
            END,
            n.action_url,
            jsonb_build_object('legacy_type', n.type, 'entity_type', n.entity_type, 'entity_id', n.entity_id),
            n.is_read,
            n.read_at,
            n.created_at
        FROM legacy.notifications n
        JOIN public.users u ON u.id = n.recipient_user_id
        ON CONFLICT (id) DO NOTHING;

        GET DIAGNOSTICS v_migrated_notifications = ROW_COUNT;
        RAISE NOTICE 'Migrated % notifications', v_migrated_notifications;
    END IF;

    -- 16. Migrate Audit Logs
    -- Legacy (01): actor_user_id, entity_type, details JSONB (single bucket).
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'legacy' AND table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (
            id, organization_id, actor_id, action, entity, entity_id,
            before_state, after_state, metadata, ip_address, created_at
        )
        SELECT
            al.id,
            default_org_id,
            al.actor_user_id,
            al.action,
            al.entity_type,
            al.entity_id,
            NULL,
            al.details,
            jsonb_strip_nulls(jsonb_build_object(
                'actor_role', al.actor_role,
                'legacy_site_id', al.site_id
            )),
            al.ip_address,
            al.created_at
        FROM legacy.audit_logs al
        LEFT JOIN public.users u ON u.id = al.actor_user_id
        ON CONFLICT (id) DO NOTHING;

        GET DIAGNOSTICS v_migrated_audit = ROW_COUNT;
        RAISE NOTICE 'Migrated % audit logs', v_migrated_audit;
    END IF;

    RAISE NOTICE '=== DATA MIGRATION COMPLETED (users=%, projects=%, attendance=%, expenses=%, notifications=%, audit=%) ===',
        v_migrated_users, v_migrated_projects, v_migrated_attendance, v_migrated_expenses, v_migrated_notifications, v_migrated_audit;
END $$;
    END IF;