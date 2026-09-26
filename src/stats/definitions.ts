// Every ratio stat: key, label, group and definition (PRD §5). The UI tooltip shows `def` verbatim.

export type StatGroup = 'Preflop' | 'Postflop';

export interface StatDef {
  key: StatKey;
  label: string;
  group: StatGroup;
  /** Opportunity (denominator) */
  den: string;
  /** Numerator */
  num: string;
  /** CBet-family stats get IP/OOP, SRP/3BP/4BP+, HU/MW splits (PRD §5.3) */
  splittable?: boolean;
}

export const STAT_KEYS = [
  'vpip', 'pfr', 'limp', 'coldCall', 'threeBet',
  'foldTo3Bet', 'call3Bet', 'fourBetVs3Bet',
  'fourBet', 'foldTo4Bet', 'squeeze', 'ats',
  'foldToStealSB', 'foldToStealBB', 'foldToSteal',
  'threeBetVsStealSB', 'threeBetVsStealBB', 'threeBetVsSteal',
  'sawFlop', 'wtsd', 'wsd', 'wwsf', 'afq',
  'flopCbet', 'turnCbet', 'riverCbet',
  'foldToFlopCbet', 'callFlopCbet', 'raiseFlopCbet', 'foldToTurnCbet',
  'flopCheckRaise', 'donkBet',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

/** Stats that are derived by summing others, not recorded per hand */
export const COMBINED: Partial<Record<StatKey, StatKey[]>> = {
  foldToSteal: ['foldToStealSB', 'foldToStealBB'],
  threeBetVsSteal: ['threeBetVsStealSB', 'threeBetVsStealBB'],
};

const N = '非 walk 的手數（N）';
const OPENED = 'Hero 做了 L2 的 raise（open 或 iso），之後第一次行動面對 L3';
const STEAL = 'Hero 在 SB/BB，第一個動作面對 L2，raiser 在 CO/BTN/SB，無 limper、無 caller';
const FACING_FLOP_CBET = '對手是 PFA 且為 flop 第一個下注者，Hero 面對該下注（尚未遇到加注）';

export const STAT_DEFS: Record<StatKey, StatDef> = {
  vpip: { key: 'vpip', label: 'VPIP', group: 'Preflop', den: N, num: '翻前有任何一次 call 或 raise（盲注不算；BB check 不算；SB 補齊算）' },
  pfr: { key: 'pfr', label: 'PFR', group: 'Preflop', den: N, num: '翻前有任何一次 raise' },
  limp: { key: 'limp', label: 'Limp', group: 'Preflop', den: N, num: '第一個動作是 L1 的 call，且 Hero 不在 BB' },
  coldCall: { key: 'coldCall', label: 'Cold Call', group: 'Preflop', den: N, num: '第一個動作是面對 L2 的 call' },
  threeBet: { key: 'threeBet', label: '3Bet', group: 'Preflop', den: 'Hero 第一次面對 L2 的決策（含先 limp 再面對 raise）', num: '該決策為 raise' },
  foldTo3Bet: { key: 'foldTo3Bet', label: 'Fold to 3Bet', group: 'Preflop', den: OPENED, num: 'fold' },
  call3Bet: { key: 'call3Bet', label: 'Call 3Bet', group: 'Preflop', den: OPENED, num: 'call' },
  fourBetVs3Bet: { key: 'fourBetVs3Bet', label: '4Bet vs 3Bet', group: 'Preflop', den: OPENED, num: 'raise' },
  fourBet: { key: 'fourBet', label: '4Bet', group: 'Preflop', den: 'Hero 第一次面對 L3 的決策（含 cold 4Bet）', num: 'raise' },
  foldTo4Bet: { key: 'foldTo4Bet', label: 'Fold to 4Bet', group: 'Preflop', den: 'Hero 做了 L3 的 raise（3Bet），之後第一次行動面對 L4', num: 'fold' },
  squeeze: { key: 'squeeze', label: 'Squeeze', group: 'Preflop', den: 'Hero 第一個動作面對 L2，且 raiser 之後已有 ≥1 人 call', num: 'raise' },
  ats: { key: 'ats', label: 'ATS (Steal)', group: 'Preflop', den: 'Hero 在 CO/BTN/SB，第一個動作面對 L1 且無 limper', num: 'raise' },
  foldToStealSB: { key: 'foldToStealSB', label: 'Fold to Steal (SB)', group: 'Preflop', den: STEAL + '（Hero 在 SB）', num: 'fold' },
  foldToStealBB: { key: 'foldToStealBB', label: 'Fold to Steal (BB)', group: 'Preflop', den: STEAL + '（Hero 在 BB）', num: 'fold' },
  foldToSteal: { key: 'foldToSteal', label: 'Fold to Steal (SB+BB)', group: 'Preflop', den: STEAL, num: 'fold' },
  threeBetVsStealSB: { key: 'threeBetVsStealSB', label: '3Bet vs Steal (SB)', group: 'Preflop', den: STEAL + '（Hero 在 SB）', num: 'raise' },
  threeBetVsStealBB: { key: 'threeBetVsStealBB', label: '3Bet vs Steal (BB)', group: 'Preflop', den: STEAL + '（Hero 在 BB）', num: 'raise' },
  threeBetVsSteal: { key: 'threeBetVsSteal', label: '3Bet vs Steal (SB+BB)', group: 'Preflop', den: STEAL, num: 'raise' },

  sawFlop: { key: 'sawFlop', label: 'Saw Flop', group: 'Postflop', den: N, num: 'Hero 翻前未棄牌且有發 flop（含翻前 all-in）' },
  wtsd: { key: 'wtsd', label: 'WTSD', group: 'Postflop', den: 'Saw Flop', num: 'Hero 從未棄牌且最後剩 ≥2 人（Summary 出現 Hero showed [）' },
  wsd: { key: 'wsd', label: 'W$SD', group: 'Postflop', den: 'WTSD', num: 'collected[Hero] > 0（平分、RIT 贏一半都算）' },
  wwsf: { key: 'wwsf', label: 'WWSF', group: 'Postflop', den: 'Saw Flop', num: 'collected[Hero] > 0' },
  afq: { key: 'afq', label: 'AFq', group: 'Postflop', den: '翻後 bets + raises + calls + folds', num: 'bets + raises' },
  flopCbet: { key: 'flopCbet', label: 'Flop CBet', group: 'Postflop', den: 'Hero 是 PFA，看到 flop，且 Hero 第一次行動前本街無人下注', num: 'bet', splittable: true },
  turnCbet: { key: 'turnCbet', label: 'Turn CBet', group: 'Postflop', den: 'Hero flop 有 CBet，看到 turn，且 Hero 第一次行動前本街無人下注', num: 'bet', splittable: true },
  riverCbet: { key: 'riverCbet', label: 'River CBet', group: 'Postflop', den: 'Hero turn 有 CBet，看到 river，且 Hero 第一次行動前本街無人下注', num: 'bet', splittable: true },
  foldToFlopCbet: { key: 'foldToFlopCbet', label: 'Fold to Flop CBet', group: 'Postflop', den: FACING_FLOP_CBET, num: 'fold', splittable: true },
  callFlopCbet: { key: 'callFlopCbet', label: 'Call Flop CBet', group: 'Postflop', den: FACING_FLOP_CBET, num: 'call', splittable: true },
  raiseFlopCbet: { key: 'raiseFlopCbet', label: 'Raise Flop CBet', group: 'Postflop', den: FACING_FLOP_CBET, num: 'raise', splittable: true },
  foldToTurnCbet: { key: 'foldToTurnCbet', label: 'Fold to Turn CBet', group: 'Postflop', den: '對手 flop 有 CBet，turn 仍是 PFA 第一個下注，Hero 面對該下注（尚未遇到加注）', num: 'fold', splittable: true },
  flopCheckRaise: { key: 'flopCheckRaise', label: 'Flop Check-Raise', group: 'Postflop', den: 'Hero 在 flop check 後面對下注', num: 'raise' },
  donkBet: { key: 'donkBet', label: 'Donk Bet', group: 'Postflop', den: 'Hero 非 PFA、PFA 仍在牌局、Hero 在 flop 位置先於 PFA、Hero 行動前無人下注', num: 'bet' },
};

export const AF_DEF = { label: 'AF', den: '翻後 calls', num: '翻後 bets + raises' };

export const RESULT_DEFS = {
  netWon: 'Σ heroNet；heroNet = collected + cashout received − invested − cashout risk paid',
  bb100: 'Σ heroNetBB / 總手數 × 100（分母含 walk）',
  showdown: 'WTSD 手的 heroNetBB 累計（藍線）',
  nonShowdown: '其餘手的 heroNetBB 累計（紅線）',
  allInEv: 'All-in 時以 equity 計算的期望值取代實際結果（橘線）',
};

export const PRE_TABLE: StatKey[] = [
  'vpip', 'pfr', 'limp', 'coldCall', 'threeBet', 'foldTo3Bet', 'call3Bet', 'fourBetVs3Bet',
  'fourBet', 'foldTo4Bet', 'squeeze', 'ats', 'foldToSteal', 'foldToStealSB', 'foldToStealBB',
  'threeBetVsSteal', 'threeBetVsStealSB', 'threeBetVsStealBB',
];
export const POST_TABLE: StatKey[] = [
  'sawFlop', 'wtsd', 'wsd', 'wwsf', 'afq', 'flopCbet', 'turnCbet', 'riverCbet',
  'foldToFlopCbet', 'callFlopCbet', 'raiseFlopCbet', 'foldToTurnCbet', 'flopCheckRaise', 'donkBet',
];
