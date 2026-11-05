import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from '../src/modules/employees/employees.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('EmployeesService (CRUD & Soft Delete)', () => {
  let service: EmployeesService;
  let prisma: any;
  let audit: any;

  const existing = {
    id: 'emp-1',
    first_name: 'Ion',
    last_name: 'Popescu',
    cnp: '1900101123456',
    position: 'Dulgher',
    hourly_rate: 45,
    user_id: null,
    is_active: true,
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('lists employees by last name including their user account', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { last_name: 'asc' } }),
    );
  });

  it('throws NotFound for an unknown employee', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('maps creation fields and audits the employee', async () => {
    prisma.employee.create.mockResolvedValue({ id: 'emp-1' });

    await service.create(
      {
        firstName: 'Ion',
        lastName: 'Popescu',
        cnp: '1900101123456',
        position: 'Dulgher',
        hourlyRate: 45,
        userId: 'user-1',
      },
      'actor-1',
    );

    expect(prisma.employee.create).toHaveBeenCalledWith({
      data: {
        first_name: 'Ion',
        last_name: 'Popescu',
        cnp: '1900101123456',
        position: 'Dulgher',
        hourly_rate: 45,
        user_id: 'user-1',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_CREATED',
        entity: 'Employee',
        entityId: 'emp-1',
      }),
    );
  });

  it('refuses to update an unknown employee', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { position: 'X' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('only writes fields present in the update DTO and audits before/after', async () => {
    prisma.employee.findUnique.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({ ...existing, position: 'Sef echipa' });

    await service.update('emp-1', { position: 'Sef echipa' }, 'actor-1');

    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1' },
        data: { position: 'Sef echipa' },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_UPDATED',
        before: expect.objectContaining({ position: 'Dulgher' }),
        after: expect.objectContaining({ position: 'Sef echipa' }),
      }),
    );
  });

  it('archives an employee instead of deleting the row', async () => {
    prisma.employee.findUnique.mockResolvedValue(existing);
    prisma.employee.update.mockResolvedValue({ ...existing, is_active: false });

    const result = await service.remove('emp-1', 'actor-1');

    expect(result.is_active).toBe(false);
    expect(prisma.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { is_active: false },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_ARCHIVED',
        before: { is_active: true },
        after: { is_active: false },
      }),
    );
  });

  it('refuses to archive an unknown employee', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });
});
