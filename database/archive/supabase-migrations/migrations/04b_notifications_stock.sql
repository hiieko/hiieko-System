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

CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_assign_user ON public.site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assign_site ON public.site_assignments(site_id);
