import { describe, expect, it } from 'vitest';
import { cardToInt, categoryOf, evaluate } from '../src/equity/evaluator';
import { potShares } from '../src/equity/equity';
import { allInEvNet, findAllInSpot } from '../src/equity/allinEv';
import { analyzeHand } from '../src/stats/facts';
import { fixture, hasZip, loadZip } from './helpers';

const ev = (s: string) => evaluate(s.split(' ').map(cardToInt));
const ints = (s: string) => s.split(' ').map(cardToInt);

describe('evaluator', () => {
  it('ranks categories', () => {
    expect(categoryOf(ev('As Ks Qs Js Ts 2d 3c'))).toBe('Straight flush');
    expect(categoryOf(ev('9c 9d 9h 9s 2d 3c 4h'))).toBe('Quads');
    expect(categoryOf(ev('9c 9d 9h 2s 2d 3c 4h'))).toBe('Full house');
    expect(categoryOf(ev('9c 9d 9h 2s 2d 2c 4h'))).toBe('Full house');
    expect(categoryOf(ev('Ac 9c 7c 4c 2c Kd Kh'))).toBe('Flush');
    expect(categoryOf(ev('Ac 2d 3h 4s 5c Kd Qh'))).toBe('Straight');
    expect(categoryOf(ev('9c 9d 9h As 2d 3c 7h'))).toBe('Trips');
    expect(categoryOf(ev('9c 9d 8h 8s 2d 3c 7h'))).toBe('Two pair');
    expect(categoryOf(ev('9c 9d 8h 7s 2d 3c Jh'))).toBe('Pair');
    expect(categoryOf(ev('Ac Td 8h 7s 2d 3c Jh'))).toBe('High card');
  });

  it('orders within categories', () => {
    expect(ev('Ac 2d 3h 4s 5c Kd Qh')).toBeLessThan(ev('2c 3d 4h 5s 6c Kd Qh')); // wheel < 6-high
    expect(ev('As Ad Kh Kc Qd 2s 3s')).toBeGreaterThan(ev('As Ad Kh Kc Jd 2s 3s')); // kicker
    expect(ev('9c 9d 9h 9s Ad 2c 3h')).toBeGreaterThan(ev('9c 9d 9h 9s Kd Qc Jh'));
    expect(ev('Kc Kd Kh 2s 2d 3c 4h')).toBeGreaterThan(ev('Qc Qd Qh As Ad 3c 4h'));
    // Two pair: third pair ignored, best kicker used
    expect(ev('Ac Ad Kh Kc 2d 2s 7h')).toBe(ev('Ac Ad Kh Kc 7d 3s 4h'));
  });
});

describe('potShares', () => {
  it('AA vs KK preflop ≈ 82%', () => {
    const [s] = potShares(0, [ints('As Ah'), ints('Kd Ks')], [], [[0, 1]], { trials: 100_000 });
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(0.84);
  });

  it('exact on the turn', () => {
    // AK vs a set of queens with one card to come: drawing dead.
    expect(potShares(0, [ints('Ac Kc'), ints('Qc Qs')], ints('Qd 7c 2s 3h'), [[0, 1]])[0]).toBe(0);
    // 99 vs 88 on 8-high board: Hero needs one of 2 nines out of 44 cards.
    expect(potShares(0, [ints('9c 9d'), ints('8c 8d')], ints('8h 5c 2s Kd'), [[0, 1]])[0]).toBeCloseTo(2 / 44, 10);
  });

  it('split pot counts half', () => {
    const [s] = potShares(0, [ints('Ac 2d'), ints('Ad 3c')], ints('Ks Qs Js Ts 9d'), [[0, 1]]);
    expect(s).toBe(0.5);
  });

  it('side pot: short stack is not eligible', () => {
    const shares = potShares(0, [ints('Ac Ad'), ints('Kc Kd'), ints('2h 2s')], ints('Ah Kh 2c'), [[0, 1, 2], [0, 1]]);
    // Hero has top set; others need runner-runner (quads, hearts for 22, broadway…).
    expect(shares[0]).toBeGreaterThan(0.8);
    expect(shares[1]).toBeGreaterThan(0.8);
    // The side pot excludes 22, so Hero can only do better there.
    expect(shares[1]).toBeGreaterThanOrEqual(shares[0]);
  });
});

describe('all-in EV', () => {
  it('no spot when Hero folded', () => {
    expect(findAllInSpot(fixture('RC4772496598'))).toBeNull();
    expect(allInEvNet(fixture('RC4772226199'))).toBeNull();
  });

  // Hero is in 50 all-in hands (the PRD's "約 50 手"): 7 uncalled, 13 all-in on the river (no EV adjustment),
  // and 30 called before the board was complete — those 30 get an EV value (15 preflop, 6 flop, 9 turn).
  it.skipIf(!hasZip)('reference data: 30 EV spots, EV sums are sane', async () => {
    const { hands } = await loadZip();
    let spots = 0;
    let evSum = 0;
    let actualSum = 0;
    for (const h of hands) {
      const e = allInEvNet(h, { trials: 20_000 });
      if (e === null) continue;
      spots++;
      evSum += e;
      actualSum += analyzeHand(h).netCents;
    }
    expect(spots).toBe(30);
    expect(Number.isFinite(evSum)).toBe(true);
    // EV and actual should be the same order of magnitude over ~50 all-ins at NL10.
    expect(Math.abs(evSum - actualSum)).toBeLessThan(20_000);
  });
});
