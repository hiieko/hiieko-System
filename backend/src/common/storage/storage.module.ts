import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';

/**
 * StorageModule exposes the StorageService abstraction app-wide.
 *
 * The concrete driver is selected by the STORAGE_DRIVER environment variable:
 * "local" (default — development/demo) or "r2" (Cloudflare R2 through its
 * S3-compatible API — an explicit operator decision, never enabled by default).
 * Unsupported values and missing R2 configuration fail at boot so a
 * misconfigured deployment never falls back to the wrong storage silently —
 * domain code keeps depending only on StorageService.
 */
@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = (config.get<string>('STORAGE_DRIVER') || 'local').toLowerCase();
        switch (driver) {
          case 'local':
            return new LocalStorageService(config);
          case 'r2':
            return new R2StorageService(config);
          default:
            throw new Error(`Unsupported STORAGE_DRIVER "${driver}". Use "local" or "r2".`);
        }
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}