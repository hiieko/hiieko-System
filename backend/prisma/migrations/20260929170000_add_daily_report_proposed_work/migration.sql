-- ISSUE-048 - Daily Report: "Proposed Work" is a concept DISTINCT from "Execution / General Notes".
-- Additive, nullable and non-destructive: existing rows keep their general_notes value untouched
-- and get proposed_work = NULL. No historical text is moved or guessed.

-- AlterTable
ALTER TABLE "daily_reports" ADD COLUMN     "proposed_work" TEXT;