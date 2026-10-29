import type { DocumentTypeValue } from './documents.constants';

export interface ClassificationProjectEvidence {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
}

export interface ClassificationCandidate<T> {
  value: T;
  confidence: 'high' | 'medium';
  explanation: string;
}

export interface DocumentClassificationSuggestions {
  categories: ClassificationCandidate<DocumentTypeValue>[];
  projects: ClassificationCandidate<ClassificationProjectEvidence>[];
  evidence: string[];
}

export interface DescriptiveFilenameSuggestion {
  filename: string;
  explanation: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesPhrase(source: string, phrase: string): boolean {
  return ` ${source} `.includes(` ${normalize(phrase)} `);
}

const CATEGORY_RULES: Array<{
  type: DocumentTypeValue;
  phrases: string[];
  broadPhrases?: string[];
  explanation: string;
}> = [
  {
    type: 'BON_FISCAL',
    phrases: ['bon fiscal', 'fiscal receipt', 'cash receipt'],
    broadPhrases: ['chitanta', 'receipt'],
    explanation: 'documents.suggestion_reason_receipt',
  },
  {
    type: 'FACTURA',
    phrases: ['factura', 'invoice', 'tax invoice'],
    explanation: 'documents.suggestion_reason_invoice',
  },
  {
    type: 'AVIZ',
    phrases: ['aviz', 'delivery note', 'dispatch note'],
    explanation: 'documents.suggestion_reason_delivery',
  },
  {
    type: 'CERTIFICAT_CONFORMITATE',
    phrases: ['certificat conformitate', 'certificate conformity', 'declaration conformity'],
    explanation: 'documents.suggestion_reason_conformity',
  },
  {
    type: 'PROCES_VERBAL',
    phrases: ['proces verbal', 'minutes of meeting', 'handover protocol'],
    explanation: 'documents.suggestion_reason_minutes',
  },
  {
    type: 'PLAN_TEHNIC',
    phrases: ['plan tehnic', 'technical drawing', 'technical plan', 'site plan', 'layout drawing'],
    broadPhrases: ['drawing', 'plan'],
    explanation: 'documents.suggestion_reason_drawing',
  },
  {
    type: 'CONTRACT',
    phrases: ['contract', 'agreement'],
    explanation: 'documents.suggestion_reason_contract',
  },
  {
    type: 'RAPORT_TESTARE',
    phrases: ['raport testare', 'test report', 'testing report'],
    explanation: 'documents.suggestion_reason_test',
  },
];

const CATEGORY_FILENAME_TOKENS: Partial<Record<DocumentTypeValue, string>> = {
  BON_FISCAL: 'bon-fiscal',
  FACTURA: 'factura',
  AVIZ: 'aviz',
  CERTIFICAT_CONFORMITATE: 'certificat-conformitate',
  PROCES_VERBAL: 'proces-verbal',
  PLAN_TEHNIC: 'plan-tehnic',
  CONTRACT: 'contract',
  RAPORT_TESTARE: 'raport-testare',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/xml': '.xml',
  'text/xml': '.xml',
};

/**
 * Deterministic suggestions from names/codes and the caller's authorized
 * project records only. Suggestions are never persistence decisions.
 */
export function suggestDocumentClassification(input: {
  fileName?: string | null;
  title?: string | null;
  code?: string | null;
  mimeType?: string | null;
  currentCategory?: string | null;
  projects: ClassificationProjectEvidence[];
}): DocumentClassificationSuggestions {
  const textParts = [input.fileName, input.title, input.code].filter(Boolean) as string[];
  const normalizedEvidence = normalize(textParts.join(' '));
  const extension = input.fileName?.match(/\.([a-z0-9]{2,8})$/i)?.[1]?.toLowerCase();

  const categories = CATEGORY_RULES.flatMap((rule) => {
    const exact = rule.phrases.find((phrase) => includesPhrase(normalizedEvidence, phrase));
    const broad = !exact && rule.broadPhrases?.find((phrase) => includesPhrase(normalizedEvidence, phrase));
    const drawingExtension = rule.type === 'PLAN_TEHNIC' && ['dwg', 'dxf'].includes(extension ?? '');
    if (!exact && !broad && !drawingExtension) return [];
    const confidence: ClassificationCandidate<DocumentTypeValue>['confidence'] = exact || drawingExtension ? 'high' : 'medium';
    const evidence = exact ? `“${exact}”` : drawingExtension ? `.${extension}` : `“${broad}”`;
    return [{
      value: rule.type,
      confidence,
      explanation: `${rule.explanation}|${evidence}`,
    }];
  }).sort((a, b) => a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1);

  const projectMatches = input.projects.flatMap((project) => {
    const normalizedCode = normalize(project.code ?? '');
    const exactCode = normalizedCode.length > 1 && includesPhrase(normalizedEvidence, normalizedCode);
    const normalizedName = normalize(project.name);
    const nameMatch = normalizedName.length > 5 && includesPhrase(normalizedEvidence, normalizedName);
    const normalizedAddress = normalize(project.address ?? '');
    const addressMatch = normalizedAddress.length > 8 && includesPhrase(normalizedEvidence, normalizedAddress);
    if (!exactCode && !nameMatch && !addressMatch) return [];
    const reason = exactCode
      ? 'documents.suggestion_reason_project_code'
      : nameMatch
        ? 'documents.suggestion_reason_project_name'
        : 'documents.suggestion_reason_project_address';
    const evidence = exactCode ? project.code : nameMatch ? project.name : project.address;
    const confidence: ClassificationCandidate<ClassificationProjectEvidence>['confidence'] = exactCode ? 'high' : 'medium';
    return [{
      value: project,
      confidence,
      explanation: `${reason}|${evidence}`,
    }];
  }).sort((a, b) => a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1);

  const evidence: string[] = [];
  if (input.fileName) evidence.push(`documents.suggestion_evidence_filename|${input.fileName}`);
  if (input.title) evidence.push(`documents.suggestion_evidence_title|${input.title}`);
  if (input.code) evidence.push(`documents.suggestion_evidence_code|${input.code}`);
  if (input.mimeType) evidence.push(`documents.suggestion_evidence_mime|${input.mimeType}`);
  if (input.currentCategory) evidence.push(`documents.suggestion_evidence_current_category|${input.currentCategory}`);

  return { categories, projects: projectMatches, evidence };
}

export function parseClassificationExplanation(value: string): { key: string; evidence?: string } {
  const [key, evidence] = value.split('|', 2);
  return { key, evidence };
}

/**
 * Build a review-only title suggestion from existing metadata. This does not
 * inspect file contents or rename the stored object; the extension is retained
 * from the source filename/title or derived from a known MIME type.
 */
export function suggestDescriptiveFilename(input: {
  sourceName?: string | null;
  title?: string | null;
  code?: string | null;
  projectCode?: string | null;
  documentType?: string | null;
  mimeType?: string | null;
}): DescriptiveFilenameSuggestion | null {
  const source = (input.title || input.sourceName || '').trim();
  if (!source) return null;

  const sourceExtension = source.match(/\.([a-z0-9]{1,10})$/i)?.[0];
  const filenameExtension = input.sourceName?.match(/\.([a-z0-9]{1,10})$/i)?.[0];
  const extension = filenameExtension || sourceExtension || MIME_EXTENSIONS[input.mimeType ?? ''] || '';
  const basename = sourceExtension ? source.slice(0, -sourceExtension.length) : source;
  const segments: string[] = [];
  const addIfAbsent = (value?: string | null) => {
    const clean = value?.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!clean) return;
    if (includesPhrase(normalize(basename), clean)) return;
    segments.push(clean);
  };

  addIfAbsent(input.projectCode);
  addIfAbsent(input.code);
  addIfAbsent(input.documentType ? CATEGORY_FILENAME_TOKENS[input.documentType as DocumentTypeValue] : undefined);
  segments.push(basename.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, ''));

  const stem = segments.filter(Boolean).join('_');
  if (!stem) return null;
  const maxStemLength = Math.max(1, 180 - extension.length);
  return {
    filename: `${stem.slice(0, maxStemLength)}${extension}`,
    explanation: 'documents.filename_suggestion_evidence',
  };
}
