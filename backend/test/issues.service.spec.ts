import { Test, TestingModule } from '@nestjs/testing';
import { IssuesService } from '../src/modules/issues/issues.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IssueStatusEnum, UserRoleEnum } from '@prisma/client';

describe('IssuesService (status lifecycle)', () => {
  let service: IssuesService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      issue: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
  });

  function mockIssueRead(before: any, after?: any) {
    prisma.issue.findUnique.mockResolvedValueOnce(before);
    if (after) {
      prisma.issue.findUnique.mockResolvedValueOnce(after);
    }
  }

  describe('legal forward transitions → PASS', () => {
    it('OPEN → INVESTIGATING is allowed, audited, and written conditionally', async () => {
      mockIssueRead(
        { id: 'issue-1', status: IssueStatusEnum.OPEN, project_id: 'proj-1' },
        { id: 'issue-1', status: IssueStatusEnum.INVESTIGATING },
      );
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.INVESTIGATING },
        'actor-1',
        UserRoleEnum.SITE_MANAGER,
      );

      expect(result.status).toBe(IssueStatusEnum.INVESTIGATING);
      expect(prisma.issue.updateMany).toHaveBeenCalledWith({
        where: { id: 'issue-1', status: IssueStatusEnum.OPEN },
        data: { status: IssueStatusEnum.INVESTIGATING },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'ISSUE_STATUS_CHANGED',
          entity: 'Issue',
          entityId: 'issue-1',
          before: { status: IssueStatusEnum.OPEN },
          after: expect.objectContaining({
            status: IssueStatusEnum.INVESTIGATING,
            projectId: 'proj-1',
          }),
        }),
      );
    });

    it('INVESTIGATING → CORRECTIVE_ACTION_PROPOSED', async () => {
      mockIssueRead(
        {
          id: 'issue-1',
          status: IssueStatusEnum.INVESTIGATING,
          project_id: 'proj-1',
        },
        { id: 'issue-1', status: IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED },
      );
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED },
        'actor-1',
        UserRoleEnum.PM,
      );

      expect(result.status).toBe(IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED);
    });

    it('CORRECTIVE_ACTION_PROPOSED → RESOLVED', async () => {
      mockIssueRead(
        {
          id: 'issue-1',
          status: IssueStatusEnum.CORRECTIVE_ACTION_PROPOSED,
          project_id: 'proj-1',
        },
        { id: 'issue-1', status: IssueStatusEnum.RESOLVED },
      );
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.RESOLVED },
        'actor-1',
        UserRoleEnum.QA_QC,
      );

      expect(result.status).toBe(IssueStatusEnum.RESOLVED);
    });

    it('RESOLVED → CLOSED', async () => {
      mockIssueRead(
        { id: 'issue-1', status: IssueStatusEnum.RESOLVED, project_id: 'proj-1' },
        { id: 'issue-1', status: IssueStatusEnum.CLOSED },
      );
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.CLOSED },
        'actor-1',
        UserRoleEnum.SITE_MANAGER,
      );

      expect(result.status).toBe(IssueStatusEnum.CLOSED);
    });
  });

  describe('illegal transitions → REJECT', () => {
    it('OPEN → RESOLVED is rejected (skips INVESTIGATING/CORRECTIVE_ACTION_PROPOSED)', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.OPEN,
        project_id: 'proj-1',
      });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.RESOLVED },
          'actor-1',
          UserRoleEnum.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.issue.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('OPEN → CLOSED is rejected', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.OPEN,
        project_id: 'proj-1',
      });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.CLOSED },
          'actor-1',
          UserRoleEnum.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('RESOLVED → OPEN is rejected (no backward transition except CLOSED→INVESTIGATING)', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.RESOLVED,
        project_id: 'proj-1',
      });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.OPEN },
          'actor-1',
          UserRoleEnum.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('concurrent status change → REJECT', () => {
    it('conditional write matching 0 rows throws ConflictException and skips the audit', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.OPEN,
        project_id: 'proj-1',
      });
      prisma.issue.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.INVESTIGATING },
          'actor-1',
          UserRoleEnum.SITE_MANAGER,
        ),
      ).rejects.toThrow(ConflictException);

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('reopen (CLOSED → INVESTIGATING) → role-gated', () => {
    it('ADMIN may reopen without a membership lookup', async () => {
      mockIssueRead(
        { id: 'issue-1', status: IssueStatusEnum.CLOSED, project_id: 'proj-1' },
        { id: 'issue-1', status: IssueStatusEnum.INVESTIGATING },
      );
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.INVESTIGATING },
        'actor-1',
        UserRoleEnum.ADMIN,
      );

      expect(result.status).toBe(IssueStatusEnum.INVESTIGATING);
      expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('service-level membership-PM gate passes for a non-triage actorRole (defense-in-depth only; the controller RolesGuard rejects such a WORKER before the service is reached)', async () => {
      mockIssueRead(
        { id: 'issue-1', status: IssueStatusEnum.CLOSED, project_id: 'proj-1' },
        { id: 'issue-1', status: IssueStatusEnum.INVESTIGATING },
      );
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'actor-1',
        role: UserRoleEnum.PM,
      });
      prisma.issue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateStatus(
        'issue-1',
        { status: IssueStatusEnum.INVESTIGATING },
        'actor-1',
        UserRoleEnum.WORKER,
      );

      expect(result.status).toBe(IssueStatusEnum.INVESTIGATING);
      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          project_id_user_id: {
            project_id: 'proj-1',
            user_id: 'actor-1',
          },
        },
      });
    });

    it('non-leadership project role may NOT reopen', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.CLOSED,
        project_id: 'proj-1',
      });
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 'proj-1',
        user_id: 'actor-1',
        role: UserRoleEnum.TEAM_LEADER,
      });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.INVESTIGATING },
          'actor-1',
          UserRoleEnum.TEAM_LEADER,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.issue.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('caller with no project membership may NOT reopen', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.CLOSED,
        project_id: 'proj-1',
      });
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'issue-1',
          { status: IssueStatusEnum.INVESTIGATING },
          'actor-1',
          UserRoleEnum.SITE_MANAGER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('invalid input → REJECT', () => {
    it('unknown issue id → NotFoundException', async () => {
      prisma.issue.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'missing',
          { status: IssueStatusEnum.INVESTIGATING },
          'actor-1',
          UserRoleEnum.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.issue.updateMany).not.toHaveBeenCalled();
    });

    it('missing target status → BadRequestException', async () => {
      mockIssueRead({
        id: 'issue-1',
        status: IssueStatusEnum.OPEN,
        project_id: 'proj-1',
      });

      await expect(
        service.updateStatus(
          'issue-1',
          { status: undefined as any },
          'actor-1',
          UserRoleEnum.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
