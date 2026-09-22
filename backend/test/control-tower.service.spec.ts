import { Test, TestingModule } from '@nestjs/testing';
import { ControlTowerService } from '../src/modules/control-tower/control-tower.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { TaskStatusEnum, NCRStatusEnum, ProjectStatusEnum } from '@prisma/client';

describe('ControlTowerService', () => {
  let service: ControlTowerService;
  let prisma: any;
  let audit: any;

  const mockOrgId = 'org-100';
  const mockProjectId = 'proj-1';

  beforeEach(async () => {
    prisma = {
      project: {
        findMany: jest.fn(),
      },
      attendanceRecord: {
        findMany: jest.fn(),
      },
      projectMember: {
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn(),
      },
      aviz: {
        findMany: jest.fn(),
      },
      costEntry: {
        findMany: jest.fn(),
      },
      expense: {
        findMany: jest.fn(),
      },
      commitment: {
        findMany: jest.fn(),
      },
      inspection: {
        findMany: jest.fn(),
      },
      nCR: {
        findMany: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlTowerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ControlTowerService>(ControlTowerService);
  });

  describe('getOverview - Empty Organization', () => {
    it('should return zeroed metrics and empty lists when no projects exist', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getOverview(mockOrgId);

      expect(result.projects.activeProjects).toBe(0);
      expect(result.workforce.scheduledToday).toBe(0);
      expect(result.production.plannedToday).toBe(0);
      expect(result.materials.lowStock).toBe(0);
      expect(result.finance.budget).toBe(0);
      expect(result.quality.openNCRs).toBe(0);
      expect(result.documentation.missingDocuments).toBe(0);
      expect(result.redFlags).toEqual([]);
    });
  });

  describe('getOverview - Full Domain Aggregation & Red Flags', () => {
    it('should correctly aggregate operational data and trigger rule-based red flags', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days overdue
      const upcomingDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days ahead

      // 1. Projects
      prisma.project.findMany.mockResolvedValue([
        {
          id: 'proj-overdue',
          organization_id: mockOrgId,
          name: 'Craiova Solar Park',
          code: 'CSP-01',
          status: ProjectStatusEnum.CONSTRUCTION,
          target_end_date: pastDate,
          budget_total: 500000,
          currency: 'EUR',
          tasks: [],
          members: [
            {
              role: 'PM',
              user: { profile: { full_name: 'Alex Popescu' } },
            },
          ],
        },
        {
          id: 'proj-upcoming',
          organization_id: mockOrgId,
          name: 'Brasov Solar Farm',
          code: 'BSF-02',
          status: ProjectStatusEnum.ENGINEERING,
          target_end_date: upcomingDate,
          budget_total: 300000,
          currency: 'EUR',
          tasks: [],
          members: [],
        },
      ]);

      // 2. Workforce
      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          id: 'att-1',
          user_id: 'user-worker-1',
          project_id: 'proj-overdue',
          check_in_time: new Date(),
          is_within_geofence: true,
          overtime_minutes: 90,
        },
      ]);

      prisma.projectMember.findMany.mockResolvedValue([
        {
          id: 'pm-1',
          user_id: 'user-worker-1',
          project_id: 'proj-overdue',
          role: 'WORKER',
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          user: { profile: { full_name: 'Ion Ionescu' } },
        },
        {
          id: 'pm-2',
          user_id: 'user-worker-2',
          project_id: 'proj-overdue',
          role: 'WORKER',
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          user: { profile: { full_name: 'Gheorghe Radu' } },
        },
      ]);

      // 3. Production
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-blocked',
          project_id: 'proj-overdue',
          code: 'TSK-001',
          title: 'Mount Inverters',
          description: 'Waiting for delivery of mounting brackets',
          status: TaskStatusEnum.BLOCKED,
          planned_start: pastDate,
          planned_end: upcomingDate,
          planned_quantity: 100,
          actual_quantity: 0,
          unit_of_measure: 'PCS',
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          zone: { name: 'Sector A' },
          assignments: [
            {
              user_id: 'user-worker-1',
              user: { profile: { full_name: 'Ion Ionescu' } },
            },
          ],
          prerequisites: [
            {
              predecessor: { code: 'TSK-000', title: 'Civil Foundations' },
            },
          ],
        },
      ]);

      // 4. Materials
      prisma.stockBalance.findMany.mockResolvedValue([
        {
          id: 'sb-1',
          material_id: 'mat-cable',
          project_id: 'proj-overdue',
          warehouse_id: 'wh-1',
          current_quantity: 10,
          material: {
            code: 'CAB-001',
            name: 'Solar Cable 4mm2',
            unit: 'M',
            min_stock_threshold: 50,
          },
          project: { name: 'Craiova Solar Park' },
          warehouse: { name: 'Site Warehouse 1' },
        },
      ]);

      prisma.aviz.findMany.mockResolvedValue([
        {
          id: 'aviz-1',
          project_id: 'proj-overdue',
          aviz_number: 'AVZ-2026-001',
          delivery_date: new Date(),
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          supplier: { name: 'SolarSupplies SRL' },
          items: [
            {
              material_id: 'mat-cable',
              quantity: 500,
              material: { code: 'CAB-001', name: 'Solar Cable 4mm2', unit: 'M' },
            },
          ],
        },
      ]);

      // 5. Finance
      prisma.costEntry.findMany.mockResolvedValue([
        { project_id: 'proj-overdue', amount: 350000 },
      ]);
      prisma.expense.findMany.mockResolvedValue([
        { project_id: 'proj-overdue', amount: 200000 },
      ]);

      // 6. Quality
      prisma.inspection.findMany.mockResolvedValue([
        {
          id: 'insp-1',
          project_id: 'proj-overdue',
          inspector_name: 'Dan Quality',
          status: 'FAILED',
          inspected_at: new Date(),
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          measurements: [
            { parameter: 'Torque check', value: 45, unit: 'Nm', passed: false },
          ],
        },
      ]);

      prisma.nCR.findMany.mockResolvedValue([
        {
          id: 'ncr-1',
          ncr_number: 'NCR-2026-001',
          description: 'Insufficient torque on solar bracket fasteners',
          status: NCRStatusEnum.OPEN,
          created_at: new Date(),
          inspection: {
            project: { id: 'proj-overdue', name: 'Craiova Solar Park', code: 'CSP-01' },
          },
        },
      ]);

      // 7. Documentation
      prisma.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          title: 'Electrical Layout Scheme',
          document_type: 'PLAN_TEHNIC',
          project_id: 'proj-overdue',
          current_version: 1,
          updated_at: new Date(),
          project: { name: 'Craiova Solar Park', code: 'CSP-01' },
          versions: [
            { version: 1 },
            { version: 2 }, // Newer version exists!
          ],
        },
      ]);

      const overview = await service.getOverview(mockOrgId);

      // Verify Projects
      expect(overview.projects.activeProjects).toBe(2);
      expect(overview.projects.overdueProjects).toBe(1);
      expect(overview.projects.upcomingDeadlines).toBe(1);
      expect(overview.projects.overdueProjectsList[0].daysOverdue).toBeGreaterThan(0);
      expect(overview.projects.overdueProjectsList[0].responsiblePerson).toBe('Alex Popescu');

      // Verify Workforce
      expect(overview.workforce.scheduledToday).toBe(2);
      expect(overview.workforce.checkedIn).toBe(1);
      expect(overview.workforce.missing).toBe(1);
      expect(overview.workforce.missingList[0].fullName).toBe('Gheorghe Radu');
      expect(overview.workforce.overtimeMinutes).toBe(90);

      // Verify Production
      expect(overview.production.blockedProduction).toBe(1);
      expect(overview.production.blockedTasksList[0].taskCode).toBe('TSK-001');

      // Verify Materials
      expect(overview.materials.lowStock).toBe(1);
      expect(overview.materials.lowStockList[0].deficit).toBe(40);
      expect(overview.materials.pendingDeliveries).toBe(1);

      // Verify Finance
      expect(overview.finance.budget).toBe(800000);
      expect(overview.finance.actual).toBe(550000); // 350k + 200k
      // Craiova budget was 500k, actual is 550k -> overrun!
      const craiovaFin = overview.finance.budgetByProject.find(
        (p) => p.projectId === 'proj-overdue',
      );
      expect(craiovaFin?.variance).toBe(-50000);

      // Verify Quality
      expect(overview.quality.failedInspections).toBe(1);
      expect(overview.quality.openNCRs).toBe(1);

      // Verify Documentation
      expect(overview.documentation.supersededDocuments).toBe(1);

      // Verify Red Flags Engine
      expect(overview.redFlags.length).toBeGreaterThan(0);

      const categories = overview.redFlags.map((r) => r.category);
      expect(categories).toContain('PROJECTS');
      expect(categories).toContain('WORKFORCE');
      expect(categories).toContain('PRODUCTION');
      expect(categories).toContain('MATERIALS');
      expect(categories).toContain('FINANCE');
      expect(categories).toContain('QUALITY');
      expect(categories).toContain('DOCUMENTATION');

      // Ensure critical flags exist
      const criticalFlags = overview.redFlags.filter((r) => r.severity === 'CRITICAL');
      expect(criticalFlags.length).toBeGreaterThan(0);
    });
  });

  describe('getDrillDown', () => {
    it('should paginate and filter drill-down results for specified domain', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getDrillDown(mockOrgId, {
        category: 'PROJECTS',
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('getRedFlags', () => {
    it('should filter red flags by severity level when requested', async () => {
      prisma.project.findMany.mockResolvedValue([]);

      const flags = await service.getRedFlags(mockOrgId, undefined, 'CRITICAL');
      expect(Array.isArray(flags)).toBe(true);
      for (const flag of flags) {
        expect(flag.severity).toBe('CRITICAL');
      }
    });
  });
});
