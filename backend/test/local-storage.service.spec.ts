import { LocalStorageService } from '../src/common/storage/local-storage.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * LocalStorageService security + persistence contract (ISSUE-013).
 */
describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let root: string;

  const config = (get: (key: string, def?: string) => string) => ({
    get: (key: string, def?: string) => get(key, def),
  } as any);

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hiieko-storage-'));
    service = new LocalStorageService(config((k, d) => (k === 'STORAGE_ROOT' ? root : d)));
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true }).catch(() => undefined);
  });

  it('persists a buffer under the root and returns a safe unique key', async () => {
    const buf = Buffer.from('hello-receipt');
    const stored = await service.save({
      buffer: buf,
      mimeType: 'image/jpeg',
      originalName: 'fuel-receipt.jpg',
      directory: 'receipts',
    });

    expect(stored.mimeType).toBe('image/jpeg');
    expect(stored.size).toBe(buf.length);
    expect(stored.originalName).toBe('fuel-receipt.jpg');
    expect(stored.checksum).toHaveLength(64);
    expect(stored.key).not.toContain('fuel-receipt'); // original name never in key
    expect(stored.key.match(/\.[a-z0-9]+$/i)![0]).toBe('.jpg');

    // The key stays inside the root.
    const full = path.join(root, stored.key);
    expect(full.startsWith(root)).toBe(true);
    expect(fs.existsSync(full)).toBe(true);
  });

  it('allows round-trip read of a persisted object', async () => {
    const buf = Buffer.from('pdf-bytes');
    const stored = await service.save({
      buffer: buf,
      mimeType: 'application/pdf',
      originalName: 'invoice.pdf',
      directory: 'receipts',
    });

    const content = await service.read(stored.key);
    expect(content.buffer.equals(buf)).toBe(true);
    expect(content.mimeType).toBe('application/pdf');
    expect(content.size).toBe(buf.length);
  });

  it('rejects unsupported MIME types before writing', async () => {
    await expect(
      service.save({
        buffer: Buffer.from('x'),
        mimeType: 'text/html',
        originalName: 'malware.html',
        directory: 'receipts',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents directory traversal in keys', async () => {
    await expect(service.read('../secret')).rejects.toThrow(BadRequestException);
    await expect(service.read('..\\..\\etc\\passwd')).rejects.toThrow(BadRequestException);
    await expect(service.read('receipts/../evil.log')).rejects.toThrow(BadRequestException);
    await expect(service.delete(' ../../etc/hosts')).rejects.toThrow(BadRequestException);
  });

  it('rejects absolute paths', async () => {
    await expect(service.read(path.resolve(root, 'a.jpg'))).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound for a missing object', async () => {
    await expect(service.read('receipts/2026/09/does-not-exist.jpg')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes an object (best effort)', async () => {
    const stored = await service.save({
      buffer: Buffer.from('to-delete'),
      mimeType: 'image/png',
      originalName: 'a.png',
      directory: 'receipts',
    });
    expect(fs.existsSync(path.join(root, stored.key))).toBe(true);
    await service.delete(stored.key);
    expect(fs.existsSync(path.join(root, stored.key))).toBe(false);
  });
});