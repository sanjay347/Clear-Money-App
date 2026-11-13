import { stableId } from '../stableId';

describe('stableId', () => {
  it('is deterministic for the same transaction', () => {
    expect(stableId('2026-01-15', 'STARBUCKS #123', 5.5)).toBe(stableId('2026-01-15', 'STARBUCKS #123', 5.5));
  });

  it('changes when date, description or amount changes', () => {
    const base = stableId('2026-01-15', 'STARBUCKS #123', 5.5);
    expect(stableId('2026-01-16', 'STARBUCKS #123', 5.5)).not.toBe(base);
    expect(stableId('2026-01-15', 'STARBUCKS #124', 5.5)).not.toBe(base);
    expect(stableId('2026-01-15', 'STARBUCKS #123', 5.51)).not.toBe(base);
  });

  it('treats amounts equal to the cent as the same', () => {
    expect(stableId('2026-01-15', 'X', 5.5)).toBe(stableId('2026-01-15', 'X', 5.5000001));
  });
});
