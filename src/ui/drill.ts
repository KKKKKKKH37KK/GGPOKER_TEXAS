import { COMBINED, type StatKey } from '../stats/definitions';
import type { HandFacts } from '../stats/types';

/** A request to list the hands behind a number on the page. */
export interface Drill {
  title: string;
  /** When set, the list can switch between all opportunities / made / not made */
  statKey?: StatKey;
  match: (f: HandFacts) => boolean;
}

/** 1 = made, 0 = opportunity not taken, undefined = no opportunity (handles combined stats) */
export function statValue(f: HandFacts, key: StatKey): 0 | 1 | undefined {
  const parts = COMBINED[key];
  if (!parts) return f.s[key];
  for (const p of parts) if (f.s[p] !== undefined) return f.s[p];
  return undefined;
}
