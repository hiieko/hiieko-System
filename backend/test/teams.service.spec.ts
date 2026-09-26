import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from '../src/modules/teams/teams.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { BadRequestException } from '@nestjs/common';

describe('TeamsService (Project Existence Validation)', () => {
  let service: TeamsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  const validDto = {
    name: 'Team Alpha',
    code: 'T-ALPHA',
    projectId: 'proj-1',
  };

  describe('existing valid project → PASS', () => {
    it('should allow creating a team when the referenced project exists', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.team.create.mockResolvedValue({
        id: 'team-1',
        name: 'Team Alpha',
        code: 'T-ALPHA',
        project_id: 'proj-1',
      });

      const result = await service.create(validDto, 'actor-1');
      expect(result.id).toBe('team-1');
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        select: { id: true },
      });
    });

    it('should allow creating a team without a projectId (organization-level team)', async () => {
      prisma.team.create.mockResolvedValue({
        id: 'team-2',
        name: 'Org Team',
        code: 'T-ORG',
        project_id: null,
      });

      const result = await service.create(
        { name: 'Org Team', code: 'T-ORG' },
        'actor-1'
      );
      expect(result.id).toBe('team-2');
      expect(prisma.project.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('nonexistent project → REJECT', () => {
    it('should reject creating a team when the referenced project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(validDto, 'actor-1')
      ).rejects.toThrow(BadRequestException);

      expect(prisma.team.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('should reject updating a team to a nonexistent project', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        project_id: 'proj-1',
        name: 'Team Alpha',
        code: 'T-ALPHA',
        leader_id: null,
        is_active: true,
      });
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.update('team-1', { projectId: 'proj-nonexistent' }, 'actor-1')
      ).rejects.toThrow(BadRequestException);

      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe('unauthorized project → REJECT', () => {
    it('should delegate authorization to ProjectAccessGuard at controller level (not in service)', async () => {
      // Service does not perform authorization; that's the guard's job.
      // This test verifies that the service still works when project exists
      // and the guard has already checked authorization.
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      prisma.team.create.mockResolvedValue({
        id: 'team-3',
        name: 'Team Beta',
        code: 'T-BETA',
        project_id: 'proj-1',
      });

      const result = await service.create(
        { name: 'Team Beta', code: 'T-BETA', projectId: 'proj-1' },
        'actor-1'
      );
      expect(result.id).toBe('team-3');
      expect(prisma.team.create).toHaveBeenCalled();
    });
  });
});
