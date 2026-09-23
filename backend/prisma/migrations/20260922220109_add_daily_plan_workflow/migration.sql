-- CreateEnum
CREATE TYPE "DailyPlanStatusEnum" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "daily_plan_tasks" ADD COLUMN     "actual_quantity" DECIMAL(12,3),
ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "daily_plans" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "status" "DailyPlanStatusEnum" NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
