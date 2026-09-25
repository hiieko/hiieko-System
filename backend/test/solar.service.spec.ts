import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/common/audit/audit.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { SolarService } from '../src/modules/solar/solar.service';

describe('SolarService', () => {
  let service: SolarService;
  let prisma: any;
  let audit: any;
  let txMock: any;

  const roofSection = {
    id: 'roof-1',
    design_id: 'design-1',
    name: 'Main Roof',
    roof_type: 'FLAT',
    slope_deg: 0,
    azimuth_deg: 0,
    roof_material: null,
    polygon: [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 8000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    origin: { x: 0, y: 0, z: 0 },
    obstacles: [],
  };

  const moduleSpec = {
    id: 'spec-1',
    manufacturer: 'DemoSolar',
    model: 'DEMO-450',
    power_wp: 450,
    length_mm: 1722,
    width_mm: 1134,
    thickness_mm: 30,
    weight_kg: 21.5,
    voc: 41.6,
    isc: 13.9,
    vmp: 34.8,
    imp: 12.94,
    technology: 'PERC',
    module_type: 'Mono',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const layoutSettings = {
    design_id: 'design-1',
    module_spec_id: 'spec-1',
    orientation: 'PORTRAIT',
    edge_margin_mm: 300,
    row_spacing_mm: 0,
    column_spacing_mm: 20,
  };

  const design = {
    id: 'design-1',
    project_id: 'project-1',
    name: 'Test Design',
    status: 'DRAFT',
    roof_sections: [roofSection],
    layout_settings: layoutSettings,
    module_placements: [],
  };

  beforeEach(async () => {
    prisma = {
      solarDesign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      solarRoofSection: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      solarModuleSpec: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      solarLayoutSettings: {
        upsert: jest.fn(),
      },
      solarModulePlacement: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      solarProduct: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        txMock = {
          solarModulePlacement: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 6 }),
          },
        };
        return cb(txMock);
      }),
    };

    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolarService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SolarService>(SolarService);
  });

  it('creates a design and records an audit entry', async () => {
    prisma.solarDesign.create.mockResolvedValue({
      id: 'design-1',
      project_id: 'project-1',
      name: 'Test Design',
      status: 'DRAFT',
    });

    const result = await service.create(
      { projectId: 'project-1', name: 'Test Design' } as any,
      { id: 'user-1', organizationId: 'org-1' } as any,
    );

    expect(prisma.solarDesign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'project-1',
        name: 'Test Design',
        created_by: 'user-1',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SOLAR_DESIGN_CREATED', entity: 'SolarDesign' }),
    );
    expect(result.id).toBe('design-1');
  });

  it('lists designs scoped to a project (no cross-project/undefined fallback)', async () => {
    prisma.solarDesign.findMany.mockResolvedValue([{ id: 'design-1' }]);

    const result = await service.findAll('project-1');

    expect(prisma.solarDesign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project_id: 'project-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('returns the full design model via findOne', async () => {
    prisma.solarDesign.findUnique.mockResolvedValue(design);

    const result = await service.findOne('design-1');

    expect(result.id).toBe('design-1');
    expect(result.projectId).toBe('project-1');
    expect(result.roofSections).toHaveLength(1);
    expect(result.roofSections[0].polygon).toHaveLength(4);
  });

  it('throws NotFoundException when the design is missing', async () => {
    prisma.solarDesign.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('adds a roof section and maps it to the domain model', async () => {
    prisma.solarDesign.findUnique.mockResolvedValue(design);
    prisma.solarRoofSection.create.mockResolvedValue(roofSection);

    const result = await service.addRoofSection(
      'design-1',
      {
        name: 'Main Roof',
        roofType: 'FLAT',
        slopeDeg: 0,
        azimuthDeg: 0,
        polygon: roofSection.polygon,
        origin: { x: 0, y: 0, z: 0 },
      } as any,
      { id: 'user-1', organizationId: 'org-1' } as any,
    );

    expect(prisma.solarRoofSection.create).toHaveBeenCalled();
    expect(result.id).toBe('roof-1');
    expect(result.polygon).toHaveLength(4);
  });

  describe('calculateLayout / getBom through the shared engines', () => {
    beforeEach(() => {
      prisma.solarDesign.findUnique.mockResolvedValue(design);
      prisma.solarModuleSpec.findUnique.mockResolvedValue(moduleSpec);
    });

    it('calculates a known module count (6 for 8m x 4m roof)', async () => {
      const result = await service.calculateLayout('design-1');
      expect(result.totalModules).toBe(6);
      expect(result.placements).toHaveLength(6);
    });

    it('calculates a known rail length in engineering millimetres', async () => {
      const result = await service.calculateLayout('design-1');
      expect(result.mounting.railTotalLengthMm).toBe(13808);
    });

    it('derives deterministic hook/clamp/fastener quantities', async () => {
      const result = await service.calculateLayout('design-1');
      expect(result.mounting.hookCount).toBe(12);
      expect(result.mounting.endClampCount).toBe(4);
      expect(result.mounting.midClampCount).toBe(10);
      expect(result.mounting.fastenerCount).toBe(26);
      expect(result.mounting.epdmCount).toBe(12);
    });

    it('persists the computed placements in a transaction', async () => {
      await service.calculateLayout('design-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txMock.solarModulePlacement.deleteMany).toHaveBeenCalledWith({
        where: { design_id: 'design-1' },
      });
      const data = txMock.solarModulePlacement.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(6);
      expect(data[0]).toEqual(
        expect.objectContaining({ design_id: 'design-1', row: 0, column: 0 }),
      );
    });

    it('returns a BOM derived from placements (module count + rail length)', async () => {
      const result = await service.getBom('design-1');

      const moduleLine = result.bom.find((b) => b.itemType === 'MODULE');
      const railLine = result.bom.find((b) => b.itemType === 'RAIL');

      expect(moduleLine?.quantityRequired).toBe(6);
      expect(railLine?.quantityRequired).toBe(13808);
      expect(railLine?.unit).toBe('mm');
    });
  });
});
