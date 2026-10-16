import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ResponseSizeInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ResponseSize');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap((data) => {
        try {
          if (data === undefined || data === null) {
            return;
          }

          const serialized = JSON.stringify(data);
          const sizeBytes = Buffer.byteLength(serialized);

          if (sizeBytes > 1_000_000) {
            this.logger.warn(
              `[ResponseSize] ${req.method} ${req.path} — ${sizeBytes} bytes`,
            );
          }
        } catch (error) {
          // Do not reject or modify the response; log only.
        }
      }),
    );
  }
}
