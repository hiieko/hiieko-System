#!/usr/bin/env node
/**
 * HIIEKO - stale task-contract guard  (UX-R1A / R1A.4)
 * ====================================================
 *
 * Zero-dependency Node 20 script. Run with `npm run guards:check`.
 *
 * Purpose: catch the OLD task contract. It is deliberately NOT a blanket ban on the words
 * TODO / DONE / REVIEW / ON_HOLD, because those appear legitimately elsewhere in the
 * product (ProjectStatusEnum `ON_HOLD`, SolarDesignStatusEnum `REVIEW`, lowercase
 * daily-report section ids `'review'` / `'done'`).
 *
 * G1 (FAIL) - `assigned_to_id`, the removed task-ownership column. Prisma `Task` has no such
 *             column (see VERIFICATION.md); any use reintroduces the dead contract. Scanned
 *             in web/src, Mobile/src and shared/src.
 *
 * G2 (FAIL) - a status literal that belongs to no current status contract, but only inside
 *             task/workflow implementation code (TASK_SCOPE below). This is what catches
 *             `'TODO'` / `'DONE'` used as task statuses, and any newly invented status,
 *             without touching unrelated legitimate strings elsewhere in the application.
 *
 * G3 (FAIL) - navigation ↔ `ROUTE_ROLES` parity. `config/route-roles.ts` is the
 *             authorization contract and `config/navigation.ts` is what the sidebar
 *             advertises; the contract in route-roles.ts states that a route a role
 *             cannot use MUST NOT be advertised to it. Two concrete assertions:
 *               G3a - every nav `href` must be a key of `ROUTE_ROLES` (no links to
 *                     routes outside the contract);
 *               G3b - every role a nav item is advertised to (its own `roles`, else its
 *                     group's `roles`, else every authenticated role) must be allowed by
 *                     `ROUTE_ROLES[href]` (`null` allows everyone; a list denies every
 *                     role outside it).
 *             The two config files are parsed as data (comments stripped, values walked),
 *             so `ROUTE_ROLES['/x']` references and role-array spreads resolve normally.
 *
 * R1 (REPORT) - allow-listed legacy tokens found OUTSIDE TASK_SCOPE (visibility only), and
 *             `progress` reads on a task object (Prisma `Task` exposes actual_quantity /
 *             planned_quantity, not `progress`).
 *
 * R2 (REPORT) - Romanian copy that is missing its diacritics (UX-R1A C4). Deliberately
 *             report-only: C4 normalised the vocabulary in the surfaces it touched, and this
 *             list keeps the remaining debt visible (R1B backlog) without blocking CI.
 *             A token counts only on a non-comment line and only when it is not glued to a
 *             path (`/santiere`), an identifier (`SantierePage`) or another word, so route
 *             literals and component names are never reported.
 *
 * Known limitation, accepted on purpose: `'ON_HOLD'` and `'REVIEW'` pass G2 inside task scope
 * because they are real members of ProjectStatusEnum / SolarDesignStatusEnum. G2's job is to
 * catch the removed task contract (`TODO`, `DONE`) and invented statuses, not to re-litigate
 * those enums.
 *
 * Escape hatch: a line containing `guards-allow` is skipped for that file+line only. Give the
 * reason in the same line.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const SCAN_ROOTS = ['web/src', 'Mobile/src', 'shared/src'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'out',
  'build',
  '.expo',
  'coverage',
  '.git',
]);

/**
 * Task / workflow implementation code. G2 only inspects these paths, so a legitimate
 * `'ON_HOLD'` in an unrelated module can never fail the build.
 */
const TASK_SCOPE = [
  'web/src/components/',
  'web/src/features/tasks/',
  'web/src/features/planning/',
  'web/src/features/attendance/',
  'web/src/features/daily-reports/',
  'web/src/features/issues/',
  'web/src/app/tasks/',
  'web/src/app/planning/',
  'web/src/app/page.tsx',
];

const MAX_REPORT_ROWS = 40;

/**
 * R2 tokens: Romanian words that are user-visible copy and must carry their diacritics.
 * Matching is case-insensitive; the lookarounds keep path segments (`/santiere`) and
 * identifiers (`SantierePage`, `ROLE_ADAUGAT`) out of the report.
 */
const RO_DIACRITIC_DEBT = new RegExp(
  '(?<![/\\w.])(?:' +
    [
      'Stantier', 'Santiere', 'Santier', 'Salveaza', 'Adauga', 'Selecteaza', 'Anuleaza',
      'Editeaza', 'Creeaza', 'Cauta', 'Incearca', 'Fara', 'Informatii', 'Notificari',
      'Setari', 'Distanta', 'Actiune', 'Intarziere', 'Reimprospateaza', 'Asteptare',
      'Prezenta', 'Iesire', 'Miscare', 'Sef', 'Inceput',
    ].join('|') +
    ')(?![/\\w])',
  'gi',
);

const rel = (absPath) => absPath.slice(REPO_ROOT.length).replace(/\\/g, '/').replace(/^\/+/, '');
const inTaskScope = (displayPath) =>
  TASK_SCOPE.some((entry) => displayPath === entry || displayPath.startsWith(entry));
const isCommentLine = (trimmed) =>
  trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

/** G1 pattern. */
const LEGACY_TASK_FIELD = /\bassigned_to_id\b/;

/**
 * Every status value that belongs to a real contract in this repository - the union of the
 * Prisma status enums (backend/prisma/schema.prisma) plus the UI filter sentinels used by the
 * planning/task filter chips. Anything outside this set used as a status is a defect.
 */
const KNOWN_STATUS_LITERALS = new Set([
  // TaskStatusEnum
  'PLANNED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'VERIFIED', 'CANCELLED',
  // DailyPlanStatusEnum / ExpenseStatusEnum / ChangeOrderStatusEnum / SolarDesignStatusEnum / OCRJobStateEnum
  'DRAFT', 'PUBLISHED', 'SUBMITTED', 'UNDER_REVIEW', 'UNDER_EVALUATION', 'APPROVED', 'REJECTED',
  'REIMBURSED', 'SUPERSEDED', 'PENDING', 'PROCESSING', 'FAILED',
  // IssueStatusEnum
  'OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION_PROPOSED', 'RESOLVED', 'CLOSED',
  // NCRStatusEnum
  'DISPOSITION_PROPOSED', 'IMPLEMENTED', 'VERIFIED_CLOSED',
  // AvizStatusEnum
  'DELIVERED', 'PARTIALLY_DELIVERED',
  // AttendanceStatusEnum
  'PRESENT', 'ABSENT', 'REST', 'MEDICAL_LEAVE', 'UNPAID_LEAVE',
  // ProjectStatusEnum
  'PLANNING', 'ENGINEERING', 'PROCUREMENT', 'CONSTRUCTION', 'TESTING', 'COMMISSIONING',
  'HANDOVER', 'ON_HOLD',
  // SolarDesignStatusEnum
  'REVIEW',
  // StockMovementTypeEnum
  'RECEIPT', 'CONSUMPTION', 'TRANSFER', 'ADJUSTMENT', 'RETURN',
  // UI filter sentinels (not persisted statuses)
  'ALL', 'ANY', 'NONE', 'OTHER',
]);

/** Status literals named in the task contract that was removed. */
const LEGACY_STATUS_LITERALS = new Set(['TODO', 'DONE']);

const STATUS_COMPARISON = /[Ss]tatus\s*(?:===|!==|==|!=)\s*'([A-Z][A-Z0-9_]*)'/g;
const STATUS_ASSIGNMENT = /[Ss]tatus\s*:\s*'([A-Z][A-Z0-9_]*)'/g;
const LEGACY_TOKEN_ANY_USAGE = /'(TODO|DONE|REVIEW|ON_HOLD)'/g;
const TASK_PROGRESS_READ = /\b(?:task|t|planTask|item)\.progress\b/g;

function collectSourceFiles(relDir) {
  const out = [];
  const stack = [join(REPO_ROOT, relDir)];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) stack.push(abs);
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

const legacyFieldRows = [];
const legacyStatusRows = [];
const legacyTokenOutsideScope = [];
const progressRows = [];
const terminologyRows = [];

const remember = (list, row) => {
  if (!list.includes(row)) list.push(row);
};

const files = SCAN_ROOTS.flatMap(collectSourceFiles);

for (const file of files) {
  const display = rel(file);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const scoped = inTaskScope(display);

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.includes('guards-allow')) return;

    if (LEGACY_TASK_FIELD.test(line)) {
      remember(legacyFieldRows, `${display}:${lineNumber}  ::  ${trimmed.slice(0, 110)}`);
    }

    if (!isCommentLine(trimmed)) {
      for (const match of line.matchAll(RO_DIACRITIC_DEBT)) {
        remember(
          terminologyRows,
          `${display}:${lineNumber}  ${match[0]}  ::  ${trimmed.slice(0, 90)}`,
        );
      }
    }

    if (!scoped) {
      for (const match of line.matchAll(LEGACY_TOKEN_ANY_USAGE)) {
        remember(
          legacyTokenOutsideScope,
          `${display}:${lineNumber}  ${match[1]}  ::  ${trimmed.slice(0, 90)}`,
        );
      }
      return;
    }

    const noteStatus = (value) => {
      if (KNOWN_STATUS_LITERALS.has(value)) return;
      const tag = LEGACY_STATUS_LITERALS.has(value) ? 'legacy status' : 'unsupported status';
      remember(
        legacyStatusRows,
        `${display}:${lineNumber}  ${tag} '${value}'  ::  ${trimmed.slice(0, 110)}`,
      );
    };
    for (const match of line.matchAll(STATUS_COMPARISON)) noteStatus(match[1]);
    for (const match of line.matchAll(STATUS_ASSIGNMENT)) noteStatus(match[1]);
    for (const match of line.matchAll(TASK_PROGRESS_READ)) {
      remember(progressRows, `${display}:${lineNumber}  ${match[0]}  ::  ${trimmed.slice(0, 110)}`);
    }
  });
}

/* ---------------------------------------------------------------------------
 * G3 - navigation ↔ ROUTE_ROLES parity
 * ------------------------------------------------------------------------ */

const ROUTE_ROLES_SOURCE = 'web/src/config/route-roles.ts';
const NAVIGATION_SOURCE = 'web/src/config/navigation.ts';

/** Remove comments without touching anything inside a string literal. */
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote !== null) {
      if (c === '\\') {
        out += c + (src[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let value = '';
      while (j < src.length) {
        if (src[j] === '\\') {
          value += src[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (src[j] === c) break;
        value += src[j];
        j += 1;
      }
      tokens.push({ t: 'str', v: value });
      i = j + 1;
      continue;
    }
    if ('{}[],:;.'.includes(c)) {
      tokens.push({ t: c });
      i += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j += 1;
      tokens.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    i += 1;
  }
  return tokens;
}

function parseValueAt(tokens, start, where) {
  const first = tokens[start];
  if (first === undefined) throw new Error(`unexpected end of input in ${where}`);
  if (first.t === 'str') return [{ kind: 'str', v: first.v }, start + 1];
  if (first.t === 'id' && (first.v === 'null' || first.v === 'undefined')) {
    return [{ kind: 'null' }, start + 1];
  }
  if (first.t === '[') {
    const items = [];
    let i = start + 1;
    while (tokens[i] !== undefined && tokens[i].t !== ']') {
      const [value, next] = parseValueAt(tokens, i, where);
      items.push(value);
      i = next;
      if (tokens[i] !== undefined && tokens[i].t === ',') i += 1;
    }
    if (tokens[i] === undefined || tokens[i].t !== ']') {
      throw new Error(`unterminated array in ${where}`);
    }
    return [{ kind: 'array', items }, i + 1];
  }
  if (first.t === '{') {
    const obj = {};
    let i = start + 1;
    while (tokens[i] !== undefined && tokens[i].t !== '}') {
      const key = tokens[i];
      if (key === undefined || (key.t !== 'str' && key.t !== 'id')) {
        throw new Error(`unexpected object key in ${where}`);
      }
      i += 1;
      if (tokens[i] === undefined || tokens[i].t !== ':') {
        throw new Error(`expected ':' after '${key.v}' in ${where}`);
      }
      const [value, next] = parseValueAt(tokens, i + 1, where);
      obj[key.v] = value;
      i = next;
      if (tokens[i] !== undefined && tokens[i].t === ',') i += 1;
    }
    if (tokens[i] === undefined || tokens[i].t !== '}') {
      throw new Error(`unterminated object in ${where}`);
    }
    return [{ kind: 'object', obj }, i + 1];
  }
  if (first.t === 'id') {
    const ref = { kind: 'ref', name: first.v, index: null };
    let i = start + 1;
    while (tokens[i] !== undefined && tokens[i].t === '[') {
      const inner = tokens[i + 1];
      if (inner === undefined || inner.t !== 'str') {
        throw new Error(`unsupported index expression in ${where}`);
      }
      ref.index = inner.v;
      if (tokens[i + 2] === undefined || tokens[i + 2].t !== ']') {
        throw new Error(`unterminated index expression in ${where}`);
      }
      i += 3;
    }
    while (
      tokens[i] !== undefined && tokens[i].t === '.' &&
      tokens[i + 1] !== undefined && tokens[i + 1].t === 'id'
    ) {
      ref.name += `.${tokens[i + 1].v}`;
      i += 2;
    }
    return [ref, i];
  }
  throw new Error(`unsupported token '${first.t}' in ${where}`);
}

function parseRouteRoles(src) {
  const roleSets = {};
  const declPattern = /export\s+const\s+(\w+)\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\]/g;
  for (const match of src.matchAll(declPattern)) {
    roleSets[match[1]] = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }

  const decl = /export\s+const\s+ROUTE_ROLES[^=]*=/.exec(src);
  if (decl === null) throw new Error(`ROUTE_ROLES declaration not found in ${ROUTE_ROLES_SOURCE}`);
  const open = src.indexOf('{', decl.index + decl[0].length);
  if (open === -1) throw new Error(`ROUTE_ROLES object literal not found in ${ROUTE_ROLES_SOURCE}`);
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) throw new Error(`ROUTE_ROLES object literal is not terminated in ${ROUTE_ROLES_SOURCE}`);

  const resolve = (raw) => {
    const value = raw.trim().replace(/,\s*$/, '').trim();
    if (value === 'null' || value === 'undefined') return null;
    if (value.startsWith('[')) {
      if (!/\]\s*$/.test(value)) {
        throw new Error(`multi-line ROUTE_ROLES value is not supported (${raw.trim()})`);
      }
      const roles = [];
      for (const part of value.matchAll(/\.\.\.\s*(\w+)|'([^']+)'/g)) {
        if (part[1] !== undefined) {
          if (roleSets[part[1]] === undefined) throw new Error(`unknown role array '${part[1]}'`);
          roles.push(...roleSets[part[1]]);
        } else {
          roles.push(part[2]);
        }
      }
      return roles;
    }
    if (roleSets[value] === undefined) throw new Error(`unresolved ROUTE_ROLES value '${value}'`);
    return roleSets[value];
  };

  const routeRoles = {};
  for (const line of src.slice(open + 1, close).split(/\r?\n/)) {
    const entry = /^\s*'([^']+)':\s*(.*)$/.exec(line);
    if (entry === null) continue;
    routeRoles[entry[1]] = resolve(entry[2]);
  }
  return { routeRoles, roleSets };
}

function parseNavGroups(src) {
  const cleaned = src.replace(/\?\?\s*(?:undefined|null)/g, '');
  const decl = /export\s+const\s+NAV_GROUPS[^=]*=/.exec(cleaned);
  if (decl === null) throw new Error(`NAV_GROUPS declaration not found in ${NAVIGATION_SOURCE}`);
  const open = cleaned.indexOf('[', decl.index + decl[0].length);
  if (open === -1) throw new Error(`NAV_GROUPS array literal not found in ${NAVIGATION_SOURCE}`);
  const [value] = parseValueAt(tokenize(cleaned.slice(open)), 0, 'NAV_GROUPS');
  if (value.kind !== 'array') throw new Error('NAV_GROUPS is not an array literal');
  return value.items;
}

const navParityFailures = [];
const navUnadvertised = [];

try {
  const routeRolesSrc = stripComments(
    readFileSync(join(REPO_ROOT, ROUTE_ROLES_SOURCE), 'utf8'),
  );
  const navSrc = stripComments(readFileSync(join(REPO_ROOT, NAVIGATION_SOURCE), 'utf8'));
  const { routeRoles, roleSets } = parseRouteRoles(routeRolesSrc);
  const groups = parseNavGroups(navSrc);
  const allRoles = [...new Set(Object.values(routeRoles).flatMap((roles) => roles ?? []))].sort();

  const resolveRoles = (value, where) => {
    if (value === undefined || value === null || value.kind === 'null') return null;
    if (value.kind === 'str') return [value.v];
    if (value.kind === 'array') {
      const roles = [];
      for (const element of value.items) {
        if (element.kind === 'str') roles.push(element.v);
        else if (element.kind === 'ref') roles.push(...resolveRef(element, where));
        else throw new Error(`unsupported nav role value in ${where}`);
      }
      return roles;
    }
    if (value.kind === 'ref') return resolveRef(value, where);
    throw new Error(`unsupported nav role value in ${where}`);
  };

  const resolveRef = (ref, where) => {
    if (ref.name === 'ROUTE_ROLES' && ref.index !== null) {
      if (!Object.prototype.hasOwnProperty.call(routeRoles, ref.index)) {
        throw new Error(`${where} reads ROUTE_ROLES['${ref.index}'], which does not exist`);
      }
      return routeRoles[ref.index];
    }
    if (roleSets[ref.name] !== undefined) return roleSets[ref.name];
    throw new Error(`${where} references unknown role source '${ref.name}'`);
  };

  const advertisedHrefs = new Set();
  const strValue = (node) => (node !== null && node !== undefined && node.kind === 'str' ? node.v : null);
  const objValue = (node) => (node !== null && node !== undefined && node.kind === 'object' ? node.obj : null);
  for (const rawGroup of groups) {
    const group = objValue(rawGroup);
    if (group === null) continue;
    const title = strValue(group.titleKey) ?? '?';
    const groupRoles = resolveRoles(group.roles, `${NAVIGATION_SOURCE} group ${title}`);
    const itemsNode = group.items;
    const items = itemsNode !== undefined && itemsNode.kind === 'array' ? itemsNode.items : [];
    for (const rawItem of items) {
      const item = objValue(rawItem);
      if (item === null) continue;
      const href = strValue(item.href);
      if (href === null) continue;
      advertisedHrefs.add(href);
      const contract = Object.prototype.hasOwnProperty.call(routeRoles, href)
        ? routeRoles[href]
        : undefined;
      if (contract === undefined) {
        navParityFailures.push(
          `${NAVIGATION_SOURCE} → '${href}' has no entry in ROUTE_ROLES`,
        );
        continue;
      }
      const advertised = item.roles !== undefined
        ? resolveRoles(item.roles, `${NAVIGATION_SOURCE} ${href}`)
        : groupRoles;
      const advertisedSet = advertised === null ? allRoles : advertised;
      const denied = contract === null ? [] : allRoles.filter((role) => !contract.includes(role));
      const conflicts = advertisedSet.filter((role) => denied.includes(role));
      if (conflicts.length > 0) {
        navParityFailures.push(
          `${NAVIGATION_SOURCE} → '${href}' advertised to [${conflicts.join(', ')}] ` +
            `but ROUTE_ROLES denies them`,
        );
      }
    }
  }
  for (const route of Object.keys(routeRoles)) {
    if (!advertisedHrefs.has(route)) navUnadvertised.push(`${ROUTE_ROLES_SOURCE} '${route}'`);
  }
} catch (error) {
  navParityFailures.push(`could not evaluate navigation parity: ${error.message}`);
}

const failures = [];
const reports = [];

if (legacyFieldRows.length > 0) {
  failures.push({
    title: `G1 removed task field 'assigned_to_id' (${legacyFieldRows.length})`,
    rows: [
      'Prisma `Task` has no `assigned_to_id` column - use the daily-plan contract instead',
      ...legacyFieldRows,
    ],
  });
}
if (legacyStatusRows.length > 0) {
  failures.push({
    title: `G2 status outside every current status contract (${legacyStatusRows.length})`,
    rows: [
      'TaskStatusEnum = PLANNED, READY, IN_PROGRESS, BLOCKED, COMPLETED, VERIFIED, CANCELLED',
      ...legacyStatusRows,
    ],
  });
}

if (navParityFailures.length > 0) {
  failures.push({
    title: `G3 navigation advertises a route/role ROUTE_ROLES denies (${navParityFailures.length})`,
    rows: [
      `${NAVIGATION_SOURCE} must advertise exactly what ${ROUTE_ROLES_SOURCE} allows`,
      ...navParityFailures,
    ],
  });
}

if (legacyTokenOutsideScope.length > 0) {
  reports.push({
    title: `legacy token outside task scope - reviewed, not failed (${legacyTokenOutsideScope.length})`,
    rows: legacyTokenOutsideScope.slice(0, MAX_REPORT_ROWS),
  });
}
if (progressRows.length > 0) {
  reports.push({
    title: `'progress' read on a task object (${progressRows.length})`,
    rows: [
      'Prisma `Task` exposes actual_quantity / planned_quantity, not progress',
      ...progressRows.slice(0, MAX_REPORT_ROWS),
    ],
  });
}
if (navUnadvertised.length > 0) {
  reports.push({
    title: `contract routes the sidebar does not advertise (${navUnadvertised.length})`,
    rows: [
      'detail / sub routes are expected here; a whole feature missing is worth a look',
      ...navUnadvertised.slice(0, MAX_REPORT_ROWS),
    ],
  });
}
if (terminologyRows.length > 0) {
  reports.push({
    title: `Romanian copy missing diacritics - report only (${terminologyRows.length})`,
    rows: [
      'UX-R1A C4 normalised this vocabulary where it was touched; the rows below are the rest (R1B)',
      ...terminologyRows.slice(0, MAX_REPORT_ROWS),
    ],
  });
}

const failureCount = failures.reduce((sum, f) => sum + f.rows.length, 0);

if (failures.length === 0) {
  console.log(`check-frontend-guards: PASS (${files.length} source files scanned)`);
} else {
  console.log(`check-frontend-guards: FAIL (${files.length} source files scanned)`);
  console.log(`  task scope: ${TASK_SCOPE.join(', ')}`);
  console.log('');
  for (const { title, rows } of failures) {
    console.log(`FAIL - ${title}`);
    for (const row of rows) console.log(`   ${row}`);
    console.log('');
  }
}

if (reports.length > 0) {
  console.log('REPORT ONLY (does not fail the check)');
  for (const { title, rows } of reports) {
    console.log(`   ${title}`);
    for (const row of rows) console.log(`     ${row}`);
  }
}

process.exit(failureCount === 0 ? 0 : 1);