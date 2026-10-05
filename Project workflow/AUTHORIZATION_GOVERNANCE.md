# Authorization Governance

**Status:** enforced RBAC remains the security boundary; granular permissions are governance-ready but not globally enforced.

## Rules
1. `@Roles()` remains the API enforcement contract until every endpoint has reviewed permission metadata.
2. `PermissionsGuard` is fail-open only when an endpoint declares no permission metadata; this preserves existing behavior while the catalog is introduced.
3. ADMIN and OWNER retain the existing global bypass.
4. Project isolation remains independent of module/action permissions.
5. A permission grant must never be inferred from a frontend route.
6. New endpoint work should add both `@Roles()` and, once the module/action mapping is approved, `@Permissions({ module, action })`.

## Canonical permission vocabulary
The merged catalog contains modules: users, roles, permissions, employees, teams, projects, project-stages, tasks, task-dependencies, attendance, daily-plans, daily-reports, materials, inventory, warehouses, procurement, suppliers, documents, ocr, expenses, upload, qa-qc, issues, change-orders, costs, notifications, control-tower, solar, audit.
Actions are: `read`, `create`, `update`, `delete`.

## Current decision
No role-permission rows are seeded yet. This is intentional: the existing endpoint-level role matrix contains distinctions that a simple module/action mapping cannot safely express, including approval, publish/cancel, project-scoped writes, and role-specific operational actions.

## 2026-10-05 reconciliation
Frontend route-role drift was corrected for workforce, approval, avize, expenses, and solar. Backend role enforcement was not weakened.