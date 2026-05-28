/**
 * Format a monetary value using Intl.NumberFormat.
 * Uses USD currency by default; locale and currency can be overridden.
 */
export function formatCurrency(
  value: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a plain numeric value using Intl.NumberFormat.
 * Adds thousand separators; no currency symbol.
 */
export function formatNumber(
  value: number,
  locale = "en-US",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}
