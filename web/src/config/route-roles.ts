/**
 * Canonical route ↔ role contract (UX-R1A C2).
 *
 * Single source of truth for "which roles may use which route". Consumed by:
 *   - `config/navigation.ts`  → the sidebar advertises exactly these links
 *   - `lib/auth-guard.tsx`    → `RoleGuard` is fed `ROUTE_ROLES[route]`
 *   - `app/page.tsx`          → the `/` role router picks the home surface
 *   - `app/control-tower/…`   → redirects roles that are not allowed to `/`
 *
 * Contract:
 *   - `null` means "every authenticated role" (no role restriction).
 *   - `RoleGuard` additionally lets `admin` / `owner` through everywhere
 *     (pre-existing superset behaviour, recorded in ISSUES.md).
 *   - Consistency rule: a route a role cannot use MUST NOT be advertised to it
 *     in the sidebar, and a route advertised in the sidebar MUST NOT be denied
 *     by `RoleGuard`.
 *
 * Backend `@Roles()` decorators are NOT the source of truth for this map: they
 * protect the API, not the information architecture, and are not proof of the
 * intended organisational permission model. Where backend and business matrix
 * diverge, the currently safe (no-403) front-end behaviour is kept here and the
 * divergence is recorded in `Project workflow/ISSUES.md`.
 */

/**
 * The broad operational set used by the day-to-day execution routes
 * (`/tasks`, `/planning`, `/issues`, `/pontaj`, `/rapoarte`, `/avize`,
 * `/stocuri`, `/cheltuieli`). Matches those pages' `RoleGuard` today.
 */
export const OPERATIONAL_ROLES: string[] = [
  'admin',
  'owner',
  'manager',
  'pm',
  'site_manager',
  'foreman',
  'team_leader',
  'technician',
  'worker',
];

/** Project/team planning set (`/projects`, `/projects/[id]`, `/teams`). */
export const PROJECT_ROLES: string[] = [
  'admin',
  'owner',
  'manager',
  'pm',
  'site_manager',
  'foreman',
  'team_leader',
];

/**
 * `/solar-configurator`. Note: `worker` is deliberately NOT here — the sidebar
 * never offered it, so the page guard is aligned to the advertised contract.
 */
export const SOLAR_CONFIGURATOR_ROLES: string[] = [
  'admin',
  'owner',
  'manager',
  'pm',
  'site_manager',
  'foreman',
  'technician',
];

/**
 * `/workforce`. `site_manager` / `foreman` / `team_leader` are excluded because
 * `GET /api/employees` (`@Roles(ADMIN, MANAGER, PM, FINANCE)`) answers 403 for
 * them; the sidebar must not advertise a link that fails. See ISSUES.md.
 */
export const WORKFORCE_ROLES: string[] = ['admin', 'owner', 'manager', 'pm'];

/**
 * `/aprobare`. `owner` is kept (current page guard + role superset) and
 * `procurement` / `finance` are NOT added: the expense approval contract has
 * not been verified as an intended organisational permission. See ISSUES.md.
 */
export const APPROVAL_ROLES: string[] = ['admin', 'owner', 'manager', 'pm'];

/** `/santiere` (GIS). Matches the current page guard exactly. */
export const GIS_ROLES: string[] = ['admin', 'owner', 'manager', 'pm', 'site_manager'];

/** `/utilizatori` — administration only, aligned with the page guard. */
export const ADMIN_ROLES: string[] = ['admin'];

/**
 * `/control-tower` (the canonical Control Tower route, and the surface `/`
 * renders for these roles).
 *
 * This list reproduces the existing role-home intent of `/`: every role that is
 * neither the worker home (`worker`) nor a field-home (`FIELD_HOME_ROLES`) has
 * always landed on the Control Tower there. Narrowing it would remove working
 * access for the operational read-only roles, which is an authorisation
 * decision, not a C2 navigation change (see ISSUES.md).
 */
export const CONTROL_TOWER_ROLES: string[] = [
  'admin',
  'owner',
  'manager',
  'pm',
  'procurement',
  'finance',
  'qa_qc',
  'viewer',
  'site_logistics',
  'maintenance_director',
  'technical_director',
];

/** Roles whose `/` home is the worker day surface. */
export const WORKER_HOME_ROLES: string[] = ['worker'];

/** Roles whose `/` home is the temporary field dashboard. */
export const FIELD_HOME_ROLES: string[] = [
  'technician',
  'team_leader',
  'foreman',
  'site_manager',
];

/** Every routed destination that has a role contract. */
export type AppRoute =
  | '/'
  | '/control-tower'
  | '/solar-configurator'
  | '/tasks'
  | '/planning'
  | '/issues'
  | '/pontaj'
  | '/rapoarte'
  | '/avize'
  | '/stocuri'
  | '/cheltuieli'
  | '/projects'
  | '/projects/[id]'
  | '/teams'
  | '/workforce'
  | '/santiere'
  | '/aprobare'
  | '/utilizatori'
  | '/notificari'
  | '/profil';

/**
 * Canonical role contract per route. `null` = every authenticated role.
 *
 * `/statistici` is intentionally absent: it is no longer a destination, it
 * redirects to `/control-tower` (see `web/next.config.js`).
 */
export const ROUTE_ROLES = {
  // Role router: every authenticated role has a home surface here.
  '/': null,
  '/control-tower': CONTROL_TOWER_ROLES,
  '/solar-configurator': SOLAR_CONFIGURATOR_ROLES,
  '/tasks': OPERATIONAL_ROLES,
  '/planning': OPERATIONAL_ROLES,
  '/issues': OPERATIONAL_ROLES,
  '/pontaj': OPERATIONAL_ROLES,
  '/rapoarte': OPERATIONAL_ROLES,
  '/avize': OPERATIONAL_ROLES,
  '/stocuri': OPERATIONAL_ROLES,
  '/cheltuieli': OPERATIONAL_ROLES,
  '/projects': PROJECT_ROLES,
  // Detail route mirrors its list route (same guard on both pages today).
  '/projects/[id]': PROJECT_ROLES,
  '/teams': PROJECT_ROLES,
  '/workforce': WORKFORCE_ROLES,
  '/santiere': GIS_ROLES,
  '/aprobare': APPROVAL_ROLES,
  '/utilizatori': ADMIN_ROLES,
  '/notificari': null,
  '/profil': null,
} satisfies Record<AppRoute, string[] | null>;