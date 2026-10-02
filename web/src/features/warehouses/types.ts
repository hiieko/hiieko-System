/**
 * HIIEKO — Warehouses (canonical)
 * Mirrors the Prisma model `Warehouse` and `CreateWarehouseDto`
 * (backend/src/modules/warehouses/warehouses.service.ts).
 *
 * DATA HONESTY: the list endpoint includes `stock_balances` (with `material`);
 * only its length is shown (no invented aggregate quantities). There is no edit
 * or archive endpoint. GET /api/warehouses/:id is NOT org-scoped (known gap).
 */
export interface Warehouse {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stock_balances?: Array<{ id: string; material?: { name?: string } }>;
}

/** Exactly the real CreateWarehouseDto. `organizationId` is supplied by the backend. */
export interface CreateWarehouseDto {
  name: string;
  code: string;
  address?: string;
}
