import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SolarModuleOrientationEnum, SolarRoofTypeEnum } from '@prisma/client';
import { Point2D, polygonContainedInPolygon, polygonIsValid } from '@solar/shared';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateObstacleDto } from './dto/create-obstacle.dto';
import { CreateRoofSectionDto } from './dto/create-roof-section.dto';
import { CreateSolarDesignDto } from './dto/create-solar-design.dto';
import { UpdateObstacleDto } from './dto/update-obstacle.dto';
import { UpdateRoofSectionDto } from './dto/update-roof-section.dto';
import { UpsertLayoutSettingsDto } from './dto/upsert-layout-settings.dto';
import {
  loadDesignModel,
  polygonFromJson,
  runEngines,
  SolarCalcResult,
  toLayoutSettingsModel,
  toModuleSpecModel,
  toObstacleModel,
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
    this.validatePolygon(dto.polygon as Point2D[]);

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

  async updateRoofSection(
    designId: string,
    roofSectionId: string,
    dto: UpdateRoofSectionDto,
    user: AuthenticatedUser,
  ) {
    const roof = await this.getRoofInDesign(designId, roofSectionId);
    if (dto.polygon) this.validatePolygon(dto.polygon as Point2D[]);

    const updated = await this.prisma.solarRoofSection.update({
      where: { id: roofSectionId },
      data: {
        name: dto.name,
        roof_type: (dto.roofType as SolarRoofTypeEnum) ?? roof.roof_type,
        slope_deg: dto.slopeDeg ?? roof.slope_deg,
        azimuth_deg: dto.azimuthDeg ?? roof.azimuth_deg,
        roof_material: dto.roofMaterial,
        polygon: dto.polygon ? (dto.polygon as never) : undefined,
        origin: dto.origin ? (dto.origin as never) : undefined,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_ROOF_SECTION_UPDATED',
      entity: 'SolarRoofSection',
      entityId: roofSectionId,
      after: dto as never,
    });

    return toRoofSectionModel(updated);
  }

  async deleteRoofSection(designId: string, roofSectionId: string, user: AuthenticatedUser) {
    await this.getRoofInDesign(designId, roofSectionId);
    await this.prisma.solarRoofSection.delete({ where: { id: roofSectionId } });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_ROOF_SECTION_DELETED',
      entity: 'SolarRoofSection',
      entityId: roofSectionId,
    });

    return { id: roofSectionId };
  }

  async addObstacle(
    designId: string,
    roofSectionId: string,
    dto: CreateObstacleDto,
    user: AuthenticatedUser,
  ) {
    const roof = await this.getRoofInDesign(designId, roofSectionId);
    this.validatePolygon(dto.polygon as Point2D[]);
    this.assertObstacleWithinRoof(dto.polygon as Point2D[], roof);

    const obstacle = await this.prisma.solarObstacle.create({
      data: {
        roof_section_id: roofSectionId,
        name: dto.name,
        obstacle_type: dto.obstacleType,
        polygon: dto.polygon as never,
        keepout_margin_mm: dto.keepoutMarginMm ?? 0,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_OBSTACLE_CREATED',
      entity: 'SolarObstacle',
      entityId: obstacle.id,
      after: { roofSectionId, name: dto.name },
    });

    return toObstacleModel(obstacle);
  }

  async listObstacles(designId: string, roofSectionId: string) {
    await this.getRoofInDesign(designId, roofSectionId);
    const obstacles = await this.prisma.solarObstacle.findMany({
      where: { roof_section_id: roofSectionId },
      orderBy: { id: 'asc' },
    });
    return obstacles.map(toObstacleModel);
  }

  async updateObstacle(
    designId: string,
    obstacleId: string,
    dto: UpdateObstacleDto,
    user: AuthenticatedUser,
  ) {
    const obstacle = await this.getObstacleInDesign(designId, obstacleId);

    if (dto.polygon) {
      this.validatePolygon(dto.polygon as Point2D[]);
      const roof = await this.prisma.solarRoofSection.findUnique({
        where: { id: obstacle.roof_section_id },
      });
      if (roof) this.assertObstacleWithinRoof(dto.polygon as Point2D[], roof);
    }

    const updated = await this.prisma.solarObstacle.update({
      where: { id: obstacleId },
      data: {
        name: dto.name,
        obstacle_type: dto.obstacleType,
        polygon: dto.polygon ? (dto.polygon as never) : undefined,
        keepout_margin_mm: dto.keepoutMarginMm,
      },
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_OBSTACLE_UPDATED',
      entity: 'SolarObstacle',
      entityId: obstacleId,
      after: dto as never,
    });

    return toObstacleModel(updated);
  }

  async deleteObstacle(designId: string, obstacleId: string, user: AuthenticatedUser) {
    await this.getObstacleInDesign(designId, obstacleId);
    await this.prisma.solarObstacle.delete({ where: { id: obstacleId } });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'SOLAR_OBSTACLE_DELETED',
      entity: 'SolarObstacle',
      entityId: obstacleId,
    });

    return { id: obstacleId };
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

  private async getRoofInDesign(designId: string, roofSectionId: string) {
    const roof = await this.prisma.solarRoofSection.findFirst({
      where: { id: roofSectionId, design_id: designId },
    });
    if (!roof) {
      throw new NotFoundException(`Roof section ${roofSectionId} not found in design ${designId}`);
    }
    return roof;
  }

  private async getObstacleInDesign(designId: string, obstacleId: string) {
    const obstacle = await this.prisma.solarObstacle.findFirst({
      where: { id: obstacleId, roof_section: { design_id: designId } },
    });
    if (!obstacle) {
      throw new NotFoundException(`Obstacle ${obstacleId} not found in design ${designId}`);
    }
    return obstacle;
  }

  private validatePolygon(polygon: Point2D[]): void {
    const result = polygonIsValid(polygon);
    if (!result.valid) throw new BadRequestException(`Invalid polygon: ${result.reason}`);
  }

  private assertObstacleWithinRoof(polygon: Point2D[], roof: { polygon: unknown }): void {
    const roofPoly = polygonFromJson(roof.polygon);
    if (!polygonContainedInPolygon(polygon, roofPoly)) {
      throw new BadRequestException('Obstacle polygon must be contained within the roof section');
    }
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
