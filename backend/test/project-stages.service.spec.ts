import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStagesService } from '../src/modules/project-stages/project-stages.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('ProjectStagesService (Stage Ordering)', () => {
  let service: ProjectStagesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      projectStage: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectStagesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProjectStagesService>(ProjectStagesService);
  });

  it('lists stages ordered by stage_order with work packages and tasks', async () => {
    prisma.projectStage.findMany.mockResolvedValue([]);

    await service.findByProject('proj-1');

    expect(prisma.projectStage.findMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-1' },
      include: {
        work_packages: { include: { tasks: true } },
      },
      orderBy: { stage_order: 'asc' },
    });
  });

  it('defaults a new stage to the next order and leaves missing dates undefined', async () => {
    prisma.projectStage.count.mockResolvedValue(3);
    prisma.projectStage.create.mockResolvedValue({ id: 'stage-4' });

    await service.create({ projectId: 'proj-1', name: 'Finisaje' });

    expect(prisma.projectStage.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        name: 'Finisaje',
        stage_order: 4,
        start_date: undefined,
        end_date: undefined,
      },
    });
  });

  it('honours an explicit order and parses provided dates', async () => {
    prisma.projectStage.count.mockResolvedValue(3);
    prisma.projectStage.create.mockResolvedValue({ id: 'stage-1' });

    await service.create({
      projectId: 'proj-1',
      name: 'Structura',
      stageOrder: 1,
      startDate: '2026-03-02',
      endDate: '2026-04-01',
    });

    expect(prisma.projectStage.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        name: 'Structura',
        stage_order: 1,
        start_date: new Date('2026-03-02'),
        end_date: new Date('2026-04-01'),
      },
    });
  });
});
