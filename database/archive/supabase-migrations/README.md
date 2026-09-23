# HIIEKO — Archived Supabase Migration Files

These files are preserved for historical/audit evidence only.

**Original location:** `supabase/` (removed 2026-09-23 as part of D-015)

**Purpose (historical):** These were the Supabase SQL migration files (01–08) used to
set up the original Supabase project that ran alongside the NestJS backend during
the R2 migration period (July–September 2026).

**Runtime relevance:** ZERO. The Supabase runtime has been fully removed. All data
now lives in PostgreSQL 18, managed by Prisma + NestJS.

**ETL reference:** The data-migration script at `database/migrations/002_migrate_supabase_data.sql`
reads from a `legacy` staging schema (not from these files directly). If a future
operator needs to re-import a Supabase dump, these migration files document the
original schema that the ETL expects.
