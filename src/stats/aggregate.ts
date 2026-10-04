import type { Hand, Position } from '../parser/types';
import { COMBINED, STAT_DEFS, STAT_KEYS, type StatKey } from './definitions';
import { analyzeHand } from './facts';
import type {
  Filter, GraphPoint, GridCell, GroupRow, HandFacts, Ratio, SplitKey, StackBounds, StackGroup, StatsResult,
} from './types';

export const POSITIONS: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const STACK_GROUPS: StackGroup[] = ['S100', 'S150', 'S200'];
export const DEFAULT_BOUNDS: StackBounds = { low: 125, high: 175, basis: 'effective' };
const SPLIT_KEYS: SplitKey[] = ['IP', 'OOP', 'SRP', '3BP', '4BP+', 'HU', 'MW'];
const MAX_GRAPH_POINTS = 2000;

export function stackGroup(f: Pick<HandFacts, 'stackBB' | 'effStackBB'>, b: StackBounds = DEFAULT_BOUNDS): StackGroup {
  const bb = b.basis === 'hero' ? f.stackBB : f.effStackBB;
  return bb <= b.low ? 'S100' : bb <= b.high ? 'S150' : 'S200';
}

export function applyFilter(facts: HandFacts[], f: Filter = {}, bounds: StackBounds = DEFAULT_BOUNDS): HandFacts[] {
  return facts.filter((x) => {
    const day = x.timestamp.slice(0, 10);
    if (f.dateFrom && day < f.dateFrom) return false;
    if (f.dateTo && day > f.dateTo) return false;
    if (f.positions?.length && !f.positions.includes(x.position)) return false;
    if (f.stackGroups?.length && !f.stackGroups.includes(stackGroup(x, bounds))) return false;
    // Pot type is only meaningful for pots Hero played: otherwise preflop stats get conditioned on the outcome.
    if (f.potTypes?.length && (!x.sawFlop || !f.potTypes.includes(x.potType))) return false;
    return true;
  });
}

const ratio = (): Ratio => ({ num: 0, den: 0 });

function statsOf(facts: HandFacts[]): Record<StatKey, Ratio> {
  const out = Object.fromEntries(STAT_KEYS.map((k) => [k, ratio()])) as Record<StatKey, Ratio>;
  let aggr = 0;
  let passive = 0;
  for (const f of facts) {
    for (const k in f.s) {
      const v = f.s[k as StatKey]!;
      out[k as StatKey].den++;
      out[k as StatKey].num += v;
    }
    aggr += f.aggr;
    passive += f.calls + f.folds;
  }
  out.afq = { num: aggr, den: aggr + passive };
  for (const [k, parts] of Object.entries(COMBINED) as [StatKey, StatKey[]][]) {
    out[k] = parts.reduce((acc, p) => ({ num: acc.num + out[p].num, den: acc.den + out[p].den }), ratio());
  }
  return out;
}

/** bb/100 and its standard error from per-hand results in bb (sample SD × 100 / √n). */
export function winrate(perHandBB: number[]): { bb100: number | null; se: number | null } {
  const n = perHandBB.length;
  if (n === 0) return { bb100: null, se: null };
  const mean = perHandBB.reduce((a, x) => a + x, 0) / n;
  if (n < 2) return { bb100: mean * 100, se: null };
  const variance = perHandBB.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return { bb100: mean * 100, se: Math.sqrt(variance / n) * 100 };
}

const netBBOf = (f: HandFacts) => f.netCents / f.bb;
const evBBOf = (f: HandFacts) => (f.evNetCents ?? f.netCents) / f.bb;

function groupRow(facts: HandFacts[]): GroupRow {
  const netCents = facts.reduce((a, f) => a + f.netCents, 0);
  const netBB = facts.reduce((a, f) => a + netBBOf(f), 0);
  const wr = winrate(facts.map(netBBOf));
  return {
    hands: facts.length,
    netCents,
    netBB,
    bb100: wr.bb100,
    bb100Se: wr.se,
    stats: statsOf(facts),
  };
}

function splitsOf(facts: HandFacts[]): StatsResult['splits'] {
  const out: StatsResult['splits'] = {};
  for (const key of STAT_KEYS) {
    if (!STAT_DEFS[key].splittable) continue;
    const row = Object.fromEntries(SPLIT_KEYS.map((k) => [k, ratio()])) as Record<SplitKey, Ratio>;
    for (const f of facts) {
      const v = f.s[key];
      const c = f.ctx[key];
      if (v === undefined || !c) continue;
      const pot = f.potType === 'UNOPENED' ? null : f.potType;
      for (const k of [c.ip ? 'IP' : 'OOP', c.multiway ? 'MW' : 'HU', pot] as (SplitKey | null)[]) {
        if (!k) continue;
        row[k].den++;
        row[k].num += v;
      }
    }
    out[key] = row;
  }
  return out;
}

function graphOf(facts: HandFacts[]): GraphPoint[] {
  const step = Math.max(1, Math.ceil(facts.length / MAX_GRAPH_POINTS));
  const pts: GraphPoint[] = [{ hand: 0, total: 0, showdown: 0, nonShowdown: 0, ev: 0 }];
  let total = 0;
  let sd = 0;
  let nsd = 0;
  let ev = 0;
  facts.forEach((f, i) => {
    const bb = f.netCents / f.bb;
    total += bb;
    if (f.wtsd) sd += bb;
    else nsd += bb;
    ev += (f.evNetCents ?? f.netCents) / f.bb;
    if ((i + 1) % step === 0 || i === facts.length - 1) {
      pts.push({ hand: i + 1, total, showdown: sd, nonShowdown: nsd, ev });
    }
  });
  return pts;
}

function gridOf(facts: HandFacts[]): Record<string, GridCell> {
  const grid: Record<string, GridCell> = {};
  for (const f of facts) {
    if (!f.combo || f.walk) continue; // walks have no decision: they would dilute VPIP/PFR per combo
    const c = (grid[f.combo] ??= { dealt: 0, vpip: 0, pfr: 0, netBB: 0, rfiOpp: 0, rfi: 0 });
    c.dealt++;
    c.vpip += f.s.vpip ?? 0;
    c.pfr += f.s.pfr ?? 0;
    const rfi = f.s[`rfi${f.position}` as StatKey];
    if (rfi !== undefined) {
      c.rfiOpp++;
      c.rfi += rfi;
    }
    c.netBB += f.netCents / f.bb;
  }
  return grid;
}

/** Aggregates precomputed facts. Cheap enough to rerun on every filter change. */
export function aggregate(all: HandFacts[], filter: Filter = {}, bounds: StackBounds = DEFAULT_BOUNDS): StatsResult {
  const facts = applyFilter(all, filter, bounds);
  const walks = facts.filter((f) => f.walk).length;
  const netCents = facts.reduce((a, f) => a + f.netCents, 0);
  const netBB = facts.reduce((a, f) => a + f.netCents / f.bb, 0);
  const evFacts = facts.filter((f) => f.evNetCents !== undefined);
  const stats = statsOf(facts);
  const aggr = facts.reduce((a, f) => a + f.aggr, 0);
  const calls = facts.reduce((a, f) => a + f.calls, 0);

  const byPosition = Object.fromEntries(
    POSITIONS.map((p) => [p, groupRow(facts.filter((f) => f.position === p))]),
  ) as Record<Position, GroupRow>;
  const byStack = Object.fromEntries(
    STACK_GROUPS.map((g) => [g, groupRow(facts.filter((f) => stackGroup(f, bounds) === g))]),
  ) as Record<StackGroup, GroupRow>;
  const wr = winrate(facts.map(netBBOf));
  const evWr = winrate(facts.map(evBBOf));

  return {
    hands: facts.length,
    walks,
    n: facts.length - walks,
    netCents,
    netBB,
    bb100: wr.bb100,
    bb100Se: wr.se,
    evNetBB: facts.reduce((a, f) => a + evBBOf(f), 0),
    evBb100: evWr.bb100,
    evBb100Se: evWr.se,
    evHands: evFacts.length,
    stats,
    af: { num: aggr, den: calls },
    splits: splitsOf(facts),
    byPosition,
    byStack,
    graph: graphOf(facts),
    grid: gridOf(facts),
  };
}

/** PRD §9.2 API: Hand[] → StatsResult */
export function computeStats(hands: Hand[], filter?: Filter, bounds?: StackBounds): StatsResult {
  return aggregate(hands.map(analyzeHand), filter, bounds);
}
