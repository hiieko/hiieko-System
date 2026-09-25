import { BadRequestException } from '@nestjs/common';
import { SolarController } from '../src/modules/solar/solar.controller';
import { SolarService } from '../src/modules/solar/solar.service';

/**
 * Regression tests for the list-design authorization fix (D3).
 *
 * Note on layering: cross-project *membership* denial is enforced by the
 * existing `ProjectAccessGuard` (wired on this route via
 * `@RequireProjectAccess('projectId')` + `@UseGuards(ProjectAccessGuard)`), which
 * is covered by `project-access.guard.spec.ts`. These tests cover the
 * controller-level regression: a missing `projectId` is rejected, and the
 * service is always called with the exact requested project id (so a listing
 * can never span projects).
 */
describe('SolarController (list-design authorization)', () => {
  let controller: SolarController;
  let service: any;

  beforeEach(() => {
    service = { findAll: jest.fn() };
    controller = new SolarController(service as SolarService);
  });

  it('rejects listDesigns when projectId is missing or empty', async () => {
    await expect(controller.listDesigns(undefined as any)).rejects.toThrow(BadRequestException);
    await expect(controller.listDesigns('' as any)).rejects.toThrow(BadRequestException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('delegates to the service with the exact requested project id', async () => {
    service.findAll.mockResolvedValue([{ id: 'design-a1' }]);

    const result = await controller.listDesigns('project-a');

    expect(service.findAll).toHaveBeenCalledWith('project-a');
    expect(result).toEqual([{ id: 'design-a1' }]);
  });

  it('never returns another project design in a given project listing', async () => {
    service.findAll.mockImplementation((projectId: string) =>
      projectId === 'project-a' ? [{ id: 'design-a1' }] : [{ id: 'design-b1' }],
    );

    const resultA = await controller.listDesigns('project-a');
    expect(resultA).toEqual([{ id: 'design-a1' }]);
    expect(resultA).not.toContainEqual({ id: 'design-b1' });
  });
});
