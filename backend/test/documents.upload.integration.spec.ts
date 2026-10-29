import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { UserRoleEnum } from '@prisma/client';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { ProjectAccessGuard } from '../src/common/auth/guards/project-access.guard';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { StorageService } from '../src/common/storage/storage.service';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

describe('Documents upload HTTP authorization', () => {
  let app: INestApplication;
  let prisma: any;
  let storage: any;
  let currentUser: any;

  beforeEach(async () => {
    currentUser = {
      id: 'worker-1',
      email: 'worker@test.local',
      role: UserRoleEnum.WORKER,
      organizationId: 'org-1',
      projectRoles: {},
    };
    prisma = {
      project: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.id === 'project-1'
            ? { id: 'project-1', organization_id: 'org-1' }
            : where.id === 'other-org-project'
              ? { id: 'other-org-project', organization_id: 'org-2' }
              : null,
        ),
      },
      projectMember: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.project_id_user_id.project_id === 'project-1'
            ? { user_id: currentUser.id }
            : null,
        ),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => ({ id: 'document-1', ...data })),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    storage = {
      save: jest.fn().mockResolvedValue({
        key: 'documents/generated.pdf',
        originalName: 'plan.pdf',
        mimeType: 'application/pdf',
        size: PDF_BYTES.length,
        checksum: 'checksum',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        DocumentsService,
        ProjectAccessGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(true) } },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: { get: jest.fn((_key: string, fallback?: string) => fallback) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const upload = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .attach('file', PDF_BYTES, { filename: 'plan.pdf', contentType: 'application/pdf' });

  it('authorizes a multipart upload using the query projectId before the interceptor persists the file', async () => {
    await upload('/api/documents?projectId=project-1').expect(201);

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: { id: true, organization_id: true },
    });
    expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: { project_id_user_id: { project_id: 'project-1', user_id: currentUser.id } },
      select: { user_id: true },
    });
    expect(storage.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a projectId supplied only in multipart fields before file persistence', async () => {
    await request(app.getHttpServer())
      .post('/api/documents')
      .field('projectId', 'project-1')
      .attach('file', PDF_BYTES, { filename: 'plan.pdf', contentType: 'application/pdf' })
      .expect(403);

    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('rejects a nonmember before the upload interceptor runs', async () => {
    await upload('/api/documents?projectId=project-2').expect(403);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('rejects a global-role upload to an unknown project after trusted lookup and before persistence', async () => {
    currentUser = { ...currentUser, role: UserRoleEnum.MANAGER };

    await upload('/api/documents?projectId=missing-project').expect(404);

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-project' },
      select: { id: true, organization_id: true },
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('rejects a MANAGER upload to another organization before blob persistence', async () => {
    currentUser = { ...currentUser, role: UserRoleEnum.MANAGER };

    await upload('/api/documents?projectId=other-org-project').expect(403);

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'other-org-project' },
      select: { id: true, organization_id: true },
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });
});
