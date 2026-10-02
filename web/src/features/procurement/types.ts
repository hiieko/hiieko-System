/**
 * HIIEKO — Procurement / Aviz types (canonical)
 *
 * Mirrors the Prisma models `Aviz` / `AvizItem` (backend/prisma/schema.prisma)
 * and the real contract of the procurement endpoints
 * (backend/src/modules/procurement/procurement.controller.ts):
 *
 *   GET  /api/procurement/avize?projectId= → any authenticated role within
 *        project scope (`include: { project, supplier, items{material} }`,
 *        newest first by delivery_date).
 *   POST /api/procurement/avize            → @Roles(ADMIN, PROCUREMENT,
 *        SITE_MANAGER, TEAM_LEADER) + RolesGuard ADMIN/OWNER bypass.
 *        Single transaction: aviz + items + RECEIPT stock movements +
 *        stock-balance increment; AVIZ_CREATED audit record.
 *        Duplicate `avizNumber` for the same project → 409.
 *
 * DATA HONESTY: an Aviz carries NO money fields (no currency/amounts/prices)
 * and NO unit field on items (unit lives on Material, display-only).
 * Nothing beyond the Prisma shape may be displayed as if it existed.
 */

/** Material reference included by GET /api/materials and embedded in aviz items. */
export interface MaterialRef {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_active?: boolean;
}

/** Supplier reference included by GET /api/suppliers (org-scoped) and by the aviz payload. */
export interface SupplierRef {
  id: string;
  name: string;
}

/** Embedded receipt item (Prisma `AvizItem` + included Material). */
export interface AvizItem {
  id: string;
  aviz_id: string;
  material_id: string;
  quantity: string | number;
  material?: MaterialRef;
}

/** Mirrors Prisma model `Aviz` + relations included by the procurement endpoints. */
export interface Aviz {
  id: string;
  project_id: string;
  supplier_id: string | null;
  aviz_number: string;
  delivery_date: string;
  driver_name: string | null;
  vehicle_plate: string | null;
  notes: string | null;
  idempotency_key: string | null;
  created_at: string;
  project?: { id: string; name: string; code: string };
  supplier?: SupplierRef | null;
  items?: AvizItem[];
}

/** Exactly the real CreateAvizDto consumed by POST /api/procurement/avize.
 *  No currency/amount/unit/PO fields exist on the backend and none are sent. */
export interface CreateAvizDto {
  projectId: string;
  avizNumber: string;
  deliveryDate: string;
  supplierId?: string;
  driverName?: string;
  vehiclePlate?: string;
  notes?: string;
  idempotencyKey?: string;
  items: Array<{
    materialId: string;
    quantity: number;
  }>;
}