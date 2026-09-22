import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ExpenseCategoryEnum, ExpenseStatusEnum, PaymentMethodEnum } from '@prisma/client';

describe('ExpensesService (Approvals & Invariants)', () => {
  let service: ExpensesService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      expense: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseApproval: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('Strict No Self-Approval Invariant', () => {
    it('should throw ForbiddenException when a user attempts to approve their own submitted expense', async () => {
      const submitterId = 'worker-uuid-123';

      prisma.expense.findUnique.mockResolvedValue({
        id: 'exp-1',
        submitted_by_id: submitterId,
        amount: 250,
        status: ExpenseStatusEnum.SUBMITTED,
        category: ExpenseCategoryEnum.FUEL,
        payment_method: PaymentMethodEnum.COMPANY_CARD,
        lines: [],
        approvals: [],
      });

      // Submitter attempts to approve their own expense
      await expect(
        service.approveOrReject('exp-1', submitterId, {
          status: 'APPROVED',
          notes: 'Self-approval attempt',
        })
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.expense.update).not.toHaveBeenCalled();
      expect(prisma.expenseApproval.create).not.toHaveBeenCalled();
    });

    it('should allow an independent manager to approve an expense', async () => {
      const submitterId = 'worker-uuid-123';
      const managerId = 'manager-uuid-456';

      prisma.expense.findUnique.mockResolvedValue({
        id: 'exp-1',
        submitted_by_id: submitterId,
        amount: 250,
        status: ExpenseStatusEnum.SUBMITTED,
        category: ExpenseCategoryEnum.FUEL,
        payment_method: PaymentMethodEnum.COMPANY_CARD,
        lines: [],
        approvals: [],
      });

      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: ExpenseStatusEnum.APPROVED,
      });

      prisma.expenseApproval.create.mockResolvedValue({
        id: 'appr-1',
        expense_id: 'exp-1',
        approver_id: managerId,
        status: 'APPROVED',
      });

      const result = await service.approveOrReject('exp-1', managerId, {
        status: 'APPROVED',
        notes: 'Approved by project manager',
      });

      expect(result.expense.status).toBe(ExpenseStatusEnum.APPROVED);
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { status: ExpenseStatusEnum.APPROVED },
      });
      expect(audit.record).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to approve an already approved or reimbursed expense', async () => {
      prisma.expense.findUnique.mockResolvedValue({
        id: 'exp-1',
        submitted_by_id: 'worker-1',
        status: ExpenseStatusEnum.APPROVED,
      });

      await expect(
        service.approveOrReject('exp-1', 'manager-1', {
          status: 'APPROVED',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
