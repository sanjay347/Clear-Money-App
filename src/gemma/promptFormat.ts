// Prompt formatting for Gemma, kept free of React Native imports so the same
// code builds prompts in the app and in the evaluation harness (eval/run.ts).
//
// Two formats exist because they disagree:
//
//   legacy  <start_of_turn>user … <end_of_turn>   Gemma 2/3 markers. What the
//           app has always sent. Has no system turn, so the system prompt is
//           folded into the user turn.
//   gemma4  <|turn>user … <turn|>                 The markers in the chat
//           template and tokenizer published with the fine-tuned model.
//
// Which one the app uses is decided by measurement, not by reading docs:
// see eval/RESULTS.md.

export type PromptFormat = 'legacy' | 'gemma4';

export const DEFAULT_PROMPT_FORMAT: PromptFormat = 'legacy';

// Generation halts on any turn marker from either format.
export const STOP_TOKENS = ['<end_of_turn>', '<eos>', '<|im_end|>', '<start_of_turn>', '<turn|>', '<|turn>'];

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface SingleTurn {
  system?: string;
  user: string;
  /** Text placed at the start of the model's turn to force an output shape, e.g. "[" for a JSON array. */
  prefill?: string;
}

// Neither format includes <bos>: llama.cpp's tokenizer adds it, and a second one degrades output.

export function formatPrompt(turn: SingleTurn, format: PromptFormat = DEFAULT_PROMPT_FORMAT): string {
  const prefill = turn.prefill ?? '';
  if (format === 'gemma4') {
    const system = turn.system ? `<|turn>system\n${turn.system.trim()}<turn|>\n` : '';
    return `${system}<|turn>user\n${turn.user}<turn|>\n<|turn>model\n${prefill}`;
  }
  const user = turn.system ? `${turn.system}\n\n${turn.user}` : turn.user;
  return `<start_of_turn>user\n${user}<end_of_turn>\n<start_of_turn>model\n${prefill}`;
}

export function formatChat(messages: ChatMessage[], format: PromptFormat = DEFAULT_PROMPT_FORMAT): string {
  const [open, close] = format === 'gemma4' ? ['<|turn>', '<turn|>'] : ['<start_of_turn>', '<end_of_turn>'];
  return messages
    // Gemma names the assistant role "model"; "assistant" is not a role it was trained on.
    .map(m => `${open}${m.role === 'assistant' ? 'model' : m.role}\n${m.content}${close}`)
    .join('\n') + `\n${open}model\n`;
}

/** Cuts raw completion text at the first stop token. */
export function stripStopTokens(text: string): string {
  let out = text;
  for (const tok of STOP_TOKENS) out = out.split(tok)[0];
  return out.trimEnd();
}

/**
 * Turns raw completion text into the final answer: cut at stop tokens and put
 * the prefill back, unless the runtime already echoed it.
 */
export function finishCompletion(text: string, prefill = ''): string {
  const cut = stripStopTokens(text);
  if (!prefill) return cut;
  return cut.trimStart().startsWith(prefill) ? cut : prefill + cut;
}
