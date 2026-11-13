/**
 * Categorisation evaluation.
 *
 * Runs the app's own rule engine, prompts and output parser against a labelled
 * test set, with the model served by llama.cpp's llama-server. It answers:
 *
 *   1. How accurate is each stage: rules alone, the model alone, and the
 *      pipeline the app ships (rules first, model for the rest)?
 *   2. Which prompt format does the fine-tuned model respond to best?
 *
 * Usage:  npm run eval -- [--url http://127.0.0.1:8089] [--formats legacy,gemma4] [--limit 50]
 * See eval/README.md for how to start the server.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryRuleCategorize } from '../src/gemma/rules';
import { runBatchCategorize, CATEGORIES, type BatchStats, type Complete } from '../src/gemma/categorizerCore';
import { STOP_TOKENS, finishCompletion, formatPrompt, type PromptFormat } from '../src/gemma/promptFormat';

interface Row { description: string; type: 'debit' | 'credit'; category: string; tier: 'head' | 'tail'; accept?: string[] }

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const URL_BASE = arg('url', 'http://127.0.0.1:8089');
const FORMATS = arg('formats', 'legacy,gemma4').split(',') as PromptFormat[];
const LIMIT = Number(arg('limit', '0'));

const rows: Row[] = readFileSync(join(HERE, 'data/transactions.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));
const data = LIMIT ? rows.slice(0, LIMIT) : rows;

// ─── Model access ─────────────────────────────────────────────────────────────

async function serverInfo(): Promise<string> {
  const res = await fetch(`${URL_BASE}/props`);
  if (!res.ok) throw new Error(`llama-server not reachable at ${URL_BASE} (${res.status})`);
  const props = await res.json() as { model_path?: string; build_info?: string };
  return `${(props.model_path ?? 'unknown model').split('/').pop()} · llama.cpp ${props.build_info ?? 'unknown build'}`;
}

/** Same sampling settings as callLocalModel in src/gemma/client.ts. */
const completeWith = (format: PromptFormat): Complete => async (prompt, systemPrompt, options) => {
  const prefill = options.prefill ?? '';
  const res = await fetch(`${URL_BASE}/completion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: formatPrompt({ system: systemPrompt, user: prompt, prefill }, format),
      n_predict: options.n_predict ?? 512,
      temperature: options.temperature ?? 0.7,
      top_p: 0.9,
      stop: STOP_TOKENS,
      cache_prompt: false,
    }),
  });
  if (!res.ok) throw new Error(`completion failed: ${res.status} ${await res.text()}`);
  const body = await res.json() as { content?: string };
  return finishCompletion(body.content ?? '', prefill);
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

type Prediction = string | null; // null = no answer
const strict = (r: Row, p: Prediction) => p === r.category;
const lenient = (r: Row, p: Prediction) => p === r.category || (!!p && (r.accept ?? []).includes(p));
const pct = (n: number, d: number) => d === 0 ? '   –' : `${((n / d) * 100).toFixed(1)}%`;

interface Score { name: string; n: number; answered: number; strict: number; lenient: number; head: string; tail: string; secPerTx?: number; note?: string }

function score(name: string, preds: Prediction[], extra: Partial<Score> = {}): Score {
  const tier = (t: Row['tier']) => {
    const idx = data.map((r, i) => i).filter(i => data[i].tier === t);
    return pct(idx.filter(i => lenient(data[i], preds[i])).length, idx.length);
  };
  return {
    name, n: data.length,
    answered: preds.filter(p => p !== null).length,
    strict: data.filter((r, i) => strict(r, preds[i])).length,
    lenient: data.filter((r, i) => lenient(r, preds[i])).length,
    head: tier('head'), tail: tier('tail'), ...extra,
  };
}

function perCategory(preds: Prediction[]): string[] {
  return CATEGORIES.map(cat => {
    const gold = data.map((r, i) => i).filter(i => data[i].category === cat);
    const predicted = data.map((r, i) => i).filter(i => preds[i] === cat);
    const recall = pct(gold.filter(i => lenient(data[i], preds[i])).length, gold.length);
    const precision = pct(predicted.filter(i => lenient(data[i], preds[i])).length, predicted.length);
    return `| ${cat} | ${gold.length} | ${recall} | ${precision} |`;
  });
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  const info = await serverInfo();
  console.log(`Evaluating ${data.length} transactions against ${info}\n`);

  // Stage 1: rules only. A miss is "no answer".
  const rulePreds: Prediction[] = data.map(r => tryRuleCategorize(r.description, r.type)?.category ?? null);
  const ruleHits = rulePreds.filter(p => p !== null).length;
  const ruleCorrect = data.filter((r, i) => rulePreds[i] !== null && lenient(r, rulePreds[i])).length;

  const scores: Score[] = [score('Rules only', rulePreds, { note: `precision on matches ${pct(ruleCorrect, ruleHits)}` })];
  const details: Record<string, unknown> = {};
  let bestPipeline: { format: PromptFormat; preds: Prediction[]; lenient: number } | null = null;

  for (const format of FORMATS) {
    // Stage 2: model only, every transaction.
    const stats: BatchStats = { batches: 0, failedBatches: 0, singleCalls: 0 };
    const t0 = Date.now();
    const out = await runBatchCategorize(
      data.map(r => r.description), completeWith(format),
      (done, total) => process.stdout.write(`\r  ${format}: ${done}/${total}`), stats,
    );
    const secPerTx = (Date.now() - t0) / 1000 / data.length;
    process.stdout.write('\n');
    const modelPreds: Prediction[] = out.map(o => o?.category ?? null);
    scores.push(score(`Model only (${format})`, modelPreds, {
      secPerTx, note: `${stats.failedBatches}/${stats.batches} batches unparseable, ${stats.singleCalls} single retries`,
    }));

    // Stage 3: what the app ships. Rules first, model for the misses.
    const pipelinePreds = rulePreds.map((p, i) => p ?? modelPreds[i]);
    const s = score(`Pipeline: rules + model (${format})`, pipelinePreds);
    scores.push(s);
    if (!bestPipeline || s.lenient > bestPipeline.lenient) bestPipeline = { format, preds: pipelinePreds, lenient: s.lenient };

    details[format] = data.map((r, i) => ({
      description: r.description, gold: r.category, rule: rulePreds[i], model: modelPreds[i],
      merchant: out[i]?.merchant_clean ?? null, pipeline_ok: lenient(r, pipelinePreds[i]),
    }));
  }

  const table = [
    '| System | Answered | Accuracy | Strict | Head | Tail | s / txn | Notes |',
    '|---|---|---|---|---|---|---|---|',
    ...scores.map(s => `| ${s.name} | ${pct(s.answered, s.n)} | **${pct(s.lenient, s.n)}** | ${pct(s.strict, s.n)} | ${s.head} | ${s.tail} | ${s.secPerTx ? s.secPerTx.toFixed(2) : '–'} | ${s.note ?? ''} |`),
  ].join('\n');
  console.log('\n' + table);

  const misses = bestPipeline
    ? data.map((r, i) => ({ r, p: bestPipeline!.preds[i] })).filter(({ r, p }) => !lenient(r, p))
    : [];
  const report = [
    '# Categorisation evaluation', '',
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Model: ${info}`,
    `- Test set: ${data.length} labelled descriptions (eval/data/transactions.jsonl)`, '',
    'Accuracy counts a prediction as correct if it matches the gold category or a listed acceptable alternative. Strict counts the gold category only. Head is national brands; tail is small merchants and cryptic descriptors.', '',
    table, '',
    ...(bestPipeline ? [
      `## Per category, best pipeline (${bestPipeline.format})`, '',
      '| Category | Count | Recall | Precision |', '|---|---|---|---|', ...perCategory(bestPipeline.preds), '',
      `## Misses, best pipeline (${misses.length})`, '',
      '| Description | Gold | Predicted |', '|---|---|---|',
      ...misses.map(({ r, p }) => `| ${r.description} | ${r.category} | ${p ?? 'no answer'} |`), '',
    ] : []),
  ].join('\n');

  writeFileSync(join(HERE, 'RESULTS.md'), report);
  mkdirSync(join(HERE, 'runs'), { recursive: true });
  writeFileSync(join(HERE, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ info, scores, details }, null, 2));
  console.log('\nWrote eval/RESULTS.md and raw output to eval/runs/');
}

main().catch(e => { console.error(e.message); process.exit(1); });
