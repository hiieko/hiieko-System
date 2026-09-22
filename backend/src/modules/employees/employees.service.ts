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
}
