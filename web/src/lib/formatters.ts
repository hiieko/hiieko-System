/**
 * HIIEKO — Shared formatters for the Web frontend
 *
 * Centralises formatting logic so every page uses consistent display:
 * - Decimal / currency amounts (Prisma Decimal → string → number)
 * - User / profile display names
 * - Dates and times
 * - Enum values → human-readable labels
 */

import { t, Locale } from '@solar/shared';

// ── Decimal / Currency ──────────────────────────────────────────────

/**
 * Safely format a Prisma Decimal value (which arrives as a string like "123.45")
 * or a number into a fixed-decimal string.
 *
 * `toFixed` on a string crashes — this always works.
 */
export function formatDecimal(
  value: string | number | null | undefined,
  decimals = 2,
): string {
  if (value == null) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toFixed(decimals);
}

/**
 * Format a monetary amount with currency suffix.
 */
export function formatCurrency(
  value: string | number | null | undefined,
  currency = 'RON',
  decimals = 2,
): string {
  return `${formatDecimal(value, decimals)} ${currency}`;
}

// ── Display Name ────────────────────────────────────────────────────

/**
 * Get the best available display name from a user-like object.
 * Handles both `profile.full_name` (backend) and `fullName` (JWT / frontend).
 */
export function displayName(
  user:
    | { profile?: { full_name?: string | null } | null; fullName?: string | null; email?: string | null }
    | null
    | undefined,
): string {
  if (!user) return '—';
  return user.profile?.full_name || user.fullName || user.email || '—';
}

// ── Date / Time ──────────────────────────────────────────────────────

/**
 * Format a date for display in the current locale.
 */
export function formatDate(
  date: string | Date | null | undefined,
  locale: Locale = 'ro',
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a datetime for display (date + time).
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  locale: Locale = 'ro',
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format hours for attendance display.
 * If value is already in hours (regular_hours), use directly.
 * If value is in minutes (overtime_minutes), divide by 60.
 */
export function formatHours(
  hours: number | null | undefined,
): string {
  if (hours == null) return '0';
  return hours.toFixed(1);
}

/**
 * Format overtime minutes to hours.
 */
export function formatOvertime(
  minutes: number | null | undefined,
): string {
  if (minutes == null) return '0';
  return (minutes / 60).toFixed(1);
}

// ── Enum Labels ─────────────────────────────────────────────────────

/**
 * Human-readable labels for ExpenseStatusEnum (backend UPPERCASE).
 */
export const EXPENSE_STATUS_LABELS: Record<string, { ro: string; en: string }> = {
  DRAFT: { ro: 'Ciornă', en: 'Draft' },
  SUBMITTED: { ro: 'Trimisă', en: 'Submitted' },
  UNDER_REVIEW: { ro: 'În Analiză', en: 'Under Review' },
  APPROVED: { ro: 'Aprobată', en: 'Approved' },
  REJECTED: { ro: 'Respinsă', en: 'Rejected' },
  REIMBURSED: { ro: 'Rambursată', en: 'Reimbursed' },
  CANCELLED: { ro: 'Anulată', en: 'Cancelled' },
};

/**
 * Human-readable labels for ExpenseCategoryEnum (backend UPPERCASE).
 */
export const EXPENSE_CATEGORY_LABELS: Record<string, { ro: string; en: string }> = {
  MATERIALS_EMERGENCY: { ro: 'Materiale Urgență', en: 'Emergency Materials' },
  FUEL: { ro: 'Combustibil', en: 'Fuel' },
  TOOLS_CONSUMABLES: { ro: 'Scule/Consumabile', en: 'Tools & Consumables' },
  TRANSPORT_LOGISTICS: { ro: 'Transport/Logistică', en: 'Transport & Logistics' },
  SUBSISTENCE_ACCOMMODATION: { ro: 'Masă/Cazare', en: 'Subsistence & Accommodation' },
  SAFETY_EQUIPMENT: { ro: 'Echipament Protecție', en: 'Safety Equipment' },
  EQUIPMENT_RENTAL: { ro: 'Închiriere Echipamente', en: 'Equipment Rental' },
  SERVICES_SUBCONTRACTORS: { ro: 'Servicii/Subcontractori', en: 'Services & Subcontractors' },
  OTHER: { ro: 'Altele', en: 'Other' },
};

/**
 * Human-readable labels for PaymentMethodEnum (backend UPPERCASE).
 */
export const PAYMENT_METHOD_LABELS: Record<string, { ro: string; en: string }> = {
  CASH: { ro: 'Numerar', en: 'Cash' },
  COMPANY_CARD: { ro: 'Card Firmă', en: 'Company Card' },
  PERSONAL_CARD: { ro: 'Card Personal', en: 'Personal Card' },
  BANK_TRANSFER: { ro: 'Transfer Bancar', en: 'Bank Transfer' },
  OTHER: { ro: 'Altele', en: 'Other' },
};

/**
 * Get the human-readable label for an expense status.
 */
export function enumLabel(
  value: string | null | undefined,
  labels: Record<string, { ro: string; en: string }>,
  locale: Locale = 'ro',
): string {
  if (!value) return '—';
  const entry = labels[value.toUpperCase()];
  if (!entry) return value; // fallback to raw value
  return entry[locale] ?? entry.ro ?? value;
}

/**
 * Status badge colour map for expense statuses (backend UPPERCASE).
 */
export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  REIMBURSED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-200 text-slate-600',
};
