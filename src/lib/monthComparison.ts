// Fair month-over-month comparison.
//
// Comparing the 12 days of a month still in progress with all 31 days of the
// month before makes spending look "down 34%" when it is not. While the month
// is in progress, the baseline is the previous month through the same day.

export interface DatedAmount { date: string; amount: number } // date: YYYY-MM-DD

export interface MonthComparison {
  current: number;
  previous: number;
  /** Percent change from previous to current; 0 when there is no baseline. */
  changePct: number;
  /** True when `month` is still in progress and the baseline was cut to match. */
  partial: boolean;
}

export const previousMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sum = (rows: DatedAmount[]) => rows.reduce((s, r) => s + r.amount, 0);

export function compareWithPreviousMonth(
  debits: DatedAmount[],
  month: string,
  today: Date = new Date(),
): MonthComparison {
  const prev = previousMonth(month);
  const partial = month === monthKey(today);
  const throughDay = partial ? today.getDate() : 31;

  const current = sum(debits.filter(t => t.date.startsWith(month)));
  const previous = sum(debits.filter(t => t.date.startsWith(prev) && Number(t.date.slice(8, 10)) <= throughDay));
  const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { current, previous, changePct, partial };
}

/** "vs last month", or "vs same point last month" while the month is in progress. */
export const comparisonLabel = (c: Pick<MonthComparison, 'partial'>): string =>
  c.partial ? 'vs same point last month' : 'vs last month';

// ─── Two picked months ────────────────────────────────────────────────────────

export interface Change { from: number; to: number; delta: number; deltaPct: number }

/**
 * Change between two picked months, always measured from the earlier month to
 * the later one, whichever picker each is in. "Up" then always means spending
 * rose over time.
 */
export function chronologicalChange(amountA: number, amountB: number, monthA: string, monthB: string): Change {
  const [from, to] = monthA <= monthB ? [amountA, amountB] : [amountB, amountA];
  const delta = to - from;
  const deltaPct = from > 0 ? (delta / from) * 100 : to > 0 ? 100 : 0;
  return { from, to, delta, deltaPct };
}
