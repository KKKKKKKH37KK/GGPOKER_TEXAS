import { beforeAll, describe, expect, it } from 'vitest';
import { aggregate } from '../src/stats/aggregate';
import { STAT_DEFS } from '../src/stats/definitions';
import { diagnose, type DiagnoseOptions } from '../src/stats/diagnose';
import { analyzeHand } from '../src/stats/facts';
import type { StatsResult } from '../src/stats/types';
import { hasZip, loadZip } from './helpers';

const opts = (minHands = 5000): DiagnoseOptions => ({
  minHands,
  minOpp: 100,
  rangeOf: (k) => (STAT_DEFS[k].ref ? { min: STAT_DEFS[k].ref![0], max: STAT_DEFS[k].ref![1] } : undefined),
});

describe.skipIf(!hasZip)('diagnose (reference data, default ranges)', () => {
  let r: StatsResult;
  beforeAll(async () => {
    const { hands } = await loadZip();
    r = aggregate(hands.map(analyzeHand));
  });

  it('does nothing below the hand threshold', () => {
    const d = diagnose(r, opts(10_000));
    expect(d.enoughData).toBe(false);
    expect(d.leaks).toHaveLength(0);
    expect(d.strengths).toHaveLength(0);
  });

  it('BTN opens too wide and over-folds to 3Bets (RFI 406/590, Fold to 3Bet 74/86)', () => {
    const d = diagnose(r, opts());
    expect(d.enoughData).toBe(true);
    const btn = d.leaks.find((l) => l.title.startsWith('BTN 開池太寬'));
    expect(btn).toBeDefined();
    expect(btn!.target).toEqual({ type: 'stat', key: 'foldTo3Bet', position: 'BTN' });
  });

  it('only strong deviations become leaks; weak ones go to the watch list', () => {
    const d = diagnose(r, opts());
    // Fold to 4Bet 51/67: Wilson low ≈ 64.6% overlaps the 45–65% range → not a leak at this sample.
    expect(d.leaks.some((l) => l.title.startsWith('3Bet 之後'))).toBe(false);
    for (const l of d.leaks) expect(l.fix).toBeTruthy();
    for (const w of d.watch) expect(w.kind).toBe('watch');
  });

  it('lists strengths: stats whose whole interval is inside the range, profitable lines', () => {
    const d = diagnose(r, opts());
    expect(d.strengths.some((s) => s.title.includes('Open → 無人 3Bet'))).toBe(true);
    expect(d.strengths.every((s) => s.kind === 'strength')).toBe(true);
    expect(d.info.some((i) => i.title === '抽水是最大的固定成本')).toBe(true);
  });
});
