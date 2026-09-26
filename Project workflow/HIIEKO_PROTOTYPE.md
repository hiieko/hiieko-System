# HIIEKO Solar Site Management System
# Product Prototype Specification

**Version:** 1.0
**Date:** 2026-09-25
**Status:** DRAFT - Product blueprint derived from existing Prisma schema and backend modules

---

## 1. Roles

### 1.1 Role Definitions (from Prisma UserRoleEnum)

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| ADMIN | ADMIN | Global | System administration, user management, all organizations |
| OWNER | OWNER | Global | System owner, full access |
| PM | PM | Global | Project Manager, manages multiple projects |
| MANAGER | MANAGER | Global | Manager with broad operational access |
| SITE_MANAGER | SITE_MANAGER | Project | Site-level manager, daily operations |
| FOREMAN | FOREMAN | Project | Team leader on site, assigns tasks to workers |
| TEAM_LEADER | TEAM_LEADER | Project | Legacy alias for FOREMAN |
| WORKER | WORKER | Project | Field worker, attendance and task execution |
| TECHNICIAN | TECHNICIAN | Project | Skilled technical worker |
| PROCUREMENT | PROCUREMENT | Global | Procurement and supply chain |
| FINANCE | FINANCE | Global | Financial operations |
| QA_QC | QA_QC | Project | Quality assurance / quality control |
| VIEWER | VIEWER | Project | Read-only access |
| SITE_LOGISTICS | SITE_LOGISTICS | Project | Site logistics and materials |
| MAINTENANCE_DIRECTOR | MAINTENANCE_DIRECTOR | Global | O&M oversight |
| TECHNICAL_DIRECTOR | TECHNICAL_DIRECTOR | Global | Technical authority |

### 1.2 Scope Classification

- Global-scope roles (membership-exempt): ADMIN, OWNER, PM, MANAGER, PROCUREMENT, FINANCE, MAINTENANCE_DIRECTOR, TECHNICAL_DIRECTOR
- Project-scoped roles (require membership): SITE_MANAGER, FOREMAN, TEAM_LEADER, WORKER, TECHNICIAN, QA_QC, VIEWER, SITE_LOGISTICS

---

## 2. Global Project Context

Every operation in the system runs within a project context. The system is multi-organization, multi-project.

### Entity Hierarchy

```
Organization
  +-- Projects
        +-- Teams (cross-project or project-scoped)
        +-- Workforce (Employees assigned to projects via teams)
        +-- Tasks (project work breakdown)
        +-- Daily Plans (published schedules)
        +-- Daily Reports (execution records)
        +-- Attendance (worker check-in/out)
        +-- Materials / Stock / Warehouses
        +-- Procurement (Suppliers, Purchase Orders, Deliveries, Avize)
        +-- Costs (Budgets, Expenses, Cost Entries, Commitments, Payments)
        +-- Documents / Photos
        +-- QA/QC (Inspections, Issues, NCRs)
        +-- HSE (safety records)
        +-- Change Orders
        +-- Notifications / Audit
```

### Key Relationships

| Entity | Belongs To | Via |
|--------|-----------|-----|
| Project | Organization | organization_id FK |
| ProjectMember | Project + User | project_id + user_id |
| Task | Project | project_id FK |
| DailyPlan | Project | project_id FK |
| DailyReport | Project | project_id FK |
| AttendanceRecord | Project + User | project_id + user_id FK |
| StockBalance | Warehouse + Material | warehouse_id + material_id FK |
| StockMovement | Project | project_id FK |
| Aviz | Project | project_id FK |
| PurchaseOrder | Project | project_id FK |
| Expense | Project + User | project_id + user_id FK |
| Document | Project | project_id FK |
| Issue | Project | project_id FK |
| NCR | Project | project_id FK |
| ChangeOrder | Project | project_id FK |
| Inspection | Project | project_id FK |
| Notification | User | user_id FK |
| AuditLog | User | user_id FK |
---

## 3. Navigation Structure

### Web Dashboard Sidebar

| Section | Route | Roles | Description |
|---------|-------|-------|-------------|
| Dashboard | / | All | Project overview, key metrics |
| Control Tower | /control-tower | Global roles | Multi-project management dashboard |
| Projects | /projects | All | Project list and detail |
| Planning | /planning | SITE_MANAGER, FOREMAN, PM | Daily/weekly planning |
| Tasks | /tasks | All | Task management |
| Attendance | /pontaj | All | Attendance records and matrix |
| Daily Reports | /rapoarte | SITE_MANAGER, FOREMAN | Daily execution reports |
| Workforce | /workforce | MANAGER, PM, SITE_MANAGER | Employee management |
| Teams | /teams | MANAGER, PM, SITE_MANAGER | Team management |
| Materials | /materiale | All | Material catalog |
| Stock | /stocuri | All | Warehouse stock and movements |
| Avize | /avize | SITE_LOGISTICS, PROCUREMENT | Delivery notes |
| Procurement | /aprovizionare | PROCUREMENT, PM | Purchase orders, suppliers |
| Expenses | /cheltuieli | All | Expense submission and approval |
| Approvals | /aprobare | MANAGER, PM, SITE_MANAGER | Pending approvals |
| Documents | /documente | All | Project documents and evidence |
| QA/QC | /qa-qc | QA_QC, PM | Inspections, NCRs, issues |
| HSE | /hse | SITE_MANAGER, QA_QC | Safety records |
| Change Orders | /schimbari | PM, TECHNICAL_DIRECTOR | Scope/budget changes |
| Notifications | /notificari | All | User notifications |
| Users | /utilizatori | ADMIN, MANAGER | User management |
| Profile | /profil | All | User profile and settings |
| Statistics | /statistici | All | Project statistics |
| Sign Up | /signup | Public | Account registration |

### Mobile Navigation (Tab Bar)

- Home: Project list, quick actions
- Attendance: Check-in/out with geofence
- Tasks: My tasks, task updates
- Reports: Daily report submission
- Expenses: Expense creation with receipt photo
- Notifications: Inbox
- Profile: User settings
---

## 4. Main Application Areas

### 4.1 Dashboard
- Route: /
- Roles: All
- Shows: Active project info, quick stats, recent activity
- Key metrics: Workers on site today, task completion %, open issues, pending approvals

### 4.2 Planning
- Route: /planning
- Roles: SITE_MANAGER, FOREMAN, PM
- Entities: DailyPlan, DailyPlanTask
- Statuses: DRAFT, PUBLISHED, COMPLETED, CANCELLED
- Workflow: Create plan -> Add tasks -> Publish -> Execute -> Complete

### 4.3 Tasks
- Route: /tasks
- Roles: All
- Entities: Task, TaskDependency, TaskAssignment
- Statuses: PLANNED, READY, IN_PROGRESS, BLOCKED, COMPLETED, VERIFIED, CANCELLED
- Features: Dependencies (FINISH_TO_START), assignments to users, progress tracking

### 4.4 Attendance
- Route: /pontaj
- Roles: All
- Entities: AttendanceRecord
- Statuses: PRESENT, ABSENT, MEDICAL_LEAVE, REST
- Features: Geofence check-in/out, overtime calculation, daily matrix

### 4.5 Daily Reports
- Route: /rapoarte
- Roles: SITE_MANAGER, FOREMAN
- Entities: DailyReport, DailyReportWorker, DailyReportTask, DailyReportMaterial, ProductionEntry
- Features: Workers present, tasks performed, materials used, production quantities, weather notes

### 4.6 Materials / Stock
- Routes: /materiale, /stocuri
- Roles: All
- Entities: Material, MaterialLot, Warehouse, StockBalance, StockMovement
- Features: Material catalog, warehouse mgmt, stock movements, lot tracking

### 4.7 Procurement / Avize
- Routes: /avize, /aprovizionare
- Roles: SITE_LOGISTICS, PROCUREMENT, PM
- Entities: Supplier, PurchaseOrder, PurchaseOrderItem, Delivery, Invoice, Aviz, AvizItem
- Statuses (Aviz): PENDING, RECEIVED, PARTIALLY_RECEIVED, CANCELLED
- Features: Purchase orders, delivery notes, invoice matching, supplier mgmt

### 4.8 Documents
- Route: /documente
- Roles: All
- Entities: Document, DocumentVersion, Attachment
- Features: Document upload, versioning, project-scoped storage
### 4.9 QA/QC
- Routes: /qa-qc
- Roles: QA_QC, PM
- Entities: InspectionTemplate, Inspection, Measurement, Issue, NCR
- Issue severities: LOW, MEDIUM, HIGH, CRITICAL
- Issue statuses: OPEN, IN_PROGRESS, RESOLVED, CLOSED
- NCR statuses: OPEN, INVESTIGATING, CORRECTIVE_ACTION, VERIFIED, CLOSED
- Features: Inspection checklists, issue register, non-conformance reports

### 4.10 HSE
- Route: /hse
- Roles: SITE_MANAGER, QA_QC
- Features: Safety observations, incident reporting, toolbox talks

### 4.11 Issues / NCR / Punch List
- Route: /qa-qc
- Entities: Issue, NCR
- Features: Cross-module issue tracking, NCR workflow, punch list management

### 4.12 Projects
- Route: /projects, /projects/[id]
- Roles: All
- Entities: Project, ProjectStage, WorkPackage, LocationZone, ProjectMember
- Statuses: PLANNING, ENGINEERING, PROCUREMENT, CONSTRUCTION, TESTING, COMMISSIONING, HANDOVER, COMPLETED, ON_HOLD, CANCELLED
- Features: Project CRUD, stage tracking, members, locations

### 4.13 Workforce
- Route: /workforce
- Roles: MANAGER, PM, SITE_MANAGER
- Entities: Employee, Team, TeamMember
- Features: Employee management, team management, assignment to projects

### 4.14 Teams
- Route: /teams
- Entities: Team, TeamMember
- Features: Team CRUD, member management, team leader assignment

### 4.15 Costs / Expenses
- Routes: /cheltuieli, /aprobare
- Roles: All
- Entities: Expense, ExpenseLine, ExpenseApproval, Reimbursement, Budget, BudgetLine, CostEntry, Commitment, Payment
- Statuses (Expense): SUBMITTED, APPROVED, REJECTED, REIMBURSED
- Categories: FUEL, PERSONAL_CARD, COMPANY_CARD, TRANSPORT, ACCOMMODATION, SUPPLIES, SUBCONTRACTOR, OTHER
- Features: Expense submission with receipt photo, approval workflow, reimbursement

### 4.16 Suppliers
- Entities: Supplier
- Features: Supplier catalog, contact management

### 4.17 Warehouses
- Entities: Warehouse
- Features: Warehouse management, location tracking

### 4.18 Change Orders
- Route: /schimbari
- Roles: PM, TECHNICAL_DIRECTOR
- Entities: ChangeOrder
- Statuses: DRAFT, SUBMITTED, APPROVED, REJECTED, IMPLEMENTED
- Features: Scope/budget/schedule change tracking, approval workflow

### 4.19 Notifications
- Route: /notificari
- Roles: All
- Entities: Notification, NotificationPreference
- Features: User inbox, read/unread, read-all, priority levels

### 4.20 Audit
- Entity: AuditLog
- Features: Automatic audit logging for all mutations, user activity tracking

### 4.21 Settings / Profile
- Route: /profil
- Roles: All
- Entities: User, UserProfile
- Features: Personal info, role info, organization, notification preferences
---

## 5. Core Workflows

### 5.1 Project Lifecycle
1. Organization creates a Project (status: PLANNING)
2. PM assigns ProjectMembers (SITE_MANAGER, FOREMAN, etc.)
3. Project progresses through stages (ENGINEERING, PROCUREMENT, CONSTRUCTION, etc.)
4. Site operations happen within CONSTRUCTION phase
5. Project completes (COMMISSIONING -> HANDOVER -> COMPLETED)

### 5.2 Daily Operations Workflow
1. SITE_MANAGER creates DailyPlan (DRAFT)
2. SITE_MANAGER publishes plan (PUBLISHED)
3. FOREMAN views plan, assigns workers to tasks
4. Workers check in (attendance with geofence)
5. FOREMAN submits DailyReport with actuals
6. Workers check out
7. SITE_MANAGER reviews reports

### 5.3 Task Management
1. Tasks created within project with dependencies
2. Tasks assigned to users/teams
3. Status progresses: PLANNED -> READY -> IN_PROGRESS -> COMPLETED -> VERIFIED
4. Blocked tasks have reason and can be unblocked
5. Progress tracked via daily report production entries

### 5.4 Material Supply Chain
1. Procurement creates PurchaseOrder (with Supplier)
2. Supplier delivers -> Aviz created (links to PO)
3. Delivery receipt updates StockBalance (RECEIVE movement)
4. Site consumes materials (CONSUME movement)
5. Transfer between warehouses (TRANSFER_OUT / TRANSFER_IN)

### 5.5 Expense and Approval
1. User creates Expense (SUBMITTED)
2. Manager reviews and APPROVES or REJECTS
3. Approved expenses proceed to REIMBURSED
4. Reimbursement processed by FINANCE role
5. Audit trail maintained

### 5.6 Quality Management
1. QA_QC creates Inspections from templates
2. Issues raised (OPEN) with severity
3. Issues resolved (RESOLVED) and verified (CLOSED)
4. NCRs follow formal corrective action process
5. Measurements recorded for verification

### 5.7 Change Management
1. ChangeOrder created (DRAFT)
2. Submitted for approval (SUBMITTED)
3. Approved or rejected by authority
4. Implemented changes tracked

---

## 6. Actions and Permissions

### 6.1 Action Types
- VIEW: Read access to entity
- CREATE: Create new entity
- EDIT: Modify existing entity
- APPROVE: Approve or reject pending items
- REJECT: Reject submitted items
- ARCHIVE: Soft-delete / deactivate
- DELETE: Hard-delete (restricted)
- ASSIGN: Assign users/teams to entities

### 6.2 Permission by Role (Project-scoped entities)

| Action | WORKER | FOREMAN | SITE_MGR | PM | MANAGER | ADMIN |
|--------|--------|---------|----------|-----|---------|-------|
| VIEW own attendance | YES | YES | YES | YES | YES | YES |
| VIEW project data | YES | YES | YES | YES | YES | YES |
| CREATE expense | YES | YES | YES | YES | YES | YES |
| CREATE daily report | - | YES | YES | - | - | - |
| CREATE daily plan | - | - | YES | YES | - | - |
| CREATE task | - | - | YES | YES | YES | YES |
| APPROVE expense | - | - | up to 5k | up to 20k | - | any |
| MANAGE users | - | - | - | - | YES | YES |
| MANAGE projects | - | - | - | YES | YES | YES |
| MANAGE teams | - | - | YES | YES | YES | YES |
| MANAGE workforce | - | - | YES | YES | YES | YES |
| ARCHIVE entity | - | - | - | YES | YES | YES |
| DELETE entity | - | - | - | - | YES | YES |

### 6.3 Project-Scoping Rules
- Project-scoped roles can only access entities within their projects
- Global-scope roles can access all entities in their organization
- Entity-derived project resolution: project_id is resolved from the entity, not from client input
- Non-members receive 403 FORBIDDEN for project-scoped operations
- Non-existent entities receive 404 NOT_FOUND
- Unauthenticated requests receive 401 UNAUTHORIZED
---

## 7. Dashboards

### 7.1 Executive Dashboard (Control Tower)
- Route: /control-tower
- Roles: Global-scope roles
- Shows: All projects status, key metrics, red flags
- Metrics: Active projects, total workforce, task completion rates, budget variance
- Drill-down: Click project -> project detail with full context

### 7.2 PM Dashboard
- Route: /projects/[id]
- Roles: PM, MANAGER
- Shows: Single project health, schedule, budget, risks, open issues
- Sections: Overview, Planning, Tasks, Costs, Documents, QA/QC, Change Orders

### 7.3 Site Manager Dashboard
- Route: / (project context)
- Roles: SITE_MANAGER
- Shows: Today's plan, attendance, pending reports, stock alerts
- Quick actions: Create plan, review reports, check stock

---

## 8. Mobile Field Workflows

### 8.1 Attendance
1. Worker opens app -> sees project list
2. Selects project -> check-in button with geofence validation
3. GPS verified -> check-in recorded
4. End of day -> check-out with overtime calculation
5. Offline: queued in SQLite -> sync when online

### 8.2 Daily Report (FOREMAN)
1. Select project and date
2. Add workers present
3. Select tasks performed and progress
4. Add materials used
5. Add production quantities
6. Submit (offline-capable)

### 8.3 Expense Submission
1. Select expense category
2. Enter amount, description
3. Take receipt photo (camera)
4. Submit (offline-capable)

### 8.4 Delivery Reception (SITE_LOGISTICS)
1. Scan/receive delivery
2. Match against PurchaseOrder
3. Record received quantities
4. Create Aviz
5. Stock automatically updated

---

## 9. Project Closeout / Handover

### Closeout Requirements
- All tasks COMPLETED or VERIFIED
- All NCRs CLOSED
- All punch list items resolved
- All documents archived
- Final costs reconciled
- Project status set to HANDOVER then COMPLETED

### Handover Package
- As-built documentation
- Commissioning records
- Warranty certificates
- O&M manuals
- Training records
- Final inspection reports

---

## 10. Entity Relationship Summary

```
Organization 1---* Project
Organization 1---* User
Organization 1---* Supplier
User 1---* ProjectMember
User 1---* AttendanceRecord
User 1---* Expense
User 1---* Notification
Project 1---* ProjectMember
Project 1---* Task
Project 1---* DailyPlan
Project 1---* DailyReport
Project 1---* AttendanceRecord
Project 1---* Document
Project 1---* Expense
Project 1---* Issue
Project 1---* NCR
Project 1---* ChangeOrder
Project 1---* PurchaseOrder
Project 1---* Aviz
Project 1---* Budget
Warehouse 1---* StockBalance
Material 1---* StockBalance
Team *---* User (via TeamMember)
```

---

*End of Product Prototype Specification*