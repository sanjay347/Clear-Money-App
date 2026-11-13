import { chronologicalChange, compareWithPreviousMonth, comparisonLabel, previousMonth } from '../monthComparison';

const days = (month: string, perDay: number, through: number) =>
  Array.from({ length: through }, (_, i) => ({ date: `${month}-${String(i + 1).padStart(2, '0')}`, amount: perDay }));

describe('previousMonth', () => {
  it('steps back within a year and across January', () => {
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('compareWithPreviousMonth', () => {
  // $100 a day in both months: spending is flat.
  const flat = [...days('2026-10', 100, 31), ...days('2026-11', 100, 12)];

  it('compares a month in progress with the same days of the month before', () => {
    const c = compareWithPreviousMonth(flat, '2026-11', new Date(2026, 10, 12));
    expect(c).toMatchObject({ current: 1200, previous: 1200, changePct: 0, partial: true });
    expect(comparisonLabel(c)).toBe('vs same point last month');
  });

  it('compares full months once the month is over', () => {
    const c = compareWithPreviousMonth(flat, '2026-10', new Date(2026, 10, 12));
    expect(c).toMatchObject({ current: 3100, previous: 0, partial: false });
    expect(comparisonLabel(c)).toBe('vs last month');
  });

  it('reports a real increase', () => {
    const txs = [...days('2026-10', 100, 31), ...days('2026-11', 150, 12)];
    expect(compareWithPreviousMonth(txs, '2026-11', new Date(2026, 10, 12)).changePct).toBeCloseTo(50);
  });

  it('returns 0% when there is no previous month to compare with', () => {
    expect(compareWithPreviousMonth(days('2026-11', 100, 5), '2026-11', new Date(2026, 10, 5)).changePct).toBe(0);
  });
});

describe('chronologicalChange', () => {
  it('measures from the earlier month to the later one, whichever picker holds it', () => {
    // November $719, October $982: spending fell by $263.
    expect(chronologicalChange(719, 982, '2026-11', '2026-10')).toMatchObject({ from: 982, to: 719, delta: -263 });
    expect(chronologicalChange(982, 719, '2026-10', '2026-11')).toMatchObject({ from: 982, to: 719, delta: -263 });
  });
  it('treats a category that appears from nothing as a 100% rise', () => {
    expect(chronologicalChange(50, 0, '2026-11', '2026-10').deltaPct).toBe(100);
  });
});
