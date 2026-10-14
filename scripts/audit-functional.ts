/* eslint-disable */
/**
 * HIIEKO functional audit harness.
 *
 * READ-ONLY: logs in each seeded user (POST /api/auth/login only) and issues
 * GET requests against the list/detail endpoints declared in
 * web/src/lib/api-client.ts. No POST/PATCH/PUT/DELETE business calls, no DB
 * writes. Credentials are read from scripts/audit-functional.json (gitignored).
 *
 * Run:
 *   backend/node_modules/.bin/ts-node --transpile-only scripts/audit-functional.ts
 *
 * Output: docs/audit/functional-results.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:4000';
const ROOT = path.resolve(__dirname, '..');
const CREDENTIALS_PATH = path.join(__dirname, 'audit-functional.json');
const OUT_PATH = path.join(ROOT, 'docs', 'audit', 'functional-results.json');

interface Credential {
  key: string;
  email: string;
  password: string;
  role: string;
  label: string;
}

interface EndpointSpec {
  path: string;
  label: string;
  page: string;
}

type EndpointResult = {
  status: number | null;
  ms: number;
  topKeys: string[] | null;
  dataType: string | null;
  dataKeys: string[] | null;
  rowCount: number | null;
  empty: boolean | null;
  error: string | null;
};

const ENDPOINTS: EndpointSpec[] = [
  { path: '/api/auth/me', label: 'Current session identity', page: 'all authenticated pages (AuthContext bootstrap)' },
  { path: '/api/projects', label: 'Project list', page: '/projects, /santiere, /documente, /stocuri, /solar-configurator, ProjectContext' },
  { path: '/api/teams', label: 'Team list', page: '/teams, /planning, /projects/[id]' },
  { path: '/api/employees', label: 'Employee list', page: '/workforce' },
  { path: '/api/expenses', label: 'Expense list', page: '/cheltuieli, /aprobare' },
  { path: '/api/notifications', label: 'Notification list', page: '/notificari, shell notifications button, WorkerMyDay' },
  { path: '/api/documents', label: 'Document list', page: '/documente' },
  { path: '/api/users', label: 'User list', page: '/utilizatori, /workforce, /teams, /rapoarte, /pontaj, /projects/[id]' },
  { path: '/api/users/profile', label: 'Own profile', page: '/profil' },
  { path: '/api/attendance', label: 'Attendance records', page: '/pontaj' },
  { path: '/api/attendance/my-logs', label: 'Own attendance logs', page: 'WorkerDashboard' },
  { path: '/api/daily-reports', label: 'Daily report list', page: '/rapoarte, WorkerActionsRequired' },
  { path: '/api/materials', label: 'Material catalogue', page: '/stocuri, AvizCreateModal, DailyReportMaterialsSection' },
  { path: '/api/inventory/stock', label: 'Stock balances', page: '/stocuri' },
  { path: '/api/inventory/movements', label: 'Stock movements', page: '/stocuri' },
  { path: '/api/procurement/purchase-orders', label: 'Purchase orders', page: '(no page consumer found — API client only)' },
  { path: '/api/qa-qc/inspections', label: 'QA/QC inspections', page: '/qa, QualityWorkspace' },
  { path: '/api/suppliers', label: 'Supplier list', page: '/furnizori, AvizCreateModal' },
  { path: '/api/warehouses', label: 'Warehouse list', page: '/depozite' },
  { path: '/api/procurement/delivery-notes', label: 'Delivery notes (avize)', page: '/avize' },
  { path: '/api/tasks', label: 'Task list', page: '/tasks, /planning, DailyReportTasksSection' },
  { path: '/api/daily-plans', label: 'Daily plan list', page: '/planning, WorkerDashboard, WorkerTodayTasks' },
  { path: '/api/issues', label: 'Issue list', page: '/issues, WorkerBlockerList' },
  { path: '/api/control-tower/overview', label: 'Control tower overview', page: '/control-tower (ControlTowerSurface)' },
  { path: '/api/control-tower/red-flags', label: 'Control tower red flags', page: '/control-tower (ControlTowerSurface)' },
];

function describeData(data: any): { dataType: string | null; dataKeys: string[] | null; rowCount: number | null; empty: boolean | null } {
  if (data === undefined) return { dataType: null, dataKeys: null, rowCount: null, empty: null };
  if (data === null) return { dataType: 'null', dataKeys: null, rowCount: null, empty: true };
  if (Array.isArray(data)) {
    return { dataType: 'array', dataKeys: null, rowCount: data.length, empty: data.length === 0 };
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    let rowCount: number | null = null;
    let empty: boolean | null = null;
    for (const k of keys) {
      if (Array.isArray((data as any)[k])) {
        rowCount = (data as any)[k].length;
        empty = rowCount === 0;
        break;
      }
    }
    return { dataType: 'object', dataKeys: keys, rowCount, empty };
  }
  return { dataType: typeof data, dataKeys: null, rowCount: null, empty: null };
}

async function timedFetch(url: string, init: any): Promise<{ status: number | null; ms: number; body: any; error: string | null }> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const ms = Date.now() - started;
    const text = await res.text();
    let body: any = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
    }
    return { status: res.status, ms, body, error: null };
  } catch (err: any) {
    return { status: null, ms: Date.now() - started, body: null, error: err && err.message ? err.message : String(err) };
  }
}

async function probeHealth(): Promise<any> {
  const live = await timedFetch(`${BASE_URL}/health/live`, { method: 'GET' });
  const ready = await timedFetch(`${BASE_URL}/health/ready`, { method: 'GET' });
  return {
    live: { status: live.status, ms: live.ms, body: live.body },
    ready: { status: ready.status, ms: ready.ms, body: ready.body },
  };
}

async function login(user: Credential): Promise<{ ok: boolean; status: number | null; ms: number; role: string | null; error: string | null; token: string | null }> {
  const r = await timedFetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password, client: 'web' }),
  });
  const token = r.body && r.body.data && r.body.data.accessToken ? r.body.data.accessToken : null;
  const role = r.body && r.body.data && r.body.data.user ? r.body.data.user.role : null;
  const ok = r.status === 200 || r.status === 201;
  return {
    ok: ok && !!token,
    status: r.status,
    ms: r.ms,
    role: role || null,
    token,
    error: r.error || (!ok ? JSON.stringify(r.body).slice(0, 200) : null),
  };
}

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`Missing credentials file: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const users: Credential[] = creds.users;

  console.log(`HIIEKO functional audit @ ${BASE_URL}`);
  const health = await probeHealth();
  console.log(`  health.live=${health.live.status} health.ready=${health.ready.status}`);

  const loginResults: Record<string, any> = {};
  const tokens: Record<string, string | null> = {};

  for (const user of users) {
    const res = await login(user);
    loginResults[user.key] = { status: res.status, ms: res.ms, role: res.role, ok: res.ok, error: res.error };
    tokens[user.key] = res.token;
    const tag = res.ok ? 'OK' : 'FAIL';
    console.log(`  login ${tag} ${user.email} (${user.role}) -> http ${res.status} role=${res.role}`);
  }

  const matrix: Record<string, Record<string, EndpointResult>> = {};
  for (const ep of ENDPOINTS) {
    matrix[ep.path] = {};
    for (const user of users) {
      const token = tokens[user.key];
      if (!token) {
        matrix[ep.path][user.key] = { status: null, ms: 0, topKeys: null, dataType: null, dataKeys: null, rowCount: null, empty: null, error: 'no-token (login failed)' };
        continue;
      }
      const r = await timedFetch(`${BASE_URL}${ep.path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const isJsonObj = r.body && typeof r.body === 'object' && !Array.isArray(r.body);
      const topKeys = isJsonObj ? Object.keys(r.body) : null;
      const data = isJsonObj ? r.body.data : r.body;
      const d = describeData(data);
      matrix[ep.path][user.key] = {
        status: r.status,
        ms: r.ms,
        topKeys,
        dataType: d.dataType,
        dataKeys: d.dataKeys,
        rowCount: d.rowCount,
        empty: d.empty,
        error: r.error || (r.status && r.status >= 400 ? JSON.stringify(r.body).slice(0, 200) : null),
      };
    }
    const statuses = Object.values(matrix[ep.path]).map((x) => x.status);
    console.log(`  ${ep.path} -> ${statuses.join(',')}`);
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      nodeVersion: process.version,
      endpointCount: ENDPOINTS.length,
      userCount: users.length,
      method: 'GET-only, read-only probes',
    },
    health,
    users: users.map((u) => ({ key: u.key, email: u.email, role: u.role, label: u.label })),
    login: loginResults,
    endpoints: ENDPOINTS,
    matrix,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
