import { batchCategorize, normalizeModelItem, parseBatchResponse } from '../batchCategorizer';
import { callLocalModel, isAIAvailable } from '../client';

jest.mock('../client', () => ({
  callLocalModel: jest.fn(),
  isAIAvailable: jest.fn(() => true),
}));

const mockModel = callLocalModel as jest.MockedFunction<typeof callLocalModel>;
const mockAvailable = isAIAvailable as jest.MockedFunction<typeof isAIAvailable>;

const item = (category: string, merchant = 'M') =>
  ({ category, merchant_clean: merchant, is_subscription: false, is_recurring: false });

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
beforeEach(() => { mockModel.mockReset(); mockAvailable.mockReturnValue(true); });

describe('normalizeModelItem', () => {
  it('keeps a valid category and fixes its casing', () => {
    expect(normalizeModelItem(item('food & dining'))!.category).toBe('Food & Dining');
  });
  it('maps an invented category to Other', () => {
    expect(normalizeModelItem(item('Groceries'))!.category).toBe('Other');
  });
  it('only accepts real booleans for the flags', () => {
    expect(normalizeModelItem({ category: 'Shopping', is_subscription: 'false', is_recurring: 1 }))
      .toMatchObject({ is_subscription: false, is_recurring: false, merchant_clean: '' });
  });
  it.each([null, 'text', 42, {}, { category: '' }])('rejects %p', (bad) => {
    expect(normalizeModelItem(bad)).toBeNull();
  });
});

describe('parseBatchResponse', () => {
  it('parses a plain JSON array', () => {
    expect(parseBatchResponse(JSON.stringify([item('Travel'), item('Shopping')]), 2).map(r => r?.category))
      .toEqual(['Travel', 'Shopping']);
  });
  it('parses an array wrapped in a markdown fence or surrounded by prose', () => {
    const json = JSON.stringify([item('Travel')]);
    expect(parseBatchResponse('```json\n' + json + '\n```', 1)[0]?.category).toBe('Travel');
    expect(parseBatchResponse('Sure! ' + json + ' Hope that helps.', 1)[0]?.category).toBe('Travel');
  });
  it('pads with null when the model returns too few items', () => {
    expect(parseBatchResponse(JSON.stringify([item('Travel')]), 3)).toEqual([expect.any(Object), null, null]);
  });
  it('ignores extra items', () => {
    expect(parseBatchResponse(JSON.stringify([item('Travel'), item('Shopping')]), 1)).toHaveLength(1);
  });
  it('returns all nulls for truncated JSON', () => {
    expect(parseBatchResponse('[{"category":"Trav', 2)).toEqual([null, null]);
  });
});

describe('batchCategorize', () => {
  it('skips the model entirely when it is unavailable', async () => {
    mockAvailable.mockReturnValue(false);
    expect(await batchCategorize(['A', 'B'])).toEqual([null, null]);
    expect(mockModel).not.toHaveBeenCalled();
  });

  it('sends five descriptions per call and reports progress', async () => {
    mockModel.mockImplementation(async (prompt) => {
      const n = prompt.split('\n').length - 1;
      return JSON.stringify(Array.from({ length: n }, () => item('Shopping')));
    });
    const progress: number[] = [];
    const out = await batchCategorize(Array.from({ length: 7 }, (_, i) => `TX ${i}`), (done) => progress.push(done));
    expect(mockModel).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(7);
    expect(out.every(r => r?.category === 'Shopping')).toBe(true);
    expect(progress).toEqual([5, 7]);
  });

  it('retries one by one when a batch comes back unparseable', async () => {
    mockModel
      .mockResolvedValueOnce('I cannot help with that')
      .mockResolvedValueOnce(JSON.stringify(item('Travel')))
      .mockResolvedValueOnce('garbage');
    const out = await batchCategorize(['HOTEL X', '???']);
    expect(mockModel).toHaveBeenCalledTimes(3);
    expect(out[0]?.category).toBe('Travel');
    expect(out[1]).toBeNull();
  });
});
