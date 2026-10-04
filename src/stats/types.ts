import type { Position } from '../parser/types';
import type { StatKey } from './definitions';

export type PotType = 'UNOPENED' | 'SRP' | '3BP' | '4BP+';
export type StackGroup = 'S100' | 'S150' | 'S200';
export type SplitKey = 'IP' | 'OOP' | 'SRP' | '3BP' | '4BP+' | 'HU' | 'MW';

export interface RakeShares {
  rakeContrib: number;
  jackpotContrib: number;
  takeWon: number;
  cashDropWon: number;
}

export interface Ratio {
  num: number;
  den: number;
}

/** Street context of a CBet-family decision */
export interface SpotCtx {
  ip: boolean;
  multiway: boolean;
}

/** Everything the aggregator needs about one hand, computed once (in the worker). */
export interface HandFacts {
  id: string;
  timestamp: string;
  position: Position;
  bb: number;
  /** Hero's starting stack in bb */
  stackBB: number;
  /** Effective stack in bb (see effectiveStack) */
  effStackBB: number;
  sawFlop: boolean;
  /** "AKs" / "T9o" / "QQ" */
  combo: string | null;
  heroCards: string[] | null;
  /** First-run board */
  board: string[];
  walk: boolean;
  /** Hero's preflop action line (see lineOf) */
  line: string;
  potType: PotType;
  /** Recorded ratio stats: key present = opportunity, value 1 = made */
  s: Partial<Record<StatKey, 0 | 1>>;
  ctx: Partial<Record<StatKey, SpotCtx>>;
  /** Postflop action counts for AF / AFq */
  aggr: number;
  calls: number;
  folds: number;
  wtsd: boolean;
  netCents: number;
  /** Hero's share of rake / jackpot fees and Cash Drop, fractional cents (see rakeShares) */
  rake: RakeShares;
  /** All-in EV net (cents) when §5.5 applies, else undefined */
  evNetCents?: number;
  /** All-in EV before rake (equity × full pot − contribution), cents */
  evPreRakeCents?: number;
}

export interface StackBounds {
  /** ≤ low → 100bb group */
  low: number;
  /** > high → 200bb+ group */
  high: number;
  /** Group by effective stack (default) or Hero's own starting stack */
  basis?: 'effective' | 'hero';
}

export interface Filter {
  dateFrom?: string; // YYYY-MM-DD inclusive
  dateTo?: string;
  positions?: Position[];
  stackGroups?: StackGroup[];
  potTypes?: PotType[];
}

export interface GroupRow {
  hands: number;
  netCents: number;
  netBB: number;
  bb100: number | null;
  /** Standard error of bb/100 */
  bb100Se: number | null;
  stats: Record<StatKey, Ratio>;
}

export interface GraphPoint {
  hand: number;
  total: number;
  showdown: number;
  nonShowdown: number;
  ev: number;
  /** Before rake: rake + jackpot taken from the pots Hero won are added back (GG PokerCraft style) */
  preRake: number;
  evPreRake: number;
}

export interface LineRow {
  line: string;
  hands: number;
  netBB: number;
  /** Mean bb per hand and its standard error */
  perHand: number;
  perHandSe: number | null;
  /** Mean All-in-EV-adjusted bb per hand */
  evPerHand: number;
}

export interface GridCell {
  dealt: number;
  vpip: number;
  pfr: number;
  netBB: number;
  /** RFI opportunities / raises (first in, unopened) */
  rfiOpp: number;
  rfi: number;
}

export interface StatsResult {
  hands: number;
  walks: number;
  n: number;
  netCents: number;
  netBB: number;
  bb100: number | null;
  bb100Se: number | null;
  evNetBB: number;
  evBb100: number | null;
  evBb100Se: number | null;
  evHands: number;
  /** Σ of Hero's rake shares, in bb */
  rakeBB: RakeShares;
  rakeCents: RakeShares;
  stats: Record<StatKey, Ratio>;
  af: Ratio;
  splits: Partial<Record<StatKey, Record<SplitKey, Ratio>>>;
  byPosition: Record<Position, GroupRow>;
  byStack: Record<StackGroup, GroupRow>;
  graph: GraphPoint[];
  grid: Record<string, GridCell>;
  /** Results by preflop action line, worst total first */
  lines: LineRow[];
  /** Same, with the opener position merged */
  linesCoarse: LineRow[];
}
