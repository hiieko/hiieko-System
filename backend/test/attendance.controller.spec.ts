import { BadRequestException } from '@nestjs/common';
import { AttendanceController } from '../src/modules/attendance/attendance.controller';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { ProjectScope } from '../src/common/auth/project-scope.filter';

/**
 * Regression tests for date query-parameter validation.
 *
 * Previously malformed `startDate`/`endDate`/`date` values were handed to
 * `companyDay`, producing an Invalid Date that crashed Prisma with a
 * PrismaClientValidationError (HTTP 500). Malformed dates must fail with
 * HTTP 400 instead.
 */
describe('AttendanceController (query-parameter validation)', () => {
  let controller: AttendanceController;
  let service: any;

  const globalScope: ProjectScope = { isGlobal: true, projectIds: [] };
  const user = { id: 'user-1' } as any;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findAllPaginated: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 25,
      }),
      findByUserAndDate: jest.fn().mockResolvedValue([]),
    };
    controller = new AttendanceController(service as AttendanceService);
  });

  it('accepts valid startDate and endDate values', async () => {
    await controller.findAll(
      globalScope,
      undefined,
      undefined,
      '2026-01-01',
      '2026-01-31',
    );

    expect(service.findAll).toHaveBeenCalledWith({
      projectId: undefined,
      userId: undefined,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      projectScopeWhere: {},
    });
  });

  it('accepts a full ISO timestamp (companyDay slicing contract)', async () => {
    await controller.findAll(
      globalScope,
      undefined,
      undefined,
      '2026-01-01T10:00:00.000Z',
    );

    expect(service.findAll).toHaveBeenCalled();
  });

  it('treats an empty startDate/endDate as absent', async () => {
    await controller.findAll(globalScope, undefined, undefined, '', '');

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '', endDate: '' }),
    );
  });

  it('rejects a malformed startDate', async () => {
    await expect(
      controller.findAll(globalScope, undefined, undefined, 'not-a-date'),
    ).rejects.toThrow(BadRequestException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('rejects an impossible calendar endDate', async () => {
    await expect(
      controller.findAll(globalScope, undefined, undefined, undefined, '2026-13-45'),
    ).rejects.toThrow(BadRequestException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('keeps the legacy array response when pagination is not requested', async () => {
    const result = await controller.findAll(
      globalScope,
      'proj-1',
      undefined,
      '2026-01-01',
      '2026-01-31',
      undefined,
      '2',
      '10',
    );

    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalledWith({
      projectId: 'proj-1',
      userId: undefined,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      projectScopeWhere: { project_id: 'proj-1' },
    });
    expect(service.findAllPaginated).not.toHaveBeenCalled();
  });

  it('returns paginated metadata only when paginated=true is requested', async () => {
    const paginated = {
      data: [{ id: 'att-1' }],
      total: 21,
      page: 2,
      pageSize: 10,
    };
    service.findAllPaginated.mockResolvedValue(paginated);

    const result = await controller.findAll(
      globalScope,
      'proj-1',
      undefined,
      '2026-01-01',
      '2026-01-31',
      'true',
      '2',
      '10',
    );

    expect(result).toEqual(paginated);
    expect(service.findAllPaginated).toHaveBeenCalledWith(
      {
        projectId: 'proj-1',
        userId: undefined,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        projectScopeWhere: { project_id: 'proj-1' },
      },
      2,
      10,
    );
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('applies pagination defaults', async () => {
    await controller.findAll(
      globalScope,
      undefined,
      undefined,
      undefined,
      undefined,
      'true',
    );

    expect(service.findAllPaginated).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      25,
    );
  });

  it('rejects invalid pagination values', async () => {
    await expect(
      controller.findAll(
        globalScope,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        '0',
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.findAll(
        globalScope,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        '1',
        '201',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(service.findAllPaginated).not.toHaveBeenCalled();
  });

  it('rejects a malformed date on my-logs', async () => {
    await expect(controller.getMyLogs(user, 'not-a-date')).rejects.toThrow(
      BadRequestException,
    );
    expect(service.findByUserAndDate).not.toHaveBeenCalled();
  });

  it('accepts a valid date on my-logs', async () => {
    await controller.getMyLogs(user, '2026-01-15');

    expect(service.findByUserAndDate).toHaveBeenCalledWith('user-1', '2026-01-15');
  });
});
