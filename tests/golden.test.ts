import { beforeAll, describe, expect, it } from 'vitest';
import { heroNet } from '../src/stats/accounting';
import { aggregate } from '../src/stats/aggregate';
import type { StatKey } from '../src/stats/definitions';
import { analyzeHand } from '../src/stats/facts';
import type { HandFacts, StatsResult } from '../src/stats/types';
import type { ParseResult } from '../src/parser/types';
import { fixture, hasZip, loadZip } from './helpers';

const pct = (r: { num: number; den: number }) => Math.round((r.num / r.den) * 1000) / 10;

describe('fixture facts', () => {
  it('walk is excluded from N but counted in hands', () => {
    const f = analyzeHand(fixture('RC4772225996'));
    expect(f.walk).toBe(true);
    expect(f.s).toEqual({});
    const r = aggregate([f]);
    expect(r.hands).toBe(1);
    expect(r.n).toBe(0);
    expect(r.bb100).toBeCloseTo(50);
  });

  it('open, cbet, showdown win', () => {
    const f = analyzeHand(fixture('RC4772226199'));
    expect(f.position).toBe('UTG');
    expect(f.combo).toBe('AQo');
    expect(f.s).toMatchObject({ vpip: 1, pfr: 1, sawFlop: 1, wtsd: 1, wsd: 1, wwsf: 1, flopCbet: 1, turnCbet: 0 });
    expect(f.ctx.flopCbet).toEqual({ ip: true, multiway: false });
    expect(f.potType).toBe('SRP');
  });

  it('3bet from SB then cbet and fold to turn bet', () => {
    const f = analyzeHand(fixture('RC4772175885'));
    expect(f.position).toBe('SB');
    expect(f.s).toMatchObject({ vpip: 1, pfr: 1, threeBet: 1, flopCbet: 1, turnCbet: 0 });
    expect(f.potType).toBe('3BP');
    expect(f.ctx.flopCbet).toEqual({ ip: false, multiway: false });
  });
});

describe.skipIf(!hasZip)('golden values (PRD §7)', () => {
  let parsed: ParseResult;
  let facts: HandFacts[];
  let r: StatsResult;
  beforeAll(async () => {
    parsed = await loadZip();
    facts = parsed.hands.map(analyzeHand);
    r = aggregate(facts, {}, { low: 125, high: 175, basis: 'hero' });
  });

  it('§7.1 hands and net must match exactly', () => {
    expect(r.hands).toBe(7880);
    expect(r.walks).toBe(230);
    expect(r.n).toBe(7650);
    expect(r.netCents).toBe(-3092);
    expect(r.netBB).toBeCloseTo(-309.2, 6);
    expect(r.bb100!.toFixed(2)).toBe('-3.92');
    const other = parsed.otherGames.reduce((a, h) => a + heroNet(h), 0);
    expect(r.netCents + other).toBe(-3082);
  });

  // 2026-10-04 definition fixes (PRD §7.1 updated with the reasons):
  //  limp/coldCall now use opportunities as denominator, BB defence split into bbCallVsOpen;
  //  turn/river CBet and Fold to Turn CBet stop counting once the previous street's CBet was raised.
  const ratios: [StatKey, number, number][] = [
    ['vpip', 2211, 7650],
    ['pfr', 1748, 7650],
    ['rfi', 1394, 4156],
    ['rfiUTG', 236, 1318],
    ['rfiHJ', 280, 1041],
    ['rfiCO', 297, 832],
    ['rfiBTN', 406, 590],
    ['rfiSB', 175, 375],
    ['limp', 4, 4209],
    ['coldCall', 67, 2146],
    ['bbCallVsOpen', 390, 880],
    ['threeBet', 321, 3029],
    ['foldTo3Bet', 212, 316],
    ['call3Bet', 73, 316],
    ['fourBet', 38, 686],
    ['foldTo4Bet', 51, 67],
    ['ats', 878, 1797],
    ['foldToSteal', 545, 868],
    ['threeBetVsSteal', 90, 868],
    ['squeeze', 19, 257],
    ['sawFlop', 1138, 7650],
    ['wtsd', 335, 1138],
    ['wsd', 182, 335],
    ['wwsf', 520, 1138],
    ['afq', 771, 1616],
    ['flopCbet', 376, 540],
    ['turnCbet', 72, 193],
    ['riverCbet', 8, 27],
    ['foldToFlopCbet', 126, 312],
    ['raiseFlopCbet', 22, 312],
    ['foldToTurnCbet', 48, 77],
    ['flopCheckRaise', 15, 304],
    ['donkBet', 17, 424],
  ];
  it.each(ratios)('§7.1 %s = %i / %i', (key, num, den) => {
    expect(r.stats[key]).toEqual({ num, den });
  });

  it('§7.1 AF', () => {
    expect((r.af.num / r.af.den).toFixed(2)).toBe('2.03');
  });

  // UTG 3Bet: the PRD table said "—", but by §5.2 / §11.2 (limp then face a raise counts) there is exactly
  // one opportunity (RC4803401952: UTG limp, BB raises, Hero folds) → 0/1. §7.1's 3029 already includes it.
  const byPos: [string, number, string, number, number, number][] = [
    ['UTG', 1318, '-3.80', 18.0, 17.9, 0.0],
    ['HJ', 1305, '10.60', 24.6, 24.4, 15.3],
    ['CO', 1289, '20.70', 28.0, 27.5, 12.5],
    ['BTN', 1320, '16.98', 38.9, 38.2, 14.2],
    ['SB', 1320, '-12.13', 21.9, 17.9, 7.2],
    ['BB', 1328, '-54.84', 44.6, 9.0, 8.8],
  ];
  it.each(byPos)('§7.2 %s', (pos, hands, bb100, vpip, pfr, threeBet) => {
    const row = r.byPosition[pos as keyof StatsResult['byPosition']];
    expect(row.hands).toBe(hands);
    expect(row.bb100!.toFixed(2)).toBe(bb100);
    expect(pct(row.stats.vpip)).toBe(vpip);
    expect(pct(row.stats.pfr)).toBe(pfr);
    expect(pct(row.stats.threeBet)).toBe(threeBet);
    if (pos === 'UTG') expect(row.stats.threeBet).toEqual({ num: 0, den: 1 });
  });

  const byStack: [string, number, string, number, number, number][] = [
    ['S100', 4590, '-9.95', 30.9, 23.8, 11.3],
    ['S150', 1522, '-2.65', 26.6, 22.0, 9.9],
    ['S200', 1768, '10.63', 25.8, 21.1, 9.4],
  ];
  it.each(byStack)('§7.3 %s', (g, hands, bb100, vpip, pfr, threeBet) => {
    const row = r.byStack[g as keyof StatsResult['byStack']];
    expect(row.hands).toBe(hands);
    expect(row.bb100!.toFixed(2)).toBe(bb100);
    expect(pct(row.stats.vpip)).toBe(vpip);
    expect(pct(row.stats.pfr)).toBe(pfr);
    expect(pct(row.stats.threeBet)).toBe(threeBet);
  });

  // Default grouping is by effective stack (Hero vs the deepest opponent still involved).
  const byEff: [string, number, string, number, number, number][] = [
    ['S100', 5551, '-13.25', 1793, 1391, 975],
    ['S150', 1456, '5.95', 276, 231, 111],
    ['S200', 873, '38.91', 142, 126, 52],
  ];
  it.each(byEff)('§7.3b effective %s', (g, hands, bb100, vpip, pfr, sawFlop) => {
    const row = aggregate(facts).byStack[g as keyof StatsResult['byStack']];
    expect(row.hands).toBe(hands);
    expect(row.bb100!.toFixed(2)).toBe(bb100);
    expect(row.stats.vpip.num).toBe(vpip);
    expect(row.stats.pfr.num).toBe(pfr);
    expect(row.stats.sawFlop.num).toBe(sawFlop);
  });

  it('pot type filter only keeps hands where Hero saw the flop', () => {
    const srp = aggregate(facts, { potTypes: ['SRP'] });
    expect(srp.hands).toBe(885);
    expect(srp.stats.sawFlop).toEqual({ num: 885, den: 885 });
  });

  it('range grid excludes walks', () => {
    const bb = aggregate(facts, { positions: ['BB'] });
    const dealt = Object.values(bb.grid).reduce((a, c) => a + c.dealt, 0);
    const vpip = Object.values(bb.grid).reduce((a, c) => a + c.vpip, 0);
    expect(dealt).toBe(bb.stats.vpip.den);
    expect(vpip).toBe(bb.stats.vpip.num);
  });
});
