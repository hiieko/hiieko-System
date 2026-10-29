import { R2StorageService } from '../src/common/storage/r2-storage.service';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * R2StorageService driver contract — Cloudflare R2 through the S3-compatible
 * API. The SDK client is always mocked: no Cloudflare credentials, network
 * access, or real bucket is ever required (ISSUE-013 / production storage
 * remediation).
 */
describe('R2StorageService', () => {
  const R2_ENV: Record<string, string> = {
    R2_ACCOUNT_ID: 'acct-test',
    R2_BUCKET: 'hiieko-test-bucket',
    R2_ACCESS_KEY_ID: 'test-access-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  };

  const config = (env: Record<string, string | undefined>) =>
    ({
      get: (key: string, def?: string) => (env[key] !== undefined ? env[key] : def),
    } as any);

  let service: R2StorageService;
  let send: jest.Mock;

  beforeEach(() => {
    service = new R2StorageService(config(R2_ENV));
    send = jest.fn();
    service.client = { send };
  });

  const uploadOptions = (overrides: Record<string, unknown> = {}) => ({
    buffer: Buffer.from('hello-receipt'),
    mimeType: 'image/jpeg',
    originalName: 'fuel-receipt.jpg',
    directory: 'receipts',
    ...overrides,
  });

  describe('save', () => {
    it('returns a provider-neutral key in the exact local-driver format', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

      const stored = await service.save(uploadOptions());

      expect(stored.key).toMatch(
        /^receipts\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
      );
      expect(stored.key).not.toContain('fuel-receipt'); // original name never in key
      expect(stored).toEqual({
        key: expect.any(String),
        originalName: 'fuel-receipt.jpg',
        mimeType: 'image/jpeg',
        size: Buffer.byteLength('hello-receipt'),
        checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    });

    it('passes the exact bytes, content type, bucket, and key to PutObject', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
      const buffer = Buffer.from('png-bytes');

      const stored = await service.save(
        uploadOptions({ buffer, mimeType: 'image/png', originalname: 'photo.png' }),
      );

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Bucket).toBe('hiieko-test-bucket');
      expect(command.input.Key).toBe(stored.key);
      expect(command.input.ContentType).toBe('image/png');
      expect(command.input.Body).toBe(buffer);
    });

    it('computes the checksum as the SHA-256 of the uploaded buffer', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
      const buffer = Buffer.from('checksum-me');

      const stored = await service.save(uploadOptions({ buffer }));
      const expected = crypto.createHash('sha256').update(buffer).digest('hex');

      expect(stored.checksum).toBe(expected);
    });

    it('sanitizes the grouping namespace and never embeds raw input in the key', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

      const stored = await service.save(uploadOptions({ directory: '../../etc/passwd' }));

      expect(stored.key.startsWith('etcpasswd/')).toBe(true);
    });

    it('rejects unsupported MIME types before calling the provider', async () => {
      await expect(
        service.save(uploadOptions({ mimeType: 'text/html', originalName: 'malware.html' })),
      ).rejects.toThrow(BadRequestException);
      expect(send).not.toHaveBeenCalled();
    });

    it('generates no public bucket URL — the stored result is key + metadata only', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

      const stored = await service.save(uploadOptions());

      expect(Object.keys(stored).sort()).toEqual([
        'checksum',
        'key',
        'mimeType',
        'originalName',
        'size',
      ]);
      // Exactly one command went out: a PutObject. No presigning, no URL minting.
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    });

    it('propagates provider errors instead of reporting a successful write', async () => {
      const failure = Object.assign(new Error('Access Denied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      send.mockRejectedValue(failure);

      await expect(service.save(uploadOptions())).rejects.toBe(failure);
    });
  });

  describe('read', () => {
    const key = 'receipts/2026/10/2f1c8f4e-6b0a-4a4e-9b3d-000000000001.pdf';

    it('returns the original bytes, size, and stored content type', async () => {
      const bytes = Buffer.from('pdf-bytes');
      send.mockResolvedValue({
        Body: { transformToByteArray: async () => bytes },
        ContentType: 'application/pdf',
        $metadata: { httpStatusCode: 200 },
      });

      const content = await service.read(key);

      expect(content.buffer.equals(bytes)).toBe(true);
      expect(content.size).toBe(bytes.length);
      expect(content.mimeType).toBe('application/pdf');
      expect(content.key).toBe(key);
    });

    it('falls back to the key extension when the provider returns no content type', async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      send.mockResolvedValue({
        Body: { transformToByteArray: async () => bytes },
        $metadata: { httpStatusCode: 200 },
      });

      const content = await service.read('receipts/2026/10/uuid.png');

      expect(content.mimeType).toBe('image/png');
    });

    it('throws NotFound for a missing object — never silent successful data', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('NoSuchKey'), {
          name: 'NoSuchKey',
          $metadata: { httpStatusCode: 404 },
        }),
      );

      await expect(service.read(key)).rejects.toThrow(NotFoundException);
      await expect(service.read(key)).rejects.toThrow('Stored file not found');
    });

    it('treats a bare 404 answer as a missing object', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('Not Found'), { $metadata: { httpStatusCode: 404 } }),
      );

      await expect(service.read(key)).rejects.toThrow(NotFoundException);
    });

    it('propagates provider errors instead of returning data', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('Service Unavailable'), {
          name: 'SlowDown',
          $metadata: { httpStatusCode: 503 },
        }),
      );

      await expect(service.read(key)).rejects.toThrow('Service Unavailable');
    });

    it('propagates a missing-bucket 404 instead of claiming the object is absent', async () => {
      const failure = Object.assign(new Error('NoSuchBucket'), {
        name: 'NoSuchBucket',
        $metadata: { httpStatusCode: 404 },
      });
      send.mockRejectedValue(failure);

      await expect(service.read(key)).rejects.toBe(failure);
    });

    it('fails loudly when the provider returns a response without a body', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

      await expect(service.read(key)).rejects.toThrow(/no content/i);
    });
  });

  describe('delete', () => {
    it('deletes the exact key in the configured bucket', async () => {
      send.mockResolvedValue({ $metadata: { httpStatusCode: 204 } });

      await service.delete('receipts/2026/10/uuid.jpg');

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'hiieko-test-bucket',
        Key: 'receipts/2026/10/uuid.jpg',
      });
    });

    it('is a no-op when the object is already gone', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('NoSuchKey'), {
          name: 'NoSuchKey',
          $metadata: { httpStatusCode: 404 },
        }),
      );

      await expect(service.delete('receipts/2026/10/uuid.jpg')).resolves.toBeUndefined();
    });

    it('propagates provider failures instead of reporting success', async () => {
      const failure = Object.assign(new Error('Internal Error'), {
        name: 'InternalError',
        $metadata: { httpStatusCode: 500 },
      });
      send.mockRejectedValue(failure);

      await expect(service.delete('receipts/2026/10/uuid.jpg')).rejects.toBe(failure);
    });
  });

  describe('key validation (traversal protection parity)', () => {
    const unsafeKeys = [
      '',
      '../secret',
      '..\\..\\etc\\passwd',
      'receipts/../evil.log',
      'receipts/./evil.log',
      path.resolve('/tmp', 'absolute.jpg'),
    ];

    it('rejects unsafe keys on read and delete before calling the provider', async () => {
      for (const key of unsafeKeys) {
        await expect(service.read(key)).rejects.toThrow(BadRequestException);
        await expect(service.delete(key)).rejects.toThrow(BadRequestException);
      }
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('configuration validation (startup)', () => {
    it('refuses to start when a required variable is missing, naming variables without values', async () => {
      for (const name of Object.keys(R2_ENV)) {
        const env = { ...R2_ENV };
        delete env[name];
        expect(() => new R2StorageService(config(env))).toThrow(new RegExp(name));
      }
    });

    it('never leaks credential values in the startup error', () => {
      const env = { ...R2_ENV };
      delete env.R2_BUCKET;

      let message = '';
      try {
        new R2StorageService(config(env));
      } catch (err) {
        message = (err as Error).message;
      }

      expect(message).toContain('R2_BUCKET');
      expect(message).not.toContain(R2_ENV.R2_ACCESS_KEY_ID);
      expect(message).not.toContain(R2_ENV.R2_SECRET_ACCESS_KEY);
      expect(message).not.toContain(R2_ENV.R2_ACCOUNT_ID);
    });

    it('rejects an invalid R2_ENDPOINT without echoing its value', () => {
      expect(() =>
        new R2StorageService(config({ ...R2_ENV, R2_ENDPOINT: 'not a url' })),
      ).toThrow(/R2_ENDPOINT/);

      expect(() =>
        new R2StorageService(config({ ...R2_ENV, R2_ENDPOINT: 'ftp://example.com' })),
      ).toThrow(/R2_ENDPOINT/);
    });

    it('defaults the endpoint to the documented R2 host and the region to "auto"', async () => {
      const real = new R2StorageService(config(R2_ENV));
      const client = real.client as any;

      expect(await client.config.region()).toBe('auto');
      const endpoint = await client.config.endpoint();
      expect(endpoint.hostname).toBe('acct-test.r2.cloudflarestorage.com');
      expect(endpoint.protocol).toBe('https:');
    });

    it('signs requests against the R2 endpoint, never an AWS host', async () => {
      const real = new R2StorageService(config(R2_ENV));
      let captured: any = null;
      (real.client as any).middlewareStack.add(
        (next: any) => (args: any) => {
          captured = args.request;
          throw new Error('ABORT_BEFORE_NETWORK');
        },
        { step: 'finalizeRequest', name: 'capture-request' },
      );

      await expect(
        real.read('receipts/2026/10/2f1c8f4e-6b0a-4a4e-9b3d-000000000001.pdf'),
      ).rejects.toThrow('ABORT_BEFORE_NETWORK');

      expect(captured).not.toBeNull();
      expect(captured.protocol).toBe('https:');
      // Virtual-hosted addressing on the R2 endpoint, matching Cloudflare's
      // official aws-sdk-js-v3 example — never an AWS S3 host.
      expect(captured.hostname).toBe(
        'hiieko-test-bucket.acct-test.r2.cloudflarestorage.com',
      );
      expect(captured.hostname).not.toContain('amazonaws.com');
      expect(captured.path).toContain('receipts/2026/10/2f1c8f4e-6b0a-4a4e-9b3d-000000000001.pdf');
    });
  });
});
