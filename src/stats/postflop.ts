import { HERO, type Action, type Hand, type Position, type Street } from '../parser/types';
import type { StatKey } from './definitions';
import type { SpotCtx } from './types';

/** Postflop acting order */
const ORDER: Position[] = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

export interface PostflopResult {
  s: Partial<Record<StatKey, 0 | 1>>;
  ctx: Partial<Record<StatKey, SpotCtx>>;
  aggr: number;
  calls: number;
  folds: number;
  sawFlop: boolean;
  wtsd: boolean;
}

const isBet = (a: Action) => a.type === 'bet' || a.type === 'raise';

export function analyzePostflop(hand: Hand, pfa: string | null, heroFoldedPre: boolean, walk: boolean): PostflopResult {
  const s: Partial<Record<StatKey, 0 | 1>> = {};
  const ctx: Partial<Record<StatKey, SpotCtx>> = {};
  const bit = (b: boolean): 0 | 1 => (b ? 1 : 0);
  const out: PostflopResult = { s, ctx, aggr: 0, calls: 0, folds: 0, sawFlop: false, wtsd: false };
  if (walk) return out;

  const flopDealt = (hand.boards[0]?.length ?? 0) >= 3;
  out.sawFlop = !heroFoldedPre && flopDealt;
  s.sawFlop = bit(out.sawFlop);
  if (!out.sawFlop) return out;

  const won = (hand.collected[HERO] ?? 0) > 0;
  out.wtsd = hand.showedDown.includes(HERO);
  s.wtsd = bit(out.wtsd);
  s.wwsf = bit(won);
  if (out.wtsd) s.wsd = bit(won);

  const orderOf = new Map(hand.players.map((p) => [p.name, ORDER.indexOf(p.position)]));
  const byStreet: Record<Street, Action[]> = { PRE: [], FLOP: [], TURN: [], RIVER: [] };
  for (const a of hand.actions) byStreet[a.street].push(a);

  // Players still in the hand when each street starts.
  const alive = new Set(hand.players.map((p) => p.name));
  const aliveAt: Partial<Record<Street, string[]>> = {};
  for (const st of ['PRE', 'FLOP', 'TURN', 'RIVER'] as Street[]) {
    aliveAt[st] = [...alive];
    for (const a of byStreet[st]) if (a.type === 'fold') alive.delete(a.player);
  }
  const spot = (st: Street): SpotCtx => {
    const players = aliveAt[st] ?? [];
    const heroOrder = orderOf.get(HERO) ?? 0;
    return { ip: players.every((p) => (orderOf.get(p) ?? 0) <= heroOrder), multiway: players.length > 2 };
  };

  for (const st of ['FLOP', 'TURN', 'RIVER'] as Street[]) {
    for (const a of byStreet[st]) {
      if (a.player !== HERO) continue;
      if (isBet(a)) out.aggr++;
      else if (a.type === 'call') out.calls++;
      else if (a.type === 'fold') out.folds++;
    }
  }
  /** Hero's first action on a street, if nobody had bet before it. */
  const firstUnopened = (st: Street): Action | undefined => {
    for (const a of byStreet[st]) {
      if (a.player === HERO) return a;
      if (isBet(a)) return undefined;
    }
    return undefined;
  };

  /** Did `player` make the first bet of the street? Returns Hero's response to it when Hero faced it unraised. */
  const facingFirstBetBy = (st: Street, player: string): { cbet: boolean; response?: Action } => {
    const acts = byStreet[st];
    const i = acts.findIndex(isBet);
    if (i < 0 || acts[i].player !== player || acts[i].type !== 'bet') return { cbet: false };
    for (let j = i + 1; j < acts.length; j++) {
      if (acts[j].player === HERO) return { cbet: true, response: acts[j] };
      if (acts[j].type === 'raise') return { cbet: true };
    }
    return { cbet: true };
  };

  const record = (key: StatKey, made: boolean, st: Street) => {
    s[key] = bit(made);
    ctx[key] = spot(st);
  };

  if (pfa === HERO) {
    let prevCbet = true;
    const keys: [Street, StatKey][] = [['FLOP', 'flopCbet'], ['TURN', 'turnCbet'], ['RIVER', 'riverCbet']];
    for (const [st, key] of keys) {
      if (!prevCbet) break;
      const a = firstUnopened(st);
      if (!a) break;
      record(key, a.type === 'bet', st);
      // Once the CBet is raised the initiative is gone: the next street is no longer a CBet spot.
      prevCbet = a.type === 'bet' && !byStreet[st].some((x) => x.type === 'raise');
    }
  } else if (pfa !== null && aliveAt.FLOP?.includes(pfa)) {
    const flop = facingFirstBetBy('FLOP', pfa);
    if (flop.response) {
      const t = flop.response.type;
      record('foldToFlopCbet', t === 'fold', 'FLOP');
      record('callFlopCbet', t === 'call', 'FLOP');
      record('raiseFlopCbet', t === 'raise', 'FLOP');
    }
    if (flop.cbet && !byStreet.FLOP.some((x) => x.type === 'raise')) {
      const turn = facingFirstBetBy('TURN', pfa);
      if (turn.response) record('foldToTurnCbet', turn.response.type === 'fold', 'TURN');
    }
    // Donk bet: Hero acts before the PFA on the flop and leads into them (a PFA all-in preflop cannot be donked into).
    const pfaAllIn = byStreet.PRE.some((x) => x.player === pfa && x.allIn);
    if (!pfaAllIn && (orderOf.get(HERO) ?? 0) < (orderOf.get(pfa) ?? 0)) {
      const a = firstUnopened('FLOP');
      if (a) s.donkBet = bit(a.type === 'bet');
    }
  }

  // Flop check-raise: Hero checks, then faces a bet.
  const flopHero = byStreet.FLOP.map((a, i) => ({ a, i })).filter((x) => x.a.player === HERO);
  const checkIdx = flopHero.findIndex((x) => x.a.type === 'check');
  if (checkIdx >= 0 && flopHero[checkIdx + 1]) {
    const next = flopHero[checkIdx + 1];
    const between = byStreet.FLOP.slice(flopHero[checkIdx].i + 1, next.i);
    if (between.some(isBet)) s.flopCheckRaise = bit(next.a.type === 'raise');
  }

  return out;
}
