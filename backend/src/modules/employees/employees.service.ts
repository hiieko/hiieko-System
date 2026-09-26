import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  cnp?: string;
  position?: string;
  hourlyRate?: number;
  userId?: string;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  cnp?: string;
  position?: string;
  hourlyRate?: number;
  userId?: string;
  isActive?: boolean;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.employee.findMany({
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
      orderBy: { last_name: 'asc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async create(dto: CreateEmployeeDto, actorId?: string) {
    const employee = await this.prisma.employee.create({
      data: {
        first_name: dto.firstName,
        last_name: dto.lastName,
        cnp: dto.cnp,
        position: dto.position,
        hourly_rate: dto.hourlyRate,
        user_id: dto.userId,
      },
    });

    await this.auditService.record({
      actorId,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employee.id,
      after: dto as any,
    });

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId?: string) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Employee ${id} not found`);

    const beforeState = {
      first_name: existing.first_name,
      last_name: existing.last_name,
      cnp: existing.cnp,
      position: existing.position,
      hourly_rate: existing.hourly_rate,
      user_id: existing.user_id,
      is_active: existing.is_active,
    };

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { first_name: dto.firstName }),
        ...(dto.lastName !== undefined && { last_name: dto.lastName }),
        ...(dto.cnp !== undefined && { cnp: dto.cnp }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.hourlyRate !== undefined && { hourly_rate: dto.hourlyRate }),
        ...(dto.userId !== undefined && { user_id: dto.userId }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    await this.auditService.record({
      actorId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: employee.id,
      before: beforeState as any,
      after: {
        first_name: employee.first_name,
        last_name: employee.last_name,
        cnp: employee.cnp,
        position: employee.position,
        hourly_rate: employee.hourly_rate,
        user_id: employee.user_id,
        is_active: employee.is_active,
      },
    });

    return employee;
  }

  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Employee ${id} not found`);

    // Soft-delete: set is_active = false
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { is_active: false },
    });

    await this.auditService.record({
      actorId,
      action: 'EMPLOYEE_ARCHIVED',
      entity: 'Employee',
      entityId: employee.id,
      before: { is_active: existing.is_active },
      after: { is_active: false },
    });

    return employee;
  }
}
