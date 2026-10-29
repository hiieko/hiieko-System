/** Parse API numeric fields that may arrive as JSON strings (Prisma Decimal). */
export function toStockNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The existing stock rule: a balance at or below its configured minimum is low. */
export function isAtOrBelowMinStock(quantity: unknown, threshold: unknown): boolean {
  const currentQuantity = toStockNumber(quantity);
  const minimum = toStockNumber(threshold);

  return currentQuantity !== null && minimum !== null && currentQuantity <= minimum;
}

export function hasStockThreshold(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
}

export function formatStockNumber(value: unknown, locale: string): string {
  const number = toStockNumber(value);
  if (number === null) return '—';

  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'ro-RO', {
    maximumFractionDigits: 3,
  }).format(number);
}
