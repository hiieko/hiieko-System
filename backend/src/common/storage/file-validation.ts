import { BadRequestException } from '@nestjs/common';

/**
 * Shared upload validation for every HIIEKO binary write path.
 *
 * The MIME allowlist, the byte cap and the content-signature (magic byte)
 * checks live here so the upload pipeline (`UploadService`) and the document
 * workspace (`DocumentsService`) validate a file EXACTLY the same way. A file
 * accepted by one endpoint must never be rejected by the other, and a file
 * rejected by one must never be accepted by the other.
 *
 * The list mirrors the MIME types accepted by the OCR pipeline, so any stored
 * document can always be OCR-processed later through the existing
 * `POST /api/ocr/process` route.
 */
export const DOCUMENT_MIME_ALLOWLIST: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/xml',
  'text/xml',
] as const;

/** Default upload byte cap (10 MB). Overridable via MAX_FILE_SIZE. */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** MIME type -> stored file extension. Mirrors the storage drivers. */
export const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/xml': '.xml',
  'text/xml': '.xml',
};

/** Stored file extension -> MIME type. Used to describe an already stored file. */
export const EXTENSION_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

/** ASCII whitespace bytes (space, tab, CR, LF) permitted before a PDF header or XML prolog. */
function isAsciiWhitespace(byte: number | undefined): boolean {
  return byte === 0x20 || byte === 0x09 || byte === 0x0d || byte === 0x0a;
}

/** JPEG: SOI marker FF D8 FF at the start of the buffer. */
function hasJpegSignature(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/** PNG: the fixed 8-byte signature 89 50 4E 47 0D 0A 1A 0A. */
function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/** WebP: RIFF container — "RIFF" at offset 0 and "WEBP" at offset 8. */
function hasWebpSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

/** PDF: the "%PDF-" header, optionally preceded by insignificant whitespace. */
function hasPdfSignature(buffer: Buffer): boolean {
  let offset = 0;
  while (offset < buffer.length && isAsciiWhitespace(buffer[offset])) offset += 1;
  return buffer.toString('ascii', offset, offset + 5) === '%PDF-';
}

/**
 * XML: optional UTF-8 BOM + leading whitespace, then a plausible document
 * opening — either the canonical lowercase `<?xml` declaration or a root
 * element whose name starts at that position. A `<` byte elsewhere in the
 * buffer is not sufficient.
 */
function hasXmlSignature(buffer: Buffer): boolean {
  let offset = 0;
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3;
  }
  while (offset < buffer.length && isAsciiWhitespace(buffer[offset])) offset += 1;
  if (buffer[offset] !== 0x3c) return false; // '<'
  const next = buffer[offset + 1];
  if (next === 0x3f) {
    // '<?' — accept only the canonical `<?xml` declaration opener (lowercase,
    // followed by whitespace or '?>'); reject e.g. `<?xml-stylesheet`.
    if (buffer.toString('ascii', offset + 2, offset + 5) !== 'xml') return false;
    const after = buffer[offset + 5];
    return after === undefined || isAsciiWhitespace(after) || after === 0x3f;
  }
  return (
    next !== undefined &&
    ((next >= 0x41 && next <= 0x5a) || // A-Z
      (next >= 0x61 && next <= 0x7a) || // a-z
      next === 0x5f || // _
      next === 0x3a) // :
  );
}

/**
 * Content-signature validators keyed by the allowlisted MIME types. Every
 * allowlisted type must have an entry; a type missing here fails closed.
 */
export const CONTENT_SIGNATURE_VALIDATORS: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': hasJpegSignature,
  'image/png': hasPngSignature,
  'image/webp': hasWebpSignature,
  'application/pdf': hasPdfSignature,
  'application/xml': hasXmlSignature,
  'text/xml': hasXmlSignature,
};

export interface UploadCandidate {
  buffer: Buffer;
  mimeType: string;
  /** Declared byte size; falls back to the real buffer length when falsy. */
  size?: number;
}

/**
 * Validate an uploaded binary against the shared upload contract.
 *
 * Throws `BadRequestException` (HTTP 400) for:
 *   - an empty buffer,
 *   - a MIME type outside the allowlist,
 *   - a file larger than the configured cap,
 *   - content that does not match the declared MIME type.
 */
export function assertValidUpload(candidate: UploadCandidate, maxBytes: number): void {
  if (!candidate || !candidate.buffer || candidate.buffer.length === 0) {
    throw new BadRequestException('No file uploaded');
  }

  const mimeType = String(candidate.mimeType || '');
  if (!DOCUMENT_MIME_ALLOWLIST.includes(mimeType)) {
    throw new BadRequestException(
      `Unsupported file type: ${mimeType || 'unknown'}. Allowed: ${DOCUMENT_MIME_ALLOWLIST.join(', ')}`,
    );
  }

  const size = candidate.size && candidate.size > 0 ? candidate.size : candidate.buffer.length;
  if (size > maxBytes) {
    throw new BadRequestException(
      `File size (${size} bytes) exceeds the maximum allowed size (${maxBytes} bytes)`,
    );
  }

  if (!CONTENT_SIGNATURE_VALIDATORS[mimeType]?.(candidate.buffer)) {
    throw new BadRequestException(
      `File content does not match the claimed type: ${mimeType}`,
    );
  }
}

/**
 * Reduce an arbitrary client file name to a safe, human-readable title.
 * Directory components are dropped; the result is metadata only and is never
 * used as a storage key.
 */
export function sanitizeUploadFileName(name: string, fallback = 'document'): string {
  const base =
    String(name || fallback)
      .replace(/\\/g, '/')
      .split('/')
      .pop() || fallback;
  const cleaned = base.replace(/[^\w.\- ]/g, '').replace(/\s+/g, '_').slice(0, 180);
  return cleaned || fallback;
}

/**
 * Resolve the MIME type of an already stored object from its storage key.
 *
 * The storage drivers derive the extension from the MIME type, so the inverse
 * mapping is exact. Returns `null` for an unknown extension so callers never
 * invent a type.
 */
export function mimeTypeFromStorageKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const dot = key.lastIndexOf('.');
  if (dot < 0 || dot === key.length - 1) return null;
  const extension = key.slice(dot).toLowerCase();
  return EXTENSION_MIME[extension] ?? null;
}
