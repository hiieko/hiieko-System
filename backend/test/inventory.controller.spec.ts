import { BadRequestException } from '@nestjs/common';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { ProjectScope } from '../src/common/auth/project-scope.filter';

/**
 * Regression tests for query-parameter validation on GET /api/inventory/balance.
 *
 * `materialId` is the endpoint's required identifier. When it was omitted the
 * value reached Prisma as `undefined`, which Prisma treats as "no filter" —
 * so the query silently matched arbitrary stock-balance rows instead of
 * failing. A missing/empty materialId must now be rejected with HTTP 400.
 */
describe('InventoryController (query-parameter validation)', () => {
  let controller: InventoryController;
  let service: any;

  const globalScope: ProjectScope = { isGlobal: true, projectIds: [] };

  beforeEach(() => {
    service = { getStockBalance: jest.fn().mockResolvedValue(null) };
    controller = new InventoryController(service as InventoryService);
  });

  it('rejects a missing materialId', async () => {
    await expect(
      controller.getBalance(globalScope, undefined as any),
    ).rejects.toThrow(BadRequestException);
    expect(service.getStockBalance).not.toHaveBeenCalled();
  });

  it('rejects an empty materialId', async () => {
    await expect(controller.getBalance(globalScope, '')).rejects.toThrow(
      BadRequestException,
    );
    expect(service.getStockBalance).not.toHaveBeenCalled();
  });

  it('forwards a valid materialId with the scoped filter', async () => {
    await controller.getBalance(globalScope, 'mat-1', undefined, 'wh-1');

    expect(service.getStockBalance).toHaveBeenCalledWith(
      'mat-1',
      undefined,
      'wh-1',
      {},
    );
  });
});
