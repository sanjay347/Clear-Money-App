// Shared types and utilities for all bank parsers.
// Kept in a separate file so each parser can import from here
// without creating a cycle through index.ts.

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  merchant_clean: string;
}

/** Collapses runs of whitespace left over from PDF column spacing. */
export const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const cleanMerchantName = (description: string): string => {
  let clean = tidy(description).toUpperCase();

  // Debit-card lines wrap the merchant in boilerplate:
  //   "CARD PURCHASE WITH PIN 03/14 DOLLAR-GENERAL # DG 02 NORMAN OK CARD 9433"
  // Strip it so the rules and the model see "DOLLAR-GENERAL # DG 02 NORMAN OK".
  clean = clean.replace(/^(RECURRING\s+)?CARD PURCHASE( WITH PIN| RETURN)?\s+(\d{2}\/\d{2}\s+)?/, '');
  clean = clean.replace(/\s+CARD(\s+\d{4})?$/, '');

  const prefixes = [
    'SQ *', 'SQ*', 'TST*', 'POS ', 'ACH ',
    'PURCHASE AUTHORIZED ON ', 'ZELLE TO ', 'VENMO*',
    'CHECKCARD ', 'DEBIT CARD ', 'ONLINE TRANSFER TO ',
    'ZELLE PAYMENT TO ', 'ZELLE PAYMENT FROM ',
  ];
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix)) {
      clean = clean.substring(prefix.length);
      break;
    }
  }

  // Wells Fargo puts the purchase date first: "PURCHASE AUTHORIZED ON 01/14 CHIPOTLE"
  clean = clean.replace(/^\d{2}\/\d{2}\s+/, '');

  // Remove trailing state+zip, trailing numbers, and reference codes
  clean = clean.replace(/\s+\w{2}\s+\d{5}(-\d{4})?$/, '');
  clean = clean.replace(/\s+#?\d{4,}$/, '');
  clean = clean.replace(/\s+\d{2}\/\d{2}$/, ''); // trailing date
  clean = clean.replace(/\s{2,}/g, ' ');

  return clean.trim();
};

/**
 * Picks the year for a statement line that only gives month and day.
 * Statements describe the past, so a date that would land more than a few days
 * in the future (a December line imported in January) belongs to last year.
 */
export const inferYear = (month: number, day: number, today: Date = new Date()): number => {
  const year = today.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const GRACE_MS = 7 * 86_400_000; // pending transactions can post a few days ahead
  return candidate.getTime() - today.getTime() > GRACE_MS ? year - 1 : year;
};
