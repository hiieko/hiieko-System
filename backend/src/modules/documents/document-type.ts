import { DocumentTypeEnum } from '@prisma/client';

/**
 * Maps the mobile/shared DocumentType tokens onto the PostgreSQL enum.
 *
 * Shared by the upload pipeline and the document workspace so a document
 * always receives the same category regardless of which endpoint created it.
 * Unknown tokens fall back to `OTHER` — a category is never invented.
 */
export const DOCUMENT_TYPE_MAP: Record<string, DocumentTypeEnum> = {
  bon_fiscal: DocumentTypeEnum.BON_FISCAL,
  factura: DocumentTypeEnum.FACTURA,
  aviz: DocumentTypeEnum.AVIZ,
  certificat_conformitate: DocumentTypeEnum.CERTIFICAT_CONFORMITATE,
  proces_verbal: DocumentTypeEnum.PROCES_VERBAL,
  plan_tehnic: DocumentTypeEnum.PLAN_TEHNIC,
  contract: DocumentTypeEnum.CONTRACT,
  raport_testare: DocumentTypeEnum.RAPORT_TESTARE,
  receipt: DocumentTypeEnum.OTHER,
  other: DocumentTypeEnum.OTHER,
  BON_FISCAL: DocumentTypeEnum.BON_FISCAL,
  FACTURA: DocumentTypeEnum.FACTURA,
  AVIZ: DocumentTypeEnum.AVIZ,
  CERTIFICAT_CONFORMITATE: DocumentTypeEnum.CERTIFICAT_CONFORMITATE,
  PROCES_VERBAL: DocumentTypeEnum.PROCES_VERBAL,
  PLAN_TEHNIC: DocumentTypeEnum.PLAN_TEHNIC,
  CONTRACT: DocumentTypeEnum.CONTRACT,
  RAPORT_TESTARE: DocumentTypeEnum.RAPORT_TESTARE,
  OTHER: DocumentTypeEnum.OTHER,
};

/**
 * Resolve a client-supplied document type token.
 *
 * Returns `null` when the token is not a known category, so callers can
 * distinguish "no category supplied" from "explicitly OTHER".
 */
export function resolveDocumentType(token: string | undefined | null): DocumentTypeEnum | null {
  if (!token) return null;
  return DOCUMENT_TYPE_MAP[String(token).toLowerCase()] ?? null;
}

/** Every category the platform can store, in enum order. */
export const DOCUMENT_TYPES: readonly DocumentTypeEnum[] = Object.values(DocumentTypeEnum);
