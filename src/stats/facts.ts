import { HERO, type Hand } from '../parser/types';
import { computeInvested, heroNet } from './accounting';
import { analyzePostflop } from './postflop';
import { analyzePreflop } from './preflop';
import type { HandFacts } from './types';

const RANKS = 'AKQJT98765432';

/** ["Qc","Ad"] → "AQo" */
export function comboLabel(cards: string[] | null): string | null {
  if (!cards || cards.length !== 2) return null;
  const [a, b] = [...cards].sort((x, y) => RANKS.indexOf(x[0]) - RANKS.indexOf(y[0]));
  if (a[0] === b[0]) return a[0] + b[0];
  return a[0] + b[0] + (a[1] === b[1] ? 's' : 'o');
}

/**
 * Effective stack in chips: Hero vs the deepest opponent still involved —
 * at the flop if Hero saw it, otherwise when Hero made the last preflop decision (walk: whole table).
 */
export function effectiveStack(hand: Hand, sawFlop: boolean): number {
  const hero = hand.players.find((p) => p.name === HERO)!;
  const folded = new Set<string>();
  let lastHeroIdx = -1;
  hand.actions.forEach((a, i) => {
    if (a.street === 'PRE' && a.player === HERO && !a.type.startsWith('post')) lastHeroIdx = i;
  });
  let end: number;
  if (sawFlop) {
    const firstPost = hand.actions.findIndex((a) => a.street !== 'PRE');
    end = firstPost < 0 ? hand.actions.length : firstPost; // preflop all-in: no postflop actions
  } else {
    end = Math.max(0, lastHeroIdx); // walk (no Hero decision): whole table
  }
  for (let i = 0; i < end; i++) if (hand.actions[i].type === 'fold') folded.add(hand.actions[i].player);
  const opp = hand.players.filter((p) => p.name !== HERO && !folded.has(p.name));
  const deepest = Math.max(0, ...opp.map((p) => p.stack));
  return Math.min(hero.stack, deepest || hero.stack);
}

/**
 * Hero's share of the house take, in (fractional) cents, by two common attribution methods:
 * - contributed: each fee split by share of money invested (how most sites compute rakeback)
 * - won: fees deducted from the pots Hero collected, split by share of the collection
 * plus Hero's share of promotional Cash Drop money.
 */
export function rakeShares(hand: Hand, invested: Record<string, number>) {
  const s = hand.summary;
  const jackpot = s.jackpot + s.bingo + s.fortune + s.tax;
  const totalInv = Object.values(invested).reduce((a, b) => a + b, 0);
  const invShare = totalInv > 0 ? (invested[HERO] ?? 0) / totalInv : 0;
  const totalCol = Object.values(hand.collected).reduce((a, b) => a + b, 0);
  const colShare = totalCol > 0 ? (hand.collected[HERO] ?? 0) / totalCol : 0;
  return {
    rakeContrib: s.rake * invShare,
    jackpotContrib: jackpot * invShare,
    takeWon: (s.rake + jackpot) * colShare,
    cashDropWon: hand.cashDrop * colShare,
  };
}

export function analyzeHand(hand: Hand): HandFacts {
  const heroSeat = hand.players.find((p) => p.name === HERO);
  if (!heroSeat) throw new Error(`${hand.id}: Hero not seated`);
  const pre = analyzePreflop(hand, heroSeat.position);
  const post = analyzePostflop(hand, pre.pfa, pre.heroFolded, pre.walk);
  const invested = computeInvested(hand);
  return {
    id: hand.id,
    timestamp: hand.timestamp,
    position: heroSeat.position,
    bb: hand.bb,
    stackBB: heroSeat.stack / hand.bb,
    effStackBB: effectiveStack(hand, post.sawFlop) / hand.bb,
    sawFlop: post.sawFlop,
    combo: comboLabel(hand.heroCards),
    walk: pre.walk,
    potType: pre.potType,
    s: { ...pre.s, ...post.s },
    ctx: post.ctx,
    aggr: post.aggr,
    calls: post.calls,
    folds: post.folds,
    wtsd: post.wtsd,
    netCents: heroNet(hand, invested),
    rake: rakeShares(hand, invested),
  };
}
