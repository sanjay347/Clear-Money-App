import { callLocalModel, isAIAvailable } from './client';
import { CategorizerOutput } from '../types';
import { runBatchCategorize } from './categorizerCore';

export { CATEGORIES, normalizeModelItem, parseBatchResponse } from './categorizerCore';

/**
 * Categorizes an array of transaction descriptions with the on-device model.
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
  return runBatchCategorize(
    descriptions,
    (prompt, systemPrompt, options) => callLocalModel(prompt, systemPrompt, options),
    onProgress,
  );
}
