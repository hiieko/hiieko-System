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

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER trg_account_applications_updated_at BEFORE UPDATE ON public.account_applications FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER trg_reimbursements_updated_at BEFORE UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_site ON public.expenses(site_id);
CREATE INDEX IF NOT EXISTS idx_expense_docs_exp ON public.expense_documents(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_appr_exp ON public.expense_approvals(expense_id);
