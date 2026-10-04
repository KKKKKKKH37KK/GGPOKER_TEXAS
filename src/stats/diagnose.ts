// Rule-based play review: turns a StatsResult into leaks, strengths and a watch list.
// Pure and deterministic (no network, no model). Every claim is gated on sample size and on the
// 95% Wilson interval, so a finding only appears when the deviation is distinguishable from noise.

import type { Position } from '../parser/types';
import { wilson } from '../ui/format';
import { STAT_DEFS, STAT_KEYS, type StatKey } from './definitions';
import type { Ratio, StatsResult } from './types';

export interface Range {
  min?: number;
  max?: number;
}

export type FindingTarget =
  | { type: 'stat'; key: StatKey; position?: Position }
  | { type: 'line'; line: string; coarse: boolean }
  | { type: 'position'; position: Position };

export interface Finding {
  kind: 'leak' | 'strength' | 'watch' | 'info';
  title: string;
  /** What the numbers show */
  evidence: string;
  /** Why it matters */
  why?: string;
  /** How to fix it (leaks) */
  fix?: string;
  /** Sort key: larger = more important */
  weight: number;
  target?: FindingTarget;
}

export interface Diagnosis {
  enoughData: boolean;
  minHands: number;
  hands: number;
  leaks: Finding[];
  strengths: Finding[];
  watch: Finding[];
  info: Finding[];
}

export interface DiagnoseOptions {
  /** Below this many hands nothing is analysed */
  minHands: number;
  /** Minimum opportunities for a single stat to be judged */
  minOpp: number;
  /** Reference range for a stat (user override or default), percent */
  rangeOf: (key: StatKey) => Range | undefined;
}

export const DEFAULT_MIN_HANDS = 5000;
export const DEFAULT_MIN_OPP = 100;

const pct = (r: Ratio) => (r.den ? (r.num / r.den) * 100 : 0);
const fmtRatio = (r: Ratio) => {
  const ci = wilson(r)!;
  return `${pct(r).toFixed(1)}%（${r.num}/${r.den}，95% 區間 ${ci[0].toFixed(1)}–${ci[1].toFixed(1)}%）`;
};
const rangeText = (b: Range) => `${b.min ?? ''}–${b.max ?? ''}%`;
const label = (k: StatKey) => `${STAT_DEFS[k].label}（${STAT_DEFS[k].zh}）`;

/** How far the interval sits outside the range, in percentage points (0 = overlaps). */
function outside(r: Ratio, b: Range): { dir: 'high' | 'low' | null; gap: number; strong: boolean } {
  const v = pct(r);
  const [lo, hi] = wilson(r)!;
  if (b.max !== undefined && v > b.max) return { dir: 'high', gap: lo - b.max, strong: lo > b.max };
  if (b.min !== undefined && v < b.min) return { dir: 'low', gap: b.min - hi, strong: hi < b.min };
  return { dir: null, gap: 0, strong: false };
}

/** Per-stat explanations for each direction of deviation. */
const ADVICE: Partial<Record<StatKey, { high?: [string, string?]; low?: [string, string?] }>> = {
  vpip: {
    high: ['入池太多，常帶著被壓制的牌進入翻後', '先剪掉早位與被 3Bet 時無法繼續的邊緣牌（offsuit 小 Ax、弱 Kx/Qx）'],
    low: ['入池太少，錯過對手池棄牌多的偷盲機會', '在 CO/BTN/SB 增加 open，BB 對小尺寸 open 多防守'],
  },
  pfr: {
    high: ['加注頻率偏高，通常是 open 範圍太寬或 3Bet 太多', '從最寬的位置（BTN/CO）剪掉最底部的 open'],
    low: ['加注太少、跟注太多，失去主動權', '把一部分跟注改成 3Bet，open 時不要 limp'],
  },
  rfiUTG: { high: ['槍口位開池太寬，後面還有 5 個人', '只留強對子、Ax 同花、強寬張'], low: ['槍口位開池太緊', '加入 A5s–A2s、KTs、QJs、66–55 等'] },
  rfiHJ: { high: ['劫持位開池太寬', '剪掉 offsuit 弱寬張（KTo、QTo 以下）與小同花連張'], low: ['劫持位開池太緊', '加入同花連張與 Kxs'] },
  rfiCO: { high: ['關煞位開池太寬，被 BTN/盲注 3Bet 時很難打', '剪掉 K8o 以下、Q9o 以下等 offsuit 牌'], low: ['關煞位開池太緊，浪費偷盲機會', '加入 Kxs、Qxs、同花一隔張'] },
  rfiBTN: { high: ['按鈕位開池太寬：被盲注 3Bet 時多數只能棄牌', '剪掉 K5o 以下、Q6o 以下、J7o 以下與所有 offsuit 隔張牌'], low: ['按鈕位開池太緊，這是最賺的位置', '加入所有同花 Kx/Qx、多數同花連張、A2o+'] },
  rfiSB: { high: ['小盲開池太寬，翻後全程沒位置', '剪掉 offsuit 弱牌，或對弱的大盲改用 limp 策略'], low: ['小盲開池太緊，對手池大盲常棄牌', '對大盲增加偷盲'] },
  limp: { high: ['平跟入池太多，讓盲注便宜看翻牌又沒有主動權', '改成 raise 或棄牌（SB 有明確 limp 策略除外）'] },
  coldCall: {
    high: ['冷跟注太多，常在夾擊位置被擠壓或被壓制', '多用 3Bet-or-fold，只在 BTN 對 CO 這類有位置時平跟'],
  },
  bbCallVsOpen: {
    high: ['大盲跟注太多，翻後沒位置的邊緣牌在虧錢', '對早位 open 收緊跟注範圍，先看翻後打法是否撐得起'],
    low: ['大盲防守太少，對手偷盲直接獲利', '對 BTN/SB 的小尺寸 open 多防守同花牌與連張'],
  },
  threeBet: {
    high: ['3Bet 太多，詐唬比例可能過高', '詐唬改用有阻擋牌的 A5s–A2s，減少 offsuit 詐唬'],
    low: ['3Bet 太少，範圍太好讀，對手 open 很安全', '在 BTN/盲注增加 3Bet，尤其對 CO/BTN 的寬 open'],
  },
  foldTo3Bet: {
    high: ['被 3Bet 後棄牌太多，對手 3Bet 任何兩張都賺', '有位置時多平跟（對子、同花寬張、同花連張），並加入 4Bet 詐唬（A5s/A4s）；或收緊 open 範圍'],
    low: ['被 3Bet 後繼續太多，常帶被壓制的牌進入大底池', '對早位/緊的 3Bet 棄掉 offsuit 中等牌'],
  },
  call3Bet: { low: ['被 3Bet 後很少平跟，範圍只剩 4Bet 或棄牌', '有位置時平跟中對子與同花寬張'] },
  fourBet: { high: ['4Bet 太多', '4Bet 詐唬只留少量有阻擋的 Ax'], low: ['幾乎不 4Bet，3Bet 者可以放心詐唬', '加入少量 A5s/A4s 4Bet 詐唬'] },
  foldTo4Bet: {
    high: ['3Bet 之後被 4Bet 大多棄牌，3Bet 的錢白白送掉', '中等強度的牌（AQo、99–88、KQo）對早位改成平跟而不是 3Bet；JJ/TT 被 4Bet 不要棄'],
    low: ['被 4Bet 後繼續太多', '對緊的 4Bet 範圍（QQ+/AK）棄掉中等對子'],
  },
  squeeze: { low: ['擠壓加注太少，open 加跟注時是最好的 3Bet 時機', '對寬 open + 弱跟注者增加 squeeze'] },
  ats: {
    high: ['偷盲太多，盲注只要反擊就難打', '對常 3Bet 的盲注收緊'],
    low: ['偷盲太少，對手池盲注偏緊，偷盲很賺', 'CO/BTN/SB 前面棄牌時多 open'],
  },
  foldToStealSB: { high: ['小盲面對偷盲棄太多', '對 BTN 的寬 open 增加 3Bet（小盲以 3Bet-or-fold 為主）'] },
  foldToStealBB: {
    high: ['大盲面對偷盲棄太多', '對小尺寸偷盲多防守同花牌與連張'],
    low: ['大盲面對偷盲防守太多', '棄掉 offsuit 不連張的弱牌'],
  },
  threeBetVsStealSB: { low: ['小盲反偷太少', '對 BTN 偷盲增加 3Bet，以有阻擋與可玩性的牌為主'] },
  threeBetVsStealBB: { low: ['大盲反偷太少', '對 BTN/SB 偷盲增加 3Bet'] },
  sawFlop: { low: ['看翻牌很少：快速棄牌桌（Rush & Cash）常見，不一定是錯誤；多數的錢在翻前就決定了'] },
  wtsd: {
    high: ['攤牌太多，可能跟注太寬（抓詐太多）', '河牌面對大注時收緊抓詐範圍'],
    low: ['攤牌太少，可能太容易被打走', '中等牌力多打到攤牌'],
  },
  wsd: { low: ['攤牌勝率偏低，常帶著不夠強的牌到攤牌', '河牌面對下注時棄掉更多邊緣牌'] },
  wwsf: { low: ['看翻牌後贏下底池的比例低，非攤牌底池常被拿走', '增加翻牌/轉牌的主動下注與過牌加注'] },
  afq: {
    high: ['翻後非常激進', '確認詐唬時有足夠的 equity 或阻擋'],
    low: ['翻後太被動，常跟注少下注', '有 equity 的牌多主動下注或加注'],
  },
  flopCbet: {
    high: ['翻牌 CBet 太多，範圍不利的牌面也在下注', '有位置時在濕潤、對你不利的牌面（中張連接、雙色）多過牌'],
    low: ['翻牌 CBet 太少，浪費翻前主動權', '在高張乾燥牌面（A/K high）用小注高頻下注'],
  },
  turnCbet: { low: ['轉牌放棄太多：翻牌下注被跟後就收手', '轉牌拿到 equity（新聽牌、高張）時繼續下注；翻牌沒打算續打的牌少 CBet'] },
  riverCbet: { low: ['河牌很少續打，對手可以放心抓詐以外的跟注', '河牌用阻擋牌選擇詐唬，並以強牌價值下注'] },
  foldToFlopCbet: {
    high: ['面對翻牌 CBet 棄太多，對手 CBet 任何牌都賺', '有後門聽牌、高張的牌多跟注或過牌加注'],
    low: ['面對翻牌 CBet 很少棄牌，可能跟注太寬', '沒有對子也沒有聽牌的牌棄掉'],
  },
  callFlopCbet: { high: ['面對翻牌 CBet 跟注太多', '把一部分跟注改成加注（強聽牌、兩對以上），弱牌棄掉'] },
  raiseFlopCbet: { low: ['幾乎不加注翻牌 CBet，對手 CBet 沒有風險', '用強聽牌與兩對以上加注，搭配少量後門聽牌詐唬'] },
  foldToTurnCbet: { high: ['面對轉牌續打棄太多', '翻牌跟注前先想好轉牌哪些牌要繼續；沒計畫的弱牌翻牌就棄'] },
  flopCheckRaise: { low: ['翻牌過牌加注太少，沒位置時只能跟或棄', '用強聽牌、兩對以上、加少量後門聽牌組成過牌加注範圍'] },
  donkBet: { high: ['搶先下注太多，範圍容易被讀', '大多數情況過牌給翻前加注者'] },
};

/** Deviations that describe the game format more than a mistake (fast-fold tables see few flops). */
const CONTEXT_ONLY = new Set<StatKey>(['sawFlop']);

export function diagnose(r: StatsResult, opts: DiagnoseOptions): Diagnosis {
  const out: Diagnosis = { enoughData: r.hands >= opts.minHands, minHands: opts.minHands, hands: r.hands, leaks: [], strengths: [], watch: [], info: [] };
  if (!out.enoughData) return out;
  const { minOpp } = opts;
  const lineOf = (name: string, coarse: boolean) => (coarse ? r.linesCoarse : r.lines).find((l) => l.line === name);
  const per100 = (bb: number) => (bb / r.hands) * 100;

  // --- Composite rules (money-based, most actionable) ---
  const f4 = r.stats.foldTo4Bet;
  const l3f4 = lineOf('3Bet → Fold to 4Bet', true);
  if (l3f4 && f4.den >= 50 && r.stats.threeBet.num > 0) {
    const b = opts.rangeOf('foldTo4Bet');
    const o = b ? outside(f4, b) : null;
    if (o?.strong && o.dir === 'high') {
      out.leaks.push({
        kind: 'leak',
        title: '3Bet 之後被 4Bet 就棄牌',
        evidence: `Fold to 4Bet ${fmtRatio(f4)}，參考 ${rangeText(b!)}；「3Bet → Fold to 4Bet」${l3f4.hands} 手共 ${l3f4.netBB.toFixed(1)} bb（${per100(l3f4.netBB).toFixed(2)} bb/100）`,
        why: '每次 3Bet 被 4Bet 棄牌都損失整個 3Bet 金額；如果被棄的是 AQo、99、88 這類牌，代表它們不該拿來 3Bet。',
        fix: ADVICE.foldTo4Bet!.high![1],
        weight: 100 + Math.abs(per100(l3f4.netBB)) * 10,
        target: { type: 'line', line: '3Bet → Fold to 4Bet', coarse: true },
      });
    }
  }

  for (const pos of ['HJ', 'CO', 'BTN'] as Position[]) {
    const row = r.byPosition[pos];
    const rfiKey = `rfi${pos}` as StatKey;
    const rfi = row.stats[rfiKey];
    const f3 = row.stats.foldTo3Bet;
    const rb = opts.rangeOf(rfiKey);
    if (!rb || rfi.den < minOpp || f3.den < 50) continue;
    const wide = outside(rfi, rb);
    const f3lo = wilson(f3)![0];
    if (wide.dir === 'high' && wide.strong && f3lo > 65) {
      out.leaks.push({
        kind: 'leak',
        title: `${pos} 開池太寬，被 3Bet 又大多棄牌`,
        evidence: `${pos} RFI ${fmtRatio(rfi)}（參考 ${rangeText(rb)}）；${pos} Fold to 3Bet ${fmtRatio(f3)}`,
        why: '開得寬卻不防守 3Bet，後面的玩家只要 3Bet 就直接獲利，開池最底部的牌也只是在付錢。',
        fix: `${ADVICE[rfiKey]?.high?.[1] ?? '收緊最底部的 open'}；同時對 3Bet 擴大繼續範圍：有位置平跟中對子、同花寬張、同花連張，A5s/A4s 4Bet 詐唬。`,
        weight: 90 + (f3lo - 65),
        target: { type: 'stat', key: 'foldTo3Bet', position: pos },
      });
    }
  }

  const callF = r.stats.callFlopCbet;
  const foldT = r.stats.foldToTurnCbet;
  const xr = r.stats.flopCheckRaise;
  const bT = opts.rangeOf('foldToTurnCbet');
  if (bT && foldT.den >= 60 && callF.den >= minOpp) {
    const o = outside(foldT, bT);
    if (o.dir === 'high' && wilson(foldT)![0] > (bT.max ?? 100) - 3) {
      out.leaks.push({
        kind: 'leak',
        title: '翻牌跟注、轉牌又棄牌（花錢買牌沒打到攤牌）',
        evidence: `Call Flop CBet ${fmtRatio(callF)}；Fold to Turn CBet ${fmtRatio(foldT)}（參考 ${rangeText(bT)}）${xr.den >= minOpp ? `；Flop Check-Raise ${fmtRatio(xr)}` : ''}；非攤牌盈虧 ${(r.graph.at(-1)?.nonShowdown ?? 0).toFixed(1)} bb`,
        why: '翻牌跟一次、轉牌再棄，等於白付一個翻牌下注；對手只要兩條街都下注就能拿走底池。',
        fix: '翻牌跟注前先決定轉牌哪些牌要繼續；沒計畫的弱牌（尤其沒位置）翻牌就棄。把一部分跟注改成過牌加注（強聽牌、兩對以上，加少量後門聽牌）。',
        weight: 80 + o.gap,
        target: { type: 'stat', key: 'foldToTurnCbet' },
      });
    }
  }

  const fc = r.stats.flopCbet;
  const tc = r.stats.turnCbet;
  const bF = opts.rangeOf('flopCbet');
  const bTc = opts.rangeOf('turnCbet');
  if (bF && bTc && fc.den >= minOpp && tc.den >= minOpp && bTc.min !== undefined && pct(fc) > (bF.max ?? 100) - 2 && wilson(tc)![1] < bTc.min + 2) {
    out.leaks.push({
      kind: 'leak',
      title: '翻牌 CBet 很多，轉牌就放棄',
      evidence: `Flop CBet ${fmtRatio(fc)}（參考 ${rangeText(bF)}）；Turn CBet ${fmtRatio(tc)}（參考 ${rangeText(bTc)}）`,
      why: '翻牌下注很多但轉牌很少續打，對手只要翻牌跟一次就能拿走大量底池。',
      fix: '有位置時在對你不利的牌面多過牌；翻牌有下注時，轉牌拿到 equity（新聽牌、高張）就繼續打。',
      weight: 70,
      target: { type: 'stat', key: 'turnCbet' },
    });
  }

  const bbCall = lineOf('BB call', true);
  if (bbCall && bbCall.perHandSe !== null && bbCall.hands >= minOpp && bbCall.perHand + 1 + 1.96 * bbCall.perHandSe < 0) {
    out.leaks.push({
      kind: 'leak',
      title: '大盲跟注比直接棄牌還差',
      evidence: `BB call ${bbCall.hands} 手，每手 ${bbCall.perHand.toFixed(2)} ± ${(1.96 * bbCall.perHandSe).toFixed(2)} bb；大盲直接棄牌固定是 −1 bb`,
      why: '跟注後的平均結果比棄牌還差，代表跟注範圍太寬或翻後打法撐不起來。',
      fix: '先收緊對早位 open 的跟注；改善大盲翻後打法（面對 CBet 的跟注/加注範圍）。',
      weight: 75,
      target: { type: 'line', line: 'BB call', coarse: true },
    });
  }

  // --- Single-stat deviations (only those not already covered above) ---
  const covered = new Set<StatKey>(out.leaks.flatMap((l) => (l.target?.type === 'stat' ? [l.target.key] : [])));
  if (out.leaks.some((l) => l.title.startsWith('3Bet 之後'))) covered.add('foldTo4Bet');
  if (out.leaks.some((l) => l.title.startsWith('翻牌跟注'))) ['foldToTurnCbet', 'callFlopCbet', 'flopCheckRaise'].forEach((k) => covered.add(k as StatKey));
  for (const pos of ['HJ', 'CO', 'BTN']) if (out.leaks.some((l) => l.title.startsWith(`${pos} 開池太寬`))) covered.add(`rfi${pos}` as StatKey);
  if (out.leaks.some((l) => l.title.startsWith('翻牌 CBet'))) ['flopCbet', 'turnCbet'].forEach((k) => covered.add(k as StatKey));

  for (const k of STAT_KEYS) {
    const b = opts.rangeOf(k);
    const s = r.stats[k];
    if (!b || s.den < minOpp) continue;
    const o = outside(s, b);
    if (!o.dir) {
      const [lo, hi] = wilson(s)!;
      const inside = (b.min === undefined || lo >= b.min) && (b.max === undefined || hi <= b.max);
      if (inside) {
        out.strengths.push({
          kind: 'strength',
          title: `${label(k)} 在合理範圍`,
          evidence: `${fmtRatio(s)}，參考 ${rangeText(b)}`,
          weight: 50 + Math.min(40, s.den / 1000), // below result-based strengths (lines 150+, positions 200+)
          target: { type: 'stat', key: k },
        });
      }
      continue;
    }
    if (covered.has(k)) continue;
    const advice = ADVICE[k]?.[o.dir];
    if (CONTEXT_ONLY.has(k)) {
      out.info.push({ kind: 'info', title: `${label(k)} ${o.dir === 'high' ? '偏高' : '偏低'}`, evidence: `${fmtRatio(s)}，參考 ${rangeText(b)}`, why: advice?.[0], weight: 5, target: { type: 'stat', key: k } });
      continue;
    }
    const finding: Finding = {
      kind: o.strong ? 'leak' : 'watch',
      title: `${label(k)} ${o.dir === 'high' ? '偏高' : '偏低'}`,
      evidence: `${fmtRatio(s)}，參考 ${rangeText(b)}`,
      why: advice?.[0],
      fix: advice?.[1],
      weight: o.strong ? 40 + o.gap * 2 : Math.abs(pct(s) - (o.dir === 'high' ? b.max! : b.min!)),
      target: { type: 'stat', key: k },
    };
    (o.strong ? out.leaks : out.watch).push(finding);
  }

  // --- Strengths from results ---
  for (const pos of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as Position[]) {
    const row = r.byPosition[pos];
    if (row.bb100 === null || row.bb100Se === null || row.hands < minOpp * 5) continue;
    if (row.bb100 - 1.96 * row.bb100Se > 0) {
      out.strengths.push({
        kind: 'strength',
        title: `${pos} 確定在贏錢`,
        evidence: `${row.bb100.toFixed(2)} ± ${(1.96 * row.bb100Se).toFixed(1)} bb/100（${row.hands} 手），95% 區間不含 0`,
        weight: 200 + row.bb100,
        target: { type: 'position', position: pos },
      });
    }
  }
  for (const l of r.linesCoarse) {
    if (l.perHandSe === null || l.hands < 50 || l.line === 'Walk') continue;
    if (l.perHand - 1.96 * l.perHandSe > 0) {
      out.strengths.push({
        kind: 'strength',
        title: `動作線「${l.line}」穩定獲利`,
        evidence: `${l.hands} 手，每手 ${l.perHand.toFixed(2)} ± ${(1.96 * l.perHandSe).toFixed(2)} bb，合計 ${l.netBB.toFixed(1)} bb`,
        weight: 150 + l.netBB / 10,
        target: { type: 'line', line: l.line, coarse: true },
      });
    }
  }

  // --- Context ---
  if (r.bb100 !== null && r.bb100Se !== null) {
    const luck = r.netBB - r.evNetBB;
    out.info.push({
      kind: 'info',
      title: '勝率與運氣',
      evidence: `實際 ${r.bb100.toFixed(2)} ± ${(1.96 * r.bb100Se).toFixed(1)} bb/100；All-in EV ${r.evBb100?.toFixed(2) ?? '—'} bb/100；運氣 ${luck >= 0 ? '+' : ''}${luck.toFixed(1)} bb`,
      why: `誤差範圍約 ±${(1.96 * r.bb100Se).toFixed(0)} bb/100，${Math.abs(r.bb100) < 1.96 * r.bb100Se ? '目前還無法確定是贏家或輸家，' : ''}判斷打法請看上面的頻率項目，不要只看盈虧。`,
      weight: 10,
    });
  }
  const fees = r.rakeBB.rakeContrib + r.rakeBB.jackpotContrib;
  if (r.hands > 0 && per100(fees) > 4) {
    out.info.push({
      kind: 'info',
      title: '抽水是最大的固定成本',
      evidence: `rake + jackpot ${per100(fees).toFixed(2)} bb/100；扣抽水前 ${per100(r.netBB + fees).toFixed(2)} bb/100`,
      why: '抽水不是雜訊，是每手都在付的成本；返水、翻前直接贏下底池（偷盲、3Bet 讓對手棄牌）都能減少它的影響。',
      weight: 9,
    });
  }

  out.leaks.sort((a, b) => b.weight - a.weight);
  out.strengths.sort((a, b) => b.weight - a.weight);
  out.watch.sort((a, b) => b.weight - a.weight);
  return out;
}
