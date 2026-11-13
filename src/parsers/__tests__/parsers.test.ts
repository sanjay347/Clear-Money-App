import { parseChaseStatement } from '../chase';
import { parseBofaStatement } from '../bofa';
import { parseWellsFargoStatement } from '../wellsfargo';
import { parseCitiStatement } from '../citi';
import { cleanMerchantName, inferYear } from '../shared';

// Parsers log a summary line; keep test output quiet.
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

const TODAY = new Date(2026, 0, 10); // 10 Jan 2026

describe('inferYear', () => {
  it('uses the current year for dates that have already happened', () => {
    expect(inferYear(1, 5, TODAY)).toBe(2026);
  });
  it('uses last year for a December line imported in January', () => {
    expect(inferYear(12, 28, TODAY)).toBe(2025);
  });
  it('allows a few days ahead for pending transactions', () => {
    expect(inferYear(1, 14, TODAY)).toBe(2026);
  });
});

describe('cleanMerchantName', () => {
  it.each([
    ['SQ *BLUE BOTTLE COFFEE', 'BLUE BOTTLE COFFEE'],
    ['TST* THE LEMON TREE 00012345', 'THE LEMON TREE'],
    ['STARBUCKS #12345', 'STARBUCKS'],
    ['STARBUCKS STORE 1234 SEATTLE WA 98101', 'STARBUCKS STORE 1234 SEATTLE'],
    ['PURCHASE AUTHORIZED ON 01/14 CHIPOTLE 1234', 'CHIPOTLE'],
    ['zelle to john smith', 'JOHN SMITH'],
  ])('%s → %s', (raw, expected) => {
    expect(cleanMerchantName(raw)).toBe(expected);
  });
});

describe('parseChaseStatement', () => {
  const text = [
    'Date  Description  Amount  Balance',
    '01/05  STARBUCKS #12345   -5.50   1,229.06',
    '01/06  DIRECT DEPOSIT ACME CORP   2,500.00   3,729.06',
    '01/07  ATM CASH   60.00-',
    '12/28  NETFLIX.COM   -15.49   1,234.56',
    '01/08 TARGET 00012345 -45.67',
    '01/05  STARBUCKS #12345   -5.50   1,229.06',
    '01/09  Ending Balance   1,000.00',
    'Page 1 of 4',
  ].join('\n');
  const txs = parseChaseStatement(text, TODAY);

  it('extracts each transaction line once and skips headers and summaries', () => {
    expect(txs.map(t => t.description)).toEqual([
      'STARBUCKS #12345', 'DIRECT DEPOSIT ACME CORP', 'ATM CASH', 'NETFLIX.COM', 'TARGET 00012345',
    ]);
  });
  it('reads negative and trailing-minus amounts as debits', () => {
    expect(txs[0]).toMatchObject({ date: '2026-01-05', amount: 5.5, type: 'debit', merchant_clean: 'STARBUCKS' });
    expect(txs[2]).toMatchObject({ amount: 60, type: 'debit' });
  });
  it('reads positive amounts as credits and strips thousands separators', () => {
    expect(txs[1]).toMatchObject({ amount: 2500, type: 'credit' });
  });
  it('dates a December line in the previous year', () => {
    expect(txs[3].date).toBe('2025-12-28');
  });
  it('falls back to single-space columns', () => {
    expect(txs[4]).toMatchObject({ date: '2026-01-08', amount: 45.67, type: 'debit' });
  });
  it('returns an empty list for text with no transactions', () => {
    expect(parseChaseStatement('Thank you for banking with us', TODAY)).toEqual([]);
  });
});

describe('parseBofaStatement', () => {
  it('parses the checking layout, where debits are negative', () => {
    const txs = parseBofaStatement("01/05/26  CHECKCARD 0104 TRADER JOE'S   -82.13   1,917.87", TODAY);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ date: '2026-01-05', amount: 82.13, type: 'debit' });
  });
  it('parses the credit card layout, where charges are positive and the posting date is used', () => {
    const txs = parseBofaStatement(['01/04 01/05 AMAZON MKTPL*2X4Y 34.99', '01/06 01/07 ONLINE REFUND AMZN -12.00'].join('\n'), TODAY);
    expect(txs[0]).toMatchObject({ date: '2026-01-05', amount: 34.99, type: 'debit' });
    expect(txs[1]).toMatchObject({ date: '2026-01-07', amount: 12, type: 'credit' });
  });
});

describe('parseWellsFargoStatement', () => {
  it('parses lines with a full date', () => {
    const txs = parseWellsFargoStatement('1/5/2026  PURCHASE AUTHORIZED ON 01/04 CHIPOTLE 1234   -12.85   500.00', TODAY);
    expect(txs[0]).toMatchObject({ date: '2026-01-05', amount: 12.85, type: 'debit', merchant_clean: 'CHIPOTLE' });
  });
  it('infers the year for lines without one', () => {
    const txs = parseWellsFargoStatement(['1/6  SHELL OIL 5744   -40.00', '12/30  PAYROLL ACME   1,800.00'].join('\n'), TODAY);
    expect(txs.map(t => t.date)).toEqual(['2026-01-06', '2025-12-30']);
    expect(txs[1].type).toBe('credit');
  });
});

describe('parseCitiStatement', () => {
  const txs = parseCitiStatement([
    '01/04/2026 01/05/2026 UBER *TRIP HELP.UBER.COM $23.45',
    '01/08/2026 01/08/2026 ONLINE PAYMENT, THANK YOU -$200.00',
    '01/09/2026  WHOLEFDS MKT 10234  $61.20',
  ].join('\n'));

  it('treats charges as debits', () => {
    expect(txs[0]).toMatchObject({ date: '2026-01-04', amount: 23.45, type: 'debit' });
  });
  it('treats payments written as -$200.00 as credits', () => {
    expect(txs[1]).toMatchObject({ amount: 200, type: 'credit' });
  });
  it('parses the single-date layout', () => {
    expect(txs[2]).toMatchObject({ date: '2026-01-09', amount: 61.2, type: 'debit' });
  });
});

describe('Chase debit-card statement lines', () => {
  it('reads "- 10.00" as the amount, not the running balance after it', () => {
    const [tx] = parseChaseStatement('03/16  Card Purchase 03/16 Csc Serviceworks, Inc. Plainview NY Card 9433  - 10.00  548.81', TODAY);
    expect(tx).toMatchObject({ amount: 10, type: 'debit' });
  });

  it('collapses PDF column spacing inside a description', () => {
    const [tx] = parseChaseStatement('03/09  Zelle Payment  From   Sanjay Kotturi Wfct0Zwg3T88   884.83   1,200.00', TODAY);
    expect(tx.description).toBe('Zelle Payment From Sanjay Kotturi Wfct0Zwg3T88');
    expect(tx.type).toBe('credit');
  });

  it.each([
    ['CARD PURCHASE WITH PIN 03/14 DOLLAR-GENERAL # DG 02 NORMAN OK CARD', 'DOLLAR-GENERAL # DG 02 NORMAN OK'],
    ['Card Purchase 03/15 Ionos Inc. Rvk1773270 Philadelphia PA Card 9433', 'IONOS INC. RVK1773270 PHILADELPHIA PA'],
    ['CARD PURCHASE 03/08 7196 GREAT CLIPS AT EAS NORMAN OK CARD', '7196 GREAT CLIPS AT EAS NORMAN OK'],
    ['Recurring Card Purchase 03/02 Netflix.Com Card 9433', 'NETFLIX.COM'],
  ])('strips card-purchase boilerplate: %s', (raw, expected) => {
    expect(cleanMerchantName(raw)).toBe(expected);
  });
});
