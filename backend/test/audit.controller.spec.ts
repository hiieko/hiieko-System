import { BadRequestException } from '@nestjs/common';
import { AuditController } from '../src/modules/audit/audit.controller';
import { AuditService } from '../src/common/audit/audit.service';

/**
 * Regression tests for query-parameter validation on GET /api/audit.
 *
 * Previously `limit`/`offset` were passed through `parseInt` unvalidated:
 * a negative `offset` reached Prisma's `skip` and crashed with an unknown
 * request error (HTTP 500), while malformed/negative `limit` values were
 * silently coerced or returned the wrong page.
 */
describe('AuditController (query-parameter validation)', () => {
  let controller: AuditController;
  let service: any;

  beforeEach(() => {
    service = { query: jest.fn().mockResolvedValue([]) };
    controller = new AuditController(service as AuditService);
  });

  it('passes parsed numeric pagination to the service', async () => {
    await controller.query(undefined, undefined, undefined, undefined, '10', '20');

    expect(service.query).toHaveBeenCalledWith({
      entity: undefined,
      entityId: undefined,
      actorId: undefined,
      action: undefined,
      limit: 10,
      offset: 20,
    });
  });

  it('keeps the documented defaults when pagination is omitted', async () => {
    await controller.query();

    expect(service.query).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('rejects a malformed limit', async () => {
    await expect(
      controller.query(undefined, undefined, undefined, undefined, 'abc', '0'),
    ).rejects.toThrow(BadRequestException);
    expect(service.query).not.toHaveBeenCalled();
  });

  it('rejects a negative limit', async () => {
    await expect(
      controller.query(undefined, undefined, undefined, undefined, '-1', '0'),
    ).rejects.toThrow(BadRequestException);
    expect(service.query).not.toHaveBeenCalled();
  });

  it('rejects a negative offset instead of crashing Prisma', async () => {
    await expect(
      controller.query(undefined, undefined, undefined, undefined, '50', '-5'),
    ).rejects.toThrow(BadRequestException);
    expect(service.query).not.toHaveBeenCalled();
  });

  it('rejects a malformed offset', async () => {
    await expect(
      controller.query(undefined, undefined, undefined, undefined, '50', 'abc'),
    ).rejects.toThrow(BadRequestException);
    expect(service.query).not.toHaveBeenCalled();
  });
});
