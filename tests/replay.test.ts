import { describe, expect, it } from 'vitest';
import { buildReplay } from '../src/stats/replay';
import { fixture } from './helpers';

describe('buildReplay', () => {
  it('tracks the pot street by street (RC4772226199)', () => {
    const r = buildReplay(fixture('RC4772226199'));
    expect(r.streets.map((s) => s.street)).toEqual(['PRE', 'FLOP', 'TURN', 'RIVER']);
    const pre = r.streets[0];
    const heroOpen = pre.actions.find((a) => a.isHero)!;
    expect(heroOpen).toMatchObject({ verb: '加注到 raise to', amountBB: 2.2, potBB: 3.7 });
    expect(r.streets[1].newCards).toEqual(['4s', 'Kh', '6h']);
    expect(r.streets[2].newCards).toEqual(['6c']);
    const last = r.streets[3].actions.at(-1)!;
    expect(last.potBB).toBeCloseTo(r.totalPotBB, 10);
    expect(r.heroNetBB).toBeCloseTo(4, 10);
    expect(r.players.find((p) => p.isHero)?.cards).toEqual(['Qc', 'Ad']);
    expect(r.players.find((p) => p.name === 'd1295ea7')?.cards).toEqual(['As', 'Js']);
  });

  it('cash drop starts in the pot; uncalled bet is listed', () => {
    const r = buildReplay(fixture('RC4772175885'));
    expect(r.streets[0].potStartBB).toBe(10);
    expect(r.uncalled).toEqual([{ player: '199ba188', bb: 16.9 }]);
  });

  it('streets dealt after a preflop all-in still appear', () => {
    const r = buildReplay(fixture('RC4772496598'));
    expect(r.streets.map((s) => s.street)).toEqual(['PRE', 'FLOP', 'TURN', 'RIVER']);
    expect(r.streets.slice(1).every((s) => s.actions.length === 0)).toBe(true);
  });

  it('run it twice keeps both boards', () => {
    const r = buildReplay(fixture('RC4772496852'));
    expect(r.runItTwice).toBe(true);
    expect(r.boards).toHaveLength(2);
    expect(r.collected).toHaveLength(2);
  });
});
