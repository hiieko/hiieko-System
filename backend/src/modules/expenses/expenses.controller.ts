import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService, CreateExpenseDto, ApproveExpenseDto } from './expenses.service';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/auth-metadata.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UserRoleEnum, ExpenseStatusEnum } from '@prisma/client';

@ApiTags('Expenses & Approvals')
@Controller('api/expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List expenses with optional project, user, or status filter' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: ExpenseStatusEnum,
  ) {
    // Non-managers can only see their own expenses unless filtering by project
    const filterUserId =
      user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.MANAGER || user.role === UserRoleEnum.FINANCE
        ? userId
        : user.id;

    return this.expensesService.findAll(projectId, filterUserId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense details and approval history' })
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit new site or travel expense' })
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(user.id, dto);
  }

  @Post(':id/approve')
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
