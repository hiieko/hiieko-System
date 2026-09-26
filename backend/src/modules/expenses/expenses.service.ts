import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ExpenseCategoryEnum, PaymentMethodEnum, ExpenseStatusEnum } from '@prisma/client';

export interface CreateExpenseDto {
  projectId?: string;
  category: ExpenseCategoryEnum;
  paymentMethod?: PaymentMethodEnum;
  amount: number;
  vatAmount?: number;
  currency?: string;
  expenseDate: string;
  merchantName?: string;
  merchantCui?: string;
  documentNumber?: string;
  description?: string;
  idempotencyKey?: string;
  lines?: Array<{
    description: string;
    amount: number;
    vatRate?: number;
  }>;
}

export interface ApproveExpenseDto {
  status: 'APPROVED' | 'REJECTED';
  notes?: string;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(projectId?: string, userId?: string, status?: ExpenseStatusEnum, projectScopeWhere?: Record<string, any>) {
    const where: any = { ...projectScopeWhere };
    if (projectId) {
      where.project_id = projectId;
    }
    if (userId) {
      where.submitted_by_id = userId;
    }
    if (status) {
      where.status = status;
    }
    return this.prisma.expense.findMany({
      where,
      include: {
        submitted_by: {
          include: { profile: true },
        },
        project: true,
        lines: true,
        approvals: {
          include: { approver: { include: { profile: true } } },
        },
      },
      orderBy: { expense_date: 'desc' },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        submitted_by: {
          include: { profile: true },
        },
        project: true,
        lines: true,
        approvals: {
          include: { approver: { include: { profile: true } } },
        },
        reimbursements: true,
      },
    });

    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const expenseDate = new Date(dto.expenseDate);
    expenseDate.setUTCHours(0, 0, 0, 0);

    const expense = await this.prisma.expense.create({
      data: {
        submitted_by_id: userId,
        project_id: dto.projectId,
        category: dto.category,
        payment_method: dto.paymentMethod || PaymentMethodEnum.COMPANY_CARD,
        amount: dto.amount,
        vat_amount: dto.vatAmount,
        currency: dto.currency || 'RON',
        expense_date: expenseDate,
        merchant_name: dto.merchantName,
        merchant_cui: dto.merchantCui,
        document_number: dto.documentNumber,
        description: dto.description,
        idempotency_key: dto.idempotencyKey,
        status: ExpenseStatusEnum.SUBMITTED,
        lines: dto.lines
          ? {
              create: dto.lines.map((l) => ({
                description: l.description,
                amount: l.amount,
                vat_rate: l.vatRate,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });

    await this.auditService.record({
      actorId: userId,
      action: 'EXPENSE_SUBMITTED',
      entity: 'Expense',
      entityId: expense.id,
      after: { amount: dto.amount, category: dto.category, merchant: dto.merchantName },
    });

    return expense;
  }

  /**
   * Approves or rejects an expense.
   * STRICT BUSINESS INVARIANT: Self-approval is strictly forbidden.
   */
  async approveOrReject(expenseId: string, approverId: string, dto: ApproveExpenseDto) {
    const expense = await this.findOne(expenseId);

    // CRITICAL INVARIANT: The submitter cannot approve their own expense
    if (expense.submitted_by_id === approverId) {
      throw new ForbiddenException(
        'Self-approval of expenses is strictly prohibited. An independent manager or administrator must review this expense.'
      );
    }

    if (expense.status === ExpenseStatusEnum.APPROVED || expense.status === ExpenseStatusEnum.REIMBURSED) {
      throw new BadRequestException(`Cannot update expense in state ${expense.status}`);
    }

    const targetStatus =
      dto.status === 'APPROVED' ? ExpenseStatusEnum.APPROVED : ExpenseStatusEnum.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: { status: targetStatus },
      });

      const approval = await tx.expenseApproval.create({
        data: {
          expense_id: expenseId,
          approver_id: approverId,
          status: targetStatus,
          notes: dto.notes,
        },
      });

      await this.auditService.record({
        actorId: approverId,
        action: `EXPENSE_${targetStatus}`,
        entity: 'Expense',
        entityId: expenseId,
        before: { status: expense.status },
        after: { status: targetStatus, notes: dto.notes },
      });

      return { expense: updated, approval };
    });
  }
}
