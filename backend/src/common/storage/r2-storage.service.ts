import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  StorageService,
  StoredFile,
  StoredFileContent,
  StoredFileOptions,
} from './storage.service';

/**
 * Extension for every MIME type the application accepts for receipts/documents.
 * Kept byte-for-byte aligned with LocalStorageService so both drivers generate
 * the identical object key for the same upload (extension drives the key only —
 * the original client file name is never embedded in a key).
 */
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/xml': '.xml',
  'text/xml': '.xml',
};

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const entry = Object.entries(MIME_EXTENSION).find(([, e]) => e === ext);
  return entry ? entry[0] : 'application/octet-stream';
}

/**
 * Minimal structural subset of the AWS SDK v3 S3 client used by this driver.
 * The production wiring builds a real `S3Client`; unit tests substitute a mock
 * with the same `send` shape, so no Cloudflare credentials or network access
 * are ever needed in tests.
 */
export interface S3CompatibleClient {
  send(command: unknown): Promise<any>;
}

/** Error shape of AWS SDK v3 service failures (metadata + optional code). */
interface S3ProviderError {
  name?: string;
  Code?: string;
  code?: string;
  $metadata?: { httpStatusCode?: number };
}

/**
 * Cloudflare R2 storage driver, spoken through R2's S3-compatible API.
 *
 * Configuration (names only — values are never logged or embedded anywhere):
 *
 * - `R2_ACCOUNT_ID`    — Cloudflare account ID (required unless R2_ENDPOINT is set)
 * - `R2_BUCKET`        — private bucket name (required)
 * - `R2_ACCESS_KEY_ID` — R2 S3 API token access key id (required)
 * - `R2_SECRET_ACCESS_KEY` — R2 S3 API token secret (required)
 * - `R2_ENDPOINT`      — optional; defaults to
 *   `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (documented R2 endpoint)
 * - `R2_REGION`        — optional; defaults to `auto`, the region R2 documents
 *   for its S3 API (empty and `us-east-1` alias to `auto` on R2's side)
 *
 * Missing/invalid configuration fails in the constructor, i.e. at application
 * boot when STORAGE_DRIVER selects this driver — never halfway through a
 * request and never by falling back to another driver.
 *
 * Verified against Cloudflare's official aws-sdk-js-v3 guidance and the
 * installed SDK (3.1154.0):
 *
 * - `region: "auto"` + custom endpoint is the documented R2 client shape; no
 *   AWS region assumptions are made.
 * - The SDK default addressing (virtual-hosted: `<bucket>.<account>.r2.cloudflarestorage.com`)
 *   matches Cloudflare's published examples, so no `forcePathStyle` override is
 *   required for R2.
 * - `requestChecksumCalculation: "WHEN_REQUIRED"` opts out of the SDK's
 *   flexible-checksum request headers (`x-amz-sdk-checksum-*`), which R2's S3
 *   API compatibility table lists as unsupported (documented HTTP 422 failures
 *   on bodies over 1 MB otherwise; HIIEKO accepts uploads up to 10 MB).
 *
 * The bucket stays private: this driver never builds object URLs, never signs
 * public links, and never bypasses the authenticated `GET /api/upload/:documentId`
 * route. Authorization stays entirely in the service/controller layer.
 */
@Injectable()
export class R2StorageService implements StorageService {
  private readonly bucket: string;
  /** Swappable seam for unit tests; a real S3Client is built in the constructor. */
  client: S3CompatibleClient;

  constructor(config: ConfigService) {
    const read = (key: string) => String(config.get<string>(key) ?? '').trim();

    const accountId = read('R2_ACCOUNT_ID');
    const bucket = read('R2_BUCKET');
    const accessKeyId = read('R2_ACCESS_KEY_ID');
    const secretAccessKey = read('R2_SECRET_ACCESS_KEY');
    const explicitEndpoint = read('R2_ENDPOINT');

    const missing: string[] = [];
    if (!accountId && !explicitEndpoint) missing.push('R2_ACCOUNT_ID');
    if (!bucket) missing.push('R2_BUCKET');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (missing.length > 0) {
      // Configuration variable names only — never values.
      throw new Error(
        `Refusing to start: STORAGE_DRIVER=r2 requires ${missing.join(', ')}. ` +
          'Set the variable(s) in the backend environment; values are never logged.',
      );
    }

    const endpoint = explicitEndpoint || `https://${accountId}.r2.cloudflarestorage.com`;
    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpoint);
    } catch {
      throw new Error(
        'Refusing to start: R2_ENDPOINT must be an absolute http(s) URL (value not shown).',
      );
    }
    if (endpointUrl.protocol !== 'https:' && endpointUrl.protocol !== 'http:') {
      throw new Error(
        'Refusing to start: R2_ENDPOINT must use http or https (value not shown).',
      );
    }

    const region = read('R2_REGION') || 'auto';

    this.bucket = bucket;
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // R2 does not implement the flexible checksum headers the SDK adds by
      // default; see the class documentation.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Reject keys that are empty, absolute, or contain traversal segments —
   * identical rules to LocalStorageService, so a key accepted by one driver is
   * accepted (and rejected) by the other.
   */
  private assertSafeKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Storage key is required');
    }
    const cleaned = key.replace(/\\/g, '/');
    if (path.isAbsolute(cleaned)) {
      throw new BadRequestException('Absolute storage keys are not allowed');
    }
    if (cleaned.split('/').some((seg) => seg === '..' || seg === '.')) {
      throw new BadRequestException('Invalid storage key: path traversal is not allowed');
    }
    const normalized = path.normalize(cleaned);
    if (normalized.split(path.sep).some((seg) => seg === '..')) {
      throw new BadRequestException('Invalid storage key: path traversal is not allowed');
    }
  }

  /** True only for "the object does not exist" answers from the provider. */
  private isMissingObject(err: unknown): boolean {
    const e = err as S3ProviderError | undefined;
    const code = String(e?.name || e?.Code || e?.code || '');
    if (code === 'NoSuchKey' || code === 'NotFound') return true;
    // A 404 with any other (or no) provider code is still "no such object" —
    // except for explicit configuration faults such as a missing bucket, which
    // must propagate instead of masquerading as a missing object.
    return e?.$metadata?.httpStatusCode === 404 && code !== 'NoSuchBucket';
  }

  async save(options: StoredFileOptions): Promise<StoredFile> {
    const extension = MIME_EXTENSION[options.mimeType];
    if (!extension) {
      throw new BadRequestException(`Unsupported file type: ${options.mimeType}`);
    }

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    // Grouping namespace pulled from a fixed allowlist, never raw user input.
    const namespace = options.directory && options.directory.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'payload';
    const key = `${namespace}/${yyyy}/${mm}/${crypto.randomUUID()}${extension}`;

    this.assertSafeKey(key);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer,
        ContentType: options.mimeType,
      }),
    );

    const checksum = crypto.createHash('sha256').update(options.buffer).digest('hex');
    return {
      key,
      originalName: options.originalName,
      mimeType: options.mimeType,
      size: options.buffer.length,
      checksum,
    };
  }

  async read(key: string): Promise<StoredFileContent> {
    this.assertSafeKey(key);

    let response: any;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      if (this.isMissingObject(err)) {
        throw new NotFoundException('Stored file not found');
      }
      throw err;
    }

    if (!response || !response.Body) {
      throw new Error('Storage provider returned no content for an existing object');
    }

    const buffer: Buffer = Buffer.from(await response.Body.transformToByteArray());
    return {
      buffer,
      mimeType: response.ContentType || mimeFromKey(key),
      size: buffer.length,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    this.assertSafeKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // Best effort only for "nothing to clean up" — same as the local driver.
      if (this.isMissingObject(err)) {
        return;
      }
      // Any other provider failure (permissions, network, bucket misconfigured)
      // must surface; it is never reported as a successful delete.
      throw err;
    }
  }
}
