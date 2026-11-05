-- Additive document lifecycle (archive/restore). Existing rows stay active.
-- No blobs, versions, project associations or attachments are changed.
ALTER TABLE "documents" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "archived_by" TEXT;
ALTER TABLE "documents" ADD COLUMN "restored_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "restored_by" TEXT;

CREATE INDEX "documents_is_archived_updated_at_idx" ON "documents"("is_archived", "updated_at");
