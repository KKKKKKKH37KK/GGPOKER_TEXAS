import { HERO, type Hand, type Street } from '../parser/types';
import { computeInvested } from '../stats/accounting';
import { cardToInt } from './evaluator';
import { hashSeed, potShares, type EquityOptions } from './equity';

const BOARD_LEN: Record<Street, number> = { PRE: 0, FLOP: 3, TURN: 4, RIVER: 5 };

export interface AllInSpot {
  /** Board cards known when the money went in */
  board: string[];
  live: string[];
}

/**
 * PRD §5.5 trigger: Hero is still in, someone is all-in, every live opponent's cards are shown,
 * and the betting ended before the river was dealt.
 */
export function findAllInSpot(hand: Hand): AllInSpot | null {
  if (hand.game !== 'NLHE' || !hand.heroCards) return null;
  const folded = new Set(hand.actions.filter((a) => a.type === 'fold').map((a) => a.player));
  const live = hand.players.map((p) => p.name).filter((p) => !folded.has(p));
  if (!live.includes(HERO) || live.length < 2) return null;
  if (!hand.actions.some((a) => a.allIn && live.includes(a.player))) return null;
  if (!live.every((p) => p === HERO || hand.shownCards[p]?.length === 2)) return null;

  const voluntary = hand.actions.filter((a) => !a.type.startsWith('post'));
  const last = voluntary[voluntary.length - 1];
  const boardLen = last ? BOARD_LEN[last.street] : 0;
  if (boardLen >= 5) return null;
  return { board: (hand.boards[0] ?? []).slice(0, boardLen), live };
}

/** Hero's equity-based net result in cents, or null when §5.5 does not apply. */
export function allInEvNet(hand: Hand, opts: EquityOptions = {}): number | null {
  return allInEv(hand, opts)?.net ?? null;
}

/**
 * Equity-based result in cents: `net` after the house take (proportional), `preRakeNet` before it
 * (equity × full pot − contribution, the way GG PokerCraft charts it).
 */
export function allInEv(hand: Hand, opts: EquityOptions = {}): { net: number; preRakeNet: number } | null {
  const spot = findAllInSpot(hand);
  if (!spot) return null;
  const invested = computeInvested(hand);

  // Side pots from the investment levels of live players; folded money feeds the pots it reached.
  const levels = [...new Set(spot.live.map((p) => invested[p] ?? 0))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: string[] }[] = [];
  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    for (const v of Object.values(invested)) amount += Math.max(0, Math.min(v, lvl) - prev);
    if (amount > 0) pots.push({ amount, eligible: spot.live.filter((p) => (invested[p] ?? 0) >= lvl) });
    prev = lvl;
  }
  if (pots.length === 0) return null;
  pots[0].amount += hand.cashDrop;

  const s = hand.summary;
  const takeRate = s.totalPot > 0 ? (s.rake + s.jackpot + s.bingo + s.fortune + s.tax) / s.totalPot : 0;

  const holes = spot.live.map((p) => (p === HERO ? hand.heroCards! : hand.shownCards[p]).map(cardToInt));
  const heroIdx = spot.live.indexOf(HERO);
  const shares = potShares(
    heroIdx,
    holes,
    spot.board.map(cardToInt),
    pots.map((pot) => pot.eligible.map((p) => spot.live.indexOf(p))),
    { seed: hashSeed(hand.id), ...opts },
  );
  const gross = pots.reduce((acc, pot, j) => acc + pot.amount * shares[j], 0);
  const mine = invested[HERO] ?? 0;
  return { net: gross * (1 - takeRate) - mine, preRakeNet: gross - mine };
}
