-- D-012: Drop orphan public.time_logs table
-- 
-- Audit confirmed:
--   - 3 rows, all matched to attendance_records
--   - 0 foreign-key references from other tables
--   - 0 triggers, 0 RLS policies, 0 grants
--   - 0 active runtime consumers in backend/src, web/src, Mobile/src, shared/src
--   - Not Prisma-managed (no model in schema.prisma)
-- 
-- Backup of the 3 rows: database/archive/backup_time_logs.sql
-- ============================================================================

-- Drop the table and its dependent objects (indexes, triggers, policies)
DROP TABLE IF EXISTS public.time_logs CASCADE;
