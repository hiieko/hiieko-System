-- Slice 5 — AttendanceCorrection audit-integrity hardening (additive).
--
-- The AttendanceCorrection model was introduced in the schema without a
-- matching migration, so this migration:
--   1. Creates the attendance_corrections table (if it does not yet exist),
--      with the Restrict FK to attendance_records from the start (Slice 5):
--      a corrected record must never be silently deleted, preserving the
--      audit trail.
--   2. Adds an index on attendance_corrections(attendance_id) so the
--      per-record correction history lookup stays cheap.
--
-- Idempotent: the table + FK + index are guarded with IF NOT EXISTS so the
-- migration is safe to re-run on a database that already has them.

-- CreateTable: attendance_corrections
CREATE TABLE IF NOT EXISTS "attendance_corrections" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "corrected_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before_state" JSONB NOT NULL,
    "after_state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- FK: AttendanceCorrection -> AttendanceRecord, ON DELETE RESTRICT (Slice 5).
-- Drop first (in case a CASCADE version exists from a prior partial apply),
-- then (re)create as RESTRICT.
ALTER TABLE "attendance_corrections" DROP CONSTRAINT IF EXISTS "attendance_corrections_attendance_id_fkey";

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_id_fkey"
  FOREIGN KEY ("attendance_id") REFERENCES "attendance_records"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: AttendanceCorrection.corrected_by -> users (default RESTRICT).
ALTER TABLE "attendance_corrections" DROP CONSTRAINT IF EXISTS "attendance_corrections_corrected_by_fkey";

ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_corrected_by_fkey"
  FOREIGN KEY ("corrected_by") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index for the per-record correction history lookup.
CREATE INDEX IF NOT EXISTS "attendance_corrections_attendance_id_idx"
  ON "attendance_corrections"("attendance_id");
