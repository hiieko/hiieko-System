-- DropIndex
DROP INDEX "idx_aviz_items_aviz_id";

-- DropIndex
DROP INDEX "idx_aviz_items_material_id";

-- DropIndex
DROP INDEX "idx_stock_balances_material_id";

-- DropIndex
DROP INDEX "idx_stock_balances_project_id";

-- DropIndex
DROP INDEX "idx_stock_movements_created_by";

-- DropIndex
DROP INDEX "idx_stock_movements_movement_type";

-- DropIndex
DROP INDEX "idx_stock_movements_project_id";

-- DropIndex
DROP INDEX "idx_stock_movements_reference";

-- AlterTable
ALTER TABLE "daily_reports" ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "revision_number" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "daily_report_approvals" (
    "id" TEXT NOT NULL,
    "daily_report_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_revisions" (
    "id" TEXT NOT NULL,
    "daily_report_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_report_approvals_daily_report_id_idx" ON "daily_report_approvals"("daily_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_revisions_daily_report_id_revision_number_key" ON "daily_report_revisions"("daily_report_id", "revision_number");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_approvals" ADD CONSTRAINT "daily_report_approvals_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_approvals" ADD CONSTRAINT "daily_report_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_revisions" ADD CONSTRAINT "daily_report_revisions_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_revisions" ADD CONSTRAINT "daily_report_revisions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
