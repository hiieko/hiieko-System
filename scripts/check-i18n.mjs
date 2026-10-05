#!/usr/bin/env node
/**
 * HIIEKO - translation integrity guard  (UX-R1A / R1A.4)
 * =====================================================
 *
 * Zero-dependency Node 20 script. Run with `npm run i18n:check`.
 *
 * FAIL (exit 1) - hard, CI-enforced:
 *   1. the translation table no longer parses as expected (parser collapse guard)
 *   2. duplicate translation keys
 *   3. mojibake / double-encoded text in a non-comment line
 *   4. a lossy '?' that replaced a Romanian diacritic inside UI text
 *   5. a translation call with a locale literal outside the supported set
 *   6. statically referenced translation keys that are not defined
 *   7. template-built tutorial keys (shared/src/tutorials.ts) that the translation
 *      table does not define - they would render as a raw key in the UI
 *
 * REPORT ONLY - printed, never fails CI:
 *   - orphan (defined but never statically referenced) keys
 *   - inline `locale === '...'` ternaries
 *   - dynamic `t(<expression>)` calls
 *   - mojibake that only appears inside a comment
 *
 * Comment-only mojibake is reported rather than failed so a stale note can never block a
 * build, while real user-visible corruption always fails.
 *
 * This script reads source text only. It never writes, never needs a build and never needs
 * the database.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const TRANSLATIONS_FILE = 'shared/src/translations.ts';
const SOURCE_ROOTS = ['web/src', 'Mobile/src', 'shared/src'];
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

/** Parsed keys below this count mean the parser lost the file shape - fail loudly. */
const MIN_EXPECTED_KEYS = 950;
const MAX_REPORT_ROWS = 40;

const rel = (absPath) => absPath.slice(REPO_ROOT.length).replace(/\\/g, '/').replace(/^\/+/, '');

// ---------------------------------------------------------------------------
// result collection (grouped by category, printed in a fixed order)
// ---------------------------------------------------------------------------

const FAILURE_ORDER = [
  'translation table no longer parses as expected',
  'duplicate translation keys',
  'mojibake in source text',
  "lossy '?' replacing a Romanian diacritic",
  'translation call with an unsupported locale',
  'referenced but undefined translation keys',
  'template-built tutorial keys missing from the translation table',
  'template-built translation keys not validated',
];
const REPORT_ORDER = [
  'orphan keys - defined but never referenced',
  'inline locale ternaries',
  'dynamic t() calls',
  't() calls whose first argument is not a key literal',
  'mojibake inside a comment (not user-visible)',
];

const failureRows = new Map();
const reportRows = new Map();

const push = (map, category, row) => {
  if (!map.has(category)) map.set(category, []);
  if (!map.get(category).includes(row)) map.get(category).push(row);
};
const addFailure = (category, row) => push(failureRows, category, row);
const addReport = (category, row) => push(reportRows, category, row);

const ranked = (order) => (a, b) => {
  const ri = order.indexOf(a);
  const rj = order.indexOf(b);
  return (ri === -1 ? order.length : ri) - (rj === -1 ? order.length : rj);
};

// ---------------------------------------------------------------------------
// file walking
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// translation file parsing
// ---------------------------------------------------------------------------

/** `'key': T('ro', 'en')` or `'key': { ro: '...', en: '...' }` */
const KEY_LINE = /^\s*'([^']+)':\s*(?:T\(|\{)/;

const isCommentLine = (trimmed) =>
  trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

function parseKeyDefinitions(text) {
  const defs = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || isCommentLine(trimmed)) return;
    const match = KEY_LINE.exec(line);
    if (match) defs.push({ key: match[1], line: index + 1 });
  });
  return defs;
}

// ---------------------------------------------------------------------------
// corruption detectors
// ---------------------------------------------------------------------------

const MOJIBAKE_PATTERNS = [
  { label: 'double-encoded em dash (U+00E2 U+20AC)', re: /\u00E2\u20AC/ },
  { label: 'double-encoded Latin-1 (U+00C3 + 0x80-0xBF)', re: /\u00C3[\u0080-\u00BF]/ },
  { label: 'double-encoded Latin-1 (U+00C5 + 0x80-0xBF)', re: /\u00C5[\u0080-\u00BF]/ },
  { label: 'U+017D (mangled Romanian I-breve)', re: /\u017D/ },
  { label: 'U+FFFD replacement character', re: /\uFFFD/ },
];

function findMojibake(line) {
  return MOJIBAKE_PATTERNS.filter(({ re }) => re.test(line)).map(({ label }) => label);
}

/** A '?' glued to the front of a lowercase Latin/Romanian-pair letter. */
const LOSSY_QUESTION_MARK = /\?[a-z\u00E0-\u00FF\u0102-\u021B]/;

/**
 * Remove the places where a legitimate '?' is expected - URL query strings, template
 * literals that build a URL, raw URLs and `/api/...` route literals - so the lossy-`?`
 * check only sees prose.
 */
function stripNonTextContexts(line) {
  return line
    .replace(/`[^`]*(?:https?:\/\/|\?[A-Za-z_][A-Za-z0-9_]*=)[^`]*`/g, ' TEMPLATE ')
    .replace(/\?[A-Za-z_][A-Za-z0-9_]*=/g, ' ?PARAM= ')
    .replace(/https?:\/\/\S+/g, ' URL ')
    .replace(/\/api\/[^\s'")`]*/g, ' ROUTE ');
}

// ---------------------------------------------------------------------------
// reference detectors
// ---------------------------------------------------------------------------

/** `t('some.key')` / `t("some.key", locale)` - a complete literal first argument. */
const STATIC_CALL = /(?<![\w.$])t\(\s*(['"])([^'"]+)\1(?=\s*[,)])/g;
/** `t(` whose first argument is NOT a complete literal (concatenated or a variable). */
const DYNAMIC_CALL = /(?<![\w.$])t\(\s*(?!['"][^'"]*['"]\s*[,)])/g;
/** `t('some.key', 'xx')` - explicit locale literal. */
const LOCALE_ARG_CALL = /(?<![\w.$])t\(\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]*)\3/g;
/** `tPrefix('nav.')` - every defined key with that prefix counts as referenced. */
const PREFIX_CALL = /(?<![\w.$])tPrefix\(\s*(['"])([^'"]+)\1/g;
const INLINE_LOCALE = /locale\s*(?:===|!==|==|!=)\s*['"]/g;

const KEY_SHAPE = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/;
const SUPPORTED_LOCALE_LITERALS = new Set(['ro', 'en']);

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const translationsAbs = join(REPO_ROOT, TRANSLATIONS_FILE);
let translationsText = '';
try {
  translationsText = readFileSync(translationsAbs, 'utf8');
} catch (error) {
  console.error(`check-i18n: cannot read ${TRANSLATIONS_FILE} - ${error.message}`);
  process.exit(1);
}

const definitions = parseKeyDefinitions(translationsText);
const uniqueKeys = new Set(definitions.map((d) => d.key));

// --- 1. parser collapse guard ----------------------------------------------
if (definitions.length < MIN_EXPECTED_KEYS) {
  addFailure(
    'translation table no longer parses as expected',
    `parsed ${definitions.length} key definitions, expected >= ${MIN_EXPECTED_KEYS} - the file shape changed (const d = {...} plus Object.assign(d, {...}) blocks), update the parser`,
  );
}

// --- 2. duplicate keys ------------------------------------------------------
const linesByKey = new Map();
for (const def of definitions) {
  if (!linesByKey.has(def.key)) linesByKey.set(def.key, []);
  linesByKey.get(def.key).push(def.line);
}
for (const [key, lines] of [...linesByKey.entries()].filter(([, l]) => l.length > 1).sort()) {
  addFailure('duplicate translation keys', `${key}  ->  ${lines.join(', :')}`);
}

// --- scan every source file -------------------------------------------------
const files = SOURCE_ROOTS.flatMap(collectSourceFiles).filter((file) => file !== translationsAbs);

const referencedKeys = new Set();
const undefinedRefCandidates = [];
const nonKeyRefs = [];
const dynamicCalls = [];
const badLocaleLiterals = [];
const inlineLocaleFiles = new Map();

for (const file of files) {
  const display = rel(file);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const comment = isCommentLine(trimmed);
    if (trimmed.length === 0) return;

    // 3/4. mojibake + U+FFFD
    const mojibake = findMojibake(line);
    if (mojibake.length > 0) {
      const row = `${display}:${lineNumber}  ${mojibake.join(', ')}  ::  ${trimmed.slice(0, 90)}`;
      if (comment) addReport('mojibake inside a comment (not user-visible)', row);
      else addFailure('mojibake in source text', row);
    }

    if (comment) return;

    // 5. lossy '?' that replaced a diacritic
    if (LOSSY_QUESTION_MARK.test(stripNonTextContexts(line))) {
      addFailure(
        "lossy '?' replacing a Romanian diacritic",
        `${display}:${lineNumber}  ::  ${trimmed.slice(0, 100)}`,
      );
    }

    // 6 + reports. translation calls and inline locale ternaries
    for (const match of line.matchAll(STATIC_CALL)) {
      const literal = match[2];
      if (KEY_SHAPE.test(literal)) {
        referencedKeys.add(literal);
        undefinedRefCandidates.push({ literal, display, lineNumber });
      } else {
        nonKeyRefs.push(`${display}:${lineNumber}  t(${JSON.stringify(literal)})`);
      }
    }
    for (const match of line.matchAll(LOCALE_ARG_CALL)) {
      if (!SUPPORTED_LOCALE_LITERALS.has(match[4])) {
        badLocaleLiterals.push(
          `${display}:${lineNumber}  t(${JSON.stringify(match[2])}, ${JSON.stringify(match[4])})`,
        );
      }
    }
    for (const match of line.matchAll(DYNAMIC_CALL)) {
      dynamicCalls.push(`${display}:${lineNumber}  ::  ${trimmed.slice(0, 90)}`);
    }
    for (const match of line.matchAll(PREFIX_CALL)) {
      for (const key of uniqueKeys) if (key.startsWith(match[2])) referencedKeys.add(key);
    }
    const inlineCount = (line.match(INLINE_LOCALE) || []).length;
    if (inlineCount > 0) {
      inlineLocaleFiles.set(display, (inlineLocaleFiles.get(display) || 0) + inlineCount);
    }
  });
}

// --- 6. statically referenced but undefined keys ----------------------------
for (const { literal, display, lineNumber } of undefinedRefCandidates) {
  if (!uniqueKeys.has(literal)) {
    addFailure('referenced but undefined translation keys', `${display}:${lineNumber}  ${literal}`);
  }
}

// --- 7. template-built tutorial keys ----------------------------------------
// shared/src/tutorials.ts builds its keys from a per-section prefix
// (K('planning') followed by '.title'), so the literal-key rules above are blind
// to them and a section whose copy is missing renders as a raw key through
// PageTutorial/PageIntro. Resolve those templates into concrete keys here: every
// generated key must be defined in the table and counts as referenced (the UI
// renders it via getTutorial). TUTORIAL_KEY_PREFIX mirrors the K() helper in
// tutorials.ts - if that helper ever changes this rule fails loudly, never silently.
const TUTORIALS_FILE = 'shared/src/tutorials.ts';
const TUTORIAL_KEY_PREFIX = 'tutorial.';
/** K('planning') + '.title' inside a template literal -> one concrete key. */
const TEMPLATE_KEY = /K\((['"])([A-Za-z-]+)\1\)\}((?:\.[A-Za-z0-9_]+)+)/g;

let templateKeysResolved = 0;
try {
  const tutorialsDisplay = TUTORIALS_FILE;
  const tutorialsText = readFileSync(join(REPO_ROOT, TUTORIALS_FILE), 'utf8');
  for (const line of tutorialsText.split(/\r?\n/)) {
    if (isCommentLine(line.trim())) continue;
    for (const match of line.matchAll(TEMPLATE_KEY)) {
      const key = TUTORIAL_KEY_PREFIX + match[2] + match[3];
      if (!KEY_SHAPE.test(key)) continue;
      templateKeysResolved += 1;
      referencedKeys.add(key);
      if (!uniqueKeys.has(key)) {
        addFailure(
          'template-built tutorial keys missing from the translation table',
          tutorialsDisplay + '  ' + key,
        );
      }
    }
  }
} catch (error) {
  const reason = TUTORIALS_FILE + '  could not be read (' + error.message + ')';
  addFailure(
    'template-built translation keys not validated',
    reason + ' - refusing to pass while checking nothing',
  );
}
if (templateKeysResolved === 0) {
  addFailure(
    'template-built translation keys not validated',
    TUTORIALS_FILE + '  no key template resolved - refusing to pass while checking nothing',
  );
}

// --- 8. unsupported locale literals ----------------------------------------
for (const row of badLocaleLiterals) addFailure('translation call with an unsupported locale', row);

// --- reports ----------------------------------------------------------------
const orphans = [...uniqueKeys].filter((key) => !referencedKeys.has(key)).sort();
for (const key of orphans.slice(0, MAX_REPORT_ROWS)) {
  addReport(
    'orphan keys - defined but never referenced',
    `${key}  (${TRANSLATIONS_FILE}:${linesByKey.get(key)[0]})`,
  );
}
if (orphans.length > MAX_REPORT_ROWS) {
  addReport('orphan keys - defined but never referenced', `...and ${orphans.length - MAX_REPORT_ROWS} more`);
}

const inlineTotal = [...inlineLocaleFiles.values()].reduce((sum, n) => sum + n, 0);
for (const [file, count] of [...inlineLocaleFiles.entries()].sort((a, b) => b[1] - a[1])) {
  addReport('inline locale ternaries', `${String(count).padStart(4)}  ${file}`);
}
addReport('inline locale ternaries', `total ${inlineTotal} in ${inlineLocaleFiles.size} files`);

for (const row of dynamicCalls.slice(0, MAX_REPORT_ROWS)) addReport('dynamic t() calls', row);
for (const row of nonKeyRefs.slice(0, MAX_REPORT_ROWS)) {
  addReport('t() calls whose first argument is not a key literal', row);
}

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------

const scannedLabel = `${files.length} source files, ${definitions.length} key definitions, ${uniqueKeys.size} unique keys`;
const failureCount = [...failureRows.values()].reduce((sum, rows) => sum + rows.length, 0);

if (failureCount === 0) {
  console.log(`check-i18n: PASS (${scannedLabel})`);
} else {
  console.log(`check-i18n: FAIL (${scannedLabel})`);
  console.log('');
  for (const category of [...failureRows.keys()].sort(ranked(FAILURE_ORDER))) {
    const rows = failureRows.get(category);
    console.log(`FAIL - ${category} (${rows.length})`);
    for (const row of rows) console.log(`   ${row}`);
    console.log('');
  }
}

if (reportRows.size > 0) {
  console.log('REPORT ONLY (does not fail the check)');
  for (const category of [...reportRows.keys()].sort(ranked(REPORT_ORDER))) {
    console.log(`   ${category}`);
    for (const row of reportRows.get(category)) console.log(`     ${row}`);
  }
}

process.exit(failureCount === 0 ? 0 : 1);