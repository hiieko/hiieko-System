/**
 * Storage abstraction contract (ISSUE-013 / ISSUE-014).
 *
 * All binary persistence for the HIIEKO backend goes through this contract so
 * the local-disk development driver can be swapped for a persistent backend
 * (S3-compatible object storage, Azure Blob, ...) without touching domain logic.
 *
 * Keys are ALWAYS generated server-side. Client-controlled information such as
 * the original file name is carried as metadata only — never embedded in a key.
 */
export interface StoredFileOptions {
  /** Raw binary payload to persist. */
  buffer: Buffer;
  /** Validated MIME type (e.g. "image/jpeg", "application/pdf"). */
  mimeType: string;
  /** Original client file name — preserved as metadata, never used as a key. */
  originalName: string;
  /** Optional logical grouping prefix (e.g. "receipts"). Sanitized server-side. */
  directory: string;
}

export interface StoredFile {
  /** Safe, unique server-side object key. Also stored as Document.storage_path. */
  key: string;
  /** Original file name (metadata only). */
  originalName: string;
  mimeType: string;
  size: number;
  /** SHA-256 hex digest of the persisted buffer. */
  checksum: string;
}

export interface StoredFileContent {
  buffer: Buffer;
  mimeType: string;
  size: number;
  key: string;
  originalName?: string;
}

export abstract class StorageService {
  /** Persist a buffer and return a stable, unique object key for later retrieval. */
  abstract save(options: StoredFileOptions): Promise<StoredFile>;

  /** Read a previously stored object by its server-side key. */
  abstract read(key: string): Promise<StoredFileContent>;

  /** Delete a previously stored object by its server-side key (best effort). */
  abstract delete(key: string): Promise<void>;
}