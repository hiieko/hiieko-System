-- Slice 1 (SEC-001 / SEC-003, account lifecycle) — additive only.
-- Adds a first-class account status enum alongside the legacy `is_active` flag.
-- The `ACTIVE` default backfills every existing row, so no data is mutated and
-- all 21 existing users (with their password hashes) stay ACTIVE.

-- CreateEnum
CREATE TYPE "UserStatusEnum" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatusEnum" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");