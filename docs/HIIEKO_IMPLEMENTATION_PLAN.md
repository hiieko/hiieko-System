# HIIEKO Implementation Plan

**Last Updated:** 2026-09-22  
**Version:** 1.0  
**Status:** AUDIT COMPLETE — Ready for WAVE 1 Implementation

---

## Current State Summary

| Area | Status | Notes |
|---|---|---|
| **Architecture** | ✅ Confirmed | Target Stack: Web/Mobile → NestJS :4000 → Prisma 5.22 → PostgreSQL 14 :5433 |
| **Backend Modules** | ✅ 28 Modules | All domain modules implemented |
| **Database** | ✅ Live | Prisma migration 20260922102428_init applied, 66 tables in PostgreSQL |
| **Authentication** | ✅ Verified | JWT auth, seed ADMIN user, /api/auth/login & /api/auth/me working |
| **Testing** | ✅ Green | 8/8 Jest suites, 29/29 tests passing |
| **Build** | ✅ PASS | Backend typecheck (0 errors), web build (18/18 pages), 0 errors |
| **Daily Reports** | ✅ Complete | PostgreSQL verified: 3 records, all CRUD operations working |
| **Attendance** | ✅ Complete | PostgreSQL verified: 5 records, geofence & overtime working |
| **Control Tower** | ✅ Complete | Real data aggregation across 7 operational domains |

---

## Implementation Gaps

### WAVE 1 — Foundation / Authorization

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-01 | Role & permission redesign | Current roles (worker/team_leader/manager/admin) incomplete | Full HIIEKO role model (Maintenance Director, Technical Director, Project Manager, Site Manager, Foreman, Worker, Site Logistics & Administration, Finance & Administration, Procurement / Supply Support, O&M / Maintenance, External specialists) | HIGH |
| GAP-02 | Daily work planning & task assignment | Daily reports exist but planning workflow missing | Site Manager can publish daily plan, Foreman can see assigned work fronts, Worker can update assigned task only | MEDIUM |
| GAP-03 | Project Manager control layer | Control Tower exists but structured records missing | PM can manage project schedule/budget/risk/variation records | HIGH |
| GAP-04 | Procurement & material request workflow | Delivery notes exist but workflow incomplete | PM defines need → Procurement sources → Finance controls approval → Site Logistics confirms receipt | HIGH |
| GAP-05 | Stock traceability, tools & assets | Basic stock capability exists | Lot/location/team/activity traceability, tools/assets tracking | MEDIUM |

### WAVE 2 — Daily Site Operations

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-06 | Daily/weekly work planning | Daily reports exist, planning workflow incomplete | Daily/weekly work planning published by Site Manager, visible to Foreman | HIGH |
| GAP-07 | Task assignment | Task models exist but assignment workflow incomplete | Foreman can assign work fronts and workers | HIGH |
| GAP-08 | Workforce allocation | Team models exist but allocation workflow incomplete | Foreman can allocate workforce to specific tasks | HIGH |
| GAP-09 | Progress tracking | Daily reports track progress, roll-up incomplete | Actual progress rolls into project/site statistics | MEDIUM |

### WAVE 3 — Procurement / Logistics

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-10 | Material requests | Basic materials exist, request workflow missing | Material request creation, approval workflow | HIGH |
| GAP-11 | Supplier management | Suppliers table exists | Quotation workflow, supplier evaluation | MEDIUM |
| GAP-12 | Purchase orders | PO concepts exist but incomplete | Full PO workflow: request → quotation → PO → delivery | HIGH |
| GAP-13 | Delivery coordination | Delivery notes exist | Link delivery to PO, track delivery status | MEDIUM |
| GAP-14 | Stock integration | Stock movements exist | Integrate delivery receipt with stock update | MEDIUM |
| GAP-15 | Material traceability | Basic stock balance exists | Trace from receipt to location/team/activity | MEDIUM |

### WAVE 4 — HSE / Quality

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-16 | Toolbox talks | Not implemented | Toolbox talk records, attendance tracking | MEDIUM |
| GAP-17 | HSE incidents | Not implemented | HSE incident reports, investigation workflow | MEDIUM |
| GAP-18 | Near misses | Not implemented | Near miss reporting | LOW |
| GAP-19 | Unsafe conditions | Not implemented | Unsafe condition reports, remediation tracking | MEDIUM |
| GAP-20 | PPE records | Not implemented | PPE inventory, distribution tracking | LOW |
| GAP-21 | Inspections | Not implemented | Inspection records, findings tracking | MEDIUM |
| GAP-22 | Defects | Not implemented | Defect reports, repair tracking | MEDIUM |
| GAP-23 | Punch lists | Not implemented | Punch list creation, resolution tracking | MEDIUM |
| GAP-24 | Corrective actions | Not implemented | Corrective action requests, closure verification | MEDIUM |

### WAVE 5 — Technical Control

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-25 | RFI (Requests for Information) | Not implemented | RFI workflow, response tracking | LOW |
| GAP-26 | Technical issues | Not implemented | Technical issue reports, resolution tracking | MEDIUM |
| GAP-27 | Technical approvals | Not implemented | Technical approval workflow | LOW |
| GAP-28 | Deviations | Not implemented | Deviation requests, approval tracking | LOW |
| GAP-29 | Design changes | Not implemented | Design change records, approval history | LOW |

### WAVE 6 — Expenses / OCR

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-30 | Expense submission | Expense models exist | Receipt upload, OCR workflow complete | LOW |
| GAP-31 | OCR confidence/review | OCR service exists | OCR confidence scoring, manual review workflow | MEDIUM |
| GAP-32 | Approval workflow | Expense approval exists | Expense approval workflow with multi-level approval | HIGH |
| GAP-33 | Rejection tracking | Expense rejection exists | Rejection reason tracking, resubmission workflow | MEDIUM |
| GAP-34 | Finance processing | Not implemented | Finance processing workflow, payment scheduling | MEDIUM |
| GAP-35 | Audit trail | Audit log exists | Full expense audit trail | MEDIUM |
| GAP-36 | No self-approval | Basic check exists | Enforce no self-approval rule | HIGH |

### WAVE 7 — Documents / Handover / O&M

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-37 | Project documents | Not implemented | Project document storage, versioning | MEDIUM |
| GAP-38 | Document versions | Not implemented | Document version tracking | LOW |
| GAP-39 | Permits | Not implemented | Permit records, expiry tracking | LOW |
| GAP-40 | Drawings | Not implemented | Drawing storage, revision tracking | LOW |
| GAP-41 | Warranties | Not implemented | Warranty records, expiry tracking | LOW |
| GAP-42 | Commissioning records | Not implemented | Commissioning records, sign-off tracking | LOW |
| GAP-43 | As-built records | Not implemented | As-built documentation | LOW |
| GAP-44 | Handover packages | Not implemented | Handover package creation, delivery tracking | HIGH |
| GAP-45 | Asset register | Not implemented | Asset inventory, lifecycle tracking | LOW |
| GAP-46 | O&M handover | Not implemented | Operations & Maintenance handover | LOW |
| GAP-47 | Maintenance records | Not implemented | Preventive maintenance scheduling, execution | LOW |

### WAVE 8 — Mobile Production Readiness

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-48 | Real mobile authentication | Demo user bypasses auth | Real authentication flow on mobile | HIGH |
| GAP-49 | Session handling | Basic auth exists | Session refresh, expiration handling | MEDIUM |
| GAP-50 | Role-aware navigation | Auth exists but navigation basic | Navigation based on user role | MEDIUM |
| GAP-51 | Offline queue | Basic infrastructure exists | Full offline queue with conflict handling | HIGH |
| GAP-52 | Synchronization | Not implemented | Sync queue items with server | HIGH |
| GAP-53 | Retry handling | Not implemented | Failed sync retry with backoff | HIGH |
| GAP-54 | Conflict handling | Not implemented | Offline conflict detection and resolution | HIGH |
| GAP-55 | Sync status | Not implemented | Sync status indicators | LOW |
| GAP-56 | Production error states | Not implemented | Production error handling | MEDIUM |

### WAVE 9 — Notifications / Audit / Control Tower

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-57 | Business-event notifications | Notification models exist | Business event triggers | MEDIUM |
| GAP-58 | Escalation notifications | Not implemented | Escalation workflow | LOW |
| GAP-59 | Audit coverage | Audit log exists | Comprehensive audit coverage | MEDIUM |
| GAP-60 | Control Tower integration | Control Tower exists | Actionable drill-downs from notifications | MEDIUM |

### WAVE 10 — Production Cleanup

| Gap ID | Requirement | Existing Implementation | Missing Implementation | Priority |
|---|---|---|---|---|
| GAP-61 | Remove mock/fallback data | Header uses MOCK_SITES | Remove all mock data, use real API | LOW |
| GAP-62 | Remove legacy Supabase paths | Some Supabase references remain | Remove legacy Supabase code paths | MEDIUM |
| GAP-63 | Remove obsolete development assumptions | Not identified | Identify and remove dev-only assumptions | LOW |

---

## Database Changes Required

### WAVE 1

| Entity | Action | Reason |
|---|---|---|
| users | Modify | Add new roles: MAINTENANCE_DIRECTOR, TECHNICAL_DIRECTOR, FOREMAN, SITE_LOGISTICS, FINANCE, PROCUREMENT, O&M, EXTERNAL_SPECIALIST |
| user_roles | Modify | Update role enum to include new roles |
| permissions | Modify | Add new permissions for new roles |
| oles | Modify | Update role model with new permissions |
| projects | Modify | Add PM, Site Manager assignment fields |
| sites | Create | Add sites table for multi-site support |

### WAVE 2

| Entity | Action | Reason |
|---|---|---|
| work_plans | Create | Daily/weekly work planning |
| work_plan_assignments | Create | Assign workers to work plans |
| work_fronts | Create | Define work fronts for task assignment |

### WAVE 3

| Entity | Action | Reason |
|---|---|---|
| material_requests | Create | Material request workflow |
| fqs | Create | Request for Quotation workflow |
| purchase_orders | Create | Purchase order workflow |
| delivery_status | Create | Track delivery status |
| stock_traceability | Create | Lot/location/team/activity traceability |
| 	ools_assets | Create | Tools, equipment, and asset tracking |

### WAVE 4

| Entity | Action | Reason |
|---|---|---|
| 	oolbox_talks | Create | Toolbox talk records |
| hse_incidents | Create | HSE incident reports |
| 
ear_misses | Create | Near miss reports |
| unsafe_conditions | Create | Unsafe condition reports |
| ppe_records | Create | PPE inventory tracking |
| inspections | Create | Inspection records |
| defects | Create | Defect reports |
| punch_lists | Create | Punch list records |
| corrective_actions | Create | Corrective action records |

### WAVE 5

| Entity | Action | Reason |
|---|---|---|
| fis | Create | RFI workflow |
| 	echnical_issues | Create | Technical issue reports |
| 	echnical_approvals | Create | Technical approval workflow |
| deviations | Create | Deviation requests |
| design_changes | Create | Design change records |

### WAVE 6

| Entity | Action | Reason |
|---|---|---|
| expense_documents | Create | Expense receipt images |
| ocr_results | Modify | Add OCR confidence scoring |
| expense_approvals | Modify | Add multi-level approval workflow |

### WAVE 7

| Entity | Action | Reason |
|---|---|---|
| project_documents | Create | Project document storage |
| document_versions | Create | Document versioning |
| permits | Create | Permit records |
| drawings | Create | Drawing storage |
| warranties | Create | Warranty records |
| commissioning_records | Create | Commissioning records |
| s_built_records | Create | As-built documentation |
| handover_packages | Create | Handover package records |
| sset_register | Create | Asset inventory |
| maintenance_records | Create | Maintenance scheduling |

---

## API Changes Required

### New Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/teams | List all teams |
| GET | /api/teams/:id | Get team details |
| POST | /api/teams | Create new team |
| POST | /api/teams/:id/members | Add member to team |
| DELETE | /api/teams/:id/members/:userId | Remove member from team |
| POST | /api/teams/:id/leader | Assign team leader |

### Modified Endpoints

| Endpoint | Change |
|---|---|
| /api/users | Add new role filters, project/site scope |
| /api/projects | Add PM/Site Manager assignment |
| /api/daily-reports | Add work plan reference |

---

## Web Changes Required

| Page | Status | Notes |
|---|---|---|
| /echipe | NEW | Team management page |
| /muncitori | NEW | Worker management page |
| /rapoarte | EXISTING | Already implemented, needs work plan integration |
| /pontaj | EXISTING | Already implemented |
| /control-tower | EXISTING | Already implemented |

---

## Permission Model

### Current Roles (Incomplete)

| Role | Permissions |
|---|---|
| ADMIN | All permissions |
| MANAGER | Project management, finance |
| TEAM_LEADER | Site supervision |
| WORKER | Task completion |

### Required Roles (HIIEKO Model)

| Role | Scope | Key Permissions |
|---|---|---|
| MAINTENANCE_DIRECTOR | Portfolio level | Maintenance oversight, O&M handover |
| TECHNICAL_DIRECTOR | Portfolio level | Technical governance, approvals |
| PROJECT_MANAGER | Project level | Schedule, budget, risk, variation |
| SITE_MANAGER | Site level | Daily execution, work planning, approval authority |
| FOREMAN | Team level | Daily workforce execution, task assignment |
| WORKER | Task level | Task completion |
| SITE_LOGISTICS | Site level | Attendance, receipts, stock, tools |
| FINANCE | Portfolio level | Financial approval, reimbursement |
| PROCUREMENT | Portfolio level | Sourcing, quotations, purchase orders |
| O&M | Portfolio level | Maintenance, handover |
| EXTERNAL_SPECIALIST | Project/site level | External expert access |

---

## Implementation Order

1. **WAVE 1** — Foundation / Authorization (Role & permission redesign)
2. **WAVE 2** — Daily Site Operations (Planning, task assignment, workforce allocation)
3. **WAVE 3** — Procurement / Logistics (Material requests, PO workflow, stock traceability)
4. **WAVE 4** — HSE / Quality (Toolbox talks, incidents, inspections, defects)
5. **WAVE 5** — Technical Control (RFI, technical issues, approvals, deviations)
6. **WAVE 6** — Expenses / OCR (Approval workflow, OCR confidence, no self-approval)
7. **WAVE 7** — Documents / Handover / O&M (Documents, handover, asset register, maintenance)
8. **WAVE 8** — Mobile Production Readiness (Real auth, offline queue, sync)
9. **WAVE 9** — Notifications / Audit / Control Tower (Business events, escalation, audit)
10. **WAVE 10** — Production Cleanup (Remove mock data, legacy paths)

---

## Known Issues

| Issue ID | Description | Status | Impact |
|---|---|---|---|
| ISSUE-001 | Dashboard queries nonexistent ttendance_records table | RESOLVED | Fixed with Control Tower |
| ISSUE-002 | Mobile auth bypassed (demo user) | OPEN | High |
| ISSUE-003 | OCR provider documentation drift | OPEN | Medium |
| ISSUE-004 | Dead extract.ts OCR parser | OPEN | Low |
| ISSUE-005 | Mobile offline sync gaps | OPEN | High |
| ISSUE-006 | .gitignore hygiene | OPEN | Medium |
| ISSUE-007 | pytest missing from OCR service | OPEN | Low |
| ISSUE-008 | ull_setup.sql header drift | OPEN | Cosmetic |
| ISSUE-009 | Mojibake in comments | OPEN | Cosmetic |
| ISSUE-010 | STEP 2 Database Coverage Audit | RESOLVED | Fixed |

---

## Verification Criteria

Each gap is COMPLETE when:

- [ ] Requirements implemented
- [ ] Prisma migration created, reviewed and tested
- [ ] NestJS DTO, service, controller implemented
- [ ] Authorization tests pass
- [ ] Swagger documentation updated
- [ ] Web UI includes all states
- [ ] Mobile UI includes offline/error behavior
- [ ] Shared types updated where applicable
- [ ] Audit events implemented
- [ ] Notifications implemented where required
- [ ] Unit + integration + E2E tests pass
- [ ] Documentation updated
- [ ] Known issues recorded
- [ ] No mock/fallback/demo runtime path remains

---

## Dependencies

### Prerequisites

- PostgreSQL 14+ running on localhost:5433
- Prisma CLI installed
- NestJS runtime available
- Web dev server available

### Build Tools

- Node.js 20 LTS or 24.x
- npm workspaces
- TypeScript 5.x

### Testing

- Jest for backend tests
- Vitest for shared tests
- Mobile testing framework pending

---

## Next Steps

1. Review this implementation plan with stakeholders
2. Prioritize gaps by business impact
3. Create detailed task breakdown for WAVE 1
4. Begin WAVE 1 implementation
5. Update this document with progress

---

*This document is a living reference. Update it as implementation proceeds.*
