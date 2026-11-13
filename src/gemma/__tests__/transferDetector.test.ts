import { detectInternalTransfers } from '../transferDetector';
import { Transaction } from '../../types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', date: '2026-01-10', amount: 500, description: 'ONLINE TRANSFER', merchant: 'ONLINE TRANSFER',
  category: 'Other', subcategory: null, is_subscription: false, is_recurring: false,
  type: 'debit', bank: 'chase', ...over,
});

describe('detectInternalTransfers', () => {
  it('pairs a debit in one bank with a matching credit in another', () => {
    const out = detectInternalTransfers([
      tx({ id: 'a', type: 'debit', bank: 'chase' }),
      tx({ id: 'b', type: 'credit', bank: 'bofa', date: '2026-01-12' }),
    ]);
    expect(out.find(t => t.id === 'a')).toMatchObject({ category: 'Transfer', merchant: 'Transfer to bofa' });
    expect(out.find(t => t.id === 'b')).toMatchObject({ category: 'Transfer', merchant: 'Transfer from chase' });
  });

  it('tolerates a one-cent difference', () => {
    const out = detectInternalTransfers([
      tx({ id: 'a', amount: 500 }),
      tx({ id: 'b', type: 'credit', bank: 'bofa', amount: 500.01 }),
    ]);
    expect(out.every(t => t.category === 'Transfer')).toBe(true);
  });

  it.each([
    ['more than three days apart', { date: '2026-01-14' }],
    ['a different amount', { amount: 499 }],
    ['the same bank', { bank: 'chase' }],
  ])('does not pair transactions with %s', (_label, over) => {
    const out = detectInternalTransfers([
      tx({ id: 'a' }),
      tx({ id: 'b', type: 'credit', bank: 'bofa', ...over }),
      tx({ id: 'c', type: 'credit', bank: 'citi', amount: 1 }), // keeps two banks present
    ]);
    expect(out.find(t => t.id === 'a')!.category).toBe('Other');
  });

  it('uses each transaction in at most one pair', () => {
    const out = detectInternalTransfers([
      tx({ id: 'a' }),
      tx({ id: 'b', type: 'credit', bank: 'bofa' }),
      tx({ id: 'c', type: 'credit', bank: 'citi' }),
    ]);
    expect(out.filter(t => t.category === 'Transfer').map(t => t.id)).toEqual(['a', 'b']);
  });

  it('does not mutate its input', () => {
    const input = [tx({ id: 'a' }), tx({ id: 'b', type: 'credit', bank: 'bofa' })];
    detectInternalTransfers(input);
    expect(input[0].category).toBe('Other');
  });
});
