-- Slice 6 (Task Lifecycle + Verification): additive verification fields.
-- No existing columns are altered; no data is rewritten (task history preserved).
ALTER TABLE "tasks" ADD COLUMN "verified_by" TEXT;
ALTER TABLE "tasks" ADD COLUMN "verified_at" TIMESTAMP(3);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verified_by_fkey"
  FOREIGN KEY ("verified_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_verified_by_idx" ON "tasks"("verified_by");
