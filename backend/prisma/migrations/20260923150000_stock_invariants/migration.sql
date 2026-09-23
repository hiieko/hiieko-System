-- ============================================================================
-- HIIEKO R2.3 — Stock Invariants
-- Migration: 20260923150000_stock_invariants
-- 
-- 1. CHECK constraint on stock_balances (non-negative quantity)
--    Note: The target-schema had chk_stock_balance_positive but Prisma's
--    initial migration silently dropped it. Re-add here.
-- 2. NULLS NOT DISTINCT unique index on stock_balances balance key
--    PostgreSQL 15+ treats NULLs as distinct by default, allowing duplicate
--    rows where project_id IS NULL AND warehouse_id IS NULL. This closes the
--    NULL-uniqueness hole (Critical finding #2).
-- 3. Per-project unique index on avize (project_id, aviz_number)
-- 4. Additional CHECK constraints: reserved_quantity >= 0,
--    reserved_quantity <= current_quantity, stock_movements.quantity > 0,
--    aviz_items.quantity > 0
-- 5. Query-performance indexes on stock_movements, stock_balances, aviz_items
-- ============================================================================

-- 1. Non-negative stock balance CHECK constraint
DO $$
BEGIN
    ALTER TABLE public.stock_balances
        ADD CONSTRAINT chk_stock_balance_positive
        CHECK (current_quantity >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. NULLS NOT DISTINCT unique index on balance key
DROP INDEX IF EXISTS idx_stock_balances_balance_key_nulls_not_distinct;
CREATE UNIQUE INDEX idx_stock_balances_balance_key_nulls_not_distinct
    ON public.stock_balances (material_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'), COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'));

-- 3. Per-project unique constraint on avize (project_id, aviz_number)
DROP INDEX IF EXISTS idx_avize_aviz_number_unique;
DROP INDEX IF EXISTS idx_avize_project_aviz_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS avize_project_id_aviz_number_key
    ON public.avize (project_id, aviz_number);

-- 4. Additional CHECK constraints
DO $$
BEGIN
    ALTER TABLE public.stock_balances
        ADD CONSTRAINT chk_stock_reserved_non_negative
        CHECK (reserved_quantity >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.stock_balances
        ADD CONSTRAINT chk_stock_reserved_lte_current
        CHECK (reserved_quantity <= current_quantity);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.stock_movements
        ADD CONSTRAINT chk_stock_movement_quantity_positive
        CHECK (quantity > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.aviz_items
        ADD CONSTRAINT chk_aviz_item_quantity_positive
        CHECK (quantity > 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. Query-performance indexes
CREATE INDEX IF NOT EXISTS idx_stock_balances_project_id
    ON public.stock_balances (project_id);

CREATE INDEX IF NOT EXISTS idx_stock_balances_material_id
    ON public.stock_balances (material_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_project_id
    ON public.stock_movements (project_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type
    ON public.stock_movements (movement_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
    ON public.stock_movements (created_by_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
    ON public.stock_movements (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_aviz_items_material_id
    ON public.aviz_items (material_id);

CREATE INDEX IF NOT EXISTS idx_aviz_items_aviz_id
    ON public.aviz_items (aviz_id);
