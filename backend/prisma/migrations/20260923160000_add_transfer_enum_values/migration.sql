-- ============================================================================
-- HIIEKO R2.3 — Add TRANSFER_IN/TRANSFER_OUT enum values
-- Migration: 20260923160000_add_transfer_enum_values
--
-- These must be a separate migration because PostgreSQL forbids using a
-- newly added enum value in the same transaction that adds it, and Prisma
-- wraps each migration directory in a single transaction.
-- ============================================================================

ALTER TYPE "StockMovementTypeEnum" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "StockMovementTypeEnum" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
