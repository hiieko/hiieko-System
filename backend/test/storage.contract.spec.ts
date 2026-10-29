import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from '../src/common/storage/local-storage.service';
import { R2StorageService } from '../src/common/storage/r2-storage.service';
import { StorageService } from '../src/common/storage/storage.service';

/**
 * StorageService cross-driver contract: LocalStorageService (development
 * default) and R2StorageService (Cloudflare R2 via its S3-compatible API)
 * behave identically through the shared abstraction, so domain code cannot
 * tell which driver is configured. The R2 side runs against an in-memory
 * S3-compatible fake — no credentials, network, or real bucket involved.
 */

interface DriverHarness {
  service: StorageService;
  cleanup?: () => Promise<void>;
}

/** Minimal in-memory S3-compatible fake for the three commands the driver sends. */
function inMemoryS3(): { send: jest.Mock } {
  const objects = new Map<string, { body: Buffer; contentType?: string }>();
  const send = jest.fn(async (command: unknown): Promise<any> => {
    if (command instanceof PutObjectCommand) {
      const input = command.input;
      objects.set(`${input.Bucket}/${input.Key}`, {
        body: Buffer.from(input.Body as Buffer),
        contentType: input.ContentType,
      });
      return { $metadata: { httpStatusCode: 200 } };
    }
    if (command instanceof GetObjectCommand) {
      const stored = objects.get(`${command.input.Bucket}/${command.input.Key}`);
      if (!stored) {
        throw Object.assign(new Error('NoSuchKey'), {
          name: 'NoSuchKey',
          $metadata: { httpStatusCode: 404 },
        });
      }
      return {
        Body: { transformToByteArray: async () => stored.body },
        ContentType: stored.contentType,
        $metadata: { httpStatusCode: 200 },
      };
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(`${command.input.Bucket}/${command.input.Key}`);
      return { $metadata: { httpStatusCode: 204 } };
    }
    throw new Error('Unexpected command in in-memory S3 fake');
  });
  return { send };
}

const r2Config = (env: Record<string, string | undefined>) =>
  ({
    get: (key: string, def?: string) => (env[key] !== undefined ? env[key] : def),
  } as any);

function localDriver(): DriverHarness {
  const root = path.join(os.tmpdir(), `hiieko-contract-${crypto.randomUUID()}`);
  fs.mkdirSync(root, { recursive: true });
  const service = new LocalStorageService(r2Config({ STORAGE_ROOT: root }));
  return {
    service,
    cleanup: async () => {
      await fs.promises.rm(root, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

function r2Driver(): DriverHarness {
  const s3 = inMemoryS3();
  const service = new R2StorageService(
    r2Config({
      R2_ACCOUNT_ID: 'acct-test',
      R2_BUCKET: 'hiieko-test-bucket',
      R2_ACCESS_KEY_ID: 'test-access-key-id',
      R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
    }),
  );
  service.client = s3;
  return { service };
}

function runContract(name: string, create: () => DriverHarness) {
  describe(name, () => {
    let harness: DriverHarness;
    let service: StorageService;

    beforeEach(() => {
      harness = create();
      service = harness.service;
    });

    afterEach(async () => {
      await harness.cleanup?.();
    });

    const options = (overrides: Record<string, unknown> = {}) => ({
      buffer: Buffer.from('contract-bytes'),
      mimeType: 'application/pdf',
      originalName: 'invoice.pdf',
      directory: 'receipts',
      ...overrides,
    });

    it('save returns a provider-neutral key, metadata, and a SHA-256 checksum', async () => {
      const buffer = Buffer.from('persisted-payload');
      const stored = await service.save(options({ buffer }));

      expect(stored.key).toMatch(
        /^receipts\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
      );
      expect(stored.key).not.toContain('invoice'); // original name never in key
      expect(stored.originalName).toBe('invoice.pdf');
      expect(stored.mimeType).toBe('application/pdf');
      expect(stored.size).toBe(buffer.length);
      expect(stored.checksum).toBe(
        crypto.createHash('sha256').update(buffer).digest('hex'),
      );
    });

    it('save → read round-trips the original bytes and content type', async () => {
      const buffer = Buffer.from('round-trip-bytes');
      const stored = await service.save(options({ buffer }));

      const content = await service.read(stored.key);
      expect(content.buffer.equals(buffer)).toBe(true);
      expect(content.size).toBe(buffer.length);
      expect(content.mimeType).toBe('application/pdf');
      expect(content.key).toBe(stored.key);
    });

    it('read of a never-stored key throws NotFound instead of returning data', async () => {
      await expect(
        service.read('receipts/2026/10/00000000-0000-4000-8000-000000000000.pdf'),
      ).rejects.toThrow(NotFoundException);
    });

    it('delete removes the object; a subsequent read throws NotFound', async () => {
      const stored = await service.save(options());
      await service.delete(stored.key);
      await expect(service.read(stored.key)).rejects.toThrow(NotFoundException);
    });

    it('delete of a missing object succeeds (best effort)', async () => {
      await expect(
        service.delete('receipts/2026/10/00000000-0000-4000-8000-000000000000.pdf'),
      ).resolves.toBeUndefined();
    });

    it('save rejects unsupported MIME types before touching storage', async () => {
      await expect(
        service.save(options({ mimeType: 'text/html', originalName: 'page.html' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('read and delete reject traversal and absolute keys', async () => {
      await expect(service.read('../secret')).rejects.toThrow(BadRequestException);
      await expect(service.read('receipts/../evil.log')).rejects.toThrow(BadRequestException);
      await expect(service.delete('..\\..\\etc\\passwd')).rejects.toThrow(BadRequestException);
    });
  });
}

describe('StorageService driver contract (local + r2)', () => {
  runContract('LocalStorageService', localDriver);
  runContract('R2StorageService', r2Driver);
});
