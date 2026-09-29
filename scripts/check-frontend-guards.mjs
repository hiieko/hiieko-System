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