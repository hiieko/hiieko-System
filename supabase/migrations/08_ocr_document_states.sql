-- Additive metadata for the self-hosted PaddleOCR/e-Factura pipeline.
ALTER TABLE public.expense_documents
  ADD COLUMN IF NOT EXISTS document_state TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (document_state IN ('uploaded', 'processing', 'ocr_completed', 'needs_review', 'confirmed', 'posted', 'failed')),
  ADD COLUMN IF NOT EXISTS raw_ocr_result JSONB,
  ADD COLUMN IF NOT EXISTS normalized_fields JSONB,
  ADD COLUMN IF NOT EXISTS employee_corrections JSONB,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_docs_state ON public.expense_documents(document_state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_docs_hash
  ON public.expense_documents ((normalized_fields->>'document_hash'))
  WHERE normalized_fields->>'document_hash' IS NOT NULL;
