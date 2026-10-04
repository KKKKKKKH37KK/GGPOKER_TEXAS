import { HERO, type Action, type Hand, type Position } from '../parser/types';
import type { StatKey } from './definitions';
import type { PotType } from './types';

/** The state of the preflop betting when Hero made a decision. */
interface Decision {
  type: Action['type'];
  /** Bet level faced (PRD §5.1): 1 = unopened, +1 per raise */
  level: number;
  limpers: number;
  /** Callers since the last raise */
  callers: number;
  raiserPos: Position | null;
}

export interface PreflopResult {
  walk: boolean;
  pfa: string | null;
  potType: PotType;
  heroFolded: boolean;
  s: Partial<Record<StatKey, 0 | 1>>;
}

const STEAL_POS: Position[] = ['CO', 'BTN', 'SB'];

export function analyzePreflop(hand: Hand, heroPos: Position): PreflopResult {
  const posOf = new Map(hand.players.map((p) => [p.name, p.position]));
  let level = 1;
  let limpers = 0;
  let callers = 0;
  let pfa: string | null = null;
  const hero: Decision[] = [];

  for (const a of hand.actions) {
    if (a.street !== 'PRE' || a.type.startsWith('post')) continue;
    if (a.player === HERO) {
      hero.push({ type: a.type, level, limpers, callers, raiserPos: pfa ? posOf.get(pfa) ?? null : null });
    }
    if (a.type === 'raise') {
      level++;
      pfa = a.player;
      callers = 0;
    } else if (a.type === 'call') {
      if (level === 1) limpers++;
      else callers++;
    }
  }

  const potType: PotType = level === 1 ? 'UNOPENED' : level === 2 ? 'SRP' : level === 3 ? '3BP' : '4BP+';
  const heroFolded = hero.some((d) => d.type === 'fold');
  const walk = heroPos === 'BB' && hero.length === 0;
  const s: Partial<Record<StatKey, 0 | 1>> = {};
  if (walk) return { walk, pfa, potType, heroFolded, s };

  const bit = (b: boolean): 0 | 1 => (b ? 1 : 0);
  const first = hero[0];

  s.vpip = bit(hero.some((d) => d.type === 'call' || d.type === 'raise'));
  s.pfr = bit(hero.some((d) => d.type === 'raise'));
  if (heroPos !== 'BB' && first.level === 1) {
    s.limp = bit(first.type === 'call');
    if (first.limpers === 0) s[`rfi${heroPos}` as StatKey] = bit(first.type === 'raise');
  }
  // Facing a single raise with the first decision: BB defence and true cold calls are different leaks.
  if (first.level === 2) s[heroPos === 'BB' ? 'bbCallVsOpen' : 'coldCall'] = bit(first.type === 'call');

  const faceL2 = hero.find((d) => d.level === 2);
  if (faceL2) s.threeBet = bit(faceL2.type === 'raise');

  const faceL3 = hero.find((d) => d.level === 3);
  if (faceL3) s.fourBet = bit(faceL3.type === 'raise');

  // Response after Hero's own raise: the next Hero decision, if it faces exactly one more raise.
  const afterOwnRaise = (raiseLevel: number): Decision | undefined => {
    const i = hero.findIndex((d) => d.type === 'raise' && d.level === raiseLevel);
    const next = i >= 0 ? hero[i + 1] : undefined;
    return next && next.level === raiseLevel + 2 ? next : undefined;
  };
  const vs3 = afterOwnRaise(1);
  if (vs3) {
    s.foldTo3Bet = bit(vs3.type === 'fold');
    s.call3Bet = bit(vs3.type === 'call');
    s.fourBetVs3Bet = bit(vs3.type === 'raise');
  }
  const vs4 = afterOwnRaise(2);
  if (vs4) s.foldTo4Bet = bit(vs4.type === 'fold');

  if (first.level === 2 && first.callers >= 1) s.squeeze = bit(first.type === 'raise');

  if (STEAL_POS.includes(heroPos) && first.level === 1 && first.limpers === 0) s.ats = bit(first.type === 'raise');

  if (
    (heroPos === 'SB' || heroPos === 'BB') &&
    first.level === 2 &&
    first.limpers === 0 &&
    first.callers === 0 &&
    first.raiserPos !== null &&
    STEAL_POS.includes(first.raiserPos)
  ) {
    s[heroPos === 'SB' ? 'foldToStealSB' : 'foldToStealBB'] = bit(first.type === 'fold');
    s[heroPos === 'SB' ? 'threeBetVsStealSB' : 'threeBetVsStealBB'] = bit(first.type === 'raise');
  }

  return { walk, pfa, potType, heroFolded, s };
}
