// Every ratio stat: key, label, Chinese name, group, definition and reference range (PRD §5).
// The UI tooltip shows `den` / `num` verbatim.

export type StatGroup = 'Preflop' | 'Postflop';

export interface StatDef {
  key: StatKey;
  label: string;
  /** Plain-language Chinese name shown next to the label */
  zh: string;
  group: StatGroup;
  /** Opportunity (denominator) */
  den: string;
  /** Numerator */
  num: string;
  /** CBet-family stats get IP/OOP, SRP/3BP/4BP+, HU/MW splits (PRD §5.3) */
  splittable?: boolean;
  /**
   * Default reference range in percent: approximate heuristics for a winning 6-max NL regular at ~100bb,
   * not solver output. Users can override them in Settings.
   */
  ref?: [number, number];
}

export const STAT_KEYS = [
  'vpip', 'pfr', 'rfi', 'rfiUTG', 'rfiHJ', 'rfiCO', 'rfiBTN', 'rfiSB',
  'limp', 'coldCall', 'bbCallVsOpen', 'threeBet',
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
  rfi: ['rfiUTG', 'rfiHJ', 'rfiCO', 'rfiBTN', 'rfiSB'],
  foldToSteal: ['foldToStealSB', 'foldToStealBB'],
  threeBetVsSteal: ['threeBetVsStealSB', 'threeBetVsStealBB'],
};

const N = '非 walk 的手數（N）';
const RFI = (pos: string) => `Hero 在 ${pos}，輪到 Hero 時前面全部棄牌（未開池、無 limper）`;
const OPENED = 'Hero 做了 L2 的 raise（open 或 iso），之後第一次行動面對 L3';
const STEAL = 'Hero 在 SB/BB，第一個動作面對 L2，raiser 在 CO/BTN/SB，無 limper、無 caller';
const FACING_FLOP_CBET = '對手是 PFA 且為 flop 第一個下注者，Hero 面對該下注（尚未遇到加注）';

export const STAT_DEFS: Record<StatKey, StatDef> = {
  vpip: { key: 'vpip', label: 'VPIP', zh: '主動入池率', group: 'Preflop', den: N, num: '翻前有任何一次 call 或 raise（盲注不算；BB check 不算；SB 補齊算）', ref: [22, 27] },
  pfr: { key: 'pfr', label: 'PFR', zh: '翻前加注率', group: 'Preflop', den: N, num: '翻前有任何一次 raise（含 open、3Bet、4Bet）', ref: [18, 23] },
  rfi: { key: 'rfi', label: 'RFI', zh: '首位加注開池率（全位置）', group: 'Preflop', den: '前面全部棄牌、輪到 Hero 第一個決策（BB 除外）', num: 'raise' },
  rfiUTG: { key: 'rfiUTG', label: 'RFI UTG', zh: '槍口位開池率', group: 'Preflop', den: RFI('UTG'), num: 'raise', ref: [14, 19] },
  rfiHJ: { key: 'rfiHJ', label: 'RFI HJ', zh: '劫持位開池率', group: 'Preflop', den: RFI('HJ'), num: 'raise', ref: [18, 24] },
  rfiCO: { key: 'rfiCO', label: 'RFI CO', zh: '關煞位開池率', group: 'Preflop', den: RFI('CO'), num: 'raise', ref: [25, 32] },
  rfiBTN: { key: 'rfiBTN', label: 'RFI BTN', zh: '按鈕位開池率', group: 'Preflop', den: RFI('BTN'), num: 'raise', ref: [40, 52] },
  rfiSB: { key: 'rfiSB', label: 'RFI SB', zh: '小盲開池率（raise）', group: 'Preflop', den: RFI('SB'), num: 'raise（SB 補齊算 limp，不算 RFI）', ref: [35, 50] },
  limp: { key: 'limp', label: 'Limp', zh: '平跟入池率', group: 'Preflop', den: 'Hero 不在 BB，第一個動作時尚無人加注（L1）', num: 'call', ref: [0, 3] },
  coldCall: { key: 'coldCall', label: 'Cold Call', zh: '冷跟注率（非 BB）', group: 'Preflop', den: 'Hero 不在 BB，第一個動作面對一次加注（L2）', num: 'call', ref: [3, 8] },
  bbCallVsOpen: { key: 'bbCallVsOpen', label: 'BB Call vs Open', zh: '大盲跟注防守率', group: 'Preflop', den: 'Hero 在 BB，第一個動作面對一次加注（L2）', num: 'call', ref: [30, 42] },
  threeBet: { key: 'threeBet', label: '3Bet', zh: '再加注率', group: 'Preflop', den: 'Hero 第一次面對 L2 的決策（含先 limp 再面對 raise）', num: '該決策為 raise', ref: [7, 11] },
  foldTo3Bet: { key: 'foldTo3Bet', label: 'Fold to 3Bet', zh: '被再加注後棄牌率', group: 'Preflop', den: OPENED, num: 'fold', ref: [45, 60] },
  call3Bet: { key: 'call3Bet', label: 'Call 3Bet', zh: '被再加注後跟注率', group: 'Preflop', den: OPENED, num: 'call', ref: [28, 42] },
  fourBetVs3Bet: { key: 'fourBetVs3Bet', label: '4Bet vs 3Bet', zh: '被再加注後 4Bet 率', group: 'Preflop', den: OPENED, num: 'raise', ref: [8, 15] },
  fourBet: { key: 'fourBet', label: '4Bet', zh: '四次加注率', group: 'Preflop', den: 'Hero 第一次面對 L3 的決策（含 cold 4Bet）', num: 'raise', ref: [3, 8] },
  foldTo4Bet: { key: 'foldTo4Bet', label: 'Fold to 4Bet', zh: '3Bet 後被 4Bet 棄牌率', group: 'Preflop', den: 'Hero 做了 L3 的 raise（3Bet），之後第一次行動面對 L4', num: 'fold', ref: [45, 65] },
  squeeze: { key: 'squeeze', label: 'Squeeze', zh: '擠壓加注率', group: 'Preflop', den: 'Hero 第一個動作面對 L2，且 raiser 之後已有 ≥1 人 call', num: 'raise', ref: [6, 12] },
  ats: { key: 'ats', label: 'ATS (Steal)', zh: '偷盲率（CO/BTN/SB）', group: 'Preflop', den: 'Hero 在 CO/BTN/SB，第一個動作面對 L1 且無 limper', num: 'raise', ref: [38, 48] },
  foldToStealSB: { key: 'foldToStealSB', label: 'Fold to Steal (SB)', zh: '小盲面對偷盲棄牌率', group: 'Preflop', den: STEAL + '（Hero 在 SB）', num: 'fold', ref: [72, 85] },
  foldToStealBB: { key: 'foldToStealBB', label: 'Fold to Steal (BB)', zh: '大盲面對偷盲棄牌率', group: 'Preflop', den: STEAL + '（Hero 在 BB）', num: 'fold', ref: [35, 50] },
  foldToSteal: { key: 'foldToSteal', label: 'Fold to Steal (SB+BB)', zh: '盲注面對偷盲棄牌率', group: 'Preflop', den: STEAL, num: 'fold', ref: [55, 68] },
  threeBetVsStealSB: { key: 'threeBetVsStealSB', label: '3Bet vs Steal (SB)', zh: '小盲反偷率', group: 'Preflop', den: STEAL + '（Hero 在 SB）', num: 'raise', ref: [10, 17] },
  threeBetVsStealBB: { key: 'threeBetVsStealBB', label: '3Bet vs Steal (BB)', zh: '大盲反偷率', group: 'Preflop', den: STEAL + '（Hero 在 BB）', num: 'raise', ref: [9, 15] },
  threeBetVsSteal: { key: 'threeBetVsSteal', label: '3Bet vs Steal (SB+BB)', zh: '盲注反偷率', group: 'Preflop', den: STEAL, num: 'raise', ref: [9, 15] },

  sawFlop: { key: 'sawFlop', label: 'Saw Flop', zh: '看翻牌率', group: 'Postflop', den: N, num: 'Hero 翻前未棄牌且有發 flop（含翻前 all-in）', ref: [16, 24] },
  wtsd: { key: 'wtsd', label: 'WTSD', zh: '攤牌率', group: 'Postflop', den: 'Saw Flop', num: 'Hero 從未棄牌且最後剩 ≥2 人（Summary 出現 Hero showed [）', ref: [25, 31] },
  wsd: { key: 'wsd', label: 'W$SD', zh: '攤牌勝率', group: 'Postflop', den: 'WTSD', num: 'collected[Hero] > 0（平分、RIT 贏一半都算；平分扣 rake 後仍可能淨輸）', ref: [50, 56] },
  wwsf: { key: 'wwsf', label: 'WWSF', zh: '看翻牌後贏錢率', group: 'Postflop', den: 'Saw Flop', num: 'collected[Hero] > 0', ref: [45, 52] },
  afq: { key: 'afq', label: 'AFq', zh: '翻後侵略頻率', group: 'Postflop', den: '翻後 bets + raises + calls + folds', num: 'bets + raises', ref: [40, 55] },
  flopCbet: { key: 'flopCbet', label: 'Flop CBet', zh: '翻牌持續下注率', group: 'Postflop', den: 'Hero 是 PFA，看到 flop，且 Hero 第一次行動前本街無人下注', num: 'bet', splittable: true, ref: [55, 70] },
  turnCbet: { key: 'turnCbet', label: 'Turn CBet', zh: '轉牌持續下注率', group: 'Postflop', den: 'Hero flop 有 CBet 且未被加注，看到 turn，Hero 第一次行動前本街無人下注', num: 'bet', splittable: true, ref: [42, 58] },
  riverCbet: { key: 'riverCbet', label: 'River CBet', zh: '河牌持續下注率', group: 'Postflop', den: 'Hero turn 有 CBet 且未被加注，看到 river，Hero 第一次行動前本街無人下注', num: 'bet', splittable: true, ref: [40, 58] },
  foldToFlopCbet: { key: 'foldToFlopCbet', label: 'Fold to Flop CBet', zh: '面對翻牌持續下注棄牌率', group: 'Postflop', den: FACING_FLOP_CBET, num: 'fold', splittable: true, ref: [38, 50] },
  callFlopCbet: { key: 'callFlopCbet', label: 'Call Flop CBet', zh: '面對翻牌持續下注跟注率', group: 'Postflop', den: FACING_FLOP_CBET, num: 'call', splittable: true, ref: [38, 52] },
  raiseFlopCbet: { key: 'raiseFlopCbet', label: 'Raise Flop CBet', zh: '面對翻牌持續下注加注率', group: 'Postflop', den: FACING_FLOP_CBET, num: 'raise', splittable: true, ref: [7, 14] },
  foldToTurnCbet: { key: 'foldToTurnCbet', label: 'Fold to Turn CBet', zh: '面對轉牌持續下注棄牌率', group: 'Postflop', den: '對手 flop CBet 且未被加注，turn 仍是 PFA 第一個下注，Hero 面對該下注（尚未遇到加注）', num: 'fold', splittable: true, ref: [38, 50] },
  flopCheckRaise: { key: 'flopCheckRaise', label: 'Flop Check-Raise', zh: '翻牌過牌加注率', group: 'Postflop', den: 'Hero 在 flop check 後面對下注', num: 'raise', ref: [7, 13] },
  donkBet: { key: 'donkBet', label: 'Donk Bet', zh: '領先下注率（搶先下注）', group: 'Postflop', den: 'Hero 非 PFA、PFA 仍在牌局且未翻前 all-in、Hero 在 flop 位置先於 PFA、Hero 行動前無人下注', num: 'bet', ref: [1, 8] },
};

export const AF_DEF = { label: 'AF', zh: '翻後侵略因子', den: '翻後 calls', num: '翻後 bets + raises', ref: [2, 3.5] as [number, number] };

export const RESULT_DEFS = {
  netWon: 'Σ heroNet；heroNet = collected + cashout received − invested − cashout risk paid（已扣 rake）',
  bb100: 'Σ heroNetBB / 總手數 × 100（分母含 walk）；± 為 95% 信賴區間（1.96 × 標準誤）',
  showdown: 'WTSD 手的 heroNetBB 累計（藍線）',
  nonShowdown: '其餘手的 heroNetBB 累計（紅線）',
  allInEv: 'All-in 時以 equity 計算的期望值取代實際結果（橘線）',
};

/** Chinese names for non-stat terms used across the UI */
export const GLOSSARY: Record<string, string> = {
  Hands: '總手數',
  Net: '淨盈虧',
  'Net won': '淨盈虧',
  'bb/100': '每百手贏多少大盲',
  'Net bb': '淨盈虧（大盲）',
  Showdown: '攤牌盈虧',
  'Non-showdown': '非攤牌盈虧',
  'All-in EV': 'All-in 期望值',
  Luck: '運氣（實際 − EV）',
  AF: '翻後侵略因子',
  walks: '大盲白拿',
  N: '有決策的手數',
  IP: '有位置',
  OOP: '無位置',
  SRP: '單次加注底池',
  '3BP': '3Bet 底池',
  '4BP+': '4Bet 以上底池',
  HU: '單挑',
  MW: '多人底池',
  Limped: '平跟底池',
  UTG: '槍口位',
  HJ: '劫持位',
  CO: '關煞位',
  BTN: '按鈕位',
  SB: '小盲',
  BB: '大盲',
};

export const PRE_TABLE: StatKey[] = [
  'vpip', 'pfr', 'rfi', 'rfiUTG', 'rfiHJ', 'rfiCO', 'rfiBTN', 'rfiSB',
  'limp', 'coldCall', 'bbCallVsOpen', 'threeBet', 'foldTo3Bet', 'call3Bet', 'fourBetVs3Bet',
  'fourBet', 'foldTo4Bet', 'squeeze', 'ats', 'foldToSteal', 'foldToStealSB', 'foldToStealBB',
  'threeBetVsSteal', 'threeBetVsStealSB', 'threeBetVsStealBB',
];
export const POST_TABLE: StatKey[] = [
  'sawFlop', 'wtsd', 'wsd', 'wwsf', 'afq', 'flopCbet', 'turnCbet', 'riverCbet',
  'foldToFlopCbet', 'callFlopCbet', 'raiseFlopCbet', 'foldToTurnCbet', 'flopCheckRaise', 'donkBet',
];

/** Sub-rows (indented under their combined stat) */
export const SUB_ROWS = new Set<StatKey>([
  'rfiUTG', 'rfiHJ', 'rfiCO', 'rfiBTN', 'rfiSB',
  'foldToStealSB', 'foldToStealBB', 'threeBetVsStealSB', 'threeBetVsStealBB',
]);
