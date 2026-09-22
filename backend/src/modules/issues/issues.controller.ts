import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IssuesService, CreateIssueDto, CreateNCRDto } from './issues.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Issues & Non-Conformance (NCR)')
@Controller('api/issues')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  @ApiOperation({ summary: 'List all open/resolved issues for project' })
  async findAll(@Query('projectId') projectId?: string) {
    return this.issuesService.findAll(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Report new field issue' })
  async createIssue(@Body() dto: CreateIssueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.createIssue(dto, user.id);
  }

  @Post('ncrs')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.QA_QC, UserRoleEnum.PM)
  @ApiOperation({ summary: 'Issue Non-Conformance Report (NCR)' })
  async createNCR(@Body() dto: CreateNCRDto, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.createNCR(dto, user.id);
  }
}
