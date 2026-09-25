import { BadRequestException, NotFoundException } from '@nestjs/common';
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
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      solarObstacle: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
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

    it('calculates layout across multiple roof sections', async () => {
      const roof2 = { ...roofSection, id: 'roof-2', name: 'Roof 2' };
      prisma.solarDesign.findUnique.mockResolvedValue({
        ...design,
        roof_sections: [roofSection, roof2],
      });
      const result = await service.calculateLayout('design-1');
      expect(result.totalModules).toBe(12);
      expect(result.placements.filter((p) => p.roofSectionId === 'roof-1')).toHaveLength(6);
      expect(result.placements.filter((p) => p.roofSectionId === 'roof-2')).toHaveLength(6);
    });
  });

  describe('SolarService (M2 — roof update/delete + obstacle CRUD)', () => {
    const roof = {
      id: 'roof-1',
      design_id: 'design-1',
      name: 'R',
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
    };
    const obstacle = {
      id: 'obs-1',
      roof_section_id: 'roof-1',
      name: 'Skylight',
      obstacle_type: 'SKYLIGHT',
      polygon: [
        { x: 2000, y: 1500 },
        { x: 2500, y: 1500 },
        { x: 2500, y: 2000 },
        { x: 2000, y: 2000 },
      ],
      keepout_margin_mm: 200,
    };

    beforeEach(() => {
      prisma.solarRoofSection.findFirst.mockResolvedValue(roof);
    });

    it('updates a roof section within its design', async () => {
      prisma.solarRoofSection.update.mockResolvedValue({ ...roof, name: 'New' });
      const result = await service.updateRoofSection(
        'design-1',
        'roof-1',
        { name: 'New' } as any,
        { id: 'u1', organizationId: 'o1' } as any,
      );
      expect(prisma.solarRoofSection.update).toHaveBeenCalled();
      expect(result.name).toBe('New');
    });

    it('rejects updating a roof not in the design', async () => {
      prisma.solarRoofSection.findFirst.mockResolvedValue(null);
      await expect(
        service.updateRoofSection('design-1', 'roof-OTHER', { name: 'X' } as any, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes a roof section within its design', async () => {
      prisma.solarRoofSection.delete.mockResolvedValue(roof);
      const result = await service.deleteRoofSection('design-1', 'roof-1', {} as any);
      expect(prisma.solarRoofSection.delete).toHaveBeenCalledWith({ where: { id: 'roof-1' } });
      expect(result.id).toBe('roof-1');
    });

    it('adds an obstacle contained in the roof', async () => {
      prisma.solarObstacle.create.mockResolvedValue(obstacle);
      const result = await service.addObstacle(
        'design-1',
        'roof-1',
        {
          name: 'Skylight',
          obstacleType: 'SKYLIGHT',
          polygon: obstacle.polygon,
          keepoutMarginMm: 200,
        } as any,
        { id: 'u1', organizationId: 'o1' } as any,
      );
      expect(prisma.solarObstacle.create).toHaveBeenCalled();
      expect(result.id).toBe('obs-1');
    });

    it('rejects an obstacle crossing the roof boundary', async () => {
      const crossing = [
        { x: 7000, y: 3000 },
        { x: 9000, y: 3000 },
        { x: 9000, y: 5000 },
        { x: 7000, y: 5000 },
      ];
      await expect(
        service.addObstacle('design-1', 'roof-1', { polygon: crossing, keepoutMarginMm: 0 } as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a self-intersecting obstacle polygon', async () => {
      const bowtie = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ];
      await expect(
        service.addObstacle('design-1', 'roof-1', { polygon: bowtie, keepoutMarginMm: 0 } as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('lists obstacles for a roof', async () => {
      prisma.solarObstacle.findMany.mockResolvedValue([obstacle]);
      const result = await service.listObstacles('design-1', 'roof-1');
      expect(result).toHaveLength(1);
    });

    it('deletes an obstacle within its design', async () => {
      prisma.solarObstacle.findFirst.mockResolvedValue({ id: 'obs-1', roof_section_id: 'roof-1' });
      prisma.solarObstacle.delete.mockResolvedValue(obstacle);
      const result = await service.deleteObstacle('design-1', 'obs-1', {} as any);
      expect(prisma.solarObstacle.delete).toHaveBeenCalledWith({ where: { id: 'obs-1' } });
      expect(result.id).toBe('obs-1');
    });

    it('rejects deleting an obstacle not in the design', async () => {
      prisma.solarObstacle.findFirst.mockResolvedValue(null);
      await expect(service.deleteObstacle('design-1', 'obs-OTHER', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
