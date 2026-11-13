import { formatDay, formatMoney } from '../format';
import { categoryStyle } from '../categories';

describe('formatMoney', () => {
  it('shows cents and thousands separators by default', () => {
    expect(formatMoney(3326.46)).toBe('$3,326.46');
    expect(formatMoney(5)).toBe('$5.00');
    expect(formatMoney(0)).toBe('$0.00');
  });
  it('drops cents for headline figures', () => {
    expect(formatMoney(3326.46, { cents: false })).toBe('$3,326');
  });
  it('compacts thousands only when asked', () => {
    expect(formatMoney(3326.46, { compact: true })).toBe('$3.3k');
    expect(formatMoney(5000, { compact: true })).toBe('$5k');
    expect(formatMoney(125000, { compact: true })).toBe('$125k');
    expect(formatMoney(874, { compact: true })).toBe('$874');
  });
  it('puts the minus sign before the dollar sign', () => {
    expect(formatMoney(-263)).toBe('-$263.00');
  });
  it('adds a plus sign to positive changes when asked', () => {
    expect(formatMoney(263, { sign: true, cents: false })).toBe('+$263');
    expect(formatMoney(-263, { sign: true, cents: false })).toBe('-$263');
    expect(formatMoney(0, { sign: true })).toBe('$0.00');
  });
});

describe('formatDay', () => {
  it('formats without shifting the day across timezones', () => {
    expect(formatDay('2026-11-01')).toBe('Nov 1');
    expect(formatDay('2026-01-31')).toBe('Jan 31');
  });
});

describe('categoryStyle', () => {
  it('gives every known category its own colour', () => {
    const cats = ['Food & Dining', 'Shopping', 'Subscriptions', 'Transportation', 'Bills & Utilities', 'Entertainment', 'Health & Fitness', 'Travel', 'Income', 'Transfer'];
    expect(new Set(cats.map(c => categoryStyle(c).color)).size).toBe(cats.length);
  });
  it('falls back for unknown categories', () => {
    expect(categoryStyle('Other')).toBe(categoryStyle('Something new'));
  });
});

describe('displayMerchant', () => {
  const { displayMerchant } = require('../format');
  it.each([
    ['DOLLAR-GENERAL # DG 02 NORMAN OK', 'Dollar-General # Dg 02 Norman Ok'],
    ['Zelle   Payment   From   Sanjay', 'Zelle Payment From Sanjay'],
    ['Trader Joe\'s', 'Trader Joe\'s'],
    ['IONOS INC.', 'Ionos Inc.'],
  ])('%s → %s', (raw: string, expected: string) => {
    expect(displayMerchant(raw)).toBe(expected);
  });
});
