import { tryRuleCategorize } from '../rules';

describe('tryRuleCategorize', () => {
  it.each([
    ['NETFLIX.COM', 'Subscriptions', 'Netflix'],
    ['TST* BLUE BOTTLE COFFEE', 'Food & Dining', 'BLUE BOTTLE COFFEE'],
    ['UBER *TRIP HELP.UBER.COM', 'Transportation', 'Uber'],
    ['UBER EATS PENDING', 'Food & Dining', 'Uber Eats'],
    ['AMAZON MKTPL*2X4Y', 'Shopping', 'Amazon'],
    ['AMAZON PRIME*1A2B3', 'Subscriptions', 'Amazon Prime'],
    ['SHELL OIL 57444', 'Transportation', 'SHELL OIL'],
    ['DELTA AIR 0062345678', 'Travel', 'DELTA AIR'],
    ['HBO MAX', 'Subscriptions', 'HBO Max'],
    ['STEAMGAMES.COM 4259522', 'Entertainment', 'STEAMGAMES.COM'],
    ['ENTERPRISE RENT-A-CAR', 'Travel', 'ENTERPRISE RENT-A-CAR'],
    ['RENT PAYMENT OAKWOOD APTS', 'Bills & Utilities', 'RENT PAYMENT OAKWOOD APTS'],
    ['CON EDISON BILL PAYMENT', 'Bills & Utilities', 'CON EDISON BILL PAYMENT'],
  ])('%s → %s', (description, category, merchant) => {
    expect(tryRuleCategorize(description)).toMatchObject({ category, merchant_clean: merchant });
  });

  it('flags known subscriptions as recurring', () => {
    expect(tryRuleCategorize('SPOTIFY USA')).toMatchObject({ is_subscription: true, is_recurring: true });
    expect(tryRuleCategorize('STARBUCKS #123')).toMatchObject({ is_subscription: false, is_recurring: false });
  });

  // Each of these was mis-filed by a substring match before word boundaries were added.
  it.each([
    ['FISHBONE SEAFOOD GRILL', 'hbo'],
    ['ROADPASS TOLL SERVICES', 'adp'],
    ['GERALDINES KITCHEN', 'aldi'],
    ['SINGAPORE NOODLE HOUSE', 'gap'],
    ['BARTACO RESTAURANT', 'bart'],
    ['SHELLFISH MARKET', 'shell'],
    ['DELTA DENTAL PREMIUM', 'delta'],
    ['LAZARAS BAKERY', 'zara'],
    ['PARENT TEACHER ASSOC', 'rent'],
  ])('does not match %s on the fragment "%s"', (description) => {
    expect(tryRuleCategorize(description)).toBeNull();
  });

  it('leaves Square merchants to the model', () => {
    expect(tryRuleCategorize('SQ *THE LEMON TREE')).toBeNull();
  });

  it('returns null for unknown merchants', () => {
    expect(tryRuleCategorize('XYZ HOLDINGS LLC 8842')).toBeNull();
  });

  describe('income rules', () => {
    it('apply to credits', () => {
      expect(tryRuleCategorize('GUSTO PAY 123456', 'credit')).toMatchObject({ category: 'Income' });
      expect(tryRuleCategorize('ACME CORP PAYROLL', 'credit')).toMatchObject({ category: 'Income', is_recurring: true });
    });
    it('do not apply to debits', () => {
      expect(tryRuleCategorize('GUSTO PIZZA CO', 'debit')).toBeNull();
    });
    it('still apply when the type is unknown', () => {
      expect(tryRuleCategorize('DIRECT DEPOSIT ACME')).toMatchObject({ category: 'Income' });
    });
  });
});
