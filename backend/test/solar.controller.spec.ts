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
    service = {
      findAll: jest.fn(),
      updateRoofSection: jest.fn(),
      deleteRoofSection: jest.fn(),
      addObstacle: jest.fn(),
      listObstacles: jest.fn(),
      updateObstacle: jest.fn(),
      deleteObstacle: jest.fn(),
    };
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

  it('delegates roof update to the service with design + roof ids', async () => {
    const user = { id: 'u1' };
    await controller.updateRoofSection('design-1', 'roof-1', { name: 'New' } as any, user as any);
    expect(service.updateRoofSection).toHaveBeenCalledWith('design-1', 'roof-1', { name: 'New' }, user);
  });

  it('delegates roof delete to the service', async () => {
    await controller.deleteRoofSection('design-1', 'roof-1', {} as any);
    expect(service.deleteRoofSection).toHaveBeenCalledWith('design-1', 'roof-1', {});
  });

  it('delegates obstacle creation to the service with design + roof ids', async () => {
    const user = { id: 'u1' };
    const dto = { polygon: [{ x: 0, y: 0 }] };
    await controller.addObstacle('design-1', 'roof-1', dto as any, user as any);
    expect(service.addObstacle).toHaveBeenCalledWith('design-1', 'roof-1', dto, user);
  });

  it('delegates obstacle delete to the service with design + obstacle ids', async () => {
    await controller.deleteObstacle('design-1', 'obs-1', {} as any);
    expect(service.deleteObstacle).toHaveBeenCalledWith('design-1', 'obs-1', {});
  });
});
