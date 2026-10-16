-- Fix orphan attendance check-ins: close any record that has a check-in
-- time but no check-out time by setting check-out 8 hours after check-in.
UPDATE attendance_records
SET check_out_time = check_in_time + INTERVAL '8 hours'
WHERE check_in_time IS NOT NULL
  AND check_out_time IS NULL;
