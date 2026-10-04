// All-in luck as a z-score: (actual − all-in EV) summed over all-in hands, divided by the standard
// deviation those all-ins were expected to produce. Only all-ins with every hand shown are measurable;
// other hands have no objective "deserved" result, so they are left out on purpose.

import type { HandFacts } from './types';

export const MIN_LUCK_HANDS = 10;

export interface LuckGrade {
  level: 1 | 2 | 3 | 4 | 5;
  icon: string;
  label: string;
}

export const LUCK_GRADES: (LuckGrade & { minZ: number })[] = [
  { level: 1, icon: '⛈️', label: '極差', minZ: -Infinity },
  { level: 2, icon: '🌧️', label: '偏差', minZ: -1.5 },
  { level: 3, icon: '☁️', label: '正常', minZ: -0.5 },
  { level: 4, icon: '🌤️', label: '偏好', minZ: 0.5 },
  { level: 5, icon: '☀️', label: '極好', minZ: 1.5 },
];

export function gradeOf(z: number): LuckGrade {
  let g = LUCK_GRADES[0];
  for (const x of LUCK_GRADES) if (z >= x.minZ) g = x;
  return { level: g.level, icon: g.icon, label: g.label };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7) */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface Luck {
  /** All-in hands measured */
  n: number;
  /** Σ(actual − EV), bb */
  luckBB: number;
  /** √Σ variance, bb */
  sdBB: number;
  z: number | null;
  /** Share of possible outcomes that would have been worse than this one */
  percentile: number | null;
  grade: LuckGrade | null;
}

export function luckOf(facts: HandFacts[]): Luck {
  let n = 0;
  let luck = 0;
  let variance = 0;
  for (const f of facts) {
    if (f.evNetCents === undefined || f.evSdCents === undefined) continue;
    n++;
    luck += (f.netCents - f.evNetCents) / f.bb;
    variance += (f.evSdCents / f.bb) ** 2;
  }
  const sd = Math.sqrt(variance);
  const z = n >= MIN_LUCK_HANDS && sd > 0 ? luck / sd : null;
  return { n, luckBB: luck, sdBB: sd, z, percentile: z === null ? null : normalCdf(z), grade: z === null ? null : gradeOf(z) };
}
