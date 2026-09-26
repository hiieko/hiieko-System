# Role / Sidebar / Action Visibility Matrix

> Source of truth: comprehensive backend (31 controllers) + frontend (21 routes + Sidebar.tsx + AppShell.tsx) audit.
> Last Updated: 2026-09-25

---

## 1. Legend

| Symbol | Meaning |
|--------|---------|
| âœ… | Full access (create/read/update/delete) |
| ðŸ‘ï¸ | Read-only |
| âœï¸ | Create + update (no delete) |
| ðŸ”’ | No access (role not in @Roles, not in sidebar, or blocked by guard) |
| âš ï¸ | Mismatch between UI and backend (documented below) |

---

## 2. Role Hierarchy & Global Scope

### Global-scope roles (no ProjectMember row required)
ADMIN, OWNER, PM, MANAGER

### Membership-scope roles (require ProjectMember row per project)
SITE_MANAGER, FOREMAN, TEAM_LEADER, TECHNICIAN, WORKER, VIEWER, PROCUREMENT, FINANCE, QA_QC, SITE_LOGISTICS, MAINTENANCE_DIRECTOR, TECHNICAL_DIRECTOR

---

## 3. Sidebar Navigation Visibility

| Menu | Route | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | WORKER | VIEWER | PROCURE | FINANCE | QA_QC | SITE_LOG | MAINT_DIR | TECH_DIR |
|------|-------|-------|-------|---------|----|----------|---------|-----------|------|--------|--------|---------|---------|-------|----------|-----------|----------|
| **Opera\u021biuni** | | | | | | | | | | | | | | | | | |
| Dashboard | / | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Pontaj & Ore | /pontaj | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | âœ… | âœ… |
| Rapoarte Zilnice | /rapoarte | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | âœ… | âœ… |
| Procurement / Avize | /avize | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | âœ… | âœ… |
| Materiale & Stoc | /stocuri | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | âœ… | âœ… |
| Cheltuieli | /cheltuieli | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | ðŸ‘ï¸ | ðŸ‘ï¸ | âœ… | âœ… |
| **Management** | | | | | | | | | | | | | | | | | |
| Proiecte | /projects | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| Echipe | /teams | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| For\u021b\u0103 de Munc\u0103 | /workforce | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| \u0218antiere (GIS) | /santiere | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| Aprob\u0103ri | /aprobare | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| Statistici | /statistici | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| **Administrare** | | | | | | | | | | | | | | | | | |
| Utilizatori | /utilizatori | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| **Personal** | | | | | | | | | | | | | | | | | |
| Notific\u0103ri | /notificari | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| Profil | /profil | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |

### Sidebar Group Visibility Rules
- **Opera\u021biuni**: All authenticated users (no role filter)
- **Management**: admin, owner, manager, pm
- **Administrare**: admin only
- **Personal**: All authenticated users (no role filter)

---

## 4. API Action Authorization (Backend @Roles)

### 4.1 Auth
| Action | ADMIN | OWNER | MANAGER | PM | Others |
|--------|-------|-------|---------|----|--------|
| POST /api/auth/register | N/A (public) | N/A | N/A | N/A | WORKER/VIEWER only (ISSUE-034 FIXED) |
| POST /api/auth/login | âœ… | âœ… | âœ… | âœ… | âœ… |
| GET /api/auth/me | âœ… | âœ… | âœ… | âœ… | âœ… |

### 4.2 Projects
| Action | ADMIN | OWNER | MANAGER | PM | Others |
|--------|-------|-------|---------|----|--------|
| GET /api/projects | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/projects | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| PATCH /api/projects/:id | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| DELETE /api/projects/:id | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |

### 4.3 Tasks
| Action | ADMIN | OWNER | PM | MANAGER | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | WORKER | QA_QC | VIEWER |
|--------|-------|-------|----|---------|----------|---------|-----------|------|--------|-------|--------|
| GET /api/tasks | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| POST /api/tasks | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| PATCH /api/tasks/:id | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| POST /api/tasks/:id/assign | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |

### 4.4 Daily Plans
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|--------|
| GET /api/daily-plans | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| POST /api/daily-plans | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| POST :id/publish | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| POST :id/complete | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| POST :id/cancel | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| PATCH tasks/:id/progress | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (assigned) |

### 4.5 Daily Reports
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|------|--------|
| GET /api/daily-reports | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ‘ï¸ |
| POST /api/daily-reports | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |

### 4.6 Expenses
| Action | ADMIN | OWNER | MANAGER | PM | FINANCE | SITE_MGR | Others |
|--------|-------|-------|---------|----|---------|----------|--------|
| GET /api/expenses | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (own) |
| POST /api/expenses | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| POST :id/approve | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ |

### 4.7 Inventory / Stock
| Action | ADMIN | OWNER | MANAGER | PROCURE | SITE_MGR | TEAM_LEAD | Others |
|--------|-------|-------|---------|---------|----------|-----------|--------|
| GET /api/inventory/balance | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/inventory/receive | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| POST /api/inventory/consume | âœ… | ðŸ”’ | âœ… | ðŸ”’ | âœ… | âœ… | ðŸ”’ |
| POST /api/inventory/transfer | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ |
| GET /api/inventory/movements | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |

### 4.8 Procurement
| Action | ADMIN | OWNER | MANAGER | PROCURE | SITE_MGR | TEAM_LEAD | Others |
|--------|-------|-------|---------|---------|----------|-----------|--------|
| GET /api/procurement/purchase-orders | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/procurement/purchase-orders | âœ… | ðŸ”’ | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| GET /api/procurement/avize | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/procurement/avize | âœ… | ðŸ”’ | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ |

### 4.9 QA/QC
| Action | ADMIN | OWNER | PM | QA_QC | SITE_MGR | Others |
|--------|-------|-------|----|-------|----------|--------|
| GET /api/qa-qc/inspections | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/qa-qc/inspections | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ |

### 4.10 Issues / NCRs
| Action | ADMIN | OWNER | PM | QA_QC | Others |
|--------|-------|-------|----|-------|--------|
| GET /api/issues | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/issues | âœ… | âœ… | âœ… | âœ… | âœ… |
| POST /api/issues/ncrs | âœ… | ðŸ”’ | âœ… | âœ… | ðŸ”’ |

### 4.11 Teams
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|--------|
| GET /api/teams | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… (scoped) |
| POST /api/teams | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| PATCH /api/teams/:id | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| DELETE /api/teams/:id | âœ… | ðŸ”’ | âœ… | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ | ðŸ”’ |
| POST :id/members | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |
| DELETE :id/members/:userId | âœ… | ðŸ”’ | âœ… | âœ… | âœ… | âœ… | âœ… | ðŸ”’ |

---

## 5. Decisions Recorded

| Decision | Value | Rationale |
|----------|-------|-----------|
| OWNER sidebar tier | **Management** (global) | Backend treats OWNER as global scope; frontend must match. Resolves UI \u2194 API mismatch. |
| FOREMAN Planning | **Create/Edit/Complete** (not Publish/Cancel) | FOREMAN is operational; lifecycle authority (publish/cancel) requires SITE_MANAGER+. |
| Public registration roles | **WORKER, VIEWER** only | All privileged roles must be assigned by ADMIN via admin panel. ISSUE-034. |

---

## 6. Known Mismatches (UI vs Backend)

| # | Route / Action | UI Says | Backend Says | Impact |
|---|----------------|---------|-------------|--------|
| 1 | /projects | MANAGER can see | MANAGER can CRUD | âœ… Aligned |
| 2 | /projects create | ADMIN only | ADMIN/OWNER/MANAGER/PM | Low: UI too restrictive |
| 3 | /avize (Procurement) | Only PROCUREMENT | ADMIN/PROCUREMENT/SITE_MGR/TEAM_LEAD | Low: UI too restrictive |
| 4 | /cheltuieli approve | FINANCE only | ADMIN/MANAGER/PM/FINANCE | Low: UI too restrictive |
| 5 | /teams create | ADMIN only | ADMIN/MANAGER/PM/SITE_MGR | Low: UI too restrictive |
| 6 | /teams add member | ADMIN only | ADMIN/MANAGER/PM/SITE_MGR/TEAM_LEAD | Low: UI too restrictive |
| 7 | /santiere | ADMIN/MANAGER/PM | ADMIN/OWNER/MANAGER/PM | Low: OWNER missing from UI |
| 8 | Pontaj/Ore list | All roles | Backend scoped | Medium: no @Roles (scoped by project) |
| 9 | FOREMAN daily plans | Not in UI | Create/Edit/Complete | Medium: needs UI update |
| 10 | OWNER admin section | Hidden | Should see management | Low: FIXED in this audit |

---

## 7. Security Post-Phase 3.2

- **ISSUE-034 FIXED**: Registration now whitelists WORKER/VIEWER only.
- **ISSUE-033 FIXED**: All 13 controller/service pairs now pass uildScopedProjectWhere() result into Prisma queries.
- **ISSUE-035 FIXED**: Tasks controller has explicit @Roles on all 4 endpoints.
- **RoleGuard WIRED**: Client-side route guard blocks direct URL access on 8 restricted pages.
- **OWNER ADDED**: To management sidebar tier.
- **FOREMAN ADDED**: To daily-plans create/complete, teams member ops, daily-reports create.
