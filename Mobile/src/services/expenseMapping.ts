import { ExpenseCategory, PaymentMethod } from '@solar/shared';

/**
 * Maps the HIIEKO shared/mobile vocabulary onto the PostgreSQL enum values used
 * by the NestJS API (Prisma ExpenseCategoryEnum / PaymentMethodEnum).
 *
 * The mobile UI keeps the legacy lowercase labels while the backend stores the
 * canonical enum values. Sending an unmapped value fails the Prisma write, so
 * every expense submit path must go through these helpers.
 */

export type BackendExpenseCategory =
  | 'MATERIALS_EMERGENCY'
  | 'FUEL'
  | 'TOOLS_CONSUMABLES'
  | 'TRANSPORT_LOGISTICS'
  | 'SUBSISTENCE_ACCOMMODATION'
  | 'SAFETY_EQUIPMENT'
  | 'EQUIPMENT_RENTAL'
  | 'SERVICES_SUBCONTRACTORS'
  | 'OTHER';

export type BackendPaymentMethod =
  | 'CASH'
  | 'COMPANY_CARD'
  | 'PERSONAL_CARD'
  | 'BANK_TRANSFER'
  | 'OTHER';

const CATEGORY_MAP: Record<string, BackendExpenseCategory> = {
  fuel: 'FUEL',
  accommodation: 'SUBSISTENCE_ACCOMMODATION',
  food: 'SUBSISTENCE_ACCOMMODATION',
  transport: 'TRANSPORT_LOGISTICS',
  parking: 'TRANSPORT_LOGISTICS',
  tolls: 'TRANSPORT_LOGISTICS',
  materials: 'MATERIALS_EMERGENCY',
  tools: 'TOOLS_CONSUMABLES',
  equipment: 'EQUIPMENT_RENTAL',
  phone_internet: 'SERVICES_SUBCONTRACTORS',
  other: 'OTHER',
};

const PAYMENT_MAP: Record<string, BackendPaymentMethod> = {
  personal: 'PERSONAL_CARD',
  company_card: 'COMPANY_CARD',
  company_cash: 'CASH',
  other: 'OTHER',
};

const CATEGORY_VALUES = Object.values(CATEGORY_MAP) as string[];
const PAYMENT_VALUES = Object.values(PAYMENT_MAP) as string[];

/**
 * Legacy/UI category -> Prisma ExpenseCategoryEnum.
 * Values that are already canonical (e.g. replayed from an offline queue) pass
 * through unchanged.
 */
export function toBackendExpenseCategory(
  category?: ExpenseCategory | string | null
): BackendExpenseCategory {
  if (!category) return 'OTHER';
  const upper = String(category).toUpperCase();
  if (CATEGORY_VALUES.includes(upper)) return upper as BackendExpenseCategory;
  return CATEGORY_MAP[String(category).toLowerCase()] || 'OTHER';
}

/**
 * Legacy/UI payment method -> Prisma PaymentMethodEnum.
 * Defaults to COMPANY_CARD, matching the backend column default.
 */
export function toBackendPaymentMethod(
  method?: PaymentMethod | string | null
): BackendPaymentMethod {
  if (!method) return 'COMPANY_CARD';
  const upper = String(method).toUpperCase();
  if (PAYMENT_VALUES.includes(upper)) return upper as BackendPaymentMethod;
  return PAYMENT_MAP[String(method).toLowerCase()] || 'OTHER';
}
