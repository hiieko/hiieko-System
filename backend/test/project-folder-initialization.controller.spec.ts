import { UserRoleEnum } from '@prisma/client';
import {
  PERMISSIONS_KEY,
  REQUIRE_PROJECT_ACCESS_KEY,
  ROLES_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';
import { ProjectFolderInitializationController } from '../src/modules/projects/project-folder-initialization.controller';

describe('ProjectFolderInitializationController', () => {
  it('requires project access, allowed organization roles and the explicit PM permission', () => {
    const handler = ProjectFolderInitializationController.prototype.initialize;
    expect(Reflect.getMetadata(REQUIRE_PROJECT_ACCESS_KEY, handler)).toEqual({
      param: 'projectId',
      mode: 'required',
    });
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRoleEnum.ADMIN,
      UserRoleEnum.OWNER,
      UserRoleEnum.PM,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      { module: 'projects', action: 'folder_initialize' },
    ]);
  });

  it('passes only project ID and the authenticated user to the service', async () => {
    const service = { initializeExistingProject: jest.fn().mockResolvedValue({ foldersCreated: 1 }) };
    const controller = new ProjectFolderInitializationController(service as any);
    const user = {
      id: 'pm-1',
      email: 'pm@test.local',
      role: UserRoleEnum.PM,
      organizationId: 'org-1',
    };

    await controller.initialize('project-1', user);

    expect(service.initializeExistingProject).toHaveBeenCalledWith('project-1', user);
  });
});
