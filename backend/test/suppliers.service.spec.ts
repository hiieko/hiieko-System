import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from '../src/modules/suppliers/suppliers.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotFoundException } from '@nestjs/common';

describe('SuppliersService (Organization Scoping)', () => {
  let service: SuppliersService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('lists only active suppliers for the organization', async () => {
    prisma.supplier.findMany.mockResolvedValue([]);

    await service.findAll('org-1');

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1', is_active: true },
      }),
    );
  });

  it('lists only active suppliers when no organization is provided', async () => {
    prisma.supplier.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: true } }),
    );
  });

  it('throws NotFound for an unknown supplier', async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('maps the DTO fields and audits supplier creation', async () => {
    prisma.supplier.create.mockResolvedValue({ id: 'sup-1' });

    await service.create(
      {
        organizationId: 'org-1',
        name: 'Fier Veche SRL',
        cui: 'RO123',
        address: 'Str. Mare 1',
        contactPerson: 'Ana',
        contactEmail: 'ana@example.com',
        contactPhone: '0700000000',
      },
      'user-1',
    );

    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: {
        organization_id: 'org-1',
        name: 'Fier Veche SRL',
        cui: 'RO123',
        address: 'Str. Mare 1',
        contact_person: 'Ana',
        contact_email: 'ana@example.com',
        contact_phone: '0700000000',
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorId: 'user-1',
        action: 'SUPPLIER_CREATED',
        entity: 'Supplier',
        entityId: 'sup-1',
      }),
    );
  });
});
