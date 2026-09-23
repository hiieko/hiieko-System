import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost } from '@nestjs/common';
import {
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ErrorEnvelope, ERROR_CODES } from '@solar/shared';

describe('AllExceptionsFilter (Error Envelope Contract)', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);

    mockResponse = {
      statusCode: 200,
      sentJson: null,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data: any) => {
        mockResponse.sentJson = data;
        return data;
      }),
    };
  });

  function createMockHost(method: string, path: string): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ method, url: path }),
      }),
    } as unknown as ArgumentsHost;
  }

  function expectValidErrorEnvelope(envelope: any, expectedStatusCode: number, expectedCode: string) {
    expect(envelope.success).toBe(false);
    expect(envelope.statusCode).toBe(expectedStatusCode);
    expect(envelope.code).toBe(expectedCode);
    expect(typeof envelope.message).toBe('string');
    expect(envelope.timestamp).toBeDefined();
    expect(Date.parse(envelope.timestamp)).not.toBeNaN();
    return envelope as ErrorEnvelope;
  }

  it('401: UNAUTHORIZED envelope', () => {
    filter.catch(new UnauthorizedException('Invalid token'), createMockHost('GET', '/api/protected'));
    const env = expectValidErrorEnvelope(mockResponse.sentJson, 401, ERROR_CODES.UNAUTHORIZED);
    expect(env.message).toContain('Invalid');
  });

  it('403: FORBIDDEN envelope', () => {
    filter.catch(new ForbiddenException('Not enough permissions'), createMockHost('POST', '/api/admin'));
    const env = expectValidErrorEnvelope(mockResponse.sentJson, 403, ERROR_CODES.FORBIDDEN);
    expect(env.message).toContain('permission');
  });

  it('404: NOT_FOUND envelope', () => {
    filter.catch(new NotFoundException('Project not found'), createMockHost('GET', '/api/projects/x'));
    const env = expectValidErrorEnvelope(mockResponse.sentJson, 404, ERROR_CODES.NOT_FOUND);
    expect(env.message).toContain('not found');
  });

  it('422: VALIDATION_ERROR envelope with field details (from class-validator)', () => {
    // class-validator returns BadRequestException with { message: [...], error: "Bad Request" }
    const validationException = new BadRequestException({
      message: [
        'email must be an email',
        'password must be longer than or equal to 8 characters',
      ],
      error: 'Bad Request',
    });

    filter.catch(validationException, createMockHost('POST', '/api/auth/register'));

    // Should be promoted to 422 instead of staying 400
    const env = expectValidErrorEnvelope(mockResponse.sentJson, 422, ERROR_CODES.VALIDATION_ERROR);

    // Must have field-level details
    expect(env.details).toBeDefined();
    expect(Array.isArray(env.details)).toBe(true);
    expect(env.details!.length).toBe(2);

    // Field inference should work
    expect(env.details![0].field).toBe('email');
    expect(env.details![0].code).toBe('VALIDATION_FAILED');
    expect(env.details![1].field).toBe('password');

    expect(env.message).toContain('Validation failed');
  });

  it('500: INTERNAL_ERROR envelope (dev mode shows actual message)', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    filter.catch(new Error('Connection refused: port 5432'), createMockHost('GET', '/api/db'));
    const env = expectValidErrorEnvelope(mockResponse.sentJson, 500, ERROR_CODES.INTERNAL_ERROR);
    expect(env.message).toContain('Connection refused');

    process.env.NODE_ENV = originalEnv;
  });

  it('500: INTERNAL_ERROR envelope (production mode hides internals)', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    filter.catch(
      new Error('DROP TABLE users; SQL injection payload visible in stack'),
      createMockHost('GET', '/api/danger')
    );

    const env = expectValidErrorEnvelope(mockResponse.sentJson, 500, ERROR_CODES.INTERNAL_ERROR);
    // Must NOT leak internal details in production
    expect(env.message).toBe('An unexpected error occurred');
    expect(env.message).not.toContain('DROP TABLE');
    expect(env.message).not.toContain('SQL injection');

    process.env.NODE_ENV = originalEnv;
  });
});
