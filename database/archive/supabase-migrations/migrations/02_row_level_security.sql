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
CREATE POLICY "Profiles viewable by self and managers/admins"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_manager_or_admin());

CREATE POLICY "Profiles editable by admins only"
ON public.profiles FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Profiles insertable by admins or triggers"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin() OR auth.uid() = id);

-- 3. Sites Policies
CREATE POLICY "Active sites viewable by authenticated active users"
ON public.sites FOR SELECT
USING (auth.role() = 'authenticated' AND (is_active = TRUE OR public.is_manager_or_admin()));

CREATE POLICY "Sites manageable by admins only"
ON public.sites FOR ALL
USING (public.is_admin());

-- 4. User Site Assignments Policies
CREATE POLICY "Assignments viewable by self or site access"
ON public.user_site_assignments FOR SELECT
USING (auth.uid() = user_id OR public.has_site_access(site_id) OR public.is_admin());

CREATE POLICY "Assignments manageable by admins only"
ON public.user_site_assignments FOR ALL
USING (public.is_admin());

-- 5. Teams Policies
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

CREATE POLICY "Teams manageable by admins only"
ON public.teams FOR ALL
USING (public.is_admin());

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

CREATE POLICY "Team members manageable by admins only"
ON public.team_members FOR ALL
USING (public.is_admin());

-- 4. Time Logs (Pontaj) Policies
CREATE POLICY "Time logs viewable by owner or site managers/admins"
ON public.time_logs FOR SELECT
USING (
    auth.uid() = user_id 
    OR public.has_site_access(site_id)
    OR public.is_admin()
);

CREATE POLICY "Time logs creatable by worker for self"
ON public.time_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id 
    OR public.is_manager_or_admin()
);

CREATE POLICY "Time logs updatable by worker for check_out or managers"
ON public.time_logs FOR UPDATE
USING (
    (auth.uid() = user_id AND check_out IS NULL) 
    OR public.is_manager_or_admin()
);

-- 5. Materials Catalog Policies
CREATE POLICY "Materials readable by all authenticated users"
ON public.materials FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Materials manageable by managers and admins"
ON public.materials FOR ALL
USING (public.is_manager_or_admin());

-- 6. Delivery Notes (Avize) Policies
CREATE POLICY "Delivery notes viewable by site managers, team leads and admins"
ON public.delivery_notes FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

CREATE POLICY "Delivery notes insertable by team leads and managers"
ON public.delivery_notes FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND public.has_site_access(site_id)
);

CREATE POLICY "Delivery note items readable if note accessible"
ON public.delivery_note_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.delivery_notes 
        WHERE delivery_notes.id = delivery_note_items.delivery_note_id
        AND (public.has_site_access(delivery_notes.site_id) OR public.is_admin())
    )
);

CREATE POLICY "Delivery note items insertable by team leads/managers"
ON public.delivery_note_items FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
);

-- 7. Daily Reports Policies
CREATE POLICY "Daily reports readable by team members, team leads, and managers"
ON public.daily_reports FOR SELECT
USING (
    team_leader_id = auth.uid()
    OR public.has_site_access(site_id)
    OR public.is_admin()
);

CREATE POLICY "Daily reports creatable by team leaders and managers"
ON public.daily_reports FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND team_leader_id = auth.uid()
);

CREATE POLICY "Daily report workers manageable by team leads and managers"
ON public.daily_report_workers FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_workers.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

CREATE POLICY "Daily report tasks manageable by team leads and managers"
ON public.daily_report_tasks FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_tasks.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

CREATE POLICY "Daily report materials manageable by team leads and managers"
ON public.daily_report_materials FOR ALL
USING (EXISTS (SELECT 1 FROM public.daily_reports WHERE daily_reports.id = daily_report_materials.daily_report_id AND (daily_reports.team_leader_id = auth.uid() OR public.is_manager_or_admin())));

-- 8. Stock & Stock Movements Policies
CREATE POLICY "Site stock viewable by authenticated site users"
ON public.site_stock FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

CREATE POLICY "Stock movements viewable by managers and admins"
ON public.stock_movements FOR SELECT
USING (public.has_site_access(site_id) OR public.is_admin());

CREATE POLICY "Stock movements insertable by authorized field leaders and managers"
ON public.stock_movements FOR INSERT
WITH CHECK (
    public.get_auth_user_role() IN ('admin', 'manager', 'team_leader')
    AND public.has_site_access(site_id)
);

-- 9. Audit Logs Policies
CREATE POLICY "Audit logs viewable by admins only"
ON public.audit_logs FOR SELECT
USING (public.is_admin());

CREATE POLICY "Audit logs insertable by system/authenticated operations"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
