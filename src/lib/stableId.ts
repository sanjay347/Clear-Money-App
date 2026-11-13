// Deterministic transaction IDs, so importing the same statement twice (or two
// overlapping statements) updates rows instead of duplicating them.

/** djb2-xor hash of date + description + amount, base36-encoded. */
export function stableId(date: string, description: string, amount: number): string {
  const key = `${date}_${description}_${amount.toFixed(2)}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h >>>= 0;
  }
  return `tx_${h.toString(36)}`;
}
