import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../src/modules/roles/roles.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { AuditService } from '../src/common/audit/audit.service';
import { RolesController } from '../src/modules/roles/roles.controller';
import { ROLES_KEY } from '../src/common/auth/decorators/auth-metadata.decorator';

describe('RolesService (Role Permissions)', () => {
  let service: RolesService;
  let prisma: any;
  let audit: { recordRequired: jest.Mock };

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(prisma)),
      permission: { findMany: jest.fn() },
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    audit = { recordRequired: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditService,
          useValue: audit,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('lists roles with their permissions', async () => {
    prisma.role.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      include: {
        permissions: { include: { permission: true } },
      },
    });
  });

  it('looks up a role by code with permissions', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });

    await service.findByCode(UserRoleEnum.ADMIN);

    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: { code: UserRoleEnum.ADMIN },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  });

  it('throws NotFound for an unknown role code', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(service.findByCode(UserRoleEnum.ADMIN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('writes only explicitly selected grants and audits the before/after permission IDs', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce({ id: 'role-worker', code: UserRoleEnum.WORKER })
      .mockResolvedValueOnce({ id: 'role-worker', code: UserRoleEnum.WORKER, permissions: [] });
    prisma.permission.findMany.mockResolvedValue([{ id: 'perm-read' }]);
    const actor = { id: 'owner-1', role: UserRoleEnum.OWNER, organizationId: 'org-1' } as any;

    await service.setPermissions(UserRoleEnum.WORKER, ['perm-read'], actor);

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role_id: 'role-worker' },
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ role_id: 'role-worker', permission_id: 'perm-read' }],
    });
    expect(audit.recordRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_PERMISSIONS_CHANGED' }),
      prisma,
    );
  });

  it('restricts permission assignment to OWNER and protects that route from the ADMIN bypass', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, RolesController.prototype.setPermissions),
    ).toEqual([UserRoleEnum.OWNER]);
  });
});
