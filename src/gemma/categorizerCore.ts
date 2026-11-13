// Transaction categorisation with the model: prompts, output parsing and the
// batch-then-retry loop. Free of React Native imports and given its completion
// function as an argument, so the app (llama.rn) and the evaluation harness
// (llama-server) run exactly the same logic.
import { CategorizerOutput } from '../types';

export const BATCH_SIZE = 5; // smaller batches = less context pressure = more reliable JSON

export const CATEGORIES = [
  'Food & Dining', 'Shopping', 'Subscriptions', 'Transportation', 'Bills & Utilities',
  'Entertainment', 'Health & Fitness', 'Travel', 'Income', 'Transfer', 'Other',
] as const;

const CATEGORY_BY_LOWERCASE = new Map<string, string>(CATEGORIES.map(c => [c.toLowerCase(), c]));

export interface CompletionOptions { temperature?: number; n_predict?: number; prefill?: string }

/** Runs one completion and returns the model's text with the prefill attached. */
export type Complete = (prompt: string, systemPrompt: string, options: CompletionOptions) => Promise<string>;

export const BATCH_SYSTEM_PROMPT = `You are a bank transaction categorizer. Output ONLY a raw JSON array. No markdown, no explanation, no code fences.

Each element must have exactly these keys:
{"category":"${CATEGORIES.join('|')}","merchant_clean":"readable name","is_subscription":false,"is_recurring":false}`;

export const SINGLE_SYSTEM_PROMPT = `You are a bank transaction categorizer. Output ONLY a raw JSON object. No markdown, no explanation.
Keys: {"category":"...","merchant_clean":"...","is_subscription":false,"is_recurring":false}
Categories: ${CATEGORIES.join('|')}`;

export function buildBatchPrompt(descriptions: string[]): string {
  const list = descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `Categorize these ${descriptions.length} bank transactions and return a JSON array with exactly ${descriptions.length} objects:\n${list}`;
}

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
    return Array(count).fill(null);
  }
}

export function parseSingleResponse(raw: string): CategorizerOutput | null {
  try {
    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return normalizeModelItem(JSON.parse(raw.substring(start, end + 1)));
  } catch {
    return null;
  }
}

export interface BatchStats { batches: number; failedBatches: number; singleCalls: number }

/**
 * Categorizes descriptions in batches. A batch whose output cannot be parsed
 * at all is retried one description at a time, sequentially, because the
 * runtime handles a single completion at once.
 */
export async function runBatchCategorize(
  descriptions: string[],
  complete: Complete,
  onProgress?: (done: number, total: number) => void,
  stats?: BatchStats,
): Promise<(CategorizerOutput | null)[]> {
  const results: (CategorizerOutput | null)[] = [];
  let done = 0;

  for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
    const chunk = descriptions.slice(i, i + BATCH_SIZE);
    const n_predict = chunk.length * 100 + 256; // ~100 tokens per transaction + buffer

    // prefill '[' forces the model to start generating the JSON array immediately
    const raw = await complete(buildBatchPrompt(chunk), BATCH_SYSTEM_PROMPT, { temperature: 0.0, n_predict, prefill: '[' });
    let chunkResults = parseBatchResponse(raw, chunk.length);
    if (stats) stats.batches++;

    if (chunkResults.every(r => r === null)) {
      if (stats) stats.failedBatches++;
      chunkResults = [];
      for (const desc of chunk) {
        const single = await complete(`Transaction: "${desc}"`, SINGLE_SYSTEM_PROMPT, { temperature: 0.0, n_predict: 120, prefill: '{' });
        if (stats) stats.singleCalls++;
        chunkResults.push(parseSingleResponse(single));
      }
    }

    results.push(...chunkResults);
    done += chunk.length;
    onProgress?.(done, descriptions.length);
  }

  return results;
}
