import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface CreateSupplierDto {
  organizationId: string;
  name: string;
  cui?: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId?: string) {
    return this.prisma.supplier.findMany({
      where: organizationId ? { organization_id: organizationId, is_active: true } : { is_active: true },
      include: {
        purchase_orders: true,
        avize: true,
      },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchase_orders: { include: { items: true } },
        avize: true,
        invoices: true,
      },
    });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async create(dto: CreateSupplierDto, actorId?: string) {
    const supplier = await this.prisma.supplier.create({
      data: {
        organization_id: dto.organizationId,
        name: dto.name,
        cui: dto.cui,
        address: dto.address,
        contact_person: dto.contactPerson,
        contact_email: dto.contactEmail,
        contact_phone: dto.contactPhone,
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorId,
      action: 'SUPPLIER_CREATED',
      entity: 'Supplier',
      entityId: supplier.id,
      after: dto as any,
    });

    return supplier;
  }
}
