import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '../src/common/storage/storage.module';
import { StorageService } from '../src/common/storage/storage.service';
import { LocalStorageService } from '../src/common/storage/local-storage.service';
import { R2StorageService } from '../src/common/storage/r2-storage.service';

/**
 * StorageModule driver-selection contract, resolved through the real global
 * ConfigModule exactly as in production. Local storage stays the default; R2
 * is only ever selected by an explicit operator decision; unsupported values
 * and missing R2 configuration fail clearly at boot.
 */
describe('StorageModule (STORAGE_DRIVER selection)', () => {
  const R2_ENV: Record<string, string> = {
    STORAGE_DRIVER: 'r2',
    R2_ACCOUNT_ID: 'acct-test',
    R2_BUCKET: 'hiieko-test-bucket',
    R2_ACCESS_KEY_ID: 'test-access-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  };

  const MANAGED_KEYS = [
    'STORAGE_DRIVER',
    'STORAGE_ROOT',
    'R2_ACCOUNT_ID',
    'R2_BUCKET',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ENDPOINT',
    'R2_REGION',
  ];

  async function resolveStorage(env: Record<string, string | undefined>): Promise<StorageService> {
    const previous: Record<string, string | undefined> = {};
    for (const key of MANAGED_KEYS) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) process.env[key] = value;
    }

    try {
      const moduleRef = await Test.createTestingModule({
        imports: [
          StorageModule,
          ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ],
      }).compile();
      return moduleRef.get<StorageService>(StorageService);
    } finally {
      for (const key of MANAGED_KEYS) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    }
  }

  it('selects the local driver when STORAGE_DRIVER is unset', async () => {
    const storage = await resolveStorage({});
    expect(storage).toBeInstanceOf(LocalStorageService);
  });

  it('selects the local driver when explicitly configured as local', async () => {
    const storage = await resolveStorage({ STORAGE_DRIVER: 'local' });
    expect(storage).toBeInstanceOf(LocalStorageService);
  });

  it('selects the R2 driver only when explicitly configured as r2', async () => {
    const storage = await resolveStorage(R2_ENV);
    expect(storage).toBeInstanceOf(R2StorageService);
  });

  it('normalizes the driver name case-insensitively', async () => {
    const storage = await resolveStorage({ ...R2_ENV, STORAGE_DRIVER: 'R2' });
    expect(storage).toBeInstanceOf(R2StorageService);
  });

  it('fails clearly for unsupported driver values', async () => {
    await expect(resolveStorage({ STORAGE_DRIVER: 's3' })).rejects.toThrow(
      'Unsupported STORAGE_DRIVER "s3". Use "local" or "r2".',
    );
    await expect(resolveStorage({ STORAGE_DRIVER: 'minio' })).rejects.toThrow(
      /Unsupported STORAGE_DRIVER/,
    );
  });

  it('fails safely when r2 is selected without the required configuration', async () => {
    await expect(resolveStorage({ STORAGE_DRIVER: 'r2' })).rejects.toThrow(
      /STORAGE_DRIVER=r2 requires/,
    );
    await expect(resolveStorage({ STORAGE_DRIVER: 'r2' })).rejects.toThrow(/R2_BUCKET/);
    await expect(
      resolveStorage({
        STORAGE_DRIVER: 'r2',
        R2_ACCOUNT_ID: 'acct-test',
        R2_ACCESS_KEY_ID: 'test-access-key-id',
        // R2_SECRET_ACCESS_KEY intentionally absent
        R2_BUCKET: 'hiieko-test-bucket',
      }),
    ).rejects.toThrow(/R2_SECRET_ACCESS_KEY/);
  });
});
