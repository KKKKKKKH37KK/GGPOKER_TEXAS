import { describe, expect, it } from 'vitest';
import { allInEv } from '../src/equity/allinEv';
import { cardToInt } from '../src/equity/evaluator';
import { potOutcome } from '../src/equity/equity';
import { analyzeHand } from '../src/stats/facts';
import { gradeOf, luckOf, normalCdf } from '../src/stats/luck';
import { hasZip, loadZip } from './helpers';

const ints = (s: string) => s.split(' ').map(cardToInt);

describe('potOutcome', () => {
  it('exact mean and SD on the turn (2 outs of 44, pot 100)', () => {
    const o = potOutcome(0, [ints('9c 9d'), ints('8c 8d')], ints('8h 5c 2s Kd'), [[0, 1]], [100]);
    const p = 2 / 44;
    expect(o.mean).toBeCloseTo(100 * p, 10);
    expect(o.sd).toBeCloseTo(100 * Math.sqrt(p * (1 - p)), 10);
  });

  it('a chopped board has no variance', () => {
    const o = potOutcome(0, [ints('Ac 2d'), ints('Ad 3c')], ints('Ks Qs Js Ts 9d'), [[0, 1]], [200]);
    expect(o.mean).toBe(100);
    expect(o.sd).toBe(0);
  });
});

describe('grading', () => {
  it('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.5)).toBeCloseTo(0.0668, 3);
  });

  it('five levels with the documented boundaries', () => {
    expect(gradeOf(-2).label).toBe('極差');
    expect(gradeOf(-1.5).label).toBe('偏差');
    expect(gradeOf(-0.6).label).toBe('偏差');
    expect(gradeOf(0).label).toBe('正常');
    expect(gradeOf(0.5).label).toBe('偏好');
    expect(gradeOf(1.5).label).toBe('極好');
  });
});

describe.skipIf(!hasZip)('luck on the reference data', () => {
  it('30 all-in spots, z = luck / SD', async () => {
    const { hands } = await loadZip();
    const facts = hands.map((h) => {
      const f = analyzeHand(h);
      const v = allInEv(h, { trials: 20_000 });
      return v ? { ...f, evNetCents: v.net, evSdCents: v.sd } : f;
    });
    const l = luckOf(facts);
    expect(l.n).toBe(30);
    expect(l.sdBB).toBeGreaterThan(0);
    expect(l.z).toBeCloseTo(l.luckBB / l.sdBB, 10);
    // −270 bb of all-in luck against an expected swing of ~±358 bb (30 deep all-ins): z ≈ −0.75 → 偏差
    expect(l.luckBB).toBeCloseTo(-270, -1);
    expect(l.z!).toBeGreaterThan(-1);
    expect(l.z!).toBeLessThan(-0.5);
    expect(l.grade?.label).toBe('偏差');
  });

  it('no grade below 10 all-ins', () => {
    expect(luckOf([]).grade).toBeNull();
  });
});
