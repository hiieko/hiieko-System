import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorDetail, statusToErrorCode, ErrorCode } from '@solar/shared';

/**
 * Standardized HTTP API error envelope filter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  // Read dynamically to allow testing
  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const envelope = this.buildEnvelope(exception, request);

    // Log internal server errors with full detail
    if (envelope.statusCode >= 500) {
      this.logger.error(
        `[HTTP ${envelope.statusCode}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(
        `[HTTP ${envelope.statusCode}] ${request.method} ${request.url} — ${envelope.code}: ${envelope.message}`
      );
    }

    response.status(envelope.statusCode).json(envelope);
  }

  private buildEnvelope(exception: unknown, request: Request) {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // === Case 1: NestJS HttpException ===
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorCode = statusToErrorCode(status);
      const res = exception.getResponse();

      let message = exception.message;
      let details: ErrorDetail[] | undefined;

      // Parse structured NestJS validation responses
      if (typeof res === 'object' && res !== null) {
        const resObj = res as any;

        // class-validator returns { message: string | string[], error: string }
        if (status === HttpStatus.BAD_REQUEST && Array.isArray(resObj.message)) {
          // Treat as 422 VALIDATION_ERROR
          const castStatus = HttpStatus.UNPROCESSABLE_ENTITY;
          const castCode: ErrorCode = 'VALIDATION_ERROR';
          details = resObj.message.map((m: string, index: number) => ({
            field: this.inferFieldFromMessage(m) || `field_${index}`,
            code: 'VALIDATION_FAILED',
            message: m,
          }));
          message = `Validation failed: ${details.length} error(s)`;

          return {
            success: false as const,
            statusCode: castStatus,
            code: castCode,
            message,
            details,
            timestamp,
            path,
            method,
          };
        }

        message = resObj.message || exception.message;
      } else if (typeof res === 'string') {
        message = res;
      }

      // Specialized exception mapping
      if (exception instanceof NotFoundException) {
        return {
          success: false as const,
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND' as const,
          message: message || 'Resource not found',
          timestamp,
          path,
          method,
        };
      }

      if (exception instanceof UnauthorizedException) {
        return {
          success: false as const,
          statusCode: HttpStatus.UNAUTHORIZED,
          code: 'UNAUTHORIZED' as const,
          message: message || 'Authentication required',
          timestamp,
          path,
          method,
        };
      }

      if (exception instanceof ForbiddenException) {
        return {
          success: false as const,
          statusCode: HttpStatus.FORBIDDEN,
          code: 'FORBIDDEN' as const,
          message: message || 'Access forbidden',
          timestamp,
          path,
          method,
        };
      }

      return {
        success: false as const,
        statusCode: status,
        code: errorCode,
        message,
        timestamp,
        path,
        method,
      };
    }

    // === Case 2: Plain Error (unhandled) ===
    if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      return {
        success: false as const,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR' as const,
        message: this.isProduction ? 'An unexpected error occurred' : exception.message,
        timestamp,
        path,
        method,
      };
    }

    // === Case 3: Unknown ===
    return {
      success: false as const,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR' as const,
      message: this.isProduction ? 'An unexpected error occurred' : `Internal error: ${String(exception)}`,
      timestamp,
      path,
      method,
    };
  }

  private inferFieldFromMessage(message: string): string | undefined {
    const patterns = [
      /^(\w+)\s+must\s+be/i,
      /^(\w+)\s+should\s+be/i,
      /^(\w+)\s+should\s+not/i,
      /^(\w+)\s+is\s+(not\s+)?required/i,
    ];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) return match[1];
    }
    return undefined;
  }
}
