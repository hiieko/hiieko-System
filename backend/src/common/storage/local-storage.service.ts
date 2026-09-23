import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  StorageService,
  StoredFile,
  StoredFileContent,
  StoredFileOptions,
} from './storage.service';

/**
 * Extension for every MIME type the application accepts for receipts/documents.
 * The extension drives the generated object key only — the original client file
 * name is never embedded in a key (path-traversal / injection safe).
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
 * Local filesystem storage driver used for development/demo.
 *
 * All reads/writes are contained under a single configurable root directory.
 * User-supplied keys are normalized and rejected unless they resolve strictly
 * inside the root, which prevents directory traversal and absolute-path writes.
 * Production can provide its own StorageService implementation (e.g. S3) and the
 * rest of the application is unaffected.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('STORAGE_ROOT', 'storage/uploads');
    this.root = path.resolve(configured);
  }

  /** Resolve a server-side key to an absolute path that stays under the root. */
  private resolveSafe(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Storage key is required');
    }
    const cleaned = key.replace(/\\/g, '/');
    if (path.isAbsolute(cleaned)) {
      throw new BadRequestException('Absolute storage keys are not allowed');
    }
    // Reject traversal *before* normalizing so "a/../b" cannot collapse safely.
    if (cleaned.split('/').some((seg) => seg === '..' || seg === '.')) {
      throw new BadRequestException('Invalid storage key: path traversal is not allowed');
    }

    const normalized = path.normalize(cleaned);
    if (normalized.split(path.sep).some((seg) => seg === '..')) {
      throw new BadRequestException('Invalid storage key: path traversal is not allowed');
    }

    const full = path.join(this.root, normalized);
    const relative = path.relative(this.root, full);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Invalid storage key: outside storage root');
    }
    return full;
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

    const full = this.resolveSafe(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, options.buffer);

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
    const full = this.resolveSafe(key);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(full);
    } catch {
      throw new NotFoundException('Stored file not found');
    }
    const buffer = await fs.promises.readFile(full);
    return {
      buffer,
      mimeType: mimeFromKey(key),
      size: stat.size,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveSafe(key);
    try {
      await fs.promises.unlink(full);
    } catch {
      // Best effort: nothing to clean up.
    }
  }
}