import { UserRoleEnum } from '@prisma/client';
import { ProjectRequirementsController } from '../src/modules/projects/project-requirements.controller';
import {
  PERMISSIONS_KEY,
  REQUIRE_PROJECT_ACCESS_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';

describe('ProjectRequirementsController', () => {
  const user = {
    id: 'pm-1',
    email: 'pm@test.local',
    role: UserRoleEnum.PM,
    organizationId: 'org-1',
    projectRoles: { 'project-1': UserRoleEnum.PM },
  };
  let service: any;
  let controller: ProjectRequirementsController;

  beforeEach(() => {
    service = {
      findApplicable: jest.fn().mockResolvedValue({ requirements: [] }),
      findAssessmentHistory: jest.fn().mockResolvedValue([]),
      findCatalogAdoptions: jest.fn().mockResolvedValue([]),
      assess: jest.fn().mockResolvedValue({ changed: true }),
      adoptLatestCatalog: jest.fn().mockResolvedValue({ adoption: { id: 'adoption-1' } }),
    };
    controller = new ProjectRequirementsController(service);
  });

  it('requires project access on each project-scoped route', () => {
    for (const handler of [
      ProjectRequirementsController.prototype.findApplicable,
      ProjectRequirementsController.prototype.findAssessmentHistory,
      ProjectRequirementsController.prototype.findCatalogAdoptions,
      ProjectRequirementsController.prototype.assess,
      ProjectRequirementsController.prototype.adoptLatestCatalog,
    ]) {
      expect(Reflect.getMetadata(REQUIRE_PROJECT_ACCESS_KEY, handler)).toEqual({
        param: 'projectId',
        mode: 'required',
      });
    }
  });

  it('protects adoption with the granular permission as well as service authorization', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ProjectRequirementsController.prototype.adoptLatestCatalog)).toEqual([
      { module: 'projects', action: 'requirement_catalog_adopt' },
    ]);
  });

  it('forwards requirement reads and assessment decisions with the authenticated user', async () => {
    const dto = { state: 'APPLICABLE', note: 'Reviewed evidence' };
    await controller.findApplicable('project-1', user);
    await controller.findAssessmentHistory('project-1', user);
    await controller.assess('project-1', 'requirement-1', dto as any, user);

    expect(service.findApplicable).toHaveBeenCalledWith('project-1', user);
    expect(service.findAssessmentHistory).toHaveBeenCalledWith('project-1', user);
    expect(service.assess).toHaveBeenCalledWith('project-1', 'requirement-1', dto, user);
  });

  it('forwards the explicit type and reason without accepting reviewer identity from the body', async () => {
    const dto = { projectType: 'COMMERCIAL_SOLAR', reason: 'Reviewed scope', reviewedBy: 'spoofed-user' };
    await controller.adoptLatestCatalog('project-1', dto as any, user);

    expect(service.adoptLatestCatalog).toHaveBeenCalledWith('project-1', dto, user);
  });
});
