import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Prisma → HTTP error envelope filter (Phase 6 hardening, functional-audit G).
 *
 * Registered BEFORE AllExceptionsFilter in execution order (global filters run in
 * reverse registration order, so this filter is registered last in `main.ts`).
 *
 * Guarantees:
 * - The raw Prisma invocation (SQL fragment, argument list, column names) NEVER
 *   reaches the response body — the client always gets a generic message.
 * - The full error, including the invocation and stack, is logged server-side
 *   together with the `x-request-id` correlation id already on the response.
 * - The body matches the shared error envelope shape
 *   `{ success, statusCode, code, message, timestamp, path, method }`.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.map(exception);

    // Same id the access log (`type: http_request`) prints for this request.
    const headerId = response.getHeader('x-request-id');
    const requestId =
      (typeof headerId === 'string' && headerId) ||
      request.header('x-request-id') ||
      '-';

    // Full detail stays server-side only.
    const detail = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const line = `[Prisma ${mapped.code} -> ${mapped.statusCode}] requestId=${requestId} ${request.method} ${request.url} — ${detail}`;

    if (mapped.statusCode >= 500) {
      this.logger.error(line, stack);
    } else {
      this.logger.warn(`${line}\n${stack ?? ''}`);
    }

    response.status(mapped.statusCode).json({
      success: false,
      statusCode: mapped.statusCode,
      code: mapped.code,
      message: mapped.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }

  private map(exception: unknown): {
    statusCode: number;
    code: 'UNIQUE_CONSTRAINT' | 'NOT_FOUND' | 'FOREIGN_KEY_CONSTRAINT' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
    message: string;
  } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // unique constraint violation
          return {
            statusCode: HttpStatus.CONFLICT,
            code: 'UNIQUE_CONSTRAINT',
            message: 'Invalid request',
          };
        case 'P2025': // record not found / target of an operation does not exist
          return {
            statusCode: HttpStatus.NOT_FOUND,
            code: 'NOT_FOUND',
            message: 'Invalid request',
          };
        case 'P2003': // foreign key constraint violation
          return {
            statusCode: HttpStatus.BAD_REQUEST,
            code: 'FOREIGN_KEY_CONSTRAINT',
            message: 'Invalid request',
          };
        default: // every other known Prisma error code (P1xxx, P2xxx, …)
          return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_ERROR',
            message: 'Database request failed',
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      };
    }

    // PrismaClientUnknownRequestError (and any other Prisma-shaped failure).
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Database request failed',
    };
  }
}
