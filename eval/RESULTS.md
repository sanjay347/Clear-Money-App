# Categorisation evaluation

- Date: 2026-11-13
- Model: clearmoney-q4km.gguf · llama.cpp b12359-b1b770d90
- Test set: 198 labelled descriptions (eval/data/transactions.jsonl)

Accuracy counts a prediction as correct if it matches the gold category or a listed acceptable alternative. Strict counts the gold category only. Head is national brands; tail is small merchants and cryptic descriptors.

| System | Answered | Accuracy | Strict | Head | Tail | s / txn | Notes |
|---|---|---|---|---|---|---|---|
| Rules only | 52.0% | **51.5%** | 50.5% | 93.8% | 11.8% | – | precision on matches 99.0% |
| Model only (legacy) | 100.0% | **82.3%** | 78.3% | 80.2% | 84.3% | 0.87 | 0/40 batches unparseable, 0 single retries |
| Pipeline: rules + model (legacy) | 100.0% | **91.4%** | 86.9% | 99.0% | 84.3% | – |  |
| Model only (gemma4) | 100.0% | **83.3%** | 80.3% | 82.3% | 84.3% | 1.10 | 0/40 batches unparseable, 0 single retries |
| Pipeline: rules + model (gemma4) | 100.0% | **90.9%** | 87.9% | 97.9% | 84.3% | – |  |

## Per category, best pipeline (legacy)

| Category | Count | Recall | Precision |
|---|---|---|---|
| Food & Dining | 36 | 88.9% | 93.9% |
| Shopping | 30 | 96.7% | 82.5% |
| Subscriptions | 25 | 84.0% | 100.0% |
| Transportation | 19 | 100.0% | 95.0% |
| Bills & Utilities | 19 | 89.5% | 100.0% |
| Entertainment | 13 | 76.9% | 100.0% |
| Health & Fitness | 17 | 100.0% | 82.4% |
| Travel | 15 | 93.3% | 100.0% |
| Income | 8 | 87.5% | 85.7% |
| Transfer | 9 | 100.0% | 76.9% |
| Other | 7 | 85.7% | 100.0% |

## Misses, best pipeline (17)

| Description | Gold | Predicted |
|---|---|---|
| SOUTHWES 5261234567890 | Travel | Shopping |
| BARTACO NASHVILLE | Food & Dining | Transportation |
| H-E-B #455 | Food & Dining | Shopping |
| WEGMANS #072 | Food & Dining | Shopping |
| SPROUTS FARMERS MKT | Food & Dining | Shopping |
| PAYPAL *WAYFAIR | Shopping | Transfer |
| HEADSPACE INC | Subscriptions | Health & Fitness |
| CALM.COM | Subscriptions | Health & Fitness |
| CURSOR AI POWERED IDE | Subscriptions | Shopping |
| THE ATHLETIC | Subscriptions | Shopping |
| LEMONADE INSURANCE | Bills & Utilities | Health & Fitness |
| GOOGLE FI | Bills & Utilities | Income |
| ALAMO DRAFTHOUSE | Entertainment | Food & Dining |
| NINTENDO ESHOP | Entertainment | Shopping |
| BOWLERO 0412 | Entertainment | Food & Dining |
| UPWORK ESCROW PAYOUT | Income | Transfer |
| CHECK #1042 | Other | Transfer |
