import { ForbiddenException } from '@nestjs/common';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService administration workflows', () => {
  let service: UsersService;
  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock; recordRequired: jest.Mock };
  let sessions: { revokeAllSessionsForUser: jest.Mock; revokeSession: jest.Mock };

  const admin = {
    id: 'admin-1',
    organizationId: 'org-1',
    role: UserRoleEnum.ADMIN,
  } as any;

  const baseUser = {
    id: 'employee-1',
    organization_id: 'org-1',
    email: 'employee@hiieko.ro',
    role: UserRoleEnum.WORKER,
    status: UserStatusEnum.ACTIVE,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    profile: { full_name: 'Employee' },
    project_members: [],
    team_members: [],
    employee: null,
  };

  beforeEach(() => {
    tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'replacement-1',
          organization_id: 'org-1',
          status: UserStatusEnum.ACTIVE,
          is_active: true,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'pending-1',
          organization_id: 'org-1',
          email: 'new@hiieko.ro',
          role: UserRoleEnum.WORKER,
          status: UserStatusEnum.PENDING,
          is_active: false,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'employee-1',
          organization_id: 'org-1',
          email: 'employee@hiieko.ro',
          role: UserRoleEnum.WORKER,
          status: UserStatusEnum.SUSPENDED,
          is_active: false,
        }),
      },
      projectMember: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'member-1', project_id: 'project-1', role: UserRoleEnum.PM },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      taskAssignment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'assignment-1', task_id: 'task-1' }]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employee: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(baseUser),
      },
      session: {
        findMany: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1', revoked_at: null }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      projectMember: { findMany: jest.fn().mockResolvedValue([]) },
      taskAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      recordRequired: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    sessions = {
      revokeAllSessionsForUser: jest.fn().mockResolvedValue(1),
      revokeSession: jest.fn().mockResolvedValue(true),
    };
    service = new UsersService(prisma, audit as any, sessions as any);
  });

  it('provisions an administrator-created account as PENDING without a password', async () => {
    await service.createPending(
      { email: 'New@hiieko.ro', fullName: 'New Employee', role: UserRoleEnum.WORKER },
      admin,
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: 'org-1',
          email: 'new@hiieko.ro',
          password_hash: null,
          status: UserStatusEnum.PENDING,
          is_active: false,
        }),
      }),
    );
    expect(audit.recordRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_PROVISIONED' }),
      tx,
    );
  });

  it('derives last login from the latest successful USER_LOGIN audit event', async () => {
    const lastLogin = new Date('2026-02-03T10:00:00.000Z');
    prisma.user.findMany.mockResolvedValue([{ ...baseUser, audit_logs: [{ created_at: lastLogin }] }]);

    const result = await service.findAll(admin);

    expect(result[0].last_login_at).toEqual(lastLogin);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organization_id: 'org-1' } }),
    );
  });

  it('does not allow an ordinary administrator to grant OWNER', async () => {
    await expect(
      service.updateRole('employee-1', UserRoleEnum.OWNER, admin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow an ordinary administrator to change an existing OWNER', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, role: UserRoleEnum.OWNER });
    await expect(
      service.updateRole('employee-1', UserRoleEnum.WORKER, admin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow an ordinary administrator to deactivate an OWNER', async () => {
    prisma.user.findFirst.mockResolvedValue({ ...baseUser, role: UserRoleEnum.OWNER });
    await expect(
      service.updateStatus('employee-1', { status: UserStatusEnum.SUSPENDED }, admin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists safe session metadata and never selects token material', async () => {
    await service.getSessions('employee-1', admin);
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'employee-1' },
        select: expect.not.objectContaining({ refresh_tokens: true, token_hash: true }),
      }),
    );
  });

  it('reassigns project memberships and task assignments, suspends the employee, and revokes sessions atomically', async () => {
    const result = await service.offboardAndReassign('employee-1', 'replacement-1', admin);

    expect(tx.projectMember.createMany).toHaveBeenCalledWith({
      data: [{ project_id: 'project-1', user_id: 'replacement-1', role: UserRoleEnum.PM }],
      skipDuplicates: true,
    });
    expect(tx.taskAssignment.createMany).toHaveBeenCalledWith({
      data: [{ task_id: 'task-1', user_id: 'replacement-1' }],
      skipDuplicates: true,
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-1' },
        data: { status: UserStatusEnum.SUSPENDED, is_active: false },
      }),
    );
    expect(sessions.revokeAllSessionsForUser).toHaveBeenCalledWith(
      'employee-1',
      'OFFBOARDING',
      undefined,
      tx,
    );
    expect(result).toMatchObject({
      projectMembershipsReassigned: 1,
      taskAssignmentsReassigned: 1,
      revokedSessions: 1,
    });
    expect(audit.recordRequired).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_OFFBOARDED' }),
      tx,
    );
  });
});
