import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ControlTowerService } from './control-tower.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { DrillDownParams } from './interfaces/control-tower.interface';

@ApiTags('Control Tower')
@Controller('api/control-tower')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ControlTowerController {
  constructor(private readonly controlTowerService: ControlTowerService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Get comprehensive cross-functional Control Tower overview metrics',
    description:
      'Aggregates real operational data across Projects, Workforce, Production, Materials, Finance, Quality, Documentation, and calculates active Red Flags.',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter metrics to a specific project',
  })
  async getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
  ) {
    return this.controlTowerService.getOverview(
      user.organizationId,
      projectId,
    );
  }

  @Get('drilldown')
  @ApiOperation({
    summary: 'Drill down into specific operational domain details',
    description:
      'Provides paginated detail records for any operational category (PROJECTS, WORKFORCE, PRODUCTION, MATERIALS, FINANCE, QUALITY, DOCUMENTATION, RED_FLAGS).',
  })
  @ApiQuery({
    name: 'category',
    required: true,
    description:
      'Category to drill down into: PROJECTS, WORKFORCE, PRODUCTION, MATERIALS, FINANCE, QUALITY, DOCUMENTATION, RED_FLAGS',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter to a specific project',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Pagination limit (default: 20)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Pagination offset (default: 0)',
  })
  async getDrillDown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: {
      category: string;
      projectId?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    const params: DrillDownParams = {
      category: query.category,
      projectId: query.projectId,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
    return this.controlTowerService.getDrillDown(
      user.organizationId,
      params,
    );
  }

  @Get('red-flags')
  @ApiOperation({
    summary: 'Get active cross-functional red flags and rule-based alerts',
    description:
      'Returns prioritized operational exceptions across all 7 domains with WHO, WHY, WHEN, and severity.',
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    description: 'Filter to a specific project',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    description: 'Filter by severity: LOW, MEDIUM, HIGH, CRITICAL',
  })
  async getRedFlags(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('severity') severity?: string,
  ) {
    return this.controlTowerService.getRedFlags(
      user.organizationId,
      projectId,
      severity,
    );
  }
}
