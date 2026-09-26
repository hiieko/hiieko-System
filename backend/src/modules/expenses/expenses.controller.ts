import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService, CreateExpenseDto, ApproveExpenseDto } from './expenses.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import {
  Roles,
  RequireProjectAccess,
  RequireEntityProjectAccess,
} from '../../common/auth/decorators/auth-metadata.decorator';
import { ProjectScope } from '../../common/auth/decorators/project-scope.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, ExpenseStatusEnum } from '@prisma/client';
import { ProjectScope as ProjectScopeType } from '../../common/auth/project-scope.filter';
import { buildScopedProjectWhere } from '../../common/auth/project-scope.filter';

@ApiTags('Expenses & Approvals')
@Controller('api/expenses')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequireProjectAccess('projectId', 'optional')
  @ApiOperation({ summary: 'List expenses with optional project, user, or status filter' })
  async findAll(
    @ProjectScope() scope: ProjectScopeType,
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: ExpenseStatusEnum,
  ) {
    const where = buildScopedProjectWhere(scope, projectId);
    const filterUserId =
      user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.MANAGER || user.role === UserRoleEnum.FINANCE
        ? userId
        : user.id;

    return this.expensesService.findAll(projectId, filterUserId, status, where);
  }

  @Get(':id')
  @RequireEntityProjectAccess('expense', 'id')
  @ApiOperation({ summary: 'Get expense details and approval history' })
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Submit new site or travel expense' })
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(user.id, dto);
  }

  @Post(':id/approve')
  @RequireEntityProjectAccess('expense', 'id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.PM, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Approve or reject expense (Strictly prohibits self-approval)' })
  async approveOrReject(
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expensesService.approveOrReject(id, user.id, dto);
  }
}
