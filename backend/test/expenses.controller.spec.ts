import { BadRequestException } from '@nestjs/common';
import { UserRoleEnum, ExpenseStatusEnum } from '@prisma/client';
import { ExpensesController } from '../src/modules/expenses/expenses.controller';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { ProjectScope } from '../src/common/auth/project-scope.filter';

/**
 * Regression tests for query-parameter validation on GET /api/expenses.
 *
 * Previously an unknown `status` value was passed straight to Prisma, which
 * rejected it with a PrismaClientValidationError (HTTP 500). Invalid enum
 * values must instead fail fast with HTTP 400 and never reach the service.
 */
describe('ExpensesController (query-parameter validation)', () => {
  let controller: ExpensesController;
  let service: any;

  const globalScope: ProjectScope = { isGlobal: true, projectIds: [] };
  const admin = { id: 'user-1', role: UserRoleEnum.ADMIN } as any;

  beforeEach(() => {
    service = { findAll: jest.fn().mockResolvedValue([]) };
    controller = new ExpensesController(service as ExpensesService);
  });

  it('forwards a valid status filter to the service', async () => {
    await controller.findAll(
      globalScope,
      admin,
      undefined,
      undefined,
      ExpenseStatusEnum.APPROVED,
    );

    expect(service.findAll).toHaveBeenCalledWith(
      undefined,
      undefined,
      ExpenseStatusEnum.APPROVED,
      {},
    );
  });

  it('accepts a missing status (no filter)', async () => {
    await controller.findAll(globalScope, admin);

    expect(service.findAll).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      {},
    );
  });

  it('rejects an unknown status value before it reaches Prisma', async () => {
    await expect(
      controller.findAll(
        globalScope,
        admin,
        undefined,
        undefined,
        'BOGUS' as ExpenseStatusEnum,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
