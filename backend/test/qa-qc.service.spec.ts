import { Test, TestingModule } from '@nestjs/testing';
import { QaQcService } from '../src/modules/qa-qc/qa-qc.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';

describe('QaQcService (Inspections)', () => {
  let service: QaQcService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      inspection: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QaQcService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<QaQcService>(QaQcService);
  });

  it('merges project scope with an explicit project filter', async () => {
    prisma.inspection.findMany.mockResolvedValue([]);

    await service.findAll('proj-1', { project_id: { in: ['proj-1'] } });

    expect(prisma.inspection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: 'proj-1' },
        orderBy: { inspected_at: 'desc' },
      }),
    );
  });

  it('creates a COMPLETED inspection with measurements defaulting to passed', async () => {
    prisma.inspection.create.mockResolvedValue({ id: 'insp-1' });

    await service.create(
      {
        projectId: 'proj-1',
        templateId: 'tpl-1',
        inspectorName: 'Ion Popescu',
        measurements: [
          { parameter: 'depth', value: 1.2, unit: 'm' },
          { parameter: 'width', value: 0.3, unit: 'm', passed: false },
        ],
      },
      'user-1',
    );

    expect(prisma.inspection.create).toHaveBeenCalledWith({
      data: {
        project_id: 'proj-1',
        template_id: 'tpl-1',
        inspector_name: 'Ion Popescu',
        status: 'COMPLETED',
        measurements: {
          create: [
            { parameter: 'depth', value: 1.2, unit: 'm', passed: true },
            { parameter: 'width', value: 0.3, unit: 'm', passed: false },
          ],
        },
      },
      include: { measurements: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INSPECTION_RECORDED',
        entity: 'Inspection',
        entityId: 'insp-1',
      }),
    );
  });

  it('omits measurements when none are supplied', async () => {
    prisma.inspection.create.mockResolvedValue({ id: 'insp-1' });

    await service.create({
      projectId: 'proj-1',
      inspectorName: 'Ion Popescu',
    });

    expect(prisma.inspection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ measurements: undefined }),
      }),
    );
  });
});
