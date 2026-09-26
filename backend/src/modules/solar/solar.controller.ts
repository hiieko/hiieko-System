import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { RequireProjectAccess, Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CreateObstacleDto } from './dto/create-obstacle.dto';
import { CreateRoofSectionDto } from './dto/create-roof-section.dto';
import { CreateSolarDesignDto } from './dto/create-solar-design.dto';
import { UpdateObstacleDto } from './dto/update-obstacle.dto';
import { UpdateRoofSectionDto } from './dto/update-roof-section.dto';
import { UpsertLayoutSettingsDto } from './dto/upsert-layout-settings.dto';
import { SolarDesignAccessGuard } from './guards/solar-design-access.guard';
import { SolarService } from './solar.service';

@ApiTags('Solar Configurator')
@Controller('api/solar')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SolarController {
  constructor(private readonly solarService: SolarService) {}

  // ── Designs ────────────────────────────────────────────────────────────────

  @Get('designs')
  @RequireProjectAccess('projectId')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List solar designs for a project' })
  async listDesigns(@Query('projectId') projectId?: string) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    return this.solarService.findAll(projectId);
  }

  @Post('designs')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @RequireProjectAccess('projectId')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Create a solar design for a project' })
  async createDesign(@Body() dto: CreateSolarDesignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.solarService.create(dto, user);
  }

  @Get('designs/:id')
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Get a solar design with its full working set' })
  async getDesign(@Param('id') id: string) {
    return this.solarService.findOne(id);
  }

  // ── Roof sections ──────────────────────────────────────────────────────────

  @Post('designs/:designId/roof-sections')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Add a roof section (rectangular or polygon)' })
  async addRoofSection(
    @Param('designId') designId: string,
    @Body() dto: CreateRoofSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.addRoofSection(designId, dto, user);
  }

  @Get('designs/:designId/roof-sections')
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'List roof sections of a design' })
  async listRoofSections(@Param('designId') designId: string) {
    return this.solarService.listRoofSections(designId);
  }

  @Patch('designs/:designId/roof-sections/:roofSectionId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Update a roof section' })
  async updateRoofSection(
    @Param('designId') designId: string,
    @Param('roofSectionId') roofSectionId: string,
    @Body() dto: UpdateRoofSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.updateRoofSection(designId, roofSectionId, dto, user);
  }

  @Delete('designs/:designId/roof-sections/:roofSectionId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Delete a roof section' })
  async deleteRoofSection(
    @Param('designId') designId: string,
    @Param('roofSectionId') roofSectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.deleteRoofSection(designId, roofSectionId, user);
  }

  @Post('designs/:designId/roof-sections/:roofSectionId/obstacles')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Add an obstacle to a roof section' })
  async addObstacle(
    @Param('designId') designId: string,
    @Param('roofSectionId') roofSectionId: string,
    @Body() dto: CreateObstacleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.addObstacle(designId, roofSectionId, dto, user);
  }

  @Get('designs/:designId/roof-sections/:roofSectionId/obstacles')
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'List obstacles of a roof section' })
  async listObstacles(
    @Param('designId') designId: string,
    @Param('roofSectionId') roofSectionId: string,
  ) {
    return this.solarService.listObstacles(designId, roofSectionId);
  }

  @Patch('designs/:designId/obstacles/:obstacleId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Update an obstacle' })
  async updateObstacle(
    @Param('designId') designId: string,
    @Param('obstacleId') obstacleId: string,
    @Body() dto: UpdateObstacleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.updateObstacle(designId, obstacleId, dto, user);
  }

  @Delete('designs/:designId/obstacles/:obstacleId')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Delete an obstacle' })
  async deleteObstacle(
    @Param('designId') designId: string,
    @Param('obstacleId') obstacleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.deleteObstacle(designId, obstacleId, user);
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  @Put('designs/:designId/layout-settings')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.OWNER, UserRoleEnum.PM, UserRoleEnum.SITE_MANAGER)
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Upsert layout settings for a design' })
  async upsertLayoutSettings(
    @Param('designId') designId: string,
    @Body() dto: UpsertLayoutSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solarService.upsertLayoutSettings(designId, dto, user);
  }

  @Post('designs/:designId/layout/calculate')
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Calculate the PV module layout (roof-local placements)' })
  async calculateLayout(@Param('designId') designId: string) {
    return this.solarService.calculateLayout(designId);
  }

  // ── BOM ────────────────────────────────────────────────────────────────────

  @Get('designs/:designId/bom')
  @UseGuards(SolarDesignAccessGuard)
  @ApiOperation({ summary: 'Compute the prototype BOM for a design' })
  async getBom(@Param('designId') designId: string) {
    return this.solarService.getBom(designId);
  }

  // ── Catalog ────────────────────────────────────────────────────────────────

  @Get('modules')
  @ApiOperation({ summary: 'List PV module specs' })
  async listModules() {
    return this.solarService.listModules();
  }

  @Get('products')
  @ApiOperation({ summary: 'List mounting products' })
  async listProducts() {
    return this.solarService.listProducts();
  }
}
