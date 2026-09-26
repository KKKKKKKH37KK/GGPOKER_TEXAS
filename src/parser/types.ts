export type Street = 'PRE' | 'FLOP' | 'TURN' | 'RIVER';
export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO';
export type Game = 'NLHE' | 'PLO' | 'OTHER';

export const HERO = 'Hero';

export interface Action {
  player: string;
  street: Street;
  /** postOther = ante / straddle / dead blind: counted as investment, flagged with a warning (not in the reference data) */
  type: 'postSB' | 'postBB' | 'postOther' | 'fold' | 'check' | 'call' | 'bet' | 'raise';
  /** cents; call/bet = amount, raise = increment */
  amount: number;
  /** cents; for raise, the street total ("raises $x to $y" → y) */
  raiseTo?: number;
  allIn: boolean;
}

export interface Player {
  seat: number;
  name: string;
  stack: number;
  position: Position;
}

export interface Hand {
  id: string;
  game: Game;
  sb: number;
  bb: number;
  /** "2026-09-01T22:25:31", header time as-is (UTC+8) */
  timestamp: string;
  tableName: string;
  buttonSeat: number;
  players: Player[];
  /** Hero's hole cards (2 for NLHE, 4 for PLO) */
  heroCards: string[] | null;
  actions: Action[];
  /** One board normally; two for run-it-twice */
  boards: string[][];
  shownCards: Record<string, string[]>;
  collected: Record<string, number>;
  uncalledReturned: Record<string, number>;
  cashDrop: number;
  /** EV Cashout per player (the PRD only needs Hero, but tracking everyone lets invariants be checked) */
  cashouts: Record<string, { riskPaid: number; received: number }>;
  summary: { totalPot: number; rake: number; jackpot: number; bingo: number; fortune: number; tax: number };
  /** Players with "showed [" in the summary */
  showedDown: string[];
  runItTwice: boolean;
  /** Lines that no rule recognised */
  warnings: string[];
}

export type Warning =
  | { kind: 'unknownLine'; line: string; count: number; sampleHandId: string }
  | { kind: 'parseError'; handId: string; message: string }
  | { kind: 'invariant'; handId: string; message: string };

export interface ParseResult {
  /** NLHE hands that parsed and passed the accounting invariants, sorted by (timestamp, id), deduplicated */
  hands: Hand[];
  /** Non-Hold'em hands, parsed best-effort (used only for the "whole zip" net total) */
  otherGames: Hand[];
  /** Count of skipped hands by reason, e.g. { PLO: 2 } */
  skipped: Record<string, number>;
  /** Hands that failed to parse or broke an invariant */
  errorCount: number;
  duplicates: number;
  warnings: Warning[];
  fileCount: number;
}
