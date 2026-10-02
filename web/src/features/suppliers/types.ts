/**
 * HIIEKO — Suppliers (canonical)
 * Mirrors the Prisma model `Supplier` (backend/prisma/schema.prisma) and the
 * `CreateSupplierDto` consumed by POST /api/suppliers
 * (backend/src/modules/suppliers/suppliers.service.ts).
 *
 * DATA HONESTY: the list endpoint (GET /api/suppliers) returns `purchase_orders`
 * and `avize` as included arrays (full objects, not counts). There is no edit or
 * archive endpoint, and GET /api/suppliers/:id is NOT org-scoped (known gap).
 */

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  cui: string | null;
  address: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  purchase_orders?: unknown[];
  avize?: unknown[];
}

/** Exactly the real CreateSupplierDto. `organizationId` is supplied by the
 *  backend from the caller's organization. No other fields exist. */
export interface CreateSupplierDto {
  name: string;
  cui?: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}
