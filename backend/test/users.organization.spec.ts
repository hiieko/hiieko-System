import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { SessionService } from '../src/modules/auth/session.service';

describe('UsersService — organization and mutation boundaries', () => {
  let service: UsersService;
  let prisma: any;
  let audit: any;
  let sessions: any;

  const admin = {
    id: 'admin-1',
    organizationId: 'org-1',
    role: UserRoleEnum.ADMIN,
  } as any;

  const userInOrg = {
    id: 'user-1',
    organization_id: 'org-1',
    email: 'user@org1.local',
    role: UserRoleEnum.WORKER,
    is_active: true,
    status: UserStatusEnum.ACTIVE,
    profile: null,
    employee: null,
    project_members: [],
    team_members: [],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      session: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn() },
      userProfile: { upsert: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    sessions = new SessionService(prisma);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findAll always scopes to the actor organization', async () => {
    prisma.user.findMany.mockResolvedValue([userInOrg]);
    await service.findAll(admin);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organization_id: 'org-1' } }),
    );
  });

  it('findOne returns 404 for a user outside the actor organization', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findOne('other-org-user', admin)).rejects.toThrow(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-org-user', organization_id: 'org-1' },
      }),
    );
  });

  it('updateRole refuses self-role changes', async () => {
    prisma.user.findFirst.mockResolvedValue(userInOrg);

    await expect(service.updateRole('admin-1', UserRoleEnum.WORKER, admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updateStatus refuses self-status changes', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...userInOrg,
      id: 'admin-1',
    });

    await expect(
      service.updateStatus('admin-1', { status: UserStatusEnum.SUSPENDED }, admin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('requires an organization on the actor before user management', async () => {
    await expect(
      service.findAll({ id: 'admin-2', role: UserRoleEnum.ADMIN } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid roles before writing', async () => {
    prisma.user.findFirst.mockResolvedValue(userInOrg);

    await expect(
      service.updateRole('user-1', 'NOT_A_ROLE' as any, admin),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
