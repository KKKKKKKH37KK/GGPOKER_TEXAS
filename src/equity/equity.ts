import { evaluate } from './evaluator';

/** Deterministic PRNG so EV numbers are reproducible run to run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface EquityOptions {
  /** Monte Carlo trials when more than `exhaustiveMax` boards remain */
  trials?: number;
  exhaustiveMax?: number;
  seed?: number;
}

/**
 * Expected share of each pot won by player `hero`.
 * `holes[i]` are player i's hole cards; `pots[j]` lists the player indexes eligible for pot j.
 * Ties split the pot evenly among the best eligible hands.
 */
export function potShares(hero: number, holes: number[][], board: number[], pots: number[][], opts: EquityOptions = {}): number[] {
  return equityCore(hero, holes, board, pots, null, opts).shares;
}

/**
 * Hero's expected share of each pot plus the mean and standard deviation of Hero's total winnings,
 * given the pot `amounts` (same units out). The SD is what a luck z-score is measured against.
 */
export function potOutcome(
  hero: number,
  holes: number[][],
  board: number[],
  pots: number[][],
  amounts: number[],
  opts: EquityOptions = {},
): { shares: number[]; mean: number; sd: number } {
  const r = equityCore(hero, holes, board, pots, amounts, opts);
  return { shares: r.shares, mean: r.mean, sd: Math.sqrt(Math.max(0, r.meanSq - r.mean * r.mean)) };
}

function equityCore(
  hero: number,
  holes: number[][],
  board: number[],
  pots: number[][],
  amounts: number[] | null,
  { trials = 200_000, exhaustiveMax = 100_000, seed = 1 }: EquityOptions,
): { shares: number[]; mean: number; meanSq: number } {
  const dead = new Set<number>([...board, ...holes.flat()]);
  const deck: number[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
  const need = 5 - board.length;

  const n = holes.length;
  const hands = holes.map((h) => {
    const a = new Int32Array(7);
    a.set(h, 0);
    a.set(board, h.length);
    return a;
  });
  const scores = new Int32Array(n);
  const shares = new Float64Array(pots.length);
  let sumWin = 0;
  let sumWinSq = 0;
  const start = 2 + board.length;

  const score = (runout: ArrayLike<number>) => {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < need; k++) hands[i][start + k] = runout[k];
      scores[i] = evaluate(hands[i], 7);
    }
    let win = 0;
    for (let j = 0; j < pots.length; j++) {
      const elig = pots[j];
      if (!elig.includes(hero)) continue;
      let best = -1;
      let ties = 0;
      for (const p of elig) {
        if (scores[p] > best) {
          best = scores[p];
          ties = 1;
        } else if (scores[p] === best) ties++;
      }
      if (scores[hero] === best) {
        shares[j] += 1 / ties;
        if (amounts) win += amounts[j] / ties;
      }
    }
    sumWin += win;
    sumWinSq += win * win;
  };

  const combos = binom(deck.length, need);
  let runs = 0;
  if (need === 0) {
    score([]);
    runs = 1;
  } else if (combos <= exhaustiveMax) {
    const idx = Array.from({ length: need }, (_, i) => i);
    const runout = new Int32Array(need);
    for (;;) {
      for (let k = 0; k < need; k++) runout[k] = deck[idx[k]];
      score(runout);
      runs++;
      let k = need - 1;
      while (k >= 0 && idx[k] === deck.length - need + k) k--;
      if (k < 0) break;
      idx[k]++;
      for (let m = k + 1; m < need; m++) idx[m] = idx[m - 1] + 1;
    }
  } else {
    const rnd = mulberry32(seed);
    const d = Int32Array.from(deck);
    for (let t = 0; t < trials; t++) {
      // Partial Fisher–Yates: the first `need` slots become a uniform random runout.
      for (let k = 0; k < need; k++) {
        const j = k + Math.floor(rnd() * (d.length - k));
        const tmp = d[k];
        d[k] = d[j];
        d[j] = tmp;
      }
      score(d);
    }
    runs = trials;
  }
  return { shares: Array.from(shares, (s) => s / runs), mean: sumWin / runs, meanSq: sumWinSq / runs };
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}
