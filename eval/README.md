# Evaluation

Measures how accurately ClearMoney categorises bank transactions, using the same rule engine, prompts and output parser the app ships. Latest numbers are in [RESULTS.md](RESULTS.md).

## What it measures

| System | What runs |
|---|---|
| Rules only | `tryRuleCategorize`. A miss counts as no answer. |
| Model only | Every description goes to the fine-tuned model in batches of five. |
| Pipeline | What the app does: rules first, model for the misses. |

The model stages run once per prompt format (`legacy` and `gemma4`, see `src/gemma/promptFormat.ts`), which is how the app's default format was chosen.

Reported per system: share answered, accuracy, strict accuracy, accuracy on head and tail merchants, seconds per transaction, and how many batches came back as unparseable JSON.

## Test set

`data/transactions.jsonl`: 198 descriptions written to look like real US statement lines, each with a gold category.

- **head** (96): national brands, including awkward real-world variants such as `AMZN MKTP US*…` and `WHOLEFDS MKT`.
- **tail** (102): small merchants behind Square and Toast prefixes, regional chains, and cryptic descriptors.
- `accept` lists other categories that are also reasonable for that line (a pharmacy is Health & Fitness or Shopping). Accuracy allows them; strict accuracy does not.

## Run it

```bash
brew install llama.cpp
mkdir -p eval/models
curl -L -o eval/models/clearmoney-q4km.gguf \
  https://huggingface.co/sanjay3478/clearmoney-categorizer/resolve/main/clearmoney-q4km.gguf
llama-server -m eval/models/clearmoney-q4km.gguf --port 8089 -c 4096 -ngl 99 -np 1
```

Then, in another terminal:

```bash
npm run eval
```

Options: `--limit 20` for a quick run, `--formats legacy` for one format, `--url` for a different server.

## Limits of these numbers

- **The test set was written by hand for this evaluation, not sampled from real statements.** It has not been checked against the fine-tuning data, so overlap is possible.
- **198 rows.** A one-point difference between two systems is two rows and is not meaningful; the 95% interval on a 91% score is roughly ±4 points.
- **Labels are one person's judgement.** Some misses are arguable (a meditation app as Subscriptions or Health & Fitness).
- **Speed is measured on a Mac**, not a phone. Accuracy should carry over because the model file and inference engine are the same; latency will not.
- **No comparison with the base model yet**, so these results do not show how much the fine-tuning helped.
- The rules have not been tuned against this set. Do not add rules to fix individual misses here without a second, held-out set.
