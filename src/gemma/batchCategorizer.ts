import { callLocalModel, isAIAvailable } from './client';
import { CategorizerOutput } from '../types';

const BATCH_SIZE = 5; // smaller batches = less context pressure = more reliable JSON

export const CATEGORIES = [
  'Food & Dining', 'Shopping', 'Subscriptions', 'Transportation', 'Bills & Utilities',
  'Entertainment', 'Health & Fitness', 'Travel', 'Income', 'Transfer', 'Other',
] as const;

const CATEGORY_BY_LOWERCASE = new Map<string, string>(CATEGORIES.map(c => [c.toLowerCase(), c]));

/**
 * Turns one model-produced object into a CategorizerOutput, or null if unusable.
 * The model occasionally invents a category ("Groceries", "Dining"); anything
 * outside the fixed list becomes "Other" so charts and budgets never see an
 * unknown bucket.
 */
export function normalizeModelItem(item: unknown): CategorizerOutput | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  if (typeof o.category !== 'string' || !o.category.trim()) return null;
  return {
    category: CATEGORY_BY_LOWERCASE.get(o.category.trim().toLowerCase()) ?? 'Other',
    merchant_clean: typeof o.merchant_clean === 'string' ? o.merchant_clean.trim() : '',
    is_subscription: o.is_subscription === true,
    is_recurring: o.is_recurring === true,
  };
}

const SYSTEM_PROMPT = `You are a bank transaction categorizer. Output ONLY a raw JSON array. No markdown, no explanation, no code fences.

Each element must have exactly these keys:
{"category":"${CATEGORIES.join('|')}","merchant_clean":"readable name","is_subscription":false,"is_recurring":false}`;

function buildBatchPrompt(descriptions: string[]): string {
  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `Categorize these ${descriptions.length} bank transactions and return a JSON array with exactly ${descriptions.length} objects:\n${list}`;
}

function extractJSONArray(raw: string): string | null {
  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();

  // 2. Find first [ ... last ]
  const start = raw.indexOf('[');
  const end   = raw.lastIndexOf(']');
  if (start !== -1 && end > start) return raw.substring(start, end + 1);

  return null;
}

export function parseBatchResponse(raw: string, count: number): (CategorizerOutput | null)[] {
  try {
    const jsonStr = extractJSONArray(raw);
    if (!jsonStr) throw new Error('No JSON array found');

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('Not an array');

    const results: (CategorizerOutput | null)[] = [];
    for (let i = 0; i < count; i++) results.push(normalizeModelItem(parsed[i]));
    return results;
  } catch {
    console.log('[BatchCategorizer] Batch parse failed, will retry individually');
    return Array(count).fill(null);
  }
}

const SINGLE_SYSTEM = `You are a bank transaction categorizer. Output ONLY a raw JSON object. No markdown, no explanation.
Keys: {"category":"...","merchant_clean":"...","is_subscription":false,"is_recurring":false}
Categories: ${CATEGORIES.join('|')}`;

async function categorizeOne(description: string): Promise<CategorizerOutput | null> {
  const prompt = `Transaction: "${description}"`;
  const raw = await callLocalModel(prompt, SINGLE_SYSTEM, { temperature: 0.0, n_predict: 120, prefill: '{' });
  try {
    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return normalizeModelItem(JSON.parse(raw.substring(start, end + 1)));
  } catch {
    return null;
  }
}

/**
 * Categorizes an array of transaction descriptions in batches.
 * Returns one CategorizerOutput per input (or null on failure for that item).
 */
export async function batchCategorize(
  descriptions: string[],
  onProgress?: (done: number, total: number) => void
): Promise<(CategorizerOutput | null)[]> {
  // In Expo Go the native llama module isn't available — skip AI, return nulls
  // so the upload pipeline falls back to rule-based + "Other" for unknowns.
  if (!isAIAvailable()) {
    onProgress?.(descriptions.length, descriptions.length);
    return Array(descriptions.length).fill(null);
  }

  const results: (CategorizerOutput | null)[] = [];
  let done = 0;

  for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
    const chunk = descriptions.slice(i, i + BATCH_SIZE);
    const prompt = buildBatchPrompt(chunk);
    const n_predict = chunk.length * 100 + 256; // ~100 tokens per transaction + buffer

    // prefill '[' forces the model to start generating the JSON array immediately
    const raw = await callLocalModel(prompt, SYSTEM_PROMPT, { temperature: 0.0, n_predict, prefill: '[' });
    let chunkResults = parseBatchResponse(raw, chunk.length);

    // If batch failed entirely, fall back to one-by-one sequential calls
    // (Promise.all would fire concurrent completions; the context can only handle one at a time)
    const allNull = chunkResults.every(r => r === null);
    if (allNull) {
      console.log('[BatchCategorizer] Batch failed — falling back to individual calls');
      chunkResults = [];
      for (const desc of chunk) {
        chunkResults.push(await categorizeOne(desc));
      }
    }

    results.push(...chunkResults);

    done += chunk.length;
    onProgress?.(done, descriptions.length);
  }

  return results;
}
