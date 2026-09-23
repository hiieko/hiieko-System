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
