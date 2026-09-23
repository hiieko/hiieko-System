# HIIEKO Implementation Decisions

**Last Updated:** 2026-09-22  
**Version:** 1.0

---

## Architecture Decisions

### Decision 1: PostgreSQL/Prisma/NestJS vs Legacy Supabase

**Issue:** Legacy Supabase web helpers are dead code, but OCR still references Supabase.

**Decision:** Keep PostgreSQL/Prisma/NestJS as the primary stack. Remove Supabase references from code.

**Rationale:** Current project status confirms PostgreSQL is fully operational. Supabase integration introduces unnecessary complexity.

**Implementation:** Remove lib/supabase.ts + useSupabaseQuery.ts dead code paths.

**Status:** RESOLVED (2026-09-22) — Verified dead code, removed from active paths.

---

### Decision 2: OCR Storage and Processing Architecture

**Issue:** OCR pipeline uses PaddleOCR FastAPI service, but documentation references Google Cloud Vision.

**Decision:** Standardize on PaddleOCR implementation. Remove Google Cloud Vision references.

**Rationale:** 
- Implemented pipeline uses PaddleOCR (PADDLEOCR_URL/PADDLEOCR_TOKEN)
- Google Cloud Vision references are outdated
- PaddleOCR is self-hosted, no API costs

**Implementation:**
1. Update Mobile/.env.example to reflect PaddleOCR configuration
2. Delete supabase/functions/ocr-extract/extract.ts (dead code)
3. Update documentation to reference PaddleOCR only

**Status:** OPEN — Awaiting implementation

---

### Decision 3: 	eam_leader Role Mapping

**Issue:** Current 	eam_leader role exists, but specification defines Foreman role.

**Decision:** Rename 	eam_leader to FOREMAN in UserRoleEnum.

**Rationale:**
- 	eam_leader exists in current schema but doesn't match HIIEKO organizational model
- Foreman is the documented role for daily workforce execution
- Maintain 	eam_leader as a legacy alias during migration

**Implementation:**
1. Add FOREMAN to UserRoleEnum
2. Update permissions to use FOREMAN
3. Add migration to map existing 	eam_leader users to FOREMAN
4. Deprecate 	eam_leader in shared types

**Status:** PLANNED — WAVE 1 implementation

---

### Decision 4: Permission Scope (Project/Site/Organization)

**Issue:** Current permission model doesn't enforce scope boundaries.

**Decision:** Implement three-level permission scope:
- **Organization level**: Admin, Finance, Procurement, Technical Director
- **Project level**: PM, External specialists (assigned to project)
- **Site level**: Site Manager, Foreman, Site Logistics, Workers (assigned to site)

**Rationale:**
- Matches HIIEKO organizational model
- Enforces project/site boundary access guards
- Supports multi-project/site scenarios

**Implementation:**
1. Add project_id and site_id to User model (nullable, mutually exclusive)
2. Update RolesGuard to check scope
3. Add project/site access guards to service layer

**Status:** PLANNED — WAVE 1 implementation

---

### Decision 5: Approval Authority by Amount

**Issue:** Specification requires approval authority based on amount thresholds.

**Decision:** Implement multi-level approval:
- **Site Manager**: Approvals up to €5,000
- **Project Manager**: Approvals up to €20,000
- **Technical Director**: Approvals up to €50,000
- **Finance & Administration**: All approvals (final authority)

**Rationale:**
- Matches HIIEKO organizational model
- Enforces approval chain in business rules
- Audit trail for all approvals

**Implementation:**
1. Add pproval_authority_limit field to User model
2. Update Expense approval workflow to check limits
3. Require higher-level approval when limit exceeded

**Status:** PLANNED — WAVE 6 implementation

---

### Decision 6: Offline Conflict Resolution

**Issue:** Mobile offline queue needs conflict resolution rules.

**Decision:** Implement last-write-wins with client-side timestamp for simple conflicts. For complex conflicts (same record modification), require manual review.

**Rationale:**
- Simple conflicts (status updates, notes) can be resolved automatically
- Complex conflicts (quantity changes, assignments) require human review
- Audit trail required for all conflict resolutions

**Implementation:**
1. Add conflict_detected flag to queue items
2. Add conflict_resolution field to track resolution status
3. Implement manual review UI for conflicts

**Status:** PLANNED — WAVE 8 implementation

---

## Business Rule Decisions

### Decision 7: No Negative Stock

**Issue:** Stock movement must prevent negative balances.

**Decision:** Enforce zero negative stock in service layer. Block movements that would result in negative balance.

**Rationale:**
- Matches specification requirement
- Prevents inventory errors
- Must be server-side (not client-side)

**Implementation:**
1. Update StockMovementService to validate before create
2. Return error if resulting stock < 0
3. Log audit event for blocked movements

**Status:** IMPLEMENTED — Existing in calculations.ts

---

### Decision 8: No Self-Approval for Expenses

**Issue:** Users should not approve their own expenses.

**Decision:** Block self-approval at service layer. Require different user for approval.

**Rationale:**
- Matches specification requirement
- Prevents fraud
- Must be server-side (not client-side)

**Implementation:**
1. Update ExpenseApprovalService to check pprover_id !== expense.submitter_id
2. Return error if self-approval attempted
3. Log audit event for blocked approval

**Status:** PLANNED — WAVE 6 implementation

---

### Decision 9: Expense Category Mapping

**Issue:** Romanian expense categories need English translations.

**Decision:** Add label_ro and label_en fields to ExpenseCategory enum.

**Rationale:**
- Supports bilingual UI (Romanian + English)
- Matches shared types pattern
- Easy to extend for additional languages

**Implementation:**
1. Add label_ro and label_en to ExpenseCategory model
2. Update API responses to include labels
3. Update UI to use labels

**Status:** PLANNED — WAVE 6 implementation

---

## Database Schema Decisions

### Decision 10: Team Model Structure

**Issue:** Current Team model exists but needs alignment with HIIEKO model.

**Decision:** Update Team model:
- Team → Team (rename to WorkTeam if needed)
- Add project_id (nullable, for site-wide teams)
- Add site_id (nullable, for team assignment to site)
- Add 	eam_leader_id (nullable, can be assigned later)
- Add status enum (ACTIVE, INACTIVE, ON_HOLD)

**Rationale:**
- Supports project-based and site-wide teams
- Allows unassigned teams (awaiting leader)
- Supports team lifecycle management

**Implementation:**
1. Create Prisma migration to add new fields
2. Update TeamsService to handle new fields
3. Update TeamsController permissions

**Status:** PLANNED — WAVE 1 implementation

---

### Decision 11: Daily Report Work Plan Reference

**Issue:** Daily reports need to reference work plans.

**Decision:** Add work_plan_id to DailyReport model.

**Rationale:**
- Links daily execution to planned work
- Enables progress tracking against plan
- Supports variance analysis

**Implementation:**
1. Add work_plan_id to DailyReport model
2. Create migration
3. Update DailyReportsService

**Status:** PLANNED — WAVE 2 implementation

---

### Decision 12: Material Request Approval Workflow

**Issue:** Material requests need approval workflow.

**Decision:** Implement approval workflow:
- DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED
- Add equested_by, equested_date, pproved_by, pproved_date
- Add pproved_amount field (can differ from requested)

**Rationale:**
- Matches procurement workflow
- Audit trail for approvals
- Supports partial approval

**Implementation:**
1. Create MaterialRequest model with status enum
2. Create MaterialRequestApproval model
3. Add approval API endpoints

**Status:** PLANNED — WAVE 3 implementation

---

## API Design Decisions

### Decision 13: Idempotency Keys for All Mutations

**Issue:** Mobile offline queue needs idempotency for retries.

**Decision:** Add idempotency_key field to all mutation DTOs. Return 200 with existing record if key already used.

**Rationale:**
- Supports offline retry with safety
- Prevents duplicate submissions
- Matches NestJS best practices

**Implementation:**
1. Add idempotency_key to all mutation DTOs
2. Update service layer to check for existing key
3. Update database constraints

**Status:** PARTIALLY IMPLEMENTED — Some endpoints have it, expand to all

---

### Decision 14: Response Transformation Pattern

**Issue:** Consistent API response format needed.

**Decision:** Use existing response transformer:
`	ypescript
{
  data: T | T[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}
`

**Rationale:**
- Consistent client-side handling
- Supports pagination
- Clear error handling

**Status:** IMPLEMENTED — Existing pattern in backend

---

## Frontend Design Decisions

### Decision 15: Romanian-First UI Copy

**Issue:** UI needs Romanian + English support.

**Decision:** Implement i18n with Romanian as default:
- Use useLocale() hook in all pages
- Add o and en translations
- Default to Romanian if locale not set

**Rationale:**
- Matches HIIEKO Romanian operations
- Easy to add English
- Supports bilingual workforce

**Status:** IMPLEMENTED — Existing in shared/i18n

---

### Decision 16: Permission-Aware UI Actions

**Issue:** UI should hide/show actions based on permissions.

**Decision:** Use permissions.ts helpers in all UI components:
- canApproveExpenses(role) — Show/hide approve button
- canManageUsers(role) — Show/hide user management UI
- canViewStatistics(role, scope) — Show/hide statistics cards

**Rationale:**
- Reduces UI clutter
- Prevents permission errors
- Consistent with backend

**Status:** IMPLEMENTED — Existing pattern in shared/permissions

---

## Known Conflicts

### Conflict 1: Supabase vs PostgreSQL

**Documented:** Some documentation references Supabase, but implementation uses PostgreSQL.

**Resolution:** PostgreSQL is the canonical database. Remove Supabase references.

**Source:** docs/HIIEKO_IMPLEMENTATION_PLAN.md

---

### Conflict 2: OCR Provider

**Documented:** Mobile/.env.example references Google Cloud Vision, but code uses PaddleOCR.

**Resolution:** PaddleOCR is the canonical OCR provider. Update documentation.

**Source:** Mobile/.env.example, supabase/functions/ocr-extract/index.ts

---

## Decision Log

| Date | Decision | Owner | Status |
|---|---|---|---|
| 2026-09-22 | PostgreSQL/Prisma/NestJS primary stack | AI Audit | RESOLVED |
| 2026-09-22 | Standardize on PaddleOCR | AI Audit | PLANNED |
| 2026-09-22 | Rename team_leader to FOREMAN | AI Audit | PLANNED |
| 2026-09-22 | Three-level permission scope | AI Audit | PLANNED |
| 2026-09-22 | Approval authority by amount | AI Audit | PLANNED |
| 2026-09-22 | Last-write-wins offline conflict | AI Audit | PLANNED |

---

## Next Steps

1. Review these decisions with stakeholders
2. Implement high-priority decisions in WAVE 1
3. Document remaining decisions in docs/HIIEKO_IMPLEMENTATION_DECISIONS.md
4. Update this document as new decisions are made

---

*This document is a living reference. Update it as decisions are made.*
