-- CreateEnum
CREATE TYPE "OhsRiskType" AS ENUM ('ppe', 'adverse_weather', 'procedures', 'electrical', 'tools_machinery', 'fall_height', 'other_risks');

-- AlterTable
ALTER TABLE "daily_reports" ADD COLUMN     "end_time" TEXT,
ADD COLUMN     "start_time" TEXT;

-- CreateTable
CREATE TABLE "daily_report_ohs_items" (
    "id" TEXT NOT NULL,
    "daily_report_id" TEXT NOT NULL,
    "risk_type" "OhsRiskType" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "daily_report_ohs_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "daily_report_ohs_items" ADD CONSTRAINT "daily_report_ohs_items_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
