import { toCents } from './money';
import { cardsIn, RE } from './lineRules';
import type { Action, Game, Hand, Player, Position, Street } from './types';

/** Positions clockwise from the button, by number of seated players (PRD §3.4-3). */
const POSITIONS_BY_COUNT: Record<number, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

export function assignPositions(seats: { seat: number; name: string; stack: number }[], buttonSeat: number): Player[] {
  const sorted = [...seats].sort((a, b) => a.seat - b.seat);
  const names = POSITIONS_BY_COUNT[sorted.length];
  if (!names) throw new Error(`Unsupported player count: ${sorted.length}`);
  // The button seat may be empty in some formats; start from the first occupied seat at or after it.
  let start = sorted.findIndex((s) => s.seat >= buttonSeat);
  if (start < 0) start = 0;
  if (sorted[start].seat !== buttonSeat) throw new Error(`Button seat ${buttonSeat} is not occupied`);
  return sorted.map((_, i) => {
    const s = sorted[(start + i) % sorted.length];
    return { ...s, position: names[i] };
  }).sort((a, b) => a.seat - b.seat);
}

function gameOf(name: string): Game {
  if (/^Hold'em No Limit$/.test(name)) return 'NLHE';
  if (/Omaha/.test(name)) return 'PLO';
  return 'OTHER';
}

const STREET_OF: Record<string, Street> = { FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER' };

/** Parses one hand (lines between blank-line separators). Throws on structural errors. */
export function parseHand(text: string): Hand {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, '').trimEnd()).filter((l) => l !== '');
  if (lines.length === 0) throw new Error('Empty hand');

  const h = RE.header.exec(lines[0].replace(/^﻿/, ''));
  if (!h) throw new Error(`Bad header: ${lines[0]}`);
  const hand: Hand = {
    id: h[1],
    game: gameOf(h[2]),
    sb: toCents(h[3]),
    bb: toCents(h[4]),
    timestamp: `${h[5]}-${h[6]}-${h[7]}T${h[8]}:${h[9]}:${h[10]}`,
    tableName: '',
    buttonSeat: 0,
    players: [],
    heroCards: null,
    actions: [],
    boards: [],
    shownCards: {},
    collected: {},
    uncalledReturned: {},
    cashDrop: 0,
    cashouts: {},
    summary: { totalPot: 0, rake: 0, jackpot: 0, bingo: 0, fortune: 0, tax: 0 },
    showedDown: [],
    runItTwice: false,
    warnings: [],
  };

  const seats: { seat: number; name: string; stack: number }[] = [];
  const seatName = new Map<number, string>();
  let section: 'pre' | 'play' | 'summary' = 'pre';
  let street: Street = 'PRE';
  let sawTotal = false;

  const cashout = (p: string) => (hand.cashouts[p] ??= { riskPaid: 0, received: 0 });
  const add = (rec: Record<string, number>, p: string, v: number) => {
    rec[p] = (rec[p] ?? 0) + v;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;

    if ((m = RE.street.exec(line))) {
      const [, run, name, rest] = m;
      if (name === 'HOLE CARDS') {
        section = 'play';
      } else if (name === 'SUMMARY') {
        section = 'summary';
      } else if (name === 'SHOWDOWN') {
        // Present on almost every hand, even when everyone folded preflop (PRD §3.4-1): carries no meaning.
      } else {
        street = STREET_OF[name];
        const idx = run === 'SECOND' ? 1 : 0;
        if (run) hand.runItTwice = true;
        hand.boards[idx] = cardsIn(rest);
      }
      continue;
    }

    if (section === 'pre') {
      if ((m = RE.table.exec(line))) {
        hand.tableName = m[1];
        hand.buttonSeat = parseInt(m[3], 10);
        continue;
      }
      if ((m = RE.seat.exec(line))) {
        const seat = parseInt(m[1], 10);
        seats.push({ seat, name: m[2], stack: toCents(m[3]) });
        seatName.set(seat, m[2]);
        if (m[4].trim()) hand.warnings.push(line);
        continue;
      }
    }

    if (section === 'summary') {
      if ((m = RE.totalPot.exec(line))) {
        const [t, r, j, b, f, x] = m.slice(1, 7).map(toCents);
        hand.summary = { totalPot: t, rake: r, jackpot: j, bingo: b, fortune: f, tax: x };
        sawTotal = true;
        continue;
      }
      if (RE.board.test(line)) continue; // boards are taken from the street lines
      if (RE.runTwice.test(line)) {
        hand.runItTwice = true;
        continue;
      }
      if ((m = RE.summarySeat.exec(line))) {
        const name = seatName.get(parseInt(m[1], 10));
        if (name && line.includes(' showed [')) hand.showedDown.push(name);
        continue;
      }
      hand.warnings.push(line);
      continue;
    }

    if ((m = RE.post.exec(line))) {
      const kind = m[2];
      const type = kind === 'small blind' ? 'postSB' : kind === 'big blind' ? 'postBB' : 'postOther';
      if (type === 'postOther') hand.warnings.push(line);
      hand.actions.push({ player: m[1], street: 'PRE', type, amount: toCents(m[3]), allIn: !!m[4] });
      continue;
    }
    if ((m = RE.action.exec(line))) {
      const [, player, verb, callAmt, betAmt, raiseBy, raiseTo, allIn] = m;
      let a: Action;
      if (verb === 'folds') a = { player, street, type: 'fold', amount: 0, allIn: false };
      else if (verb === 'checks') a = { player, street, type: 'check', amount: 0, allIn: false };
      else if (callAmt !== undefined) a = { player, street, type: 'call', amount: toCents(callAmt), allIn: !!allIn };
      else if (betAmt !== undefined) a = { player, street, type: 'bet', amount: toCents(betAmt), allIn: !!allIn };
      else a = { player, street, type: 'raise', amount: toCents(raiseBy), raiseTo: toCents(raiseTo), allIn: !!allIn };
      hand.actions.push(a);
      continue;
    }
    if ((m = RE.dealt.exec(line))) {
      if (m[2] && m[1] === 'Hero') hand.heroCards = m[2].trim().split(/\s+/);
      continue;
    }
    if ((m = RE.uncalled.exec(line))) {
      add(hand.uncalledReturned, m[2], toCents(m[1]));
      continue;
    }
    if ((m = RE.shows.exec(line))) {
      hand.shownCards[m[1]] = m[2].trim().split(/\s+/);
      continue;
    }
    if ((m = RE.collected.exec(line))) {
      add(hand.collected, m[1], toCents(m[2]));
      continue;
    }
    if ((m = RE.cashDrop.exec(line))) {
      hand.cashDrop += toCents(m[1]);
      continue;
    }
    if (RE.evChoose.test(line)) continue;
    if ((m = RE.evRisk.exec(line))) {
      cashout(m[1]).riskPaid += toCents(m[2]);
      continue;
    }
    if ((m = RE.evReceive.exec(line))) {
      cashout(m[1]).received += toCents(m[2]);
      continue;
    }
    hand.warnings.push(line);
  }

  if (!hand.tableName) throw new Error('Missing table line');
  if (seats.length === 0) throw new Error('No seats');
  if (!sawTotal) throw new Error('Missing "Total pot" summary line');
  hand.players = assignPositions(seats, hand.buttonSeat);
  return hand;
}

/** Splits a file into hand blocks. Hands are separated by blank lines; a block always starts with "Poker Hand #". */
export function splitHands(text: string): string[] {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of normalized.split('\n')) {
    if (line.startsWith('Poker Hand #')) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [line];
    } else if (cur.length) {
      cur.push(line);
    }
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.filter((b) => b.trim() !== '');
}
