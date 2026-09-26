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

export function analyzeHand(hand: Hand): HandFacts {
  const heroSeat = hand.players.find((p) => p.name === HERO);
  if (!heroSeat) throw new Error(`${hand.id}: Hero not seated`);
  const pre = analyzePreflop(hand, heroSeat.position);
  const post = analyzePostflop(hand, pre.pfa, pre.heroFolded, pre.walk);
  return {
    id: hand.id,
    timestamp: hand.timestamp,
    position: heroSeat.position,
    bb: hand.bb,
    stackBB: heroSeat.stack / hand.bb,
    combo: comboLabel(hand.heroCards),
    walk: pre.walk,
    potType: pre.potType,
    s: { ...pre.s, ...post.s },
    ctx: post.ctx,
    aggr: post.aggr,
    calls: post.calls,
    folds: post.folds,
    wtsd: post.wtsd,
    netCents: heroNet(hand, computeInvested(hand)),
  };
}
