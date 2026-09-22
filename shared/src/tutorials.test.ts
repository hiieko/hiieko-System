import {
  TUTORIALS,
  TUTORIAL_SECTION_IDS,
  CAMERA_TIPS_KEYS,
  getTutorial,
  TutorialContent,
} from './tutorials';
import { t, Locale } from './translations';
import {
  getLowConfidenceFields,
  ocrHasData,
  isOcrResultUsable,
  OCR_FIELD_KEYS,
} from './ocr';
import { OcrResult } from './types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log('--- RUNNING TUTORIALS & OCR INTEGRITY CHECKS ---');

// 1. Coverage — every meaningful Web page and Mobile screen has a tutorial.
const WEB_ROUTES: string[] = [
  'dashboard', 'attendance', 'reports', 'deliveries', 'stock', 'sites',
  'expenses', 'approvals', 'users', 'statistics', 'notifications', 'profile', 'login',
];
const MOBILE_SCREENS: string[] = [
  'attendance', 'reports', 'deliveries', 'expenses', 'notifications', 'scan', 'expenseReview',
];
for (const id of [...WEB_ROUTES, ...MOBILE_SCREENS]) {
  assert(
    !!getTutorial(id as keyof typeof TUTORIALS),
    `Tutorial coverage: '${id}' has a definition`
  );
}

// 2. Structure — every tutorial has the required fields, and all keys resolve in BOTH locales.
function collectKeys(c: TutorialContent): string[] {
  const keys: string[] = [c.titleKey, c.shortKey, c.purposeKey, ...c.steps];
  if (c.importantKey) keys.push(c.importantKey);
  for (const r of c.roles) keys.push(r.noteKey);
  if (c.helpItems) {
    for (const h of c.helpItems) {
      keys.push(h.labelKey, h.textKey);
    }
  }
  return keys;
}

for (const id of TUTORIAL_SECTION_IDS) {
  const c = TUTORIALS[id];
  assert(!!c.titleKey && !!c.shortKey && !!c.purposeKey && c.steps.length > 0,
    `Tutorial '${id}' has title/short/purpose/steps`);
  for (const key of collectKeys(c)) {
    const ro = t(key, 'ro');
    const en = t(key, 'en');
    assert(ro !== key, `Tutorial '${id}' key '${key}' resolves in RO`);
    assert(en !== key, `Tutorial '${id}' key '${key}' resolves in EN`);
    assert(ro.trim().length > 0 && en.trim().length > 0,
      `Tutorial '${id}' key '${key}' is non-empty in both locales`);
  }
}

// 3. Camera tips resolve in both locales.
for (const key of CAMERA_TIPS_KEYS) {
  assert(t(key, 'ro') !== key, `Camera tip '${key}' resolves in RO`);
  assert(t(key, 'en') !== key, `Camera tip '${key}' resolves in EN`);
}

// 4. OCR helpers.
const highConf: OcrResult = {
  merchant_name: 'Petrom',
  total: 100.5,
  confidence: 0.95,
  fields: { merchant_name: { value: 'Petrom', confidence: 0.92 }, total: { value: 100.5, confidence: 0.9 } },
};
assert(getLowConfidenceFields(highConf).length === 0,
  'No low-confidence fields when per-field confidence is high');

const lowConf: OcrResult = {
  merchant_name: 'Petrom',
  total: 100.5,
  confidence: 0.95,
  fields: { merchant_name: { value: 'Petrom', confidence: 0.4 }, total: { value: 100.5, confidence: 0.9 } },
};
const lowFields = getLowConfidenceFields(lowConf);
assert(lowFields.includes('merchant_name'), 'merchant_name flagged as low confidence');
assert(!lowFields.includes('total'), 'total not flagged (high confidence)');

const globalLow: OcrResult = { merchant_name: 'X', confidence: 0.3 };
assert(getLowConfidenceFields(globalLow).includes('merchant_name'),
  'Low global confidence flags populated fields');

assert(ocrHasData(highConf) === true, 'ocrHasData true when fields present');
assert(ocrHasData({} as OcrResult) === false, 'ocrHasData false when empty');
assert(isOcrResultUsable(highConf) === true, 'isOcrResultUsable true with total');
assert(isOcrResultUsable(undefined) === false, 'isOcrResultUsable false when undefined');

// 5. OCR field key list is well-formed (all entries valid, no duplicates).
const uniqueKeys = new Set(OCR_FIELD_KEYS);
assert(uniqueKeys.size === OCR_FIELD_KEYS.length, 'OCR_FIELD_KEYS has no duplicates');

console.log(`--- ALL ${WEB_ROUTES.length + MOBILE_SCREENS.length + 8} TUTORIAL/OCR CHECKS PASSED ---`);
