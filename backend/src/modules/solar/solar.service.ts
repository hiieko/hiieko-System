import { Injectable, NotFoundException } from '@nestjs/common';
import { SolarModuleOrientationEnum, SolarRoofTypeEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateRoofSectionDto } from './dto/create-roof-section.dto';
import { CreateSolarDesignDto } from './dto/create-solar-design.dto';
import { UpsertLayoutSettingsDto } from './dto/upsert-layout-settings.dto';
import {
  loadDesignModel,
  runEngines,
  SolarCalcResult,
  toLayoutSettingsModel,
  toModuleSpecModel,
  toRoofSectionModel,
} from './solar.util';

@Injectable()
export class SolarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(projectId: string) {
    return this.prisma.solarDesign.findMany({
      where: { project_id: projectId },
      include: { roof_sections: true, layout_settings: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(dto: CreateSolarDesignDto, user: AuthenticatedUser) {
    const design = await this.prisma.solarDesign.create({
      data: {
        project_id: dto.projectId,
        name: dto.name,
        description: dto.description,
        created_by: user.id,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_DESIGN_CREATED',
      entity: 'SolarDesign',
      entityId: design.id,
      after: { projectId: dto.projectId, name: dto.name },
    });

    return design;
  }

  async findOne(designId: string) {
    const model = await loadDesignModel(this.prisma, designId);
    if (!model) throw new NotFoundException(`SolarDesign ${designId} not found`);
    return model;
  }

  async addRoofSection(designId: string, dto: CreateRoofSectionDto, user: AuthenticatedUser) {
    await this.ensureDesign(designId);

    const section = await this.prisma.solarRoofSection.create({
      data: {
        design_id: designId,
        name: dto.name,
        roof_type: (dto.roofType as SolarRoofTypeEnum) ?? SolarRoofTypeEnum.FLAT,
        slope_deg: dto.slopeDeg ?? 0,
        azimuth_deg: dto.azimuthDeg ?? 0,
        roof_material: dto.roofMaterial,
        polygon: dto.polygon as never,
        origin: (dto.origin as never) ?? { x: 0, y: 0, z: 0 },
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_ROOF_SECTION_CREATED',
      entity: 'SolarRoofSection',
      entityId: section.id,
      after: { designId, name: dto.name },
    });

    return toRoofSectionModel(section);
  }

  async listRoofSections(designId: string) {
    const sections = await this.prisma.solarRoofSection.findMany({
      where: { design_id: designId },
      orderBy: { created_at: 'asc' },
    });
    return sections.map(toRoofSectionModel);
  }

  async upsertLayoutSettings(designId: string, dto: UpsertLayoutSettingsDto, user: AuthenticatedUser) {
    await this.ensureDesign(designId);

    const settings = await this.prisma.solarLayoutSettings.upsert({
      where: { design_id: designId },
      update: {
        module_spec_id: dto.moduleSpecId,
        orientation: (dto.orientation as SolarModuleOrientationEnum) ?? SolarModuleOrientationEnum.PORTRAIT,
        edge_margin_mm: dto.edgeMarginMm ?? 300,
        row_spacing_mm: dto.rowSpacingMm ?? 0,
        column_spacing_mm: dto.columnSpacingMm ?? 20,
      },
      create: {
        design_id: designId,
        module_spec_id: dto.moduleSpecId,
        orientation: (dto.orientation as SolarModuleOrientationEnum) ?? SolarModuleOrientationEnum.PORTRAIT,
        edge_margin_mm: dto.edgeMarginMm ?? 300,
        row_spacing_mm: dto.rowSpacingMm ?? 0,
        column_spacing_mm: dto.columnSpacingMm ?? 20,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_LAYOUT_SETTINGS_UPDATED',
      entity: 'SolarDesign',
      entityId: designId,
      after: dto as never,
    });

    return toLayoutSettingsModel(settings);
  }

  async calculateLayout(designId: string): Promise<SolarCalcResult> {
    const model = await loadDesignModel(this.prisma, designId);
    if (!model) throw new NotFoundException(`SolarDesign ${designId} not found`);

    const moduleSpec = await this.resolveModuleSpec(model);
    if (!moduleSpec) {
      return this.emptyResult();
    }

    const result = runEngines(model, moduleSpec);

    await this.prisma.$transaction(async (tx) => {
      await tx.solarModulePlacement.deleteMany({ where: { design_id: designId } });
      if (result.placements.length > 0) {
        await tx.solarModulePlacement.createMany({
          data: result.placements.map((p) => ({
            design_id: designId,
            roof_section_id: p.roofSectionId,
            module_spec_id: p.moduleSpecId ?? null,
            row: p.row,
            column: p.column,
            local_x: p.localX,
            local_y: p.localY,
            local_z: p.localZ,
            rotation_deg: p.rotationDeg,
            width_mm: p.widthMm,
            height_mm: p.heightMm,
          })),
        });
      }
    });

    return result;
  }

  async getBom(designId: string): Promise<SolarCalcResult> {
    const model = await loadDesignModel(this.prisma, designId);
    if (!model) throw new NotFoundException(`SolarDesign ${designId} not found`);

    const moduleSpec = await this.resolveModuleSpec(model);
    if (!moduleSpec) {
      return this.emptyResult();
    }

    return runEngines(model, moduleSpec);
  }

  async listModules() {
    const specs = await this.prisma.solarModuleSpec.findMany({
      where: { is_active: true },
      orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
    });
    return specs.map(toModuleSpecModel);
  }

  async listProducts() {
    return this.prisma.solarProduct.findMany({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });
  }

  private async ensureDesign(designId: string) {
    const design = await this.prisma.solarDesign.findUnique({ where: { id: designId } });
    if (!design) throw new NotFoundException(`SolarDesign ${designId} not found`);
    return design;
  }

  private async resolveModuleSpec(model: { layoutSettings?: { moduleSpecId?: string } }) {
    const specId = model.layoutSettings?.moduleSpecId;
    if (specId) {
      const spec = await this.prisma.solarModuleSpec.findUnique({ where: { id: specId } });
      if (spec) return toModuleSpecModel(spec);
    }
    const first = await this.prisma.solarModuleSpec.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
    });
    return first ? toModuleSpecModel(first) : null;
  }

  private emptyResult(): SolarCalcResult {
    return {
      placements: [],
      mounting: {
        railRuns: [],
        railTotalLengthMm: 0,
        hookCount: 0,
        endClampCount: 0,
        midClampCount: 0,
        fastenerCount: 0,
        epdmCount: 0,
      },
      bom: [],
      totalModules: 0,
      totalPowerWp: 0,
    };
  }
}
