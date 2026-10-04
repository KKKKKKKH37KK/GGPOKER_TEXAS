import { describe, expect, it } from 'vitest';
import { winrate } from '../src/stats/aggregate';
import { wilson } from '../src/ui/format';
import { benchFlag } from '../src/ui/settings';

describe('winrate', () => {
  it('mean and standard error', () => {
    const { bb100, se } = winrate([1, -1, 1, -1]);
    expect(bb100).toBe(0);
    // sample SD = √(4/3), SE = SD/√4 × 100
    expect(se).toBeCloseTo((Math.sqrt(4 / 3) / 2) * 100, 10);
    expect(winrate([]).bb100).toBeNull();
    expect(winrate([2]).se).toBeNull();
  });
});

describe('benchFlag (two-level)', () => {
  const range = { min: 22, max: 27 };
  it('strong when the whole Wilson interval is outside', () => {
    expect(benchFlag({ num: 1500, den: 5000 }, range)).toBe('high'); // 30%, CI ≈ 28.7–31.3
    expect(benchFlag({ num: 900, den: 5000 }, range)).toBe('low');
  });
  it('weak when only the point estimate is outside', () => {
    expect(benchFlag({ num: 9, den: 30 }, range)).toBe('high-weak'); // 30%, CI ≈ 17–48
    expect(wilson({ num: 9, den: 30 })![0]).toBeLessThan(27);
  });
  it('no flag inside the range or without data', () => {
    expect(benchFlag({ num: 25, den: 100 }, range)).toBeNull();
    expect(benchFlag({ num: 0, den: 0 }, range)).toBeNull();
    expect(benchFlag({ num: 50, den: 100 }, undefined)).toBeNull();
  });
});
