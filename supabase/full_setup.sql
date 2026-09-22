-- ====================================================================
-- Solar Site Management App - FULL DATABASE SETUP (consolidated artifact)
-- File: supabase/full_setup.sql
-- ====================================================================
-- AUTO-GENERATED from the AUTHORITATIVE migration files in
-- supabase/migrations/ (applied in chronological order).
-- DO NOT EDIT BY HAND - edit the migrations and regenerate.
--
-- Source migrations (included, in order):
--   01_initial_schema.sql
--   02_row_level_security.sql
--   03_seed_data.sql
--   04a_auth_expenses.sql
--   04b_notifications_stock.sql
--   04c_rls_new_tables.sql
--   04d_auth_trigger.sql
--   05_self_approval_prevention.sql
--   06_event_notifications.sql
--
-- Idempotency guarantees:
--   * every CREATE POLICY is preceded by DROP POLICY IF EXISTS
--   * every CREATE TRIGGER is preceded by DROP TRIGGER IF EXISTS
--   * all functions use CREATE OR REPLACE FUNCTION (signatures untouched)
--   * tables / indexes / extensions use IF NOT EXISTS
--   * enum types are created inside duplicate_object-guarded DO blocks
--   * seed data uses ON CONFLICT DO NOTHING
-- RLS is enabled by this script and is never disabled.
-- No secrets / service-role credentials are present in this file.
-- ====================================================================


-- ====================================================================
-- SECTION 1/9 - 01_initial_schema.sql
-- ====================================================================

-- ====================================================================
-- Solar Site Management App — Database Schema & Data Integrity
-- Migration: 01_initial_schema.sql
-- Conforms to: 00_MASTER_PROJECT_RULES.md, 09_DATABASE_AND_DATA_INTEGRITY.md
-- ====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Types
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('admin', 'manager', 'team_leader', 'worker');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE attendance_status_enum AS ENUM ('present', 'late', 'early_leave', 'absent', 'sick_leave', 'vacation');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE report_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    CREATE TYPE stock_movement_type_enum AS ENUM ('delivery', 'daily_usage', 'transfer_in', 'transfer_out', 'adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'worker',
    phone_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sites (Santiere)
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_radius_meters INTEGER NOT NULL DEFAULT 300,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. User Site Assignments (Site visibility for managers/workers)
CREATE TABLE IF NOT EXISTS public.user_site_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, site_id)
);

-- 5. Teams (Echipe)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- 6. Time Logs (Pontaj)
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out TIMESTAMPTZ,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_in_distance_meters INTEGER,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    status attendance_status_enum NOT NULL DEFAULT 'present',
    normal_hours_worked NUMERIC(5, 2) NOT NULL DEFAULT 0,
    overtime_minutes INTEGER NOT NULL DEFAULT 0,
    rest_minutes INTEGER NOT NULL DEFAULT 60,
    notes TEXT,
    is_offline_created BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast daily pontaj and monthly pontaj lookups
CREATE INDEX IF NOT EXISTS idx_time_logs_user_date ON public.time_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_logs_site_date ON public.time_logs(site_id, date);

-- 7. Materials Catalog (Catalog Materiale)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'buc', -- buc, m, kg, role, set, l
    barcode TEXT UNIQUE,
    category TEXT,
    min_stock_threshold INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Delivery Notes (Avize Receptie)
CREATE TABLE IF NOT EXISTS public.delivery_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_or_aviz_number TEXT NOT NULL,
    supplier TEXT NOT NULL,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    receiver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    photo_url TEXT,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_note_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    unit_price NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Daily Team Reports (Rapoarte Zilnice Echipe)
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status report_status_enum NOT NULL DEFAULT 'submitted',
    notes TEXT,
    photos TEXT[] DEFAULT '{}',
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    is_offline_created BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_report_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(daily_report_id, worker_id)
);

CREATE TABLE IF NOT EXISTS public.daily_report_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'buc',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_report_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Site Stock Balances & Immutable Movements
CREATE TABLE IF NOT EXISTS public.site_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    current_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL, -- Positive for intake, negative for consumption
    movement_type stock_movement_type_enum NOT NULL,
    reference_id UUID, -- References delivery_notes(id), daily_reports(id), or transfer
    performed_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. System Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role user_role_enum,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- TRIGGERS & PROCEDURES
-- ====================================================================

-- A. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_sites_updated_at ON public.sites;
CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_time_logs_updated_at ON public.time_logs;
CREATE TRIGGER trg_time_logs_updated_at BEFORE UPDATE ON public.time_logs FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_materials_updated_at ON public.materials;
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_delivery_notes_updated_at ON public.delivery_notes;
CREATE TRIGGER trg_delivery_notes_updated_at BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER trg_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- B. Auto-update site_stock upon stock_movement insertion with strict invariant enforcement
CREATE OR REPLACE FUNCTION apply_stock_movement_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_qty NUMERIC(12, 2);
    v_new_qty NUMERIC(12, 2);
BEGIN
    SELECT current_quantity INTO v_existing_qty
    FROM public.site_stock
    WHERE site_id = NEW.site_id AND material_id = NEW.material_id;

    IF v_existing_qty IS NULL THEN
        IF NEW.quantity < 0 THEN
            RAISE EXCEPTION 'Eroare Integritate Stoc: Nu se poate consuma materialul fara o receptie anterioara (Stoc: 0, Solicitat: %)', NEW.quantity;
        END IF;
        INSERT INTO public.site_stock (site_id, material_id, current_quantity, last_updated_at)
        VALUES (NEW.site_id, NEW.material_id, NEW.quantity, NOW());
    ELSE
        v_new_qty := v_existing_qty + NEW.quantity;
        IF v_new_qty < 0 THEN
            RAISE EXCEPTION 'Eroare Integritate Stoc: Cantitatea solicitata (%) depaseste stocul disponibil (%).', ABS(NEW.quantity), v_existing_qty;
        END IF;
        UPDATE public.site_stock
        SET current_quantity = v_new_qty,
            last_updated_at = NOW()
        WHERE site_id = NEW.site_id AND material_id = NEW.material_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
BEFORE INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION apply_stock_movement_trigger();


-- ====================================================================
-- SECTION 2/9 - 02_row_level_security.sql
-- ====================================================================

-- ====================================================================
-- Solar Site Management App — Row Level Security (RLS) Policies
-- Migration: 02_row_level_security.sql
-- Conforms to: 12_SECURITY_PERMISSIONS_AUDIT.md
-- ====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for role & site checks
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role_enum AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_site_access(target_site_id UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1 FROM public.user_site_assignments 
        WHERE user_id = auth.uid() AND site_id = target_site_id
    ) OR EXISTS (
        SELECT 1 FROM public.sites
        WHERE id = target_site_id AND manager_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Profiles viewable by self and managers/admins" ON public.profiles;
CREATE POLICY "Profiles viewable by self and managers/admins"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_manager_or_admin());

DROP POLICY IF EXISTS "Profiles editable by admins only" ON public.profiles;
CREATE POLICY "Profiles editable by admins only"
ON public.profiles FOR UPDATE
USING (public.is_admin());

DROP POLICY IF EXISTS "Profiles insertable by admins or triggers" ON public.profiles;
CREATE POLICY "Profiles insertable by admins or triggers"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin() OR auth.uid() = id);

-- 3. Sites Policies
DROP POLICY IF EXISTS "Active sites viewable by authenticated active users" ON public.sites;
CREATE POLICY "Active sites viewable by authenticated active users"
ON public.sites FOR SELECT
USING (auth.role() = 'authenticated' AND (is_active = TRUE OR public.is_manager_or_admin()));

DROP POLICY IF EXISTS "Sites manageable by admins only" ON public.sites;
CREATE POLICY "Sites manageable by admins only"
ON public.sites FOR ALL
USING (public.is_admin());

-- 4. User Site Assignments Policies
DROP POLICY IF EXISTS "Assignments viewable by self or site access" ON public.user_site_assignments;
CREATE POLICY "Assignments viewable by self or site access"
ON public.user_site_assignments FOR SELECT
USING (auth.uid() = user_id OR public.has_site_access(site_id) OR public.is_admin());

DROP POLICY IF EXISTS "Assignments manageable by admins only" ON public.user_site_assignments;
CREATE POLICY "Assignments manageable by admins only"
ON public.user_site_assignments FOR ALL
USING (public.is_admin());

-- 5. Teams Policies
DROP POLICY IF EXISTS "Teams viewable by site access, leads or members" ON public.teams;
CREATE POLICY "Teams viewable by site access, leads or members"
ON public.teams FOR SELECT
USING (
    public.has_site_access(site_id)
    OR team_leader_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Teams manageable by admins only" ON public.teams;
CREATE POLICY "Teams manageable by admins only"
ON public.teams FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Team members viewable by related team access or self" ON public.team_members;
CREATE POLICY "Team members viewable by related team access or self"
ON public.team_members FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.teams
        WHERE teams.id = team_members.team_id
        AND (public.has_site_access(teams.site_id) OR teams.team_leader_id = auth.uid() OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Team members manageable by admins only" ON public.team_members;
CREATE POLICY "Team members manageable by admins only"
ON public.team_members FOR ALL
USING (public.is_admin());

-- 4. Time Logs (Pontaj) Policies
DROP POLICY IF EXISTS "Time logs viewable by owner or site managers/admins" ON public.time_logs;
CREATE POLICY "Time logs viewable by owner or site managers/admins"
ON public.time_logs FOR SELECT
USING (
    auth.uid() = user_id 
    OR public.has_site_access(site_id)
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Time logs creatable by worker for self" ON public.time_logs;
CREATE POLICY "Time logs creatable by worker for self"
ON public.time_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id 
    OR public.is_manager_or_admin()
);

DROP POLICY IF EXISTS "Time logs updatable by worker for check_out or managers" ON public.time_logs;
CREATE POLICY "Time logs updatable by worker for check_out or managers"
ON public.time_logs FOR UPDATE
USING (
    (auth.uid() = user_id AND check_out IS NULL) 
    OR public.is_manager_or_admin()
);

-- 5. Materials Catalog Policies
DROP POLICY IF EXISTS "Materials readable by all authenticated users" ON public.materials;
CREATE POLICY "Materials readable by all authenticated users"
ON public.materials FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Materials manageable by managers and admins" ON public.materials;
CREATE POLICY "Materials manageable by managers and admins"
ON public.materials FOR ALL
USING (public.is_manager_or_admin());

-- 6. Delivery Notes (Avize) Policies
DROP POLICY IF EXISTS "Delivery notes viewable by site managers, team leads and admins" ON public.delivery_notes;
CREATE POLICY "Delivery notes viewable by site managers, team leads and admins"
ON public.delivery_notes FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

DROP POLICY IF EXISTS "Delivery notes insertable by team leads and managers" ON public.delivery_notes;
CREATE POLICY "Delivery notes insertable by team leads and managers"
ON public.delivery_notes FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND public.has_site_access(site_id)
);

DROP POLICY IF EXISTS "Delivery note items readable if note accessible" ON public.delivery_note_items;
CREATE POLICY "Delivery note items readable if note accessible"
ON public.delivery_note_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.delivery_notes 
        WHERE delivery_notes.id = delivery_note_items.delivery_note_id
        AND (public.has_site_access(delivery_notes.site_id) OR public.is_admin())
    )
);

DROP POLICY IF EXISTS "Delivery note items insertable by team leads/managers" ON public.delivery_note_items;
CREATE POLICY "Delivery note items insertable by team leads/managers"
ON public.delivery_note_items FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
);

-- 7. Daily Reports Policies
DROP POLICY IF EXISTS "Daily reports readable by team members, team leads, and managers" ON public.daily_reports;
CREATE POLICY "Daily reports readable by team members, team leads, and managers"
ON public.daily_reports FOR SELECT
USING (
    team_leader_id = auth.uid()
    OR public.has_site_access(site_id)
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Daily reports creatable by team leaders and managers" ON public.daily_reports;
CREATE POLICY "Daily reports creatable by team leaders and managers"
ON public.daily_reports FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND team_leader_id = auth.uid()
);

DROP POLICY IF EXISTS "Daily report workers manageable by team leads and managers" ON public.daily_report_workers;
CREATE POLICY "Daily report workers manageable by team leads and managers"
ON public.daily_report_workers FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_workers.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

DROP POLICY IF EXISTS "Daily report tasks manageable by team leads and managers" ON public.daily_report_tasks;
CREATE POLICY "Daily report tasks manageable by team leads and managers"
ON public.daily_report_tasks FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_tasks.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

DROP POLICY IF EXISTS "Daily report materials manageable by team leads and managers" ON public.daily_report_materials;
CREATE POLICY "Daily report materials manageable by team leads and managers"
ON public.daily_report_materials FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_materials.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

-- 8. Stock & Stock Movements Policies
DROP POLICY IF EXISTS "Site stock viewable by authenticated site users" ON public.site_stock;
CREATE POLICY "Site stock viewable by authenticated site users"
ON public.site_stock FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

DROP POLICY IF EXISTS "Stock movements viewable by managers and admins" ON public.stock_movements;
CREATE POLICY "Stock movements viewable by managers and admins"
ON public.stock_movements FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

DROP POLICY IF EXISTS "Stock movements insertable by authorized field leaders and managers" ON public.stock_movements;
CREATE POLICY "Stock movements insertable by authorized field leaders and managers"
ON public.stock_movements FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND public.has_site_access(site_id)
);

-- 9. Audit Logs Policies
DROP POLICY IF EXISTS "Audit logs viewable by admins only" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by admins only"
ON public.audit_logs FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Audit logs insertable by system/authenticated operations" ON public.audit_logs;
CREATE POLICY "Audit logs insertable by system/authenticated operations"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');


-- ====================================================================
-- SECTION 3/9 - 03_seed_data.sql
-- ====================================================================

-- ====================================================================
-- Solar Site Management App — Seed Data & Demo Scenarios
-- Migration: 03_seed_data.sql
-- ====================================================================

-- 1. Demo Sites
INSERT INTO public.sites (id, name, code, address, latitude, longitude, geofence_radius_meters, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Parc Solar Craiova Sud', 'PV-CR-01', 'DJ552B, Craiova, Dolj', 44.2981, 23.8122, 350, true),
    ('22222222-2222-2222-2222-222222222222', 'Parc Solar Brașov Est', 'PV-BV-02', 'DN11, Hărman, Brașov', 45.7125, 25.6841, 400, true),
    ('33333333-3333-3333-3333-333333333333', 'Depozit Central Logistic', 'DEP-CENTRAL', 'Șos. Centurii 45, Ilfov', 44.4712, 26.0211, 200, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Demo Materials Catalog
INSERT INTO public.materials (id, code, name, unit, barcode, category, min_stock_threshold)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PAN-550W', 'Panou Fotovoltaic Monocristalin 550W', 'buc', '5941234560012', 'Panouri Solare', 20),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CAB-SOL-6', 'Cablu Solar Negru 6mm²', 'm', '5941234560029', 'Cabluri & Conexiuni', 500),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'MC4-SET', 'Set Conectori MC4 Tata/Mama', 'set', '5941234560036', 'Cabluri & Conexiuni', 100),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'STR-ALU-PROF', 'Profil Aluminiu Structura 4.2m', 'buc', '5941234560043', 'Structura & Montaj', 30),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GARD-150M', 'Gard Împrejmuire Șantier 150m', 'buc', '5941234560050', 'Protecție & Perimetru', 2),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'INV-100KW', 'Invertor Trifazat 100kW On-Grid', 'buc', '5941234560067', 'Invertoare', 2)
ON CONFLICT (code) DO NOTHING;


-- ====================================================================
-- SECTION 4/9 - 04a_auth_expenses.sql
-- ====================================================================

-- Migration 04a: Phase 1 (Auth) + Phase 6 (Expenses) tables
DO $$ BEGIN CREATE TYPE account_application_status_enum AS ENUM ('pending','approved','rejected','correction_requested'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE expense_status_enum AS ENUM ('draft','submitted','under_review','approved','rejected','needs_correction','reimbursement_pending','reimbursed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE expense_category_enum AS ENUM ('fuel','accommodation','food','transport','parking','tolls','materials','tools','equipment','phone_internet','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_method_enum AS ENUM ('personal','company_card','company_cash','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE document_type_enum AS ENUM ('bon_fiscal','factura','receipt','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.account_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL,
    employee_code TEXT,
    requested_role user_role_enum NOT NULL DEFAULT 'worker',
    requested_site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    requested_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    status account_application_status_enum NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ, rejection_reason TEXT, correction_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
    category expense_category_enum NOT NULL,
    status expense_status_enum NOT NULL DEFAULT 'draft',
    document_type document_type_enum NOT NULL DEFAULT 'receipt',
    payment_method payment_method_enum NOT NULL DEFAULT 'personal',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    reimbursable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON',
    receipt_photo_url TEXT, ocr_result JSONB,
    description TEXT, notes TEXT, mileage NUMERIC(8,2),
    vehicle TEXT, participants JSONB, related_work_order TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ, rejection_reason TEXT, correction_notes TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    document_type document_type_enum NOT NULL DEFAULT 'receipt',
    original_image_url TEXT NOT NULL, thumbnail_url TEXT,
    ocr_result JSONB, corrected_values JSONB, approval_status TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    approver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('approved','rejected','correction_requested')),
    reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reimbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reimbursed')),
    reimbursement_date TIMESTAMPTZ, payment_method TEXT,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reference_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_account_applications_updated_at ON public.account_applications;
CREATE TRIGGER trg_account_applications_updated_at BEFORE UPDATE ON public.account_applications FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
DROP TRIGGER IF EXISTS trg_reimbursements_updated_at ON public.reimbursements;
CREATE TRIGGER trg_reimbursements_updated_at BEFORE UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_site ON public.expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_expense_docs_exp ON public.expense_documents(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_appr_exp ON public.expense_approvals(expense_id);


-- ====================================================================
-- SECTION 5/9 - 04b_notifications_stock.sql
-- ====================================================================

-- Migration 04b: Phase 7 (Notifications) + Phase 5 (Warehouses) + schema extensions

DO $$ BEGIN CREATE TYPE site_status_enum AS ENUM ('planned','active','paused','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE stock_receipt_status_enum AS ENUM ('draft','submitted','review','approved','stock_posted'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Notifications (Spec 32-34)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title_ro TEXT NOT NULL, title_en TEXT NOT NULL,
    body_ro TEXT NOT NULL, body_en TEXT NOT NULL,
    entity_type TEXT, entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE, read_at TIMESTAMPTZ,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
    action_url TEXT, metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Warehouses (Spec 20)
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    address TEXT,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site Assignments (Spec 31)
CREATE TABLE IF NOT EXISTS public.site_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL DEFAULT 'worker',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema extensions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'ro';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS status site_status_enum DEFAULT 'active';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS expected_end_date DATE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS project_code TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS description TEXT;

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_assign_user ON public.site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assign_site ON public.site_assignments(site_id);


-- ====================================================================
-- SECTION 6/9 - 04c_rls_new_tables.sql
-- ====================================================================

-- Migration 04c: RLS policies for new tables

ALTER TABLE public.account_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_assignments ENABLE ROW LEVEL SECURITY;

-- Account Applications: anyone can insert, only admin can view/update
DROP POLICY IF EXISTS "Anyone can submit applications" ON public.account_applications;
CREATE POLICY "Anyone can submit applications" ON public.account_applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can view all applications" ON public.account_applications;
CREATE POLICY "Admin can view all applications" ON public.account_applications FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users can view own applications" ON public.account_applications;
CREATE POLICY "Users can view own applications" ON public.account_applications FOR SELECT USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Admin can update applications" ON public.account_applications;
CREATE POLICY "Admin can update applications" ON public.account_applications FOR UPDATE USING (public.is_admin());

-- Expenses: owner can view/insert, admin/manager can view all
DROP POLICY IF EXISTS "Users view own expenses" ON public.expenses;
CREATE POLICY "Users view own expenses" ON public.expenses FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Managers view site expenses" ON public.expenses;
CREATE POLICY "Managers view site expenses" ON public.expenses FOR SELECT USING (public.has_site_access(site_id));
DROP POLICY IF EXISTS "Admin view all expenses" ON public.expenses;
CREATE POLICY "Admin view all expenses" ON public.expenses FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users insert own expenses" ON public.expenses;
CREATE POLICY "Users insert own expenses" ON public.expenses FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own draft expenses" ON public.expenses;
CREATE POLICY "Users update own draft expenses" ON public.expenses FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');
DROP POLICY IF EXISTS "Admin manage all expenses" ON public.expenses;
CREATE POLICY "Admin manage all expenses" ON public.expenses FOR ALL USING (public.is_admin());

-- Expense Documents: follow expense visibility
DROP POLICY IF EXISTS "View expense docs by expense access" ON public.expense_documents;
CREATE POLICY "View expense docs by expense access" ON public.expense_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_documents.expense_id AND (expenses.user_id = auth.uid() OR public.is_manager_or_admin()))
);
DROP POLICY IF EXISTS "Insert expense docs by authenticated" ON public.expense_documents;
CREATE POLICY "Insert expense docs by authenticated" ON public.expense_documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Expense Approvals: admin/manager can insert
DROP POLICY IF EXISTS "View expense approvals" ON public.expense_approvals;
CREATE POLICY "View expense approvals" ON public.expense_approvals FOR SELECT USING (public.is_manager_or_admin());
DROP POLICY IF EXISTS "Insert expense approvals" ON public.expense_approvals;
CREATE POLICY "Insert expense approvals" ON public.expense_approvals FOR INSERT WITH CHECK (public.is_manager_or_admin());

-- Reimbursements: admin can manage, users view own
DROP POLICY IF EXISTS "Admin manage reimbursements" ON public.reimbursements;
CREATE POLICY "Admin manage reimbursements" ON public.reimbursements FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Users view own reimbursements" ON public.reimbursements;
CREATE POLICY "Users view own reimbursements" ON public.reimbursements FOR SELECT USING (user_id = auth.uid());

-- Notifications: recipient can view/update own
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
CREATE POLICY "System insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (recipient_user_id = auth.uid());

-- Warehouses: authenticated can view, admin/manager can manage
DROP POLICY IF EXISTS "Authenticated view warehouses" ON public.warehouses;
CREATE POLICY "Authenticated view warehouses" ON public.warehouses FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin manage warehouses" ON public.warehouses;
CREATE POLICY "Admin manage warehouses" ON public.warehouses FOR ALL USING (public.is_manager_or_admin());

-- Site Assignments: view by site access, admin manage
DROP POLICY IF EXISTS "View assignments by site access" ON public.site_assignments;
CREATE POLICY "View assignments by site access" ON public.site_assignments FOR SELECT USING (public.has_site_access(site_id) OR public.is_admin());
DROP POLICY IF EXISTS "Admin manage assignments" ON public.site_assignments;
CREATE POLICY "Admin manage assignments" ON public.site_assignments FOR ALL USING (public.is_admin());


-- ====================================================================
-- SECTION 7/9 - 04d_auth_trigger.sql
-- ====================================================================

-- Migration 04d: Auth trigger to auto-create profiles + helper functions for RLS
-- These functions are referenced by RLS policies in 02_row_level_security.sql and 04c_rls_new_tables.sql

-- ============================================================================
-- 1. Trigger function: auto-create a profile row when a new user signs up
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, phone_number)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'name', ''),
            split_part(COALESCE(NEW.email, ''), '@', 1),
            'Utilizator'
        ),
        CASE
            WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'manager', 'team_leader', 'worker')
                THEN (NEW.raw_user_meta_data->>'role')::user_role_enum
            ELSE 'worker'::user_role_enum
        END,
        NULLIF(NEW.raw_user_meta_data->>'phone_number', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. Helper functions for RLS policies (safety net if 02 migration wasn't applied)
-- ============================================================================

-- Returns the current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role_enum AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager') AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user has access to a specific site
CREATE OR REPLACE FUNCTION public.has_site_access(target_site_id UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_admin() OR EXISTS (
        SELECT 1 FROM public.user_site_assignments
        WHERE user_id = auth.uid() AND site_id = target_site_id
    ) OR EXISTS (
        SELECT 1 FROM public.sites
        WHERE id = target_site_id AND manager_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. Updated_at trigger function (safety net if not already created)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ====================================================================
-- SECTION 8/9 - 05_self_approval_prevention.sql
-- ====================================================================

-- ============================================================================
-- 05_self_approval_prevention.sql
-- Prevents users from approving their own expenses and their own daily reports
-- ============================================================================

-- Function to prevent self-approval on expenses
CREATE OR REPLACE FUNCTION prevent_self_approval_expense()
RETURNS TRIGGER AS $$
DECLARE
  expense_owner UUID;
BEGIN
  -- Get the user_id who owns the expense
  SELECT user_id INTO expense_owner FROM expenses WHERE id = NEW.expense_id;

  -- If the actor is the expense owner, prevent the action
  IF expense_owner = NEW.approver_user_id THEN
    RAISE EXCEPTION 'Cannot approve/reject your own expense. Self-approval is forbidden (Spec §49 Rule 5).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on expense_approvals table
DROP TRIGGER IF EXISTS trg_prevent_self_approval_expense ON expense_approvals;
CREATE TRIGGER trg_prevent_self_approval_expense
  BEFORE INSERT ON expense_approvals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_approval_expense();

-- Function to prevent self-approval on daily reports
CREATE OR REPLACE FUNCTION prevent_self_approval_report()
RETURNS TRIGGER AS $$
DECLARE
  report_owner UUID;
BEGIN
  -- Get the team_leader_id who owns the report
  SELECT team_leader_id INTO report_owner FROM daily_reports WHERE id = NEW.report_id;

  -- If the actor is the report owner, prevent the action
  IF report_owner = NEW.actor_user_id THEN
    RAISE EXCEPTION 'Cannot approve/reject your own daily report. Self-approval is forbidden.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on daily_report_approvals table (if it exists)
-- Note: daily_report_approvals may not exist yet; this is future-proofing
-- DROP TRIGGER IF EXISTS trg_prevent_self_approval_report ON daily_report_approvals;
-- CREATE TRIGGER trg_prevent_self_approval_report
--   BEFORE INSERT ON daily_report_approvals
--   FOR EACH ROW
--   EXECUTE FUNCTION prevent_self_approval_report();

-- The self-approval rule above is enforced by the trigger (a CHECK constraint cannot
-- reference other rows). No additional constraint expression is needed here.
-- (Removed the previous no-op CHECK (TRUE) constraint.)

COMMENT ON FUNCTION prevent_self_approval_expense IS 'Prevents users from approving/rejecting their own expenses per Spec §49 Rule 5.';
COMMENT ON FUNCTION prevent_self_approval_report IS 'Prevents team leaders from approving their own daily reports.';


-- ====================================================================
-- SECTION 9/9 - 06_event_notifications.sql
-- ====================================================================

-- ============================================================================
-- 06_event_notifications.sql
-- Event-driven notifications for key workflow actions
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID, p_title_ro TEXT, p_title_en TEXT,
  p_body_ro TEXT, p_body_en TEXT, p_type TEXT,
  p_priority TEXT DEFAULT 'normal', p_action_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (recipient_user_id, title_ro, title_en, body_ro, body_en, type, priority, action_url, is_read, created_at)
  VALUES (p_user_id, p_title_ro, p_title_en, p_body_ro, p_body_en, p_type, p_priority, p_action_url, FALSE, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Expense submitted
CREATE OR REPLACE FUNCTION notify_expense_submitted() RETURNS TRIGGER AS $$
DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM profiles WHERE role IN ('manager','admin') AND is_active = TRUE LOOP
    PERFORM create_notification(r.id, 'Cheltuiala noua trimisa', 'New expense submitted',
      NEW.description || ' (' || NEW.amount || ' ' || NEW.currency || ')',
      NEW.description || ' (' || NEW.amount || ' ' || NEW.currency || ')',
      'expense_submitted', 'normal', '/aprobare');
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_expense_submitted ON expenses;
CREATE TRIGGER trg_notify_expense_submitted AFTER INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION notify_expense_submitted();

-- 2. Expense approved/rejected
CREATE OR REPLACE FUNCTION notify_expense_approved() RETURNS TRIGGER AS $$
DECLARE exp_owner UUID; BEGIN
  IF NEW.action IN ('approved','rejected') THEN
    SELECT user_id INTO exp_owner FROM expenses WHERE id = NEW.expense_id;
    IF exp_owner IS NOT NULL AND exp_owner != NEW.approver_user_id THEN
      PERFORM create_notification(exp_owner,
        CASE WHEN NEW.action='approved' THEN 'Cheltuiala aprobata' ELSE 'Cheltuiala respinsa' END,
        CASE WHEN NEW.action='approved' THEN 'Expense approved' ELSE 'Expense rejected' END,
        'Cheltuiala a fost ' || CASE WHEN NEW.action='approved' THEN 'aprobata' ELSE 'respinsa' END,
        'Expense has been ' || CASE WHEN NEW.action='approved' THEN 'approved' ELSE 'rejected' END,
        'expense_' || NEW.action, 'normal', '/cheltuieli');
    END IF;
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_expense_approved ON expense_approvals;
CREATE TRIGGER trg_notify_expense_approved AFTER INSERT ON expense_approvals FOR EACH ROW EXECUTE FUNCTION notify_expense_approved();

-- 3. Daily report submitted
CREATE OR REPLACE FUNCTION notify_daily_report_submitted() RETURNS TRIGGER AS $$
DECLARE r RECORD; site_name TEXT; BEGIN
  SELECT name INTO site_name FROM sites WHERE id = NEW.site_id;
  FOR r IN SELECT id FROM profiles WHERE role IN ('manager','admin') AND is_active = TRUE LOOP
    PERFORM create_notification(r.id, 'Raport zilnic trimis', 'Daily report submitted',
      'Raport de la ' || (SELECT full_name FROM profiles WHERE id = NEW.team_leader_id) || ' pe ' || COALESCE(site_name,'Santier'),
      'Report from ' || (SELECT full_name FROM profiles WHERE id = NEW.team_leader_id) || ' at ' || COALESCE(site_name,'Unknown site'),
      'daily_report_submitted', 'normal', '/rapoarte');
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_daily_report_submitted ON daily_reports;
CREATE TRIGGER trg_notify_daily_report_submitted AFTER INSERT ON daily_reports FOR EACH ROW EXECUTE FUNCTION notify_daily_report_submitted();

-- 4. Delivery note received
CREATE OR REPLACE FUNCTION notify_delivery_received() RETURNS TRIGGER AS $$
DECLARE r RECORD; site_name TEXT; BEGIN
  SELECT name INTO site_name FROM sites WHERE id = NEW.site_id;
  FOR r IN SELECT id FROM profiles WHERE role IN ('manager','admin','team_leader') AND is_active = TRUE LOOP
    PERFORM create_notification(r.id, 'Aviz receptionat', 'Delivery received',
      'Aviz ' || NEW.invoice_or_aviz_number || ' pe ' || COALESCE(site_name,'Santier'),
      'Delivery ' || NEW.invoice_or_aviz_number || ' at ' || COALESCE(site_name,'site'),
      'delivery_received', 'normal', '/avize');
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_delivery_received ON delivery_notes;
CREATE TRIGGER trg_notify_delivery_received AFTER INSERT ON delivery_notes FOR EACH ROW EXECUTE FUNCTION notify_delivery_received();

-- 5. Low stock alert
CREATE OR REPLACE FUNCTION notify_low_stock() RETURNS TRIGGER AS $$
DECLARE r RECORD; mat_name TEXT; site_name TEXT; cur_qty NUMERIC; min_qty NUMERIC; BEGIN
  IF NEW.quantity >= 0 THEN RETURN NEW; END IF;
  SELECT name INTO mat_name FROM materials WHERE id = NEW.material_id;
  SELECT name INTO site_name FROM sites WHERE id = NEW.site_id;
  SELECT ss.current_quantity, m.min_stock_threshold
    INTO cur_qty, min_qty
    FROM site_stock ss
    JOIN materials m ON m.id = ss.material_id
   WHERE ss.site_id = NEW.site_id AND ss.material_id = NEW.material_id;
  IF cur_qty IS NOT NULL AND min_qty IS NOT NULL AND cur_qty <= min_qty THEN
    FOR r IN SELECT id FROM profiles WHERE role IN ('manager','admin','team_leader') AND is_active = TRUE LOOP
      PERFORM create_notification(r.id, 'Stoc critic: ' || mat_name, 'Critical stock: ' || mat_name,
        'Materialul ' || mat_name || ' pe ' || COALESCE(site_name,'Santier') || ' a atins ' || cur_qty || ' (min: ' || min_qty || ')',
        mat_name || ' at ' || COALESCE(site_name,'site') || ' reached ' || cur_qty || ' (min: ' || min_qty || ')',
        'stock_critical', 'high', '/stocuri');
    END LOOP;
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_low_stock ON stock_movements;
CREATE TRIGGER trg_notify_low_stock AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION notify_low_stock();

-- 6. New account application
CREATE OR REPLACE FUNCTION notify_account_application() RETURNS TRIGGER AS $$
DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM profiles WHERE role = 'admin' AND is_active = TRUE LOOP
    PERFORM create_notification(r.id, 'Solicitare cont nou', 'New account application',
      NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.email || ') - ' || NEW.requested_role,
      NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.email || ') requested ' || NEW.requested_role,
      'account_application', 'high', '/aprobare');
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_account_application ON account_applications;
CREATE TRIGGER trg_notify_account_application AFTER INSERT ON account_applications FOR EACH ROW EXECUTE FUNCTION notify_account_application();

-- 7. Account application result
CREATE OR REPLACE FUNCTION notify_account_application_result() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved','rejected') AND OLD.status = 'pending' AND NEW.user_id IS NOT NULL THEN
    -- Notify the applicant (account_applications.user_id links the application to the auth user;
    -- guard above prevents a NOT NULL violation when the application has no linked user yet).
    PERFORM create_notification(NEW.user_id,
      CASE WHEN NEW.status='approved' THEN 'Cont aprobat' ELSE 'Cont respins' END,
      CASE WHEN NEW.status='approved' THEN 'Account approved' ELSE 'Account rejected' END,
      'Cererea a fost ' || CASE WHEN NEW.status='approved' THEN 'aprobata' ELSE 'respinsa' END,
      'Application was ' || CASE WHEN NEW.status='approved' THEN 'approved' ELSE 'rejected' END,
      'account_application_' || NEW.status, 'normal', '/login');
  END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_notify_account_application_result ON account_applications;
CREATE TRIGGER trg_notify_account_application_result AFTER UPDATE ON account_applications FOR EACH ROW EXECUTE FUNCTION notify_account_application_result();

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION notify_expense_submitted TO authenticated;
GRANT EXECUTE ON FUNCTION notify_expense_approved TO authenticated;
GRANT EXECUTE ON FUNCTION notify_daily_report_submitted TO authenticated;
GRANT EXECUTE ON FUNCTION notify_delivery_received TO authenticated;
GRANT EXECUTE ON FUNCTION notify_low_stock TO authenticated;
GRANT EXECUTE ON FUNCTION notify_account_application TO authenticated;
GRANT EXECUTE ON FUNCTION notify_account_application_result TO authenticated;

-- ====================================================================
-- SECTION 10/10 - 07_expense_documents_storage.sql
-- HIIEKO Camera/OCR workflow: private storage bucket + metadata columns.
-- IDEMPOTENT / NON-DESTRUCTIVE. Safe to run again (no changes 2nd run).
-- ====================================================================

-- 1) Private storage bucket for original expense documents.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-documents', 'expense-documents', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 2) Storage RLS policies (bucket-scoped). Uses public.is_manager_or_admin().
DROP POLICY IF EXISTS "expense_docs_owner_select" ON storage.objects;
CREATE POLICY "expense_docs_owner_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents' AND (auth.uid() = owner OR public.is_manager_or_admin()));

DROP POLICY IF EXISTS "expense_docs_owner_insert" ON storage.objects;
CREATE POLICY "expense_docs_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "expense_docs_owner_update" ON storage.objects;
CREATE POLICY "expense_docs_owner_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'expense-documents' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'expense-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "expense_docs_owner_delete" ON storage.objects;
CREATE POLICY "expense_docs_owner_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'expense-documents' AND auth.uid() = owner);

-- 3) Additive metadata columns on expense_documents (scan pipeline).
ALTER TABLE public.expense_documents
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'expense-documents',
    ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS ocr_provider TEXT,
    ADD COLUMN IF NOT EXISTS low_confidence_fields JSONB;

CREATE INDEX IF NOT EXISTS idx_expense_docs_uploaded_by ON public.expense_documents(uploaded_by);

-- SECTION 11/11 - Self-hosted PaddleOCR document states
ALTER TABLE public.expense_documents
    ADD COLUMN IF NOT EXISTS document_state TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (document_state IN ('uploaded', 'processing', 'ocr_completed', 'needs_review', 'confirmed', 'posted', 'failed')),
    ADD COLUMN IF NOT EXISTS raw_ocr_result JSONB,
    ADD COLUMN IF NOT EXISTS normalized_fields JSONB,
    ADD COLUMN IF NOT EXISTS employee_corrections JSONB,
    ADD COLUMN IF NOT EXISTS processing_error TEXT,
    ADD COLUMN IF NOT EXISTS correlation_id TEXT,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_docs_state ON public.expense_documents(document_state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_docs_hash
    ON public.expense_documents ((normalized_fields->>'document_hash'))
    WHERE normalized_fields->>'document_hash' IS NOT NULL;
