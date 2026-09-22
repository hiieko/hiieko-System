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