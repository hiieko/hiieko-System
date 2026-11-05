import { UserRoleEnum } from '@prisma/client';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  PERMISSIONS_KEY,
  REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
  REQUIRE_PROJECT_ACCESS_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';
import { DocumentFoldersController } from '../src/modules/documents/document-folders.controller';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';

describe('DocumentFoldersController', () => {
  const permissions = [{ module: 'documents', action: 'folder_manage' }];
  let service: any;
  let controller: DocumentFoldersController;
  const user = { id: 'pm-1', role: UserRoleEnum.PM, organizationId: 'org-1' };

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'folder-1' }),
      rename: jest.fn().mockResolvedValue({ id: 'folder-1' }),
      move: jest.fn().mockResolvedValue({ id: 'folder-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'folder-1', deleted: true }),
    };
    controller = new DocumentFoldersController(service);
  });

  it('keeps list and create scoped by the optional authorized project query', () => {
    expect(Reflect.getMetadata(REQUIRE_PROJECT_ACCESS_KEY, DocumentFoldersController.prototype.findAll)).toEqual({
      param: 'projectId', mode: 'optional',
    });
    expect(Reflect.getMetadata(REQUIRE_PROJECT_ACCESS_KEY, DocumentFoldersController.prototype.create)).toEqual({
      param: 'projectId', mode: 'optional',
    });
  });

  it('requires folder entity project access and documents:folder_manage on every mutation', () => {
    for (const method of ['create', 'rename', 'move', 'delete'] as const) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentFoldersController.prototype[method])).toEqual(permissions);
      expect(Reflect.getMetadata(GUARDS_METADATA, DocumentFoldersController.prototype[method])).toContain(PermissionsGuard);
    }
    for (const method of ['rename', 'move', 'delete'] as const) {
      expect(Reflect.getMetadata(REQUIRE_ENTITY_PROJECT_ACCESS_KEY, DocumentFoldersController.prototype[method])).toEqual({
        model: 'documentFolder', param: 'folderId',
      });
    }
  });

  it('forwards only user-controlled fields and authenticated identity to the service', async () => {
    const createDto = { name: 'Custom', parentId: 'parent-1' };
    const renameDto = { name: 'Renamed' };
    const moveDto = { parentId: null };
    await controller.findAll('project-1', user as any);
    await controller.create('project-1', createDto as any, user as any);
    await controller.rename('folder-1', renameDto, user as any);
    await controller.move('folder-1', moveDto as any, user as any);
    await controller.delete('folder-1', user as any);

    expect(service.findAll).toHaveBeenCalledWith('project-1', user);
    expect(service.create).toHaveBeenCalledWith('project-1', createDto, user);
    expect(service.rename).toHaveBeenCalledWith('folder-1', renameDto, user);
    expect(service.move).toHaveBeenCalledWith('folder-1', null, user);
    expect(service.delete).toHaveBeenCalledWith('folder-1', user);
  });

  it('requires an explicit null or folder ID for a move request', async () => {
    expect(() => controller.move('folder-1', {} as any, user as any)).toThrow('parentId is required');
    expect(service.move).not.toHaveBeenCalled();
  });
});
