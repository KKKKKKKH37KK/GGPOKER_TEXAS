import { useEffect, useState } from 'react';
import { DEFAULT_BOUNDS } from '../stats/aggregate';
import { AF_DEF, STAT_DEFS, type StatKey } from '../stats/definitions';
import type { Ratio, StackBounds } from '../stats/types';
import { pctValue, wilson } from './format';

export interface Benchmark {
  min?: number;
  max?: number;
}

export type BenchKey = StatKey | 'af';

export interface Settings {
  bounds: StackBounds;
  /** User overrides of the reference ranges (F14); keys not present fall back to the built-in defaults */
  benchmarks: Partial<Record<BenchKey, Benchmark>>;
}

const KEY = 'hh-stats-viewer.settings.v1';
const DEFAULTS: Settings = { bounds: DEFAULT_BOUNDS, benchmarks: {} };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return { bounds: { ...DEFAULTS.bounds, ...s.bounds }, benchmarks: s.benchmarks ?? {} };
  } catch {
    return DEFAULTS;
  }
}

/** Settings live only in this browser (localStorage); nothing is uploaded. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode); settings then last for the session only.
    }
  }, [settings]);
  return [settings, setSettings] as const;
}

export function defaultBench(k: BenchKey): Benchmark | undefined {
  const ref = k === 'af' ? AF_DEF.ref : STAT_DEFS[k].ref;
  return ref ? { min: ref[0], max: ref[1] } : undefined;
}

/** The user's override if set, else the built-in reference range */
export function benchFor(settings: Settings, k: BenchKey): Benchmark | undefined {
  return k in settings.benchmarks ? settings.benchmarks[k] : defaultBench(k);
}

export function benchText(b: Benchmark | undefined, unit = '%'): string {
  if (!b || (b.min === undefined && b.max === undefined)) return '';
  return `${b.min ?? ''}–${b.max ?? ''}${unit}`;
}

export type BenchFlag = 'low' | 'high' | 'low-weak' | 'high-weak' | null;

/**
 * Strong flag: the whole 95% Wilson interval is outside the range (the deviation is real).
 * Weak flag: only the point estimate is outside (could still be noise).
 */
export function benchFlag(r: Ratio, b: Benchmark | undefined): BenchFlag {
  const v = pctValue(r);
  if (v === null || !b) return null;
  const ci = wilson(r)!;
  if (b.min !== undefined && v < b.min) return ci[1] < b.min ? 'low' : 'low-weak';
  if (b.max !== undefined && v > b.max) return ci[0] > b.max ? 'high' : 'high-weak';
  return null;
}

/** For plain values without a sampling interval (AF): always a weak flag */
export function valueFlag(v: number | null, b: Benchmark | undefined): BenchFlag {
  if (v === null || !b) return null;
  if (b.min !== undefined && v < b.min) return 'low-weak';
  if (b.max !== undefined && v > b.max) return 'high-weak';
  return null;
}
