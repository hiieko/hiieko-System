import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { SessionService } from '../auth/session.service';
import { SESSION_REVOKE_REASON } from '../auth/auth.constants';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, UserStatusEnum } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async findAll(actor: AuthenticatedUser) {
    const organizationId = this.requireOrganization(actor);

    const users = await this.prisma.user.findMany({
      where: { organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        created_at: true,
        updated_at: true,
        profile: true,
        ...(process.env.ENTRA_LINKING_ENABLED === 'true' && {
          microsoft_identity_link: {
            select: { status: true, linked_at: true, last_authenticated_at: true },
          },
        }),
        audit_logs: {
          where: { action: 'USER_LOGIN' },
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true },
        },
        project_members: {
          include: {
            project: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return users.map(({ audit_logs, ...user }) => ({
      ...user,
      last_login_at: audit_logs?.[0]?.created_at ?? null,
    }));
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const organizationId = this.requireOrganization(actor);
    const user = await this.prisma.user.findFirst({
      where: { id, organization_id: organizationId },
      select: {
        id: true,
        organization_id: true,
        email: true,
        role: true,
        is_active: true,
        status: true,
        created_at: true,
        updated_at: true,
        profile: true,
        ...(process.env.ENTRA_LINKING_ENABLED === 'true' && {
          microsoft_identity_link: {
            select: { status: true, linked_at: true, last_authenticated_at: true },
          },
        }),
        employee: true,
        project_members: {
          include: {
            project: true,
          },
        },
        team_members: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateRole(id: string, newRole: UserRoleEnum, actor: AuthenticatedUser) {
    const before = await this.findOne(id, actor);

    if (id === actor.id) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    this.assertAdministrator(actor);
    if (
      actor.role === UserRoleEnum.ADMIN &&
      (before.role === UserRoleEnum.OWNER || newRole === UserRoleEnum.OWNER)
    ) {
      throw new ForbiddenException('Only a Super Administrator may change Super Administrator access.');
    }

    this.assertValidRole(newRole);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { role: newRole },
        select: {
          id: true,
          organization_id: true,
          email: true,
          role: true,
          is_active: true,
          status: true,
          profile: true,
        },
      });

      const revokedSessions = await this.sessionService.revokeAllSessionsForUser(
        id,
        SESSION_REVOKE_REASON.ROLE_CHANGED,
        undefined,
        tx,
      );
      await this.auditService.recordRequired(
        {
          organizationId: before.organization_id,
          actorId: actor.id,
          action: 'USER_ROLE_CHANGED',
          entity: 'User',
          entityId: id,
          before: { role: before.role },
          after: { role: newRole },
          metadata: { revokedSessions },
        },
        tx,
      );

      return updated;
    });

    return updated;
  }

  async updateStatus(
    id: string,
    input: { status?: UserStatusEnum; isActive?: boolean },
    actor: AuthenticatedUser,
  ) {
    const before = await this.findOne(id, actor);

    if (id === actor.id) {
      throw new ForbiddenException('You cannot change your own account status.');
    }
    this.assertAdministrator(actor);
    if (actor.role === UserRoleEnum.ADMIN && before.role === UserRoleEnum.OWNER) {
      throw new ForbiddenException('Only a Super Administrator may change Super Administrator status.');
    }

    const targetStatus = this.resolveStatus(input);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (before.role === UserRoleEnum.OWNER && targetStatus !== UserStatusEnum.ACTIVE) {
        const activeOwners = await tx.user.count({
          where: {
            role: UserRoleEnum.OWNER,
            status: UserStatusEnum.ACTIVE,
            is_active: true,
          },
        });
        if (activeOwners <= 1) {
          throw new ConflictException('The last active Super Administrator cannot be deactivated.');
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          status: targetStatus,
          is_active: targetStatus === UserStatusEnum.ACTIVE,
        },
        select: {
          id: true,
          organization_id: true,
          email: true,
          role: true,
          is_active: true,
          status: true,
          profile: true,
        },
      });

      // Revoke when moving to any non-active state, including PENDING. Otherwise a
      // later reactivation could make a previously issued session usable again.
      const revokedSessions =
        targetStatus === UserStatusEnum.ACTIVE
          ? 0
          : await this.sessionService.revokeAllSessionsForUser(
              id,
              targetStatus === UserStatusEnum.SUSPENDED
                ? SESSION_REVOKE_REASON.SUSPENDED
                : SESSION_REVOKE_REASON.ACCOUNT_NOT_ACTIVE,
              undefined,
              tx,
            );

      if (revokedSessions > 0) {
        await this.auditService.recordRequired(
          {
            organizationId: before.organization_id,
            actorId: actor.id,
            action: 'SESSION_REVOKED',
            entity: 'User',
            entityId: id,
            metadata: {
              reason:
                targetStatus === UserStatusEnum.SUSPENDED
                  ? SESSION_REVOKE_REASON.SUSPENDED
                  : SESSION_REVOKE_REASON.ACCOUNT_NOT_ACTIVE,
              revokedSessions,
            },
          },
          tx,
        );
      }

      const activated =
        targetStatus === UserStatusEnum.ACTIVE && before.status !== UserStatusEnum.ACTIVE;
      await this.auditService.recordRequired(
        {
          organizationId: before.organization_id,
          actorId: actor.id,
          action: activated ? 'USER_ACTIVATED' : 'USER_STATUS_CHANGED',
          entity: 'User',
          entityId: id,
          before: { status: before.status, isActive: before.is_active },
          after: { status: targetStatus, isActive: updated.is_active },
        },
        tx,
      );

      return updated;
    });

    return updated;
  }

  async createPending(
    input: { email: string; fullName: string; role?: UserRoleEnum },
    actor: AuthenticatedUser,
  ) {
    this.assertAdministrator(actor);
    const organizationId = this.requireOrganization(actor);
    const email = input.email.trim().toLowerCase();
    if (!email.endsWith('@hiieko.ro')) {
      throw new UnprocessableEntityException('Provisioned company users must use an @hiieko.ro address.');
    }
    const role = input.role ?? UserRoleEnum.WORKER;
    this.assertValidRole(role);
    if (actor.role === UserRoleEnum.ADMIN && role === UserRoleEnum.OWNER) {
      throw new ForbiddenException('Only a Super Administrator may grant Super Administrator access.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organization_id: organizationId,
            email,
            password_hash: null,
            role,
            status: UserStatusEnum.PENDING,
            is_active: false,
            profile: { create: { full_name: input.fullName.trim() } },
          },
          select: {
            id: true,
            organization_id: true,
            email: true,
            role: true,
            status: true,
            is_active: true,
            created_at: true,
            updated_at: true,
            profile: true,
          },
        });
        await this.auditService.recordRequired(
          {
            organizationId,
            actorId: actor.id,
            action: 'USER_PROVISIONED',
            entity: 'User',
            entityId: user.id,
            after: { email: user.email, role: user.role, status: user.status },
          },
          tx,
        );
        return user;
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('A HIIEKO user with this email already exists.');
      }
      throw error;
    }
  }

  async getSessions(id: string, actor: AuthenticatedUser) {
    const user = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, user);
    // Never return refresh-token hashes or access tokens from this endpoint.
    return this.prisma.session.findMany({
      where: { user_id: id },
      select: {
        id: true,
        created_at: true,
        last_used_at: true,
        expires_at: true,
        revoked_at: true,
        revoked_reason: true,
        created_ip: true,
        user_agent: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async revokeSession(id: string, sessionId: string, actor: AuthenticatedUser) {
    const user = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, user);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: sessionId, user_id: id },
        select: { id: true },
      });
      if (!session) throw new NotFoundException('Session not found for this user');
      const revoked = await this.sessionService.revokeSession(
        sessionId,
        SESSION_REVOKE_REASON.ADMIN_REVOKED,
        tx,
      );
      if (revoked) {
        await this.auditService.recordRequired(
          {
            organizationId: user.organization_id || undefined,
            actorId: actor.id,
            action: 'SESSION_REVOKED',
            entity: 'User',
            entityId: id,
            metadata: { sessionId, reason: SESSION_REVOKE_REASON.ADMIN_REVOKED },
          },
          tx,
        );
      }
      return { revoked };
    });
  }

  async revokeAllSessions(id: string, actor: AuthenticatedUser) {
    const user = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, user);
    return this.prisma.$transaction(async (tx) => {
      const revokedSessions = await this.sessionService.revokeAllSessionsForUser(
        id,
        SESSION_REVOKE_REASON.ADMIN_REVOKED,
        undefined,
        tx,
      );
      await this.auditService.recordRequired(
        {
          organizationId: user.organization_id || undefined,
          actorId: actor.id,
          action: 'USER_SESSIONS_REVOKED',
          entity: 'User',
          entityId: id,
          metadata: { reason: SESSION_REVOKE_REASON.ADMIN_REVOKED, revokedSessions },
        },
        tx,
      );
      return { revokedSessions };
    });
  }

  async getActivity(id: string, actor: AuthenticatedUser) {
    const user = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, user);
    return this.prisma.auditLog.findMany({
      where: {
        organization_id: user.organization_id,
        OR: [{ actor_id: id }, { entity: 'User', entity_id: id }],
      },
      select: {
        id: true,
        action: true,
        entity: true,
        entity_id: true,
        before_state: true,
        after_state: true,
        metadata: true,
        ip_address: true,
        user_agent: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async previewOffboarding(id: string, actor: AuthenticatedUser) {
    const user = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, user);
    if (id === actor.id) throw new ForbiddenException('You cannot offboard your own account.');
    const organizationId = this.requireOrganization(actor);
    const [projectMemberships, taskAssignments] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { user_id: id, project: { organization_id: organizationId } },
        select: { id: true, project_id: true, project: { select: { name: true, code: true } } },
      }),
      this.prisma.taskAssignment.findMany({
        where: { user_id: id, task: { project: { organization_id: organizationId } } },
        select: { id: true, task_id: true, task: { select: { title: true, project_id: true } } },
      }),
    ]);
    return {
      userId: id,
      status: user.status,
      projectMemberships,
      taskAssignments,
      counts: { projects: projectMemberships.length, tasks: taskAssignments.length },
      crmLeads: { available: false, reason: 'No CRM Lead model/API exists in the current backend.' },
    };
  }

  async offboardAndReassign(
    id: string,
    replacementUserId: string,
    actor: AuthenticatedUser,
  ) {
    const organizationId = this.requireOrganization(actor);
    const source = await this.findOne(id, actor);
    this.assertCanManageTarget(actor, source);
    if (id === actor.id || replacementUserId === id) {
      throw new BadRequestException('Choose another active employee as the replacement.');
    }

    const { updated, projectMembershipsReassigned, taskAssignmentsReassigned, revokedSessions } =
      await this.prisma.$transaction(async (tx) => {
      if (source.role === UserRoleEnum.OWNER) {
        const activeOwners = await tx.user.count({
          where: {
            role: UserRoleEnum.OWNER,
            status: UserStatusEnum.ACTIVE,
            is_active: true,
          },
        });
        if (activeOwners <= 1) {
          throw new ConflictException('The last active Super Administrator cannot be offboarded.');
        }
      }

        const replacement = await tx.user.findFirst({
          where: {
            id: replacementUserId,
            organization_id: organizationId,
            status: UserStatusEnum.ACTIVE,
            is_active: true,
          },
          select: { id: true },
        });
        if (!replacement) {
          throw new NotFoundException('Replacement must be an active user in the same organization.');
        }

        const projectMemberships = await tx.projectMember.findMany({
          where: { user_id: id, project: { organization_id: organizationId } },
          select: { id: true, project_id: true, role: true },
        });
        const taskAssignments = await tx.taskAssignment.findMany({
          where: { user_id: id, task: { project: { organization_id: organizationId } } },
          select: { id: true, task_id: true },
        });

        if (projectMemberships.length > 0) {
          await tx.projectMember.createMany({
            data: projectMemberships.map((membership) => ({
              project_id: membership.project_id,
              user_id: replacementUserId,
              role: membership.role,
            })),
            skipDuplicates: true,
          });
          await tx.projectMember.deleteMany({
            where: { id: { in: projectMemberships.map((membership) => membership.id) } },
          });
        }

        if (taskAssignments.length > 0) {
          await tx.taskAssignment.createMany({
            data: taskAssignments.map((assignment) => ({
              task_id: assignment.task_id,
              user_id: replacementUserId,
            })),
            skipDuplicates: true,
          });
          await tx.taskAssignment.deleteMany({
            where: { id: { in: taskAssignments.map((assignment) => assignment.id) } },
          });
        }

        await tx.employee.updateMany({ where: { user_id: id }, data: { is_active: false } });
        const updated = await tx.user.update({
          where: { id },
          data: { status: UserStatusEnum.SUSPENDED, is_active: false },
          select: {
            id: true,
            organization_id: true,
            email: true,
            role: true,
            status: true,
            is_active: true,
            updated_at: true,
          },
        });
        const revokedSessions = await this.sessionService.revokeAllSessionsForUser(
          id,
          SESSION_REVOKE_REASON.OFFBOARDING,
          undefined,
          tx,
        );

        await this.auditService.recordRequired(
          {
            organizationId,
            actorId: actor.id,
            action: 'EMPLOYEE_OFFBOARDED',
            entity: 'User',
            entityId: id,
            before: { status: source.status, isActive: source.is_active },
            after: { status: UserStatusEnum.SUSPENDED, isActive: false },
            metadata: {
              replacementUserId,
              projectMembershipIds: projectMemberships.map((membership) => membership.id),
              taskAssignmentIds: taskAssignments.map((assignment) => assignment.id),
              revokedSessions,
              crmLeadReassignment: 'UNAVAILABLE_NO_LEAD_MODEL',
            },
          },
          tx,
        );

        return {
          updated,
          projectMembershipsReassigned: projectMemberships.length,
          taskAssignmentsReassigned: taskAssignments.length,
          revokedSessions,
        };
      });

    return { updated, projectMembershipsReassigned, taskAssignmentsReassigned, revokedSessions };
  }

  async getProfile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { user_id: userId } });
  }

  async updateProfile(
    id: string,
    data: { fullName?: string; phone?: string; language?: string },
    actor: AuthenticatedUser,
  ) {
    if (id !== actor.id) {
      throw new ForbiddenException('You can only update your own profile.');
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { user_id: id },
      update: {
        full_name: data.fullName,
        phone: data.phone,
        language: data.language,
      },
      create: {
        user_id: id,
        full_name: data.fullName || '',
        phone: data.phone,
        language: data.language || 'ro',
      },
    });

    await this.auditService.record({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: 'USER_PROFILE_UPDATED',
      entity: 'UserProfile',
      entityId: profile.id,
      after: data,
    });

    return profile;
  }

  private requireOrganization(actor: AuthenticatedUser): string {
    if (!actor.organizationId) {
      throw new ForbiddenException('User organization is required for user management.');
    }
    return actor.organizationId;
  }

  private assertAdministrator(actor: AuthenticatedUser): void {
    if (actor.role !== UserRoleEnum.ADMIN && actor.role !== UserRoleEnum.OWNER) {
      throw new ForbiddenException('Administrator authorization is required.');
    }
  }

  private assertCanManageTarget(actor: AuthenticatedUser, target: { id: string; role: UserRoleEnum }): void {
    this.assertAdministrator(actor);
    if (actor.role === UserRoleEnum.ADMIN && target.role === UserRoleEnum.OWNER) {
      throw new ForbiddenException('Only a Super Administrator may manage a Super Administrator.');
    }
  }

  private assertValidRole(role: UserRoleEnum): void {
    const validRoles = Object.values(UserRoleEnum) as string[];
    if (typeof role !== 'string' || !validRoles.includes(role)) {
      throw new UnprocessableEntityException(
        `Invalid role '${role}'. Expected one of: ${validRoles.join(', ')}.`,
      );
    }
  }

  private resolveStatus(
    input?: { status?: UserStatusEnum; isActive?: boolean } | null,
  ): UserStatusEnum {
    const body = input ?? {};
    const validStatuses = Object.values(UserStatusEnum) as string[];

    if (body.status !== undefined && body.status !== null) {
      if (typeof body.status !== 'string' || !validStatuses.includes(body.status)) {
        throw new UnprocessableEntityException(
          `Invalid status '${body.status}'. Expected one of: ${validStatuses.join(', ')}.`,
        );
      }
      return body.status as UserStatusEnum;
    }

    if (typeof body.isActive === 'boolean') {
      return body.isActive ? UserStatusEnum.ACTIVE : UserStatusEnum.SUSPENDED;
    }

    throw new UnprocessableEntityException(
      "Provide either 'status' (PENDING|ACTIVE|SUSPENDED) or the legacy 'isActive' (boolean).",
    );
  }
}
