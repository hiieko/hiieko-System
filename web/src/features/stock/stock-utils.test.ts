import { formatStockNumber, hasStockThreshold, isAtOrBelowMinStock, toStockNumber } from './stock-utils';

describe('stock number handling', () => {
  it('normalizes Prisma Decimal values serialized as strings', () => {
    const response = JSON.parse(JSON.stringify({ min_stock_threshold: '12.500' }));

    expect(toStockNumber(response.min_stock_threshold)).toBe(12.5);
    expect(isAtOrBelowMinStock('12.500', response.min_stock_threshold)).toBe(true);
    expect(isAtOrBelowMinStock('12.501', response.min_stock_threshold)).toBe(false);
  });

  it('accepts numeric values and treats equality as at minimum', () => {
    expect(isAtOrBelowMinStock(5, 5)).toBe(true);
    expect(isAtOrBelowMinStock(5.01, 5)).toBe(false);
    expect(isAtOrBelowMinStock('0.000', '0.000')).toBe(true);
    expect(isAtOrBelowMinStock('0.001', '0')).toBe(false);
  });

  it('does not invent a threshold for null, empty, or invalid values', () => {
    expect(isAtOrBelowMinStock(0, null)).toBe(false);
    expect(isAtOrBelowMinStock(0, '')).toBe(false);
    expect(isAtOrBelowMinStock(0, 'not-a-number')).toBe(false);
    expect(toStockNumber(Number.NaN)).toBeNull();
    expect(hasStockThreshold(null)).toBe(false);
    expect(hasStockThreshold('')).toBe(false);
    expect(hasStockThreshold('not-a-number')).toBe(true);
  });

  it('formats valid stock numbers and uses an em dash for invalid values', () => {
    expect(formatStockNumber('1.250', 'en')).toBe('1.25');
    expect(formatStockNumber(null, 'en')).toBe('—');
  });
});
