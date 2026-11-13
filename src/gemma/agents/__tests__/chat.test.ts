import {
  analyticsRoute, buildChatMessages, buildFinancialContext, chatAgentStream, isAdviceQuestion, routeChat,
} from '../chat';
import { callChatModelStreaming, isAIAvailable } from '../../client';
import { Transaction } from '../../../types';

jest.mock('../../client', () => ({
  callChatModelStreaming: jest.fn(),
  isAIAvailable: jest.fn(() => true),
}));

const mockModel = callChatModelStreaming as jest.MockedFunction<typeof callChatModelStreaming>;
const mockAvailable = isAIAvailable as jest.MockedFunction<typeof isAIAvailable>;

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, date: '2026-01-10', amount: 10, description: 'X', merchant: 'X', category: 'Other',
  subcategory: null, is_subscription: false, is_recurring: false, type: 'debit', bank: 'chase', ...over,
});

const TXS: Transaction[] = [
  tx({ date: '2026-01-02', amount: 3000, type: 'credit', category: 'Income', merchant: 'Acme Payroll' }),
  tx({ date: '2026-01-03', amount: 15.49, category: 'Subscriptions', merchant: 'Netflix', is_subscription: true, is_recurring: true }),
  tx({ date: '2026-01-04', amount: 82.13, category: 'Food & Dining', merchant: "Trader Joe's" }),
  tx({ date: '2026-01-05', amount: 5.5, category: 'Food & Dining', merchant: 'Starbucks' }),
  tx({ date: '2026-01-06', amount: 1200, category: 'Bills & Utilities', merchant: 'Oakwood Apts' }),
];

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 0, 15), advanceTimers: true });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
beforeEach(() => { mockModel.mockReset(); mockAvailable.mockReturnValue(true); });

describe('analyticsRoute', () => {
  it('computes subscription answers from the data', () => {
    const answer = analyticsRoute('what subscriptions do I have?', TXS);
    expect(answer).toContain('Netflix');
    expect(answer).toContain('15.49');
  });
  it('answers an explicit overview request', () => {
    expect(analyticsRoute('give me an overview', TXS)).toContain('3000.00');
  });
  it('returns null when no intent matches', () => {
    expect(analyticsRoute('tell me something interesting about my habits', TXS)).toBeNull();
  });
});

describe('isAdviceQuestion', () => {
  it.each([
    'Should I cancel Netflix?',
    'How can I save $200 a month?',
    'Why am I always broke?',
    'Can I afford a $900 trip in March?',
    'Any tips for cutting my food bill?',
  ])('advice: %s', (q) => expect(isAdviceQuestion(q)).toBe(true));

  it.each([
    'How much did I spend at Starbucks?',
    'Show my last 5 transactions',
    'What subscriptions do I have?',
  ])('lookup: %s', (q) => expect(isAdviceQuestion(q)).toBe(false));
});

describe('routeChat', () => {
  it('answers lookups in code', () => {
    expect(routeChat('what subscriptions do I have?', TXS).kind).toBe('analytics');
  });
  it('sends advice to the model with computed figures as context', () => {
    const route = routeChat('Should I cancel Netflix?', TXS);
    expect(route.kind).toBe('model');
    if (route.kind !== 'model') return;
    expect(route.context).toContain('Netflix');
    expect(route.context).toContain('3000.00');
    expect(route.fallback).toContain('Netflix'); // the computed subscriptions answer
  });
  it('sends unmatched questions to the model, with the overview as fallback', () => {
    const route = routeChat('tell me something interesting about my habits', TXS);
    expect(route).toMatchObject({ kind: 'model' });
    if (route.kind === 'model') expect(route.fallback).toContain('Financial overview');
  });
});

describe('buildFinancialContext', () => {
  it('stays within the context budget for a large history', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      tx({ merchant: `Merchant ${i}`, category: 'Shopping', amount: i + 1, is_subscription: i % 3 === 0 }));
    expect(buildFinancialContext(many).length).toBeLessThanOrEqual(2800);
  });
});

describe('buildChatMessages', () => {
  it('puts the data in the system turn and the question last', () => {
    const msgs = buildChatMessages('Should I cancel Netflix?', 'CTX');
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('FINANCIAL DATA\nCTX');
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'Should I cancel Netflix?' });
  });
  it('keeps only the last four turns and trims long ones', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 ? 'assistant' as const : 'user' as const, content: `turn ${i} ` + 'x'.repeat(1000),
    }));
    const msgs = buildChatMessages('q', 'CTX', history);
    expect(msgs).toHaveLength(6); // system + 4 + question
    expect(msgs[1].content.startsWith('turn 2')).toBe(true);
    expect(msgs[1].content.length).toBe(400);
  });
});

describe('chatAgentStream', () => {
  const run = async (question: string) => {
    const tokens: string[] = [];
    const sources: string[] = [];
    const answer = await chatAgentStream(question, TXS, t => tokens.push(t), { onSource: s => sources.push(s) });
    return { answer, tokens, sources };
  };

  it('never calls the model for a lookup', async () => {
    const { answer, sources, tokens } = await run('what subscriptions do I have?');
    expect(mockModel).not.toHaveBeenCalled();
    expect(sources).toEqual(['analytics']);
    expect(tokens[tokens.length - 1]).toBe(answer);
  });

  it('streams the model answer for advice', async () => {
    mockModel.mockImplementation(async (_messages, onToken) => {
      onToken('Keep'); onToken('Keep Netflix.');
      return 'Keep Netflix.';
    });
    const { answer, sources, tokens } = await run('Should I cancel Netflix?');
    expect(answer).toBe('Keep Netflix.');
    expect(tokens).toEqual(['Keep', 'Keep Netflix.']);
    expect(sources).toEqual(['model']);
    expect(mockModel.mock.calls[0][0][0].content).toContain('Netflix'); // grounded prompt
  });

  it('falls back to the computed answer when the model throws', async () => {
    mockModel.mockRejectedValue(new Error('Model not loaded'));
    const { answer, sources } = await run('Should I cancel Netflix?');
    expect(answer).toContain('Netflix');
    expect(sources).toEqual(['analytics']);
  });

  it('falls back when the model returns nothing', async () => {
    mockModel.mockResolvedValue('   ');
    const { answer, sources } = await run('How can I save more?');
    expect(answer.length).toBeGreaterThan(20);
    expect(sources).toEqual(['analytics']);
  });

  it('answers from data alone when there is no native model (Expo Go)', async () => {
    mockAvailable.mockReturnValue(false);
    const { answer } = await run('Should I cancel Netflix?');
    expect(mockModel).not.toHaveBeenCalled();
    expect(answer).toContain('Netflix');
  });
});
