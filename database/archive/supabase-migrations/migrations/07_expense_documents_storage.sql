-- ============================================================================
-- Migration 07: Expense document storage (HIIEKO Camera/OCR workflow)
--
-- FOCUSED, IDEMPOTENT, NON-DESTRUCTIVE. Adds ONLY what the scanning workflow
-- genuinely needs on top of the existing `expenses` / `expense_documents`
-- schema (which already carry `ocr_result`, `original_image_url`).
--
--   1. A private storage bucket `expense-documents` for original scans.
--   2. RLS storage policies: an employee can read/write/delete their OWN
--      documents; managers/admins can view all (matching expense visibility).
--      Documents are NOT public. No service/secret keys are involved.
--   3. Additive metadata columns on `expense_documents` for the scan pipeline.
--
-- Operator config required (Supabase dashboard, project settings):
--   - Storage -> enable RLS (on by default).
--   - The bucket is created here with `public = false`.
--   - No additional secret keys are needed for this migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Storage bucket (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-documents', 'expense-documents', FALSE, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Storage RLS policies (only for this bucket). Safe to (re)create.
--    Uses the existing helper public.is_manager_or_admin() from migration 02.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "expense_docs_owner_select" ON storage.objects;
CREATE POLICY "expense_docs_owner_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'expense-documents'
  AND (auth.uid() = owner OR public.is_manager_or_admin())
);

DROP POLICY IF EXISTS "expense_docs_owner_insert" ON storage.objects;
CREATE POLICY "expense_docs_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "expense_docs_owner_update" ON storage.objects;
CREATE POLICY "expense_docs_owner_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'expense-documents' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'expense-documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "expense_docs_owner_delete" ON storage.objects;
CREATE POLICY "expense_docs_owner_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'expense-documents' AND auth.uid() = owner);

-- ---------------------------------------------------------------------------
-- 3) Additive metadata columns on expense_documents (scan pipeline)
-- ---------------------------------------------------------------------------
ALTER TABLE public.expense_documents
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'expense-documents',
    ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS ocr_provider TEXT,
    ADD COLUMN IF NOT EXISTS low_confidence_fields JSONB;

-- Index to enforce/look up upload ownership quickly.
CREATE INDEX IF NOT EXISTS idx_expense_docs_uploaded_by ON public.expense_documents(uploaded_by);

-- ---------------------------------------------------------------------------
-- Idempotency re-run: the whole file is safe to execute again (no changes on
-- a second run because every object/column/index/policy already exists).
-- ---------------------------------------------------------------------------
