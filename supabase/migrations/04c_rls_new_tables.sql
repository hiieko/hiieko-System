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
CREATE POLICY "Anyone can submit applications" ON public.account_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can view all applications" ON public.account_applications FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can view own applications" ON public.account_applications FOR SELECT USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Admin can update applications" ON public.account_applications FOR UPDATE USING (public.is_admin());

-- Expenses: owner can view/insert, admin/manager can view all
CREATE POLICY "Users view own expenses" ON public.expenses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Managers view site expenses" ON public.expenses FOR SELECT USING (public.has_site_access(site_id));
CREATE POLICY "Admin view all expenses" ON public.expenses FOR SELECT USING (public.is_admin());
CREATE POLICY "Users insert own expenses" ON public.expenses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own draft expenses" ON public.expenses FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');
CREATE POLICY "Admin manage all expenses" ON public.expenses FOR ALL USING (public.is_admin());

-- Expense Documents: follow expense visibility
CREATE POLICY "View expense docs by expense access" ON public.expense_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expenses WHERE expenses.id = expense_documents.expense_id AND (expenses.user_id = auth.uid() OR public.is_manager_or_admin()))
);
CREATE POLICY "Insert expense docs by authenticated" ON public.expense_documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Expense Approvals: admin/manager can insert
CREATE POLICY "View expense approvals" ON public.expense_approvals FOR SELECT USING (public.is_manager_or_admin());
CREATE POLICY "Insert expense approvals" ON public.expense_approvals FOR INSERT WITH CHECK (public.is_manager_or_admin());

-- Reimbursements: admin can manage, users view own
CREATE POLICY "Admin manage reimbursements" ON public.reimbursements FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own reimbursements" ON public.reimbursements FOR SELECT USING (user_id = auth.uid());

-- Notifications: recipient can view/update own
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (recipient_user_id = auth.uid());
CREATE POLICY "System insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (recipient_user_id = auth.uid());

-- Warehouses: authenticated can view, admin/manager can manage
CREATE POLICY "Authenticated view warehouses" ON public.warehouses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage warehouses" ON public.warehouses FOR ALL USING (public.is_manager_or_admin());

-- Site Assignments: view by site access, admin manage
CREATE POLICY "View assignments by site access" ON public.site_assignments FOR SELECT USING (public.has_site_access(site_id) OR public.is_admin());
CREATE POLICY "Admin manage assignments" ON public.site_assignments FOR ALL USING (public.is_admin());
