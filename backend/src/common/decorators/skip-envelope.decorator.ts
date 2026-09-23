import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skip_envelope';

/**
 * Marks a handler so the global TransformInterceptor leaves its response
 * unwrapped (e.g. StreamableFile binary downloads that are not JSON).
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);