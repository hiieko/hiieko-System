/**
 * HIIEKO — QA/QC Inspection types (canonical)
 *
 * Mirrors the Prisma model `Inspection` (backend/prisma/schema.prisma) and the
 * real contract of GET/POST /api/qa-qc/inspections (backend/src/modules/qa-qc):
 *
 *   GET  /api/qa-qc/inspections?projectId= → any authenticated role within
 *        project scope (no @Roles; `include: { template, measurements, ncrs }`,
 *        newest first by `inspected_at`).
 *   POST /api/qa-qc/inspections → @Roles(ADMIN, QA_QC, PM, SITE_MANAGER);
 *        the backend always creates with status='COMPLETED' and stamps
 *        `inspected_at` server-side (now()); it is never client-supplied.
 *
 * DATA HONESTY: there is no title, description, inspectionType or result field
 * on the backend Inspection model. The real create contract is
 * `{ projectId, templateId?, inspectorName, measurements? }`.
 * Nothing beyond the Prisma shape may be displayed as if it existed.
 */

/** Embedded measurement (Prisma `Measurement`). `value` is Decimal(12,4) → serialized as string | number. */
export interface InspectionMeasurement {
  id: string;
  inspection_id: string;
  parameter: string;
  value: string | number;
  unit: string;
  passed: boolean;
}

/** Optional template reference included by the list endpoint (Prisma `InspectionTemplate`). */
export interface InspectionTemplateRef {
  id: string;
  name: string;
  code: string;
}

/** Embedded NCR (Prisma `NCR` — same shape as the issues feature `IssueNcr`). */
export interface InspectionNcr {
  id: string;
  issue_id: string | null;
  inspection_id: string | null;
  ncr_number: string;
  description: string;
  status:
    | 'OPEN'
    | 'DISPOSITION_PROPOSED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'IMPLEMENTED'
    | 'VERIFIED_CLOSED';
  created_at: string;
}

/** Mirrors Prisma model `Inspection` + relations included by GET /api/qa-qc/inspections. */
export interface Inspection {
  id: string;
  project_id: string;
  template_id: string | null;
  inspector_name: string;
  status: string;
  inspected_at: string;
  template?: InspectionTemplateRef | null;
  measurements?: InspectionMeasurement[];
  ncrs?: InspectionNcr[];
}

/** Exactly the real CreateInspectionDto consumed by POST /api/qa-qc/inspections.
 *  Status and inspected_at are server-assigned; no status input exists. */
export interface CreateInspectionDto {
  projectId: string;
  templateId?: string;
  inspectorName: string;
  measurements?: Array<{
    parameter: string;
    value: number;
    unit: string;
    passed?: boolean;
  }>;
}