-- ============================================================================
-- HIIEKO — D-012 Archival Backup of public.time_logs
-- Created: 2026-09-23 (before DROP TABLE)
-- 
-- These 3 rows were confirmed fully migrated to attendance_records
-- (see D-012 final audit). Retained here for historical/audit evidence only.
-- 
-- Run via: cd backend; npx prisma db execute --file ..\database\archive\backup_time_logs.sql
-- ============================================================================

-- Row 1 (from the audit)
INSERT INTO public.time_logs (id, user_id, site_id, date, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, normal_hours_worked, is_offline_created, idempotency_key, created_at, updated_at)
VALUES ('1384aafc-a25a-43bc-8b70-71cff947518d', 'd5b25662-e7cd-431e-8baa-59d97b5e8309', 'e788f9a1-b5c2-4d3e-8f9a-7b6c5d4e3f2a', '2026-09-23', '2026-09-23 13:06:12.07+03', '2026-09-23 13:07:23.341+03', 44.4268, 26.1021, 44.4269, 26.1022, 0.02, false, NULL, '2026-09-23 13:06:12.073+03', '2026-09-23 13:07:23.344+03');

-- Row 2
INSERT INTO public.time_logs (id, user_id, site_id, date, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, normal_hours_worked, is_offline_created, idempotency_key, created_at, updated_at)
VALUES ('c61b101b-5ea0-47ba-aa26-a61a0cf4ef46', 'd5b25662-e7cd-431e-8baa-59d97b5e8309', 'e788f9a1-b5c2-4d3e-8f9a-7b6c5d4e3f2a', '2026-09-23', '2026-09-23 13:07:47.424+03', '2026-09-23 13:08:21.596+03', 44.4268, 26.1021, 44.4268, 26.1021, 0.01, false, NULL, '2026-09-23 13:07:47.425+03', '2026-09-23 13:08:21.597+03');

-- Row 3
INSERT INTO public.time_logs (id, user_id, site_id, date, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, normal_hours_worked, is_offline_created, idempotency_key, created_at, updated_at)
VALUES ('eb48c6f0-3aec-466f-b91f-50eba2b4cf8f', 'd5b25662-e7cd-431e-8baa-59d97b5e8309', 'e788f9a1-b5c2-4d3e-8f9a-7b6c5d4e3f2a', '2026-09-23', '2026-09-23 13:08:35.416+03', '2026-09-23 13:08:48.532+03', 44.4368, 26.1021, 44.4368, 26.1021, 0, false, NULL, '2026-09-23 13:08:35.418+03', '2026-09-23 13:08:48.533+03');
