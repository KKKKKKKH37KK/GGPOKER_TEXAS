# HH Stats Viewer

GG Poker (Rush & Cash NLHE) hand-history stats that run entirely in the browser.
Drop the .zip exported from GG PokerCraft onto the page; nothing is uploaded anywhere.
Later uploads are merged (duplicate hands removed). The uploaded files can be kept in this browser's IndexedDB so the data is there next time (Settings → 資料保存; off deletes them).

```bash
npm install
npm run dev      # http://localhost:5173 — drop the GG .zip on the page
npm test         # parser fixtures, invariants, golden values, equity, performance
npm run build    # static site in dist/ (relative paths, works on GitHub Pages)
```

Tests that need the full reference data look for `260926_test.zip` in the repo root, or the path in `HH_ZIP`.
Without it they are skipped. Raw hand histories (`*.zip`, `data/`) are git-ignored; only single-hand fixtures are committed.

## Layout

| Path | Contents |
|---|---|
| `src/parser/` | text → `Hand` (`lineRules.ts`, `parseHand.ts`, `parseZip.ts`) |
| `src/stats/` | `Hand` → per-hand facts (`preflop.ts`, `postflop.ts`, `facts.ts`) → `StatsResult` (`aggregate.ts`); definitions in `definitions.ts` |
| `src/equity/` | 7-card evaluator, exhaustive / Monte Carlo equity, all-in EV with side pots |
| `src/worker/` | Web Worker: unzip + parse + facts, then all-in EV in the background; `store.ts` keeps the raw uploads in IndexedDB |
| `src/ui/` | React components |

Filters only re-run `aggregate()` over the precomputed facts, so every report updates immediately.
