-- Non-unique lookup index for review-first exact-byte duplicate checks.
-- Duplicate files remain valid records; no existing rows or blobs are changed.
CREATE INDEX "document_versions_checksum_document_idx"
    ON "document_versions"("checksum", "document_id");
