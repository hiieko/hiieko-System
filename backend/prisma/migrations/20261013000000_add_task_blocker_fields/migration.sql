-- Phase 4 (Execution Loop): additive blocker fields on tasks.
-- No existing columns are altered; no data is rewritten (task history preserved).
-- Task.status already includes BLOCKED in TaskStatusEnum, so blocking only sets
-- blocked_reason + blocked_at alongside the existing status column.
ALTER TABLE "tasks" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "tasks" ADD COLUMN "blocked_at" TIMESTAMP(3);
