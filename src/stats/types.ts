import type { Position } from '../parser/types';
import type { StatKey } from './definitions';

export type PotType = 'UNOPENED' | 'SRP' | '3BP' | '4BP+';
export type StackGroup = 'S100' | 'S150' | 'S200';
export type SplitKey = 'IP' | 'OOP' | 'SRP' | '3BP' | '4BP+' | 'HU' | 'MW';

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
  stackBB: number;
  /** "AKs" / "T9o" / "QQ" */
  combo: string | null;
  walk: boolean;
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
  /** All-in EV net (cents) when §5.5 applies, else undefined */
  evNetCents?: number;
}

export interface StackBounds {
  /** ≤ low → 100bb group */
  low: number;
  /** > high → 200bb+ group */
  high: number;
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
  stats: Record<StatKey, Ratio>;
}

export interface GraphPoint {
  hand: number;
  total: number;
  showdown: number;
  nonShowdown: number;
  ev: number;
}

export interface GridCell {
  dealt: number;
  vpip: number;
  pfr: number;
  netBB: number;
}

export interface StatsResult {
  hands: number;
  walks: number;
  n: number;
  netCents: number;
  netBB: number;
  bb100: number | null;
  evNetBB: number;
  evHands: number;
  stats: Record<StatKey, Ratio>;
  af: Ratio;
  splits: Partial<Record<StatKey, Record<SplitKey, Ratio>>>;
  byPosition: Record<Position, GroupRow>;
  byStack: Record<StackGroup, GroupRow>;
  graph: GraphPoint[];
  grid: Record<string, GridCell>;
}
