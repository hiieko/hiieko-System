import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsService } from '../src/modules/attachments/attachments.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../src/common/auth/auth.types';

describe('AttachmentsService (Cross-Project Isolation)', () => {
  let service: AttachmentsService;
  let prisma: any;
  let audit: any;

  const member: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRoleEnum.SITE_MANAGER,
    organizationId: 'org-1',
    permissions: [],
  } as unknown as AuthenticatedUser;

  const admin: AuthenticatedUser = {
    ...member,
    id: 'admin-1',
    role: UserRoleEnum.ADMIN,
  } as unknown as AuthenticatedUser;

  const createdRow = {
    id: 'att-1',
    target_type: 'task',
    target_id: 'task-1',
    file_name: 'photo.jpg',
    storage_url: '/api/upload/doc-1',
    mime_type: null,
    created_at: new Date('2026-03-02T10:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn() },
      task: { findUnique: jest.fn() },
      dailyReport: { findUnique: jest.fn() },
      issue: { findUnique: jest.fn() },
      inspection: { findUnique: jest.fn() },
      document: { findUnique: jest.fn() },
      attachment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('create', () => {
    it('rejects an unsupported target type', async () => {
      await expect(
        service.create(
          { target_type: 'warehouse' as any, target_id: 'wh-1', file_id: 'doc-1' },
          'proj-1',
          member,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('rejects a target that does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { target_type: 'task', target_id: 'missing', file_id: 'doc-1' },
          'proj-1',
          member,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('rejects a target belonging to a different project', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-2' });

      await expect(
        service.create(
          { target_type: 'task', target_id: 'task-1', file_id: 'doc-1' },
          'proj-1',
          member,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('allows a global-scope role to link a target from another project', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-2' });
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'photo.jpg',
        project_id: 'proj-1',
      });
      prisma.attachment.create.mockResolvedValue(createdRow);

      const result = await service.create(
        { target_type: 'task', target_id: 'task-1', file_id: 'doc-1' },
        'proj-1',
        admin,
      );

      expect(result.id).toBe('att-1');
      expect(prisma.document.findUnique).toHaveBeenCalled();
    });

    it('rejects an uploaded document that does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-1' });
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { target_type: 'task', target_id: 'task-1', file_id: 'missing' },
          'proj-1',
          member,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('rejects an uploaded document belonging to another project', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-1' });
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'photo.jpg',
        project_id: 'proj-2',
      });

      await expect(
        service.create(
          { target_type: 'task', target_id: 'task-1', file_id: 'doc-1' },
          'proj-1',
          member,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('links an uploaded document and audits the link', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-1' });
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        title: 'photo.jpg',
        project_id: 'proj-1',
      });
      prisma.attachment.create.mockResolvedValue(createdRow);

      const result = await service.create(
        { target_type: 'task', target_id: 'task-1', file_id: 'doc-1' },
        'proj-1',
        member,
      );

      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: {
          target_type: 'task',
          target_id: 'task-1',
          file_name: 'photo.jpg',
          storage_url: '/api/upload/doc-1',
          mime_type: null,
        },
      });
      expect(result.url).toBe('/api/upload/doc-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTACHMENT_CREATED',
          entity: 'Attachment',
          entityId: 'att-1',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('rejects listing attachments across projects', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-2' });

      await expect(
        service.findAll('task', 'task-1', 'proj-1', member),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('lists newest first and maps rows to the client shape', async () => {
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-1' });
      prisma.attachment.findMany.mockResolvedValue([createdRow]);

      const result = await service.findAll('task', 'task-1', 'proj-1', member);

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: { target_type: 'task', target_id: 'task-1' },
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual([
        {
          id: 'att-1',
          target_type: 'task',
          target_id: 'task-1',
          file_name: 'photo.jpg',
          mime_type: null,
          url: '/api/upload/doc-1',
          caption: null,
          created_at: createdRow.created_at,
        },
      ]);
    });
  });

  describe('remove', () => {
    it('throws NotFound for an unknown attachment', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', 'proj-1', member)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects deleting an attachment whose target is in another project', async () => {
      prisma.attachment.findUnique.mockResolvedValue(createdRow);
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-2' });

      await expect(service.remove('att-1', 'proj-1', member)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.attachment.delete).not.toHaveBeenCalled();
    });

    it('deletes the link and audits it without touching the blob', async () => {
      prisma.attachment.findUnique.mockResolvedValue(createdRow);
      prisma.task.findUnique.mockResolvedValue({ project_id: 'proj-1' });
      prisma.attachment.delete.mockResolvedValue(createdRow);

      const result = await service.remove('att-1', 'proj-1', member);

      expect(result).toEqual({ id: 'att-1' });
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTACHMENT_DELETED',
          before: expect.objectContaining({ storage_url: '/api/upload/doc-1' }),
        }),
      );
    });
  });
});
