# Role / Sidebar / Action Visibility Matrix

> Source of truth: comprehensive backend (31 controllers) + frontend (21 routes + Sidebar.tsx + AppShell.tsx) audit.
> Last Updated: 2026-10-05 (UX-R1A C4 corrected two rows: `/control-tower` is the `Turn de Control` destination - `/statistici` is a C2 redirect and no longer a page - and `/avize` reads `Livrări & Avize`. See the notes below the table.)

---

## 1. Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access (create/read/update/delete) |
| 👁️ | Read-only |
| 🖉 | Create + update (no delete) |
| 🔒 | No access (role not in @Roles, not in sidebar, or blocked by guard) |
| ⚠️ | Mismatch between UI and backend (documented below) |

---

## 2. Role Hierarchy & Global Scope

### Global-scope roles (no ProjectMember row required)
ADMIN, OWNER, MANAGER

> **Phase 1 update (2026-10-05):** PM is project-scoped and requires a `ProjectMember` row.

### Membership-scope roles (require ProjectMember row per project)
SITE_MANAGER, FOREMAN, TEAM_LEADER, TECHNICIAN, WORKER, VIEWER, PROCUREMENT, FINANCE, QA_QC, SITE_LOGISTICS, MAINTENANCE_DIRECTOR, TECHNICAL_DIRECTOR

---

## 3. Sidebar Navigation Visibility

| Menu | Route | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | WORKER | VIEWER | PROCURE | FINANCE | QA_QC | SITE_LOG | MAINT_DIR | TECH_DIR |
|------|-------|-------|-------|---------|----|----------|---------|-----------|------|--------|--------|---------|---------|-------|----------|-----------|----------|
| **Operațiuni** | | | | | | | | | | | | | | | | | |
| Dashboard | / | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pontaj & Ore | /pontaj | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ✅ | ✅ | ✅ |
| Rapoarte Zilnice | /rapoarte | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ✅ | ✅ | ✅ |
| Livrări & Avize | /avize | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | 👁️ | 👁️ | ✅ | ✅ | ✅ |
| Materiale & Stoc | /stocuri | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ | ✅ | ✅ | ✅ |
| Cheltuieli | /cheltuieli | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | ✅ | 👁️ | 👁️ | ✅ | ✅ |
| **Management** | | | | | | | | | | | | | | | | | |
| Proiecte | /projects | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Echipe | /teams | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Forță de Muncă | /workforce | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Șantiere (GIS) | /santiere | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| Aprobări | /aprobare | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| Turn de Control | /control-tower | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Administrare** | | | | | | | | | | | | | | | | | |
| Utilizatori | /utilizatori | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Personal** | | | | | | | | | | | | | | | | | |
| Notificări | /notificari | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Profil | /profil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Authorization reconciliation notes (2026-10-05)
- **Row corrected:** `Statistici | /statistici` → `Turn de Control | /control-tower`. The sidebar item
  has pointed at `/control-tower` since UX-R1A C2 (the `/statistici` page was replaced by a 307
  redirect) and now carries its own `nav.control_tower` key instead of the temporary `nav.statistici`.
- **Row corrected:** `Procurement / Avize` → `Livrări & Avize` (the RO column is Romanian; the EN
  label is `Deliveries`).
- **Encoding debt (not fixed here):** this file still stores several labels as literal `\uXXXX`
  escapes (`Forță de Muncă`, `Șantiere (GIS)`, `Aprobări`,
  `Notificări`, `Operațiuni`) and the legend emoji render as mojibake. The two rows above
  now contain real characters; a full re-encode should happen when this document is next revised
  (ISSUE-056).

### Sidebar Group Visibility Rules
- **Operațiuni**: All authenticated users (no role filter)
- **Management**: admin, owner, manager, pm
- **Administrare**: admin only
- **Personal**: All authenticated users (no role filter)

---

## 4. API Action Authorization (Backend @Roles)

### 4.1 Auth
| Action | ADMIN | OWNER | MANAGER | PM | Others |
|--------|-------|-------|---------|----|--------|
| POST /api/auth/register | N/A (public) | N/A | N/A | N/A | WORKER/VIEWER only (ISSUE-034 FIXED) |
| POST /api/auth/login | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/auth/me | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.2 Projects
| Action | ADMIN | OWNER | MANAGER | PM | Others |
|--------|-------|-------|---------|----|--------|
| GET /api/projects | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/projects | ✅ | ✅ | ✅ | ✅ | 🔒 |
| PATCH /api/projects/:id | ✅ | ✅ | ✅ | ✅ | 🔒 |
| DELETE /api/projects/:id | ✅ | ✅ | 🔒 | 🔒 | 🔒 |

### 4.3 Tasks
| Action | ADMIN | OWNER | PM | MANAGER | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | WORKER | QA_QC | VIEWER |
|--------|-------|-------|----|---------|----------|---------|-----------|------|--------|-------|--------|
| GET /api/tasks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/tasks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |
| PATCH /api/tasks/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |
| POST /api/tasks/:id/assign | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 | 🔒 |

### 4.4 Daily Plans
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|--------|
| GET /api/daily-plans | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/daily-plans | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |
| POST :id/publish | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| POST :id/complete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |
| POST :id/cancel | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| PATCH tasks/:id/progress | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (assigned) |

### 4.5 Daily Reports
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | TECH | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|------|--------|
| GET /api/daily-reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| POST /api/daily-reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |

### 4.6 Expenses
| Action | ADMIN | OWNER | MANAGER | PM | FINANCE | SITE_MGR | Others |
|--------|-------|-------|---------|----|---------|----------|--------|
| GET /api/expenses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| POST /api/expenses | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST :id/approve | ✅ | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 |

### 4.7 Inventory / Stock
| Action | ADMIN | OWNER | MANAGER | PROCURE | SITE_MGR | TEAM_LEAD | Others |
|--------|-------|-------|---------|---------|----------|-----------|--------|
| GET /api/inventory/balance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/inventory/receive | ✅ | 🔒 | ✅ | ✅ | ✅ | ✅ | 🔒 |
| POST /api/inventory/consume | ✅ | 🔒 | ✅ | 🔒 | ✅ | ✅ | 🔒 |
| POST /api/inventory/transfer | ✅ | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 |
| GET /api/inventory/movements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |

### 4.8 Procurement
| Action | ADMIN | OWNER | MANAGER | PROCURE | SITE_MGR | TEAM_LEAD | Others |
|--------|-------|-------|---------|---------|----------|-----------|--------|
| GET /api/procurement/purchase-orders | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/procurement/purchase-orders | ✅ | 🔒 | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| GET /api/procurement/avize | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/procurement/avize | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ | 🔒 |

### 4.9 QA/QC
| Action | ADMIN | OWNER | PM | QA_QC | SITE_MGR | Others |
|--------|-------|-------|----|-------|----------|--------|
| GET /api/qa-qc/inspections | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/qa-qc/inspections | ✅ | 🔒 | ✅ | ✅ | ✅ | 🔒 |

### 4.10 Issues / NCRs
| Action | ADMIN | OWNER | PM | QA_QC | Others |
|--------|-------|-------|----|-------|--------|
| GET /api/issues | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/issues | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /api/issues/ncrs | ✅ | 🔒 | ✅ | ✅ | 🔒 |

### 4.11 Teams
| Action | ADMIN | OWNER | MANAGER | PM | SITE_MGR | FOREMAN | TEAM_LEAD | Others |
|--------|-------|-------|---------|----|----------|---------|-----------|--------|
| GET /api/teams | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (scoped) |
| POST /api/teams | ✅ | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| PATCH /api/teams/:id | ✅ | 🔒 | ✅ | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| DELETE /api/teams/:id | ✅ | 🔒 | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| POST :id/members | ✅ | 🔒 | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |
| DELETE :id/members/:userId | ✅ | 🔒 | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 |

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
| 1 | /projects | MANAGER can see | MANAGER can CRUD | ✅ Aligned |
| 2 | /projects create | ADMIN only | ADMIN/OWNER/MANAGER/PM | Low: UI too restrictive |
| 3 | /avize (Procurement) | Operational roles + PROCUREMENT | ADMIN/PROCUREMENT/SITE_MGR/TEAM_LEAD | Resolved: frontend now includes PROCUREMENT |
| 4 | /cheltuieli approve | Operational roles + FINANCE | ADMIN/MANAGER/PM/FINANCE | Resolved: frontend now includes FINANCE |
| 5 | /teams create | ADMIN only | ADMIN/MANAGER/PM/SITE_MGR | Low: UI too restrictive |
| 6 | /teams add member | ADMIN only | ADMIN/MANAGER/PM/SITE_MGR/TEAM_LEAD | Low: FIXED in Phase 11 — Sidebar and RoleGuard updated for team_leader |
| 7 | /santiere | ADMIN/OWNER/MANAGER/PM | ADMIN/OWNER/MANAGER/PM | Resolved: OWNER is in the canonical GIS route contract |
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

- **TEAM_LEADER SIDEBAR**: Added to Management section (access to /teams).
- **TEAMS PAGE**: RoleGuard updated to allow team_leader, site_manager, foreman; action buttons role-gated.
