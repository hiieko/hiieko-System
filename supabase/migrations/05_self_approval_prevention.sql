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