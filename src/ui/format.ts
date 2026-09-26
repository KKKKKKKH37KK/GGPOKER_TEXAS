import type { Ratio } from '../stats/types';

/** Samples below this are shown greyed out (PRD §5.6) */
export const MIN_SAMPLE = 30;

export function pctText(r: Ratio, digits = 1): string {
  return r.den === 0 ? '—' : `${((r.num / r.den) * 100).toFixed(digits)}%`;
}

export function pctValue(r: Ratio): number | null {
  return r.den === 0 ? null : (r.num / r.den) * 100;
}

/** 95% Wilson score interval, in percent */
export function wilson(r: Ratio, z = 1.96): [number, number] | null {
  if (r.den === 0) return null;
  const n = r.den;
  const p = r.num / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half) * 100, Math.min(1, center + half) * 100];
}

export function signed(v: number, digits = 2): string {
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function dollars(cents: number): string {
  const abs = Math.abs(cents);
  const s = `$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
  return cents > 0 ? `+${s}` : cents < 0 ? `−${s}` : s;
}

export const int = (n: number) => n.toLocaleString('en-US');

export const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'pos' : 'neg');
