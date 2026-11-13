// Money formatting rules, in one place.
//
//   formatMoney(3326.46)                     "$3,326.46"   lists, totals, detail
//   formatMoney(3326.46, { cents: false })   "$3,326"      headline tiles
//   formatMoney(3326.46, { compact: true })  "$3.3k"       chart axes and tight chips only
//   formatMoney(-263, { sign: true })        "-$263.00"    changes; "+$263.00" when positive
//
// Compact form drops precision, so it is never used for an amount the user
// might act on.

export interface MoneyOptions {
  cents?: boolean;   // default true
  compact?: boolean; // default false
  sign?: boolean;    // prefix "+" for positive values; negatives always get "-"
}

export function formatMoney(amount: number, options: MoneyOptions = {}): string {
  const { cents = true, compact = false, sign = false } = options;
  const abs = Math.abs(amount);
  const prefix = amount < 0 ? '-' : sign && amount > 0 ? '+' : '';

  if (compact && abs >= 1000) {
    const k = abs / 1000;
    const text = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `${prefix}$${text}k`;
  }

  const digits = cents && !compact ? 2 : 0;
  return `${prefix}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "Nov 10" from "2026-11-10", without the timezone shift `new Date(iso)` causes. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
