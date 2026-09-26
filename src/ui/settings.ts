import { useEffect, useState } from 'react';
import { DEFAULT_BOUNDS } from '../stats/aggregate';
import type { StatKey } from '../stats/definitions';
import type { StackBounds } from '../stats/types';

export interface Benchmark {
  min?: number;
  max?: number;
}

export interface Settings {
  bounds: StackBounds;
  /** Target ranges in percent (F14); AF uses the raw ratio */
  benchmarks: Partial<Record<StatKey | 'af', Benchmark>>;
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

export function outOfRange(value: number | null, b: Benchmark | undefined): 'low' | 'high' | null {
  if (value === null || !b) return null;
  if (b.min !== undefined && value < b.min) return 'low';
  if (b.max !== undefined && value > b.max) return 'high';
  return null;
}
