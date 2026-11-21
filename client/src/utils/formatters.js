/**
 * Currency (INR / ₹) and Reward Coin display formatters for VP52.
 *
 * Business Rule:
 * - Real-world financial amounts (product prices, bills, orders, payments, refunds,
 *   membership fees, promotional max discounts) MUST display clear INR / ₹ formatting.
 * - Reward coin balances, rewards, deductions, and transfers MUST stay strictly coin-based
 *   with zero ₹ / rupee equivalents displayed alongside coin figures.
 */

function toSafeNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a numeric count or coin quantity using the active Indian locale
 * (en-IN, hi-IN, mr-IN) with Indian digit grouping (e.g., 1,50,000).
 */
export function formatNumber(value, locale = 'en-IN', options = {}) {
  const num = toSafeNumber(value);
  const resolvedLocale = locale || 'en-IN';
  try {
    return new Intl.NumberFormat(resolvedLocale, options).format(num);
  } catch {
    return new Intl.NumberFormat('en-IN', options).format(num);
  }
}

/**
 * Formats a genuine Indian Rupee (INR) financial amount with the ₹ symbol
 * and Indian digit grouping (e.g., ₹280, ₹1,50,000, ₹1,250.50, -₹250).
 */
export function formatInr(amount, locale = 'en-IN', options = {}) {
  const num = toSafeNumber(amount);
  const absNum = Math.abs(num);
  const hasFraction = Math.round((absNum % 1) * 100) !== 0;

  const { decimals, ...intlOptions } = options || {};
  const minFraction = decimals !== undefined ? decimals : (hasFraction ? 2 : 0);
  const maxFraction = decimals !== undefined ? decimals : (hasFraction ? 2 : 0);

  const formattedAbs = formatNumber(absNum, locale, {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
    ...intlOptions,
  });

  return num < 0 ? `-₹${formattedAbs}` : `₹${formattedAbs}`;
}

/**
 * Formats a VP52 Coin quantity strictly as coins (NEVER includes ₹ or INR).
 */
export function formatCoins(amount, locale = 'en-IN', coinLabel = 'Coins', options = {}) {
  const num = toSafeNumber(amount);
  const { signed = false, decimals, ...intlOptions } = options || {};

  const absFormatted = formatNumber(Math.abs(num), locale, {
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: decimals !== undefined ? decimals : 2,
    ...intlOptions,
  });

  let prefix = '';
  if (num < 0) {
    prefix = '-';
  } else if (signed && num >= 0) {
    prefix = '+';
  }

  const label = coinLabel ? ` ${coinLabel}` : '';
  return `${prefix}${absFormatted}${label}`;
}
