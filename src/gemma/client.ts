import { MODEL_PATH } from './downloadManager';
import * as FileSystem from 'expo-file-system/legacy';
import {
  STOP_TOKENS, finishCompletion, formatChat, formatPrompt, stripStopTokens, type ChatMessage,
} from './promptFormat';

export type { ChatMessage } from './promptFormat';

// Minimal shape of the llama.rn context we rely on. Declared here instead of
// importing llama.rn's types so this module still loads in Expo Go, where the
// native module is absent.
interface CompletionResult { text?: string; content?: string }
interface CompletionParams {
  prompt: string;
  n_predict: number;
  temperature: number;
  top_p: number;
  stop: string[];
}
export interface LlamaContextLike {
  completion(params: CompletionParams, onToken?: (data: { token: string }) => void): Promise<CompletionResult>;
  release(): Promise<void>;
}

let llamaContext: LlamaContextLike | null = null;
let nativeUnavailable = false; // true when running in Expo Go / no native build

// ── Completion mutex ─────────────────────────────────────────────────────────
// llama.rn allows only one concurrent completion per context.
// All callers (batch categorizer, behavior agent, predictor, chat) share this
// single promise chain so completions are queued, never concurrent.
let completionQueue: Promise<void> = Promise.resolve();

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next: Promise<T> = completionQueue.then(fn, fn); // run even if previous failed
  completionQueue = next.then(() => {}, () => {}); // keep queue alive
  return next;
}

// llama.rn is required lazily so the app doesn't crash on load if the native module is absent
async function tryInitLlama(rawPath: string): Promise<LlamaContextLike | null> {
  const { initLlama } = require('llama.rn');
  if (!initLlama) throw new Error('initLlama not exported');

  // Try GPU first; if it OOMs or fails, fall back to CPU-only
  try {
    const ctx = await initLlama({ model: rawPath, n_ctx: 4096, n_gpu_layers: 99, n_batch: 512 });
    console.log('[Llama] GPU mode active (n_gpu_layers=99)');
    return ctx;
  } catch (gpuErr: any) {
    // Expo Go / no native module
    if (gpuErr?.message?.includes('install') || gpuErr?.message?.includes('null')) {
      console.warn('[Llama] Native module not available (Expo Go). AI features disabled.');
      nativeUnavailable = true;
      return null;
    }
    // GPU OOM or Metal unsupported — fall back to CPU
    console.warn('[Llama] GPU init failed, falling back to CPU:', gpuErr?.message);
    return await initLlama({ model: rawPath, n_ctx: 4096, n_gpu_layers: 0, n_batch: 512 });
  }
}

export const isAIAvailable = () => !nativeUnavailable;
export const isModelLoaded = () => !!llamaContext;

export const getLlamaContext = async (): Promise<LlamaContextLike | null> => {
  if (nativeUnavailable) return null;
  if (llamaContext) return llamaContext;

  try {
    const rawPath = MODEL_PATH.replace(/^file:\/\//, '');
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    console.log(`[Llama Engine] Loading from: ${rawPath}`);
    console.log(`[Llama Engine] Size: ${info.exists ? (info.size / 1024 / 1024).toFixed(2) + ' MB' : 'MISSING'}`);

    llamaContext = await tryInitLlama(rawPath);
    return llamaContext;
  } catch (error) {
    console.error('Failed to initialize llama.rn:', error);
    return null;
  }
};

export const releaseContext = async (): Promise<void> => {
  if (llamaContext) {
    try {
      await llamaContext.release();
    } catch (e) {
      console.error('Failed to release llama context:', e);
    }
    llamaContext = null;
  }
};

export const callLocalModel = async (
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; n_predict?: number; prefill?: string }
): Promise<string> => {
  const context = await getLlamaContext();
  if (!context) return '';

  try {
    const prefill = options?.prefill ?? '';
    const formattedPrompt = formatPrompt({ system: systemPrompt, user: prompt, prefill });

    const response = await enqueue(() => context.completion({
      prompt: formattedPrompt,
      n_predict: options?.n_predict ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: 0.9,
      stop: STOP_TOKENS,
    }));

    // Some llama.rn builds echo the last prompt token; finishCompletion guards against a doubled prefill.
    return finishCompletion(response.text ?? response.content ?? '', prefill);
  } catch (error) {
    console.error('Error executing local model:', error);
    return '';
  }
};

export const callGemmaBase = callLocalModel;

export const callLocalModelStreaming = async (
  prompt: string,
  systemPrompt: string | undefined,
  onToken: (partial: string) => void,
  options?: { temperature?: number; n_predict?: number }
): Promise<string> => {
  const context = await getLlamaContext();
  if (!context) throw new Error('Model not loaded');

  const formattedPrompt = formatPrompt({ system: systemPrompt, user: prompt });
  const cleanText = stripStopTokens;

  let accumulated = '';
  const result = await enqueue(() => context.completion(
    {
      prompt: formattedPrompt,
      n_predict: options?.n_predict ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: 0.9,
      stop: STOP_TOKENS,
    },
    (data: { token: string }) => {
      accumulated += data.token;
      const cleaned = cleanText(accumulated);
      if (cleaned) onToken(cleaned);
    }
  ));

  const finalText = cleanText(result?.text ?? result?.content ?? accumulated);
  return finalText;
};

// ─── Gemma 4 chat via messages API ──────────────────────────────────────────
// Uses the model's embedded chat template (supports system role in Gemma 4).
// This is separate from callLocalModel so the categorizer is not affected.

const cleanOutput = stripStopTokens;

/** Legacy-format chat prompt. Kept as a named export for existing callers and tests. */
export const buildGemma4Prompt = (messages: ChatMessage[]): string => formatChat(messages);

export const callChatModel = async (
  messages: ChatMessage[],
  options?: { temperature?: number; n_predict?: number }
): Promise<string> => {
  const context = await getLlamaContext();
  if (!context) return '';
  try {
    const response = await enqueue(() => context.completion({
      prompt: buildGemma4Prompt(messages),
      n_predict: options?.n_predict ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: 0.9,
      stop: STOP_TOKENS,
    }));
    return cleanOutput(response.text ?? response.content ?? '');
  } catch (error) {
    console.error('[ChatModel] error:', error);
    return '';
  }
};

export const callChatModelStreaming = async (
  messages: ChatMessage[],
  onToken: (partial: string) => void,
  options?: { temperature?: number; n_predict?: number }
): Promise<string> => {
  const context = await getLlamaContext();
  if (!context) throw new Error('Model not loaded');

  let accumulated = '';
  const result = await enqueue(() => context.completion(
    {
      prompt: buildGemma4Prompt(messages),
      n_predict: options?.n_predict ?? 512,
      temperature: options?.temperature ?? 0.7,
      top_p: 0.9,
      stop: STOP_TOKENS,
    },
    (data: { token: string }) => {
      accumulated += data.token;
      const cleaned = cleanOutput(accumulated);
      if (cleaned) onToken(cleaned);
    }
  ));
  return cleanOutput(result?.text ?? result?.content ?? accumulated);
};

export const callHFCategorizer = async (text: string): Promise<any> => {
  const prompt = `Analyze this bank transaction: "${text}".
Return ONLY a valid JSON object with exactly these keys:
{"category": "one of: Food & Dining, Shopping, Subscriptions, Transportation, Bills & Utilities, Entertainment, Health & Fitness, Travel, Income, Transfer, Other", "merchant_clean": "Cleaned merchant name", "is_subscription": boolean, "is_recurring": boolean}
Do not include markdown or other text.`;

  const rawText = await callLocalModel(prompt, undefined, { temperature: 0.0, n_predict: 256 });
  try {
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
    }
  } catch (e) {
    console.error('Failed to parse JSON from local model output:', e);
  }
  return rawText;
};
