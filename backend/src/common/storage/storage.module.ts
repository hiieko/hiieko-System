import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';

/**
 * StorageModule exposes the StorageService abstraction app-wide.
 *
 * The concrete driver is selected by the STORAGE_DRIVER environment variable
 * ("local" for development). Production can register a persistent backend
 * (e.g. S3-compatible object storage) by adding another case here — domain code
 * keeps depending only on StorageService.
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
          default:
            throw new Error(`Unsupported STORAGE_DRIVER "${driver}". Use "local".`);
        }
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}