import { BadRequestException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import {
  REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
  REQUIRE_PROJECT_ACCESS_KEY,
} from '../src/common/auth/decorators/auth-metadata.decorator';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

const user = {
  id: 'user-1',
  email: 'user@hiieko.local',
  role: UserRoleEnum.WORKER,
  organizationId: 'org-1',
  projectRoles: { 'project-1': UserRoleEnum.WORKER },
};

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: any;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
      findOne: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      updateMetadata: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      createFromUpload: jest.fn().mockResolvedValue({
        document: { id: 'doc-1', title: 'Plan', current_version: 1 },
        stored: { key: 'documents/x.pdf', mimeType: 'application/pdf', size: 42, checksum: 'sum' },
      }),
      addVersionFromUpload: jest.fn().mockResolvedValue({
        document: { id: 'doc-1', title: 'Plan', current_version: 2 },
        stored: { key: 'documents/y.pdf', mimeType: 'application/pdf', size: 43, checksum: 'sum2' },
      }),
    };

    controller = new DocumentsController(service);
  });

  describe('route metadata', () => {
    it('protects the list route with an optional project access check', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_PROJECT_ACCESS_KEY,
        DocumentsController.prototype.findAll,
      );
      expect(metadata).toEqual({ param: 'projectId', mode: 'optional' });
    });

    it('protects the detail route with an entity project access check', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
        DocumentsController.prototype.findOne,
      );
      expect(metadata).toEqual({ model: 'document', param: 'id' });
    });

    it('requires projectId from a guard-readable request parameter for document uploads', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_PROJECT_ACCESS_KEY,
        DocumentsController.prototype.create,
      );
      expect(metadata).toEqual({ param: 'projectId', mode: 'required' });
    });

    it('protects the version route with an entity project access check', () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
        DocumentsController.prototype.addVersion,
      );
      expect(metadata).toEqual({ model: 'document', param: 'id' });
    });
  });

  describe('GET /api/documents', () => {
    it('forwards the filters and the pagination to the service', async () => {
      await controller.findAll(
        { isGlobal: false, projectIds: ['project-1'] },
        user,
        'project-1',
        'plan',
        'plan_tehnic',
        '2026-01-01',
        '2026-01-31',
        'application/pdf',
        'title',
        'asc',
        '2',
        '10',
      );

      expect(service.findAll).toHaveBeenCalledWith(
        { isGlobal: false, projectIds: ['project-1'] },
        user,
        {
          projectId: 'project-1',
          q: 'plan',
          documentType: 'plan_tehnic',
          from: '2026-01-01',
          to: '2026-01-31',
          mimeType: 'application/pdf',
          sortBy: 'title',
          sortOrder: 'asc',
          page: 2,
          pageSize: 10,
        },
      );
    });
  });

  describe('PATCH /api/documents/:id', () => {
    it('requires entity access and forwards metadata changes without a file payload', async () => {
      const metadata = Reflect.getMetadata(
        REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
        DocumentsController.prototype.updateMetadata,
      );
      expect(metadata).toEqual({ model: 'document', param: 'id' });

      const dto = { documentType: 'FACTURA', projectId: 'project-1' };
      await controller.updateMetadata('doc-1', dto, user);
      expect(service.updateMetadata).toHaveBeenCalledWith('doc-1', dto, user);
    });
  });

  describe('POST /api/documents', () => {
    it('rejects a request without a file', async () => {
      await expect(
        controller.create(undefined, 'project-1', 'plan_tehnic', 'Plan', 'PT-1', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores the binary server-side and returns the stable document id', async () => {
      const result = await controller.create(
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'plan.pdf', size: PDF_BYTES.length } as any,
        'project-1',
        'plan_tehnic',
        'Plan',
        'PT-1',
        user,
      );

      expect(service.createFromUpload).toHaveBeenCalledWith(
        { projectId: 'project-1', documentType: 'plan_tehnic', title: 'Plan', code: 'PT-1' },
        expect.objectContaining({ mimetype: 'application/pdf' }),
        user,
      );
      expect(result).toMatchObject({
        documentId: 'doc-1',
        url: '/api/upload/doc-1',
        mimeType: 'application/pdf',
      });
    });

    it('returns an exact-duplicate warning without serializing a new document result', async () => {
      const warning = {
        duplicate: true,
        matchScope: 'authorized_projects',
        matches: [{ documentId: 'existing-doc', matchingVersion: 2 }],
      };
      service.createFromUpload.mockResolvedValue(warning);

      const result = await controller.create(
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'plan.pdf', size: PDF_BYTES.length } as any,
        'project-1',
        'CONTRACT',
        undefined,
        undefined,
        user,
      );

      expect(result).toEqual(warning);
    });

    it('forwards an explicit continue-as-separate confirmation to the service', async () => {
      await controller.create(
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'plan.pdf', size: PDF_BYTES.length } as any,
        'project-1',
        'CONTRACT',
        undefined,
        undefined,
        user,
        'true',
      );

      expect(service.createFromUpload).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1', documentType: 'CONTRACT', allowDuplicate: true }),
        expect.any(Object),
        user,
      );
    });
  });

  describe('POST /api/documents/:id/versions', () => {
    it('rejects a request without a file', async () => {
      await expect(controller.addVersion('doc-1', undefined, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('appends the version and returns the new version number', async () => {
      const result = await controller.addVersion(
        'doc-1',
        { buffer: PDF_BYTES, mimetype: 'application/pdf', originalname: 'plan-v2.pdf', size: PDF_BYTES.length } as any,
        user,
      );

      expect(service.addVersionFromUpload).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ mimetype: 'application/pdf' }),
        user,
        false,
      );
      expect(result).toMatchObject({ documentId: 'doc-1', version: 2 });
    });
  });
});
