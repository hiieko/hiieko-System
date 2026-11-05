/**
 * HIIEKO - Documents workspace constants and formatters.
 *
 * The category list mirrors the Prisma `DocumentTypeEnum` used by the
 * NestJS backend, and the accepted MIME types / size cap mirror
 * `backend/src/common/storage/file-validation.ts`. The client validation is a
 * convenience only - the server always validates again and stays the
 * authority.
 */

export const DOCUMENT_TYPES = [
  'BON_FISCAL',
  'FACTURA',
  'AVIZ',
  'CERTIFICAT_CONFORMITATE',
  'PROCES_VERBAL',
  'PLAN_TEHNIC',
  'CONTRACT',
  'RAPORT_TESTARE',
  'OTHER',
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

/** Translation key of every category, used for the localized label. */
export const DOCUMENT_TYPE_LABEL_KEYS: Record<DocumentTypeValue, string> = {
  BON_FISCAL: 'documents.type_bon_fiscal',
  FACTURA: 'documents.type_factura',
  AVIZ: 'documents.type_aviz',
  CERTIFICAT_CONFORMITATE: 'documents.type_certificat_conformitate',
  PROCES_VERBAL: 'documents.type_proces_verbal',
  PLAN_TEHNIC: 'documents.type_plan_tehnic',
  CONTRACT: 'documents.type_contract',
  RAPORT_TESTARE: 'documents.type_raport_testare',
  OTHER: 'documents.type_other',
};

/** MIME types accepted by the storage validation layer. */
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/xml',
  'text/xml',
];

/** Value of the `accept` attribute of the file input. */
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,.pdf,.xml';

/** Maximum upload size in bytes (server default: 10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Human readable file size. */
export function formatBytes(bytes: number | null | undefined, fallback = '—'): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return fallback;
  if (bytes <= 0) return fallback;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Preserve the existing filename extension while distinguishing a revision download. */
export function formatVersionFilename(title: string, version: number): string {
  const extensionStart = title.lastIndexOf('.');
  if (extensionStart > 0 && extensionStart < title.length - 1) {
    return `${title.slice(0, extensionStart)}.v${version}${title.slice(extensionStart)}`;
  }
  return `${title}.v${version}`;
}

/** Localized date/time. `locale` is the app locale ('ro' | 'en'). */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
  fallback = '—',
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB');
}

/** `true` when the browser can render the MIME type inline. */
export function isPreviewable(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return (
    mimeType === 'application/pdf' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    mimeType === 'application/xml' ||
    mimeType === 'text/xml'
  );
}

/** `true` when the preview is rendered as an image. */
export function isImage(mimeType: string | null | undefined): boolean {
  return (
    mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
  );
}

/** `true` when the preview is rendered as XML source. */
export function isXml(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/xml' || mimeType === 'text/xml';
}
