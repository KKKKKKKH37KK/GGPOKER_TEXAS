import { HERO, type Action, type Hand, type Position, type Street } from '../parser/types';
import { computeInvested, heroNet } from './accounting';

export interface ReplayAction {
  player: string;
  position: Position | null;
  isHero: boolean;
  /** Chinese + English verb, e.g. "加注到 raise to" */
  verb: string;
  /** Amount in bb (call/bet amount, raise-to total, blind), if any */
  amountBB?: number;
  allIn: boolean;
  /** Pot in bb after this action */
  potBB: number;
}

export interface ReplayStreet {
  street: Street;
  /** Full board visible on this street (first run) */
  board: string[];
  /** Cards dealt on this street */
  newCards: string[];
  potStartBB: number;
  actions: ReplayAction[];
}

export interface Replay {
  id: string;
  timestamp: string;
  tableName: string;
  stakes: string;
  players: { seat: number; name: string; position: Position; stackBB: number; isHero: boolean; cards: string[] | null }[];
  streets: ReplayStreet[];
  /** All boards (two when run twice) */
  boards: string[][];
  runItTwice: boolean;
  collected: { player: string; position: Position | null; bb: number }[];
  uncalled: { player: string; bb: number }[];
  cashDropBB: number;
  totalPotBB: number;
  rakeBB: number;
  heroNetBB: number;
}

const BOARD_LEN: Record<Street, number> = { PRE: 0, FLOP: 3, TURN: 4, RIVER: 5 };
const VERB: Record<Action['type'], string> = {
  postSB: '小盲 posts SB',
  postBB: '大盲 posts BB',
  postOther: '前注/補盲 posts',
  fold: '棄牌 fold',
  check: '過牌 check',
  call: '跟注 call',
  bet: '下注 bet',
  raise: '加注到 raise to',
};

/** Turns a parsed hand into a street-by-street script with the running pot (in bb). */
export function buildReplay(hand: Hand): Replay {
  const bb = hand.bb;
  const posOf = new Map(hand.players.map((p) => [p.name, p.position]));
  const streets: ReplayStreet[] = [];
  let pot = hand.cashDrop;
  let streetIn: Record<string, number> = {};
  const ORDER: Street[] = ['PRE', 'FLOP', 'TURN', 'RIVER'];
  const openStreet = (st: Street, prev: ReplayStreet | null): ReplayStreet => {
    const board = (hand.boards[0] ?? []).slice(0, BOARD_LEN[st]);
    const next: ReplayStreet = { street: st, board, newCards: board.slice(prev?.board.length ?? 0), potStartBB: pot / bb, actions: [] };
    streets.push(next);
    streetIn = {};
    return next;
  };
  let cur = openStreet('PRE', null);

  for (const a of hand.actions) {
    while (cur.street !== a.street) cur = openStreet(ORDER[ORDER.indexOf(cur.street) + 1], cur);
    const before = streetIn[a.player] ?? 0;
    let put = 0;
    let shown: number | undefined;
    if (a.type === 'raise') {
      put = (a.raiseTo ?? 0) - before;
      shown = a.raiseTo;
    } else if (a.type === 'call' || a.type === 'bet' || a.type === 'postSB' || a.type === 'postBB' || a.type === 'postOther') {
      put = a.amount;
      shown = a.amount;
    }
    if (a.type !== 'postOther') streetIn[a.player] = before + put;
    pot += put;
    cur.actions.push({
      player: a.player,
      position: posOf.get(a.player) ?? null,
      isHero: a.player === HERO,
      verb: VERB[a.type],
      amountBB: shown === undefined ? undefined : shown / bb,
      allIn: a.allIn,
      potBB: pot / bb,
    });
  }
  // Streets dealt after an all-in have no actions but still show their cards.
  const finalLen = hand.boards[0]?.length ?? 0;
  while (cur.board.length < finalLen) cur = openStreet(ORDER[ORDER.indexOf(cur.street) + 1], cur);

  const uncalled = Object.entries(hand.uncalledReturned).map(([player, v]) => ({ player, bb: v / bb }));
  const s = hand.summary;
  return {
    id: hand.id,
    timestamp: hand.timestamp.replace('T', ' '),
    tableName: hand.tableName,
    stakes: `$${(hand.sb / 100).toFixed(2)}/$${(hand.bb / 100).toFixed(2)}`,
    players: hand.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      position: p.position,
      stackBB: p.stack / bb,
      isHero: p.name === HERO,
      cards: p.name === HERO ? hand.heroCards : hand.shownCards[p.name] ?? null,
    })),
    streets,
    boards: hand.boards,
    runItTwice: hand.runItTwice,
    collected: Object.entries(hand.collected).map(([player, v]) => ({ player, position: posOf.get(player) ?? null, bb: v / bb })),
    uncalled,
    cashDropBB: hand.cashDrop / bb,
    totalPotBB: s.totalPot / bb,
    rakeBB: (s.rake + s.jackpot + s.bingo + s.fortune + s.tax) / bb,
    heroNetBB: heroNet(hand, computeInvested(hand)) / bb,
  };
}
